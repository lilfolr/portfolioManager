// Source rows -> staged rows. The heart of the import path, and pure: no IO,
// no database, no clock. Everything it needs about the user's ledger arrives
// in MapContext.
//
// Two invariants it must never break, both learned from the manual-entry
// defect documented at src/features/transaction-entry/payload.ts:147 -- where
// the form sends an account *display name* and a DD/MM/YYYY string, and every
// save fails at confirm_staged_row's casts:
//
//   1. account_id and instrument_id are real UUIDs, resolved here.
//   2. trade_date is YYYY-MM-DD.
//
// A row that cannot satisfy both gets a blocking issue and a null
// parsed_payload rather than a payload that will explode at confirm time.

import { D } from "../engine/decimal.ts";
import {
  coerceCurrency,
  coerceDate,
  coerceDecimal,
  coerceText,
  coerceTransactionType,
  normaliseHeader,
  type CoerceResult,
} from "./coerce.ts";
import { dedupeKey } from "./dedupe.ts";
import { parserVersion } from "./profiles/index.ts";
import type { CsvRecord } from "./tokenize.ts";
import type {
  CanonicalField,
  ColumnMapping,
  HeaderMapping,
  ImportProfile,
  Issue,
  MapContext,
  MappedRow,
  MapResult,
  ParsedPayload,
  TransactionType,
} from "./types.ts";

// ---------------------------------------------------------------------------
// What each transaction type needs.
//
// These mirror what the parcel engine will throw on (see engine.ts) and what
// confirm_staged_row's NOT NULL columns require. Catching them here turns a
// 500 at confirm time into a row the user can see and fix before anything
// reaches the ledger.
// ---------------------------------------------------------------------------

/** Everything except the two cash-only types carries an instrument. */
const NO_INSTRUMENT: ReadonlySet<TransactionType> = new Set([
  "INTEREST",
  "EXPENSE",
]);

/** Types that move units, so a quantity is mandatory and must be positive. */
const NEEDS_QUANTITY: ReadonlySet<TransactionType> = new Set([
  "BUY",
  "SELL",
  "DRP",
  "TRANSFER_IN",
  "TRANSFER_OUT",
]);

/** Types where unit_price is mandatory. SPLIT and CONSOLIDATION are here
 * because the engine reads unit_price as the ratio, not as a price. */
const NEEDS_UNIT_PRICE: ReadonlySet<TransactionType> = new Set([
  "BUY",
  "SELL",
  "DRP",
  "SPLIT",
  "CONSOLIDATION",
]);

// ---------------------------------------------------------------------------
// Header resolution
// ---------------------------------------------------------------------------

interface ResolvedColumn {
  mapping: ColumnMapping;
  /** The source header this column matched, or null if the file lacks it. */
  header: string | null;
  index: number;
}

function resolveColumns(
  headers: string[],
  profile: ImportProfile,
): ResolvedColumn[] {
  const normalised = headers.map(normaliseHeader);

  return profile.columns.map((mapping) => {
    // The canonical field name is always an implicit alias, so a profile need
    // only list the ones that differ.
    const keys = new Set(
      [mapping.field, ...mapping.aliases].map(normaliseHeader),
    );
    const index = normalised.findIndex((header) => keys.has(header));
    return {
      mapping,
      header: index === -1 ? null : (headers[index] ?? null),
      index,
    };
  });
}

// ---------------------------------------------------------------------------
// Instrument resolution
// ---------------------------------------------------------------------------

interface InstrumentIndex {
  bySymbolExchange: Map<string, string>;
  bySymbol: Map<string, string[]>;
}

function indexInstruments(context: MapContext): InstrumentIndex {
  const bySymbolExchange = new Map<string, string>();
  const bySymbol = new Map<string, string[]>();

  for (const instrument of context.instruments) {
    const symbol = instrument.symbol.trim().toUpperCase();
    const exchange = instrument.exchange.trim().toUpperCase();
    bySymbolExchange.set(`${symbol}|${exchange}`, instrument.id);
    const bucket = bySymbol.get(symbol);
    if (bucket) bucket.push(instrument.id);
    else bySymbol.set(symbol, [instrument.id]);
  }

  return { bySymbolExchange, bySymbol };
}

/**
 * Symbol (+ exchange) -> instrument UUID.
 *
 * When the file gives no exchange, the profile's default is tried first and
 * only then a symbol-only lookup. A symbol listed on two exchanges with no
 * exchange column is left blocking rather than guessed: picking one would
 * silently attach a parcel to the wrong instrument, which is exactly the kind
 * of error that is invisible until a tax pack is wrong.
 */
function resolveInstrument(
  symbol: string | null,
  exchange: string | null,
  profile: ImportProfile,
  index: InstrumentIndex,
): { id: string | null; issue: Issue | null } {
  if (!symbol) {
    return {
      id: null,
      issue: issue(
        "missing_required",
        "symbol",
        "This transaction type needs a symbol",
        true,
      ),
    };
  }

  const upperSymbol = symbol.toUpperCase();

  if (exchange) {
    const id = index.bySymbolExchange.get(
      `${upperSymbol}|${exchange.toUpperCase()}`,
    );
    if (id) return { id, issue: null };
    return {
      id: null,
      issue: issue(
        "unknown_instrument",
        "symbol",
        `${upperSymbol} is not a known instrument on ${exchange.toUpperCase()}`,
        true,
      ),
    };
  }

  const viaDefault = index.bySymbolExchange.get(
    `${upperSymbol}|${profile.defaultExchange.toUpperCase()}`,
  );
  if (viaDefault) return { id: viaDefault, issue: null };

  const candidates = index.bySymbol.get(upperSymbol) ?? [];
  const only = candidates.length === 1 ? candidates[0] : undefined;
  if (only) return { id: only, issue: null };
  if (candidates.length > 1) {
    return {
      id: null,
      issue: issue(
        "ambiguous_instrument",
        "symbol",
        `${upperSymbol} is listed on more than one exchange; add an exchange column`,
        true,
      ),
    };
  }
  return {
    id: null,
    issue: issue(
      "unknown_instrument",
      "symbol",
      `${upperSymbol} is not a known instrument`,
      true,
    ),
  };
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function issue(
  code: Issue["code"],
  field: CanonicalField | null,
  message: string,
  blocking: boolean,
): Issue {
  return { code, field, message, blocking };
}

function coerceCell(
  mapping: ColumnMapping,
  raw: string,
  profile: ImportProfile,
): CoerceResult {
  switch (mapping.kind) {
    case "date":
      return coerceDate(raw, profile.dateFormat, profile.sourceTimeZone);
    case "decimal":
      return coerceDecimal(raw);
    case "currency":
      return coerceCurrency(raw);
    case "transaction_type":
      return coerceTransactionType(raw);
    case "text":
      return coerceText(raw);
  }
}

export interface MapRowsArgs {
  headers: string[];
  records: CsvRecord[];
  profile: ImportProfile;
  context: MapContext;
}

export function mapRows(args: MapRowsArgs): MapResult {
  const { headers, records, profile, context } = args;

  const columns = resolveColumns(headers, profile);
  const instrumentIndex = indexInstruments(context);
  const matchedHeaders = new Set(
    columns.filter((c) => c.header !== null).map((c) => c.header as string),
  );

  const headerMapping: HeaderMapping[] = headers.map((header) => {
    const column = columns.find((c) => c.header === header);
    return { header, field: column ? column.mapping.field : null };
  });

  // Keys seen earlier in *this* file, so a line repeated within one export is
  // flagged the same way as one that collides with the existing ledger.
  const seenInFile = new Map<string, number>();

  const rows: MappedRow[] = records.map((record) =>
    mapRecord(record, {
      headers,
      columns,
      profile,
      context,
      instrumentIndex,
      seenInFile,
    })
  );

  const totals = {
    rows: rows.length,
    ok: rows.filter((row) => row.issues.length === 0).length,
    warning: rows.filter(
      (row) => row.issues.length > 0 && !row.issues.some((i) => i.blocking),
    ).length,
    blocking: rows.filter((row) => row.issues.some((i) => i.blocking)).length,
  };

  return {
    profileId: profile.id,
    parserVersion: parserVersion(profile),
    headerMapping,
    unmappedHeaders: headers.filter((header) => !matchedHeaders.has(header)),
    missingColumns: columns
      .filter((column) => column.header === null)
      .map((column) => column.mapping.field),
    rows,
    totals,
  };
}

interface MapRecordDeps {
  headers: string[];
  columns: ResolvedColumn[];
  profile: ImportProfile;
  context: MapContext;
  instrumentIndex: InstrumentIndex;
  seenInFile: Map<string, number>;
}

function mapRecord(record: CsvRecord, deps: MapRecordDeps): MappedRow {
  const { headers, columns, profile, context, instrumentIndex, seenInFile } =
    deps;
  const issues: Issue[] = [];

  // --- raw payload -------------------------------------------------------
  // Retained verbatim (CLAUDE.md rule 6). Cells beyond the header row are kept
  // under a positional key rather than dropped, so a reprocess after a header
  // fix still has them.
  const raw: Record<string, string> = {};
  headers.forEach((header, index) => {
    raw[header] = record.cells[index] ?? "";
  });
  for (let i = headers.length; i < record.cells.length; i++) {
    raw[`column_${i + 1}`] = record.cells[i] ?? "";
  }

  if (record.cells.length !== headers.length) {
    issues.push(
      issue(
        "ragged_row",
        null,
        `Row has ${record.cells.length} cells but the header has ${headers.length}`,
        // Not blocking on its own: a trailing empty column is common and the
        // per-field checks below will catch anything that actually went
        // missing.
        false,
      ),
    );
  }

  const source = profile.transformRow ? profile.transformRow(raw) : raw;

  // --- per-column coercion ------------------------------------------------
  const values = new Map<CanonicalField, string | null>();

  for (const column of columns) {
    const { mapping, header } = column;
    const cell = header === null ? "" : (source[header] ?? "");
    const result = coerceCell(mapping, cell, profile);

    if (!result.ok) {
      issues.push(issue(result.code, mapping.field, result.message, true));
      values.set(mapping.field, null);
      continue;
    }

    let value = result.value;
    if (value === null && mapping.fallback !== undefined) {
      value = mapping.fallback;
    }
    if (value === null && mapping.required) {
      issues.push(
        issue(
          "missing_required",
          mapping.field,
          header === null
            ? `The file has no ${mapping.field} column`
            : `${header} is empty`,
          true,
        ),
      );
    }
    values.set(mapping.field, value);
  }

  // --- type-dependent requirements ---------------------------------------
  const type = values.get("type") as TransactionType | null | undefined;
  const tradeDate = values.get("trade_date") ?? null;
  let instrumentId: string | null = null;

  if (type) {
    if (!NO_INSTRUMENT.has(type)) {
      const resolved = resolveInstrument(
        values.get("symbol") ?? null,
        values.get("exchange") ?? null,
        profile,
        instrumentIndex,
      );
      instrumentId = resolved.id;
      if (resolved.issue) issues.push(resolved.issue);
    }

    const quantity = values.get("quantity") ?? null;
    if (NEEDS_QUANTITY.has(type)) {
      if (quantity === null) {
        issues.push(
          issue(
            "missing_required",
            "quantity",
            `A ${type} needs a quantity`,
            true,
          ),
        );
        // D(), not Number(): a numeric(20,8) quantity does not survive a
        // float, and the sign test has to agree with what Postgres will store.
      } else if (D(quantity).lte(0)) {
        // Direction is carried by `type`, never by the sign of the quantity --
        // a negative SELL quantity would deplete a parcel backwards. Reject it
        // rather than take an absolute value, which would silently accept a
        // file whose convention we have guessed at.
        issues.push(
          issue(
            "invalid_quantity",
            "quantity",
            `Quantity must be greater than zero (got ${quantity}); direction comes from the transaction type`,
            true,
          ),
        );
      }
    }

    if (NEEDS_UNIT_PRICE.has(type) && values.get("unit_price") === null) {
      issues.push(
        issue(
          "missing_required",
          "unit_price",
          type === "SPLIT" || type === "CONSOLIDATION"
            ? `A ${type} needs a unit_price carrying the ratio`
            : `A ${type} needs a unit price`,
          true,
        ),
      );
    }
  }

  // --- payload ------------------------------------------------------------
  const blocked = issues.some((i) => i.blocking);
  let parsed: ParsedPayload | null = null;
  let key: string | null = null;

  if (!blocked && type && tradeDate) {
    parsed = {
      account_id: context.accountId,
      instrument_id: instrumentId,
      type,
      trade_date: tradeDate,
      settlement_date: values.get("settlement_date") ?? null,
      quantity: values.get("quantity") ?? null,
      unit_price: values.get("unit_price") ?? null,
      brokerage: values.get("brokerage") ?? "0",
      fees: values.get("fees") ?? "0",
      currency: values.get("currency") ?? "AUD",
      fx_rate_to_aud: values.get("fx_rate_to_aud") ?? "1",
      external_ref: values.get("external_ref") ?? null,
    };

    key = dedupeKey(parsed);

    const earlier = seenInFile.get(key);
    if (earlier !== undefined) {
      issues.push(
        issue(
          "duplicate_suspected",
          null,
          `Looks like row ${earlier} of this same file`,
          false,
        ),
      );
    } else {
      seenInFile.set(key, record.line);
      const existing = context.existingDedupeKeys?.get(key);
      if (existing) {
        issues.push(
          issue(
            "duplicate_suspected",
            null,
            `Matches ${existing}, already in the ledger`,
            false,
          ),
        );
      }
    }
  }

  return {
    row_number: record.line,
    raw_payload: raw,
    parsed_payload: parsed,
    issues,
    dedupe_key: key,
  };
}
