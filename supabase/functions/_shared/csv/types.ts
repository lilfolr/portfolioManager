// Types for the CSV import mapper. Same contract as the parcel engine's
// types.ts: dependency-free, no IO, no Date.now(). The mapper must stay a pure
// function of (file text, profile, context) => staged rows so it can be tested
// with known files in and asserted rows out.
//
// Money and quantity are decimal *strings* throughout, exactly as in the
// engine. A JSON number here would reintroduce the float precision loss that
// the ::text casts in the views exist to prevent -- confirm_staged_row() casts
// these strings to numeric in SQL, where the precision is real.

import type { TransactionType } from "../engine/types.ts";

export type { TransactionType };

/** A field the ledger understands. Import profiles map source columns onto
 * these; nothing else reaches parsed_payload. */
export type CanonicalField =
  | "type"
  | "trade_date"
  | "settlement_date"
  | "symbol"
  | "exchange"
  | "quantity"
  | "unit_price"
  | "brokerage"
  | "fees"
  | "currency"
  | "fx_rate_to_aud"
  | "external_ref";

export type IssueCode =
  | "missing_required"
  | "unparseable_date"
  | "unparseable_decimal"
  | "unknown_transaction_type"
  | "unknown_instrument"
  | "ambiguous_instrument"
  | "invalid_currency"
  | "invalid_quantity"
  | "ragged_row"
  | "duplicate_suspected";

/**
 * One thing wrong (or worth saying) about one row.
 *
 * `blocking` is the whole point of the shape: a row that cannot be turned into
 * a valid transaction must never reach the ledger, while a row that merely
 * looks like something already imported is the user's call to make. CLAUDE.md
 * rule 4 -- the app computes, the user decides -- so duplicate suspicion is
 * emphatically not blocking.
 */
export interface Issue {
  code: IssueCode;
  field: CanonicalField | null;
  message: string;
  blocking: boolean;
}

/**
 * Exactly the keys confirm_staged_row() reads out of parsed_payload. Every
 * value is a string or null; the RPC does the casting.
 */
export interface ParsedPayload {
  account_id: string;
  instrument_id: string | null;
  type: TransactionType;
  trade_date: string; // YYYY-MM-DD
  settlement_date: string | null;
  quantity: string | null;
  unit_price: string | null;
  brokerage: string;
  fees: string;
  currency: string;
  fx_rate_to_aud: string;
  external_ref: string | null;
}

export interface MappedRow {
  /** Physical 1-based line number in the source file, so provenance reads
   * "commsec-2024-fy.csv · row 118" and that number is the line a person sees
   * when they open the file. Blank lines are counted, not skipped. */
  row_number: number;
  /** The source cells, keyed by their original header. Retained verbatim:
   * CLAUDE.md rule 6, a bad parse must be reprocessable without the user. */
  raw_payload: Record<string, string>;
  /** Null when the row carries a blocking issue and could not be resolved. */
  parsed_payload: ParsedPayload | null;
  issues: Issue[];
  dedupe_key: string | null;
}

export type DateFormat = "ISO" | "DMY" | "MDY";

/** How a column's text becomes a canonical value. */
export type ColumnKind =
  | "date"
  | "decimal"
  | "text"
  | "currency"
  | "transaction_type";

export interface ColumnMapping {
  field: CanonicalField;
  /** Header names this column answers to, matched case-, space- and
   * punctuation-insensitively (see normaliseHeader). */
  aliases: string[];
  kind: ColumnKind;
  /** A missing or blank value is a blocking issue. Type-dependent
   * requirements (a BUY needs a quantity) are handled in map.ts instead,
   * because they cannot be expressed per-column. */
  required?: boolean;
  /** Used when the column is absent or blank and not required. */
  fallback?: string;
}

export interface ImportProfile {
  /** Stable identifier; half of parser_version. */
  id: string;
  /** Bump when a change to this profile would parse an old file differently.
   * parser_version is written as `{id}@{version}` so a reprocess pass can tell
   * which files predate a fix. */
  version: number;
  label: string;
  dateFormat: DateFormat;
  /**
   * IANA zone of the venue the file came from, e.g. "Australia/Sydney" for a
   * local broker, "America/New_York" for a US one.
   *
   * This is not about storing times -- the ledger has no time component at
   * all. It is about which calendar date a *timestamp* belongs to. See
   * coerce.ts: the target is always the source's local calendar date, never
   * UTC, because a trade at 1 Jul 09:00 AEST is 30 Jun in UTC and moving it
   * there would change its financial year.
   */
  sourceTimeZone: string;
  columns: ColumnMapping[];
  /** Used when no exchange column is present. */
  defaultExchange: string;
  /** 0..1 confidence that this profile suits the given headers. */
  detect(headers: string[]): number;
  /**
   * Escape hatch for sources that need more than a column rename -- a broker
   * that encodes buy/sell in a "Direction" column, or splits brokerage across
   * two. Runs on the raw row before column mapping. Native does not use it;
   * it exists so adding CommSec is a new file rather than a change here.
   */
  transformRow?(raw: Record<string, string>): Record<string, string>;
}

export interface InstrumentRef {
  id: string;
  symbol: string;
  exchange: string;
}

/** Everything the mapper needs from the database, passed in rather than
 * fetched, so the module stays pure. */
export interface MapContext {
  /** The destination account, chosen by the user at import time. Applied to
   * every row: a real UUID, never a display name. */
  accountId: string;
  instruments: InstrumentRef[];
  /** dedupe_key -> a human-facing reference for what it already matches,
   * e.g. "T-3f2a91c4". Presence raises a non-blocking duplicate warning. */
  existingDedupeKeys?: Map<string, string>;
}

export interface HeaderMapping {
  header: string;
  field: CanonicalField | null;
}

export interface MapTotals {
  rows: number;
  ok: number;
  warning: number;
  blocking: number;
}

export interface MapResult {
  profileId: string;
  parserVersion: string;
  headerMapping: HeaderMapping[];
  unmappedHeaders: string[];
  /** Canonical fields the profile declares but the file does not supply. */
  missingColumns: CanonicalField[];
  rows: MappedRow[];
  totals: MapTotals;
}
