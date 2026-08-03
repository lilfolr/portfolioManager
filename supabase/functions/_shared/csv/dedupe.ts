// Duplicate detection keys.
//
// CLAUDE.md: "Duplicate detection matters: the same trade will arrive via both
// CSV and email." This produces the key both paths compute, so the second
// arrival can be recognised.
//
// Advisory only. A key collision raises a non-blocking issue naming what it
// matched; it never skips a row. Two genuinely separate parcels bought at the
// same price on the same day are indistinguishable from a double import by
// their fields alone, and guessing wrong in either direction changes a cost
// base. CLAUDE.md rule 4: the app computes, the user decides.

import { canonicalDecimal } from "./coerce.ts";
import type { ParsedPayload } from "./types.ts";

export type DedupeInput = Pick<
  ParsedPayload,
  | "account_id"
  | "instrument_id"
  | "type"
  | "trade_date"
  | "quantity"
  | "unit_price"
  | "external_ref"
>;

/**
 * Stable across parser versions and sources, which is the whole requirement --
 * a key that changed shape between the CSV and the email path would never
 * match.
 *
 * A broker reference wins when present: it identifies the trade exactly, and
 * two fills of the same size at the same price on the same day are a real
 * thing that field-matching would wrongly collapse. Scoped by account, because
 * two brokers can and do issue the same confirmation number.
 */
export function dedupeKey(input: DedupeInput): string {
  const ref = input.external_ref?.trim();
  if (ref) return `ref:${input.account_id}:${ref.toUpperCase()}`;

  return [
    "txn",
    input.account_id,
    input.instrument_id ?? "",
    input.type,
    input.trade_date,
    canonicalDecimal(input.quantity),
    canonicalDecimal(input.unit_price),
  ].join(":");
}
