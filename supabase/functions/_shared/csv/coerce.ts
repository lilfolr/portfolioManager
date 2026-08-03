// Turning source text into canonical values. Pure: no IO, no Date.now().
//
// Every function returns a result rather than throwing, because a bad cell is
// an ordinary outcome of importing someone's broker export -- it becomes an
// issue on one row, not a failure of the whole file.

import { D } from "../engine/decimal.ts";
import type { DateFormat, IssueCode, TransactionType } from "./types.ts";

export type CoerceResult =
  | { ok: true; value: string | null }
  | { ok: false; code: IssueCode; message: string };

const ok = (value: string | null): CoerceResult => ({ ok: true, value });
const bad = (code: IssueCode, message: string): CoerceResult => ({
  ok: false,
  code,
  message,
});

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

/** Case-, space- and punctuation-insensitive header key, so "Trade Date",
 * "trade_date" and "TRADE-DATE" are the same column. */
export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Decimals
// ---------------------------------------------------------------------------

const DECIMAL_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/**
 * A money or quantity cell. Returns the cleaned decimal *string*, never a
 * number -- CLAUDE.md's money rule, and the reason eslint bans parseFloat on
 * the client side. The value goes into parsed_payload as text and is cast to
 * numeric by confirm_staged_row(), where the precision is real.
 *
 * Handles the things broker exports actually contain: thousands separators,
 * a currency symbol, surrounding whitespace, and accounting-style parentheses
 * for negatives. Scientific notation is rejected rather than expanded -- it
 * does not appear in a contract note, so seeing it means something upstream
 * has already been through a float.
 */
export function coerceDecimal(raw: string): CoerceResult {
  let text = raw.trim();
  if (text === "") return ok(null);

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1).trim();
  }

  text = text.replace(/[$\s]/g, "").replace(/,/g, "");

  if (text === "") return ok(null);
  if (!DECIMAL_RE.test(text)) {
    return bad(
      "unparseable_decimal",
      `"${raw.trim()}" is not a number the ledger can store`,
    );
  }

  // Normalise sign and strip a redundant leading '+' without touching the
  // scale: "10.00" stays "10.00" so the source's own precision survives into
  // the staged row.
  if (text.startsWith("+")) text = text.slice(1);
  if (negative) text = text.startsWith("-") ? text : `-${text}`;

  // A last check through Decimal catches anything the regex admits but the
  // arithmetic cannot represent.
  try {
    D(text);
  } catch {
    return bad("unparseable_decimal", `"${raw.trim()}" is not a valid decimal`);
  }

  return ok(text);
}

/** Canonical form for comparison -- "10", "10.00" and "+10" all collapse to
 * the same string. Used for dedupe keys, never for storage. */
export function canonicalDecimal(value: string | null): string {
  if (value === null || value.trim() === "") return "";
  try {
    return D(value).toString();
  } catch {
    return value.trim();
  }
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// An ISO datetime, with or without an explicit offset.
const ISO_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;
// Day/month/year in either order, 1-2 digit components, 2 or 4 digit year,
// with an optional trailing time that we deliberately ignore.
const NUMERIC_DATE_RE =
  /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})(?:[T ,]\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)?$/;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Is this a real calendar date? Rejects 2026-02-30 and friends. */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * The calendar date an instant falls on in a given zone.
 *
 * Intl rather than arithmetic because the offset depends on the date (daylight
 * saving), so there is no fixed number of hours to add. `-u-ca-iso8601` pins
 * the calendar to proleptic Gregorian so a locale default cannot introduce an
 * era or a different year numbering.
 */
export function dateInZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-iso8601", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year").padStart(4, "0")}-${get("month")}-${get("day")}`;
}

/** Throws for an unknown IANA zone, so a bad profile fails loudly at load
 * rather than silently importing everything a day out. */
export function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error(`unknown IANA time zone: ${timeZone}`);
  }
}

/**
 * A trade or settlement date.
 *
 * The target is always the **source's local calendar date, never UTC**.
 * `transactions.trade_date` is a Postgres `date` -- the ledger has no time
 * component anywhere -- and `financial_year` is generated from it. Normalising
 * to UTC would be an active bug: a trade at 1 Jul 09:30 AEST is 30 Jun 23:30
 * in UTC, which moves it into the previous financial year and changes a tax
 * outcome. CGT uses the contract date as the calendar date in the market's own
 * timezone, so that is what we store.
 *
 * Three cases:
 *   - a bare date is taken as written;
 *   - a timestamp *with* an offset is converted into `timeZone` and reduced to
 *     the date there (this is the only case where the zone does real work);
 *   - a timestamp *without* an offset is already source-local wall clock, so
 *     the time is simply discarded.
 */
export function coerceDate(
  raw: string,
  format: DateFormat,
  timeZone: string,
): CoerceResult {
  const text = raw.trim();
  if (text === "") return ok(null);

  const isoDate = ISO_DATE_RE.exec(text);
  if (isoDate) {
    const [, y, m, d] = isoDate;
    if (!isRealDate(Number(y), Number(m), Number(d))) {
      return bad("unparseable_date", `"${text}" is not a real calendar date`);
    }
    return ok(`${y}-${m}-${d}`);
  }

  const isoDateTime = ISO_DATETIME_RE.exec(text);
  if (isoDateTime) {
    const [, y, m, d, , , , offset] = isoDateTime;
    if (!isRealDate(Number(y), Number(m), Number(d))) {
      return bad("unparseable_date", `"${text}" is not a real calendar date`);
    }
    if (!offset) {
      // Local wall clock at the source. The date is what it says.
      return ok(`${y}-${m}-${d}`);
    }
    const instant = new Date(text.replace(" ", "T"));
    if (Number.isNaN(instant.getTime())) {
      return bad("unparseable_date", `"${text}" is not a valid timestamp`);
    }
    return ok(dateInZone(instant, timeZone));
  }

  const numeric = NUMERIC_DATE_RE.exec(text);
  if (numeric) {
    if (format === "ISO") {
      return bad(
        "unparseable_date",
        `"${text}" is not an ISO date (expected YYYY-MM-DD)`,
      );
    }
    // The three leading groups are non-optional in the pattern, so the
    // defaults are unreachable; they are here because this module is compiled
    // under noUncheckedIndexedAccess, where a capture group reads as
    // `string | undefined`.
    const [, first = "", second = "", yearText = ""] = numeric;
    const day = format === "DMY" ? Number(first) : Number(second);
    const month = format === "DMY" ? Number(second) : Number(first);
    const year = expandYear(yearText);
    if (!isRealDate(year, month, day)) {
      return bad("unparseable_date", `"${text}" is not a real calendar date`);
    }
    return ok(`${year}-${pad(month)}-${pad(day)}`);
  }

  return bad("unparseable_date", `"${text}" is not a date this profile reads`);
}

/** Two-digit years: 00-69 are 2000s, 70-99 are 1900s. The POSIX convention,
 * and the one every spreadsheet uses. */
function expandYear(text: string): number {
  const value = Number(text);
  if (text.length === 4) return value;
  return value < 70 ? 2000 + value : 1900 + value;
}

// ---------------------------------------------------------------------------
// Enums and codes
// ---------------------------------------------------------------------------

const TRANSACTION_TYPES: readonly TransactionType[] = [
  "BUY",
  "SELL",
  "DRP",
  "DIVIDEND",
  "DISTRIBUTION",
  "SPLIT",
  "CONSOLIDATION",
  "RETURN_OF_CAPITAL",
  "DEMERGER",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "INTEREST",
  "EXPENSE",
];

const TYPE_BY_KEY = new Map<string, TransactionType>(
  TRANSACTION_TYPES.map((type) => [normaliseHeader(type), type]),
);

/**
 * A transaction type. Matched on the same normalisation headers use, so
 * "return of capital", "RETURN_OF_CAPITAL" and "ReturnOfCapital" all resolve.
 *
 * Nothing is inferred beyond that -- no mapping of "Buy 500 CBA" or a
 * direction column onto a type. A source that needs it declares it in its own
 * profile's transformRow, where the assumption is visible and versioned,
 * rather than having this function guess for every source at once.
 */
export function coerceTransactionType(raw: string): CoerceResult {
  const text = raw.trim();
  if (text === "") return ok(null);
  const match = TYPE_BY_KEY.get(normaliseHeader(text));
  if (!match) {
    return bad(
      "unknown_transaction_type",
      `"${text}" is not a transaction type the ledger has`,
    );
  }
  return ok(match);
}

export function isTransactionType(value: string): value is TransactionType {
  return TYPE_BY_KEY.has(normaliseHeader(value));
}

const CURRENCY_RE = /^[A-Za-z]{3}$/;

export function coerceCurrency(raw: string): CoerceResult {
  const text = raw.trim();
  if (text === "") return ok(null);
  if (!CURRENCY_RE.test(text)) {
    return bad("invalid_currency", `"${text}" is not a 3-letter currency code`);
  }
  return ok(text.toUpperCase());
}

export function coerceText(raw: string): CoerceResult {
  const text = raw.trim();
  return ok(text === "" ? null : text);
}
