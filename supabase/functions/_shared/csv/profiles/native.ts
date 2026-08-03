// The identity profile: a file whose columns already match the ledger.
//
// This is the only profile Phase 1 ships. It exists as a profile rather than
// as hardcoded column handling so that adding CommSec, Stake, Selfwealth or
// Pearler later is a new file in this directory plus a line in index.ts --
// nothing in map.ts, the edge function or the UI changes.
//
// A broker profile differs from this one in three places and no others: the
// `aliases` on each column, `dateFormat`/`sourceTimeZone`, and an optional
// `transformRow` for sources that encode something across columns rather than
// in one.

import { normaliseHeader } from "../coerce.ts";
import type { CanonicalField, ImportProfile } from "../types.ts";

const CANONICAL: CanonicalField[] = [
  "type",
  "trade_date",
  "settlement_date",
  "symbol",
  "exchange",
  "quantity",
  "unit_price",
  "brokerage",
  "fees",
  "currency",
  "fx_rate_to_aud",
  "external_ref",
];

export const nativeProfile: ImportProfile = {
  id: "native",
  version: 1,
  label: "Native — columns match the ledger",
  dateFormat: "ISO",
  // Australian listed holdings are the Phase 1 scope, so a bare date in a
  // native file is a Sydney calendar date. Only matters for a cell that
  // carries an explicit UTC offset; see coerce.ts.
  sourceTimeZone: "Australia/Sydney",
  defaultExchange: "ASX",

  columns: [
    { field: "type", aliases: ["type"], kind: "transaction_type", required: true },
    { field: "trade_date", aliases: ["trade_date", "date"], kind: "date", required: true },
    { field: "settlement_date", aliases: ["settlement_date"], kind: "date" },
    { field: "symbol", aliases: ["symbol", "code", "ticker"], kind: "text" },
    { field: "exchange", aliases: ["exchange", "market"], kind: "text" },
    { field: "quantity", aliases: ["quantity", "units"], kind: "decimal" },
    { field: "unit_price", aliases: ["unit_price", "price"], kind: "decimal" },
    { field: "brokerage", aliases: ["brokerage", "commission"], kind: "decimal", fallback: "0" },
    { field: "fees", aliases: ["fees"], kind: "decimal", fallback: "0" },
    { field: "currency", aliases: ["currency"], kind: "currency", fallback: "AUD" },
    { field: "fx_rate_to_aud", aliases: ["fx_rate_to_aud", "fx_rate"], kind: "decimal", fallback: "1" },
    { field: "external_ref", aliases: ["external_ref", "reference", "confirmation"], kind: "text" },
  ],

  /**
   * Confidence is the share of canonical field names appearing verbatim in the
   * headers. A native file scores near 1; a broker export that happens to have
   * a "Date" and a "Quantity" column scores low enough that a dedicated
   * profile will outrank it once one exists.
   */
  detect(headers: string[]): number {
    if (headers.length === 0) return 0;
    const present = new Set(headers.map(normaliseHeader));
    const hits = CANONICAL.filter((field) =>
      present.has(normaliseHeader(field))
    ).length;
    // type and trade_date are the two columns nothing can be imported without.
    const hasEssentials =
      present.has(normaliseHeader("type")) &&
      present.has(normaliseHeader("trade_date"));
    if (!hasEssentials) return 0;
    return hits / CANONICAL.length;
  },
};
