import type { Row } from '../../data/api';
import type { RowIssue } from '../../domain/models';

/**
 * The `import-csv` preview response, as the screen wants it.
 *
 * Kept apart from the screen and free of React so it can be unit tested
 * directly -- the response is untyped JSON crossing a process boundary, and
 * every field here is one the UI would otherwise render as `undefined`.
 */

export interface PreviewRow {
  rowNumber: number;
  type: string | null;
  tradeDate: string | null;
  symbol: string | null;
  quantity: string | null;
  unitPrice: string | null;
  issues: RowIssue[];
}

export interface ImportPreview {
  profileId: string;
  profileLabel: string;
  parserVersion: string;
  headerMapping: { header: string; field: string | null }[];
  unmappedHeaders: string[];
  missingColumns: string[];
  totals: { rows: number; ok: number; warning: number; blocking: number };
  rows: PreviewRow[];
  /** Set when a byte-identical file has been imported before and not voided. */
  priorImport: string | null;
}

const str = (value: unknown): string => String(value ?? '');
const strOrNull = (value: unknown): string | null =>
  value === null || value === undefined || value === '' ? null : String(value);
const int = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function toIssues(value: unknown): RowIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const issue = entry as Record<string, unknown>;
    return [
      {
        code: str(issue.code),
        field: strOrNull(issue.field),
        message: str(issue.message),
        blocking: issue.blocking === true,
      },
    ];
  });
}

export function previewFromRow(response: Row): ImportPreview {
  const totals = (response.totals ?? {}) as Record<string, unknown>;
  const prior = response.priorImportOfSameFile as Record<string, unknown> | null;

  const rows = Array.isArray(response.rows) ? response.rows : [];
  const headerMapping = Array.isArray(response.headerMapping)
    ? response.headerMapping
    : [];

  return {
    profileId: str(response.profileId),
    profileLabel: str(response.profileLabel),
    parserVersion: str(response.parserVersion),
    headerMapping: headerMapping.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return [];
      const mapping = entry as Record<string, unknown>;
      return [{ header: str(mapping.header), field: strOrNull(mapping.field) }];
    }),
    unmappedHeaders: toStringArray(response.unmappedHeaders),
    missingColumns: toStringArray(response.missingColumns),
    totals: {
      rows: int(totals.rows),
      ok: int(totals.ok),
      warning: int(totals.warning),
      blocking: int(totals.blocking),
    },
    rows: rows.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return [];
      const row = entry as Record<string, unknown>;
      const parsed = row.parsed_payload as Record<string, unknown> | null;
      const raw = (row.raw_payload ?? {}) as Record<string, unknown>;
      return [
        {
          rowNumber: int(row.row_number),
          // Falls back to the raw cell so a row the parser rejected still
          // shows what the file actually said -- otherwise the one row a user
          // most needs to look at is the emptiest.
          type: strOrNull(parsed?.type) ?? strOrNull(raw.type),
          tradeDate:
            strOrNull(parsed?.trade_date) ?? strOrNull(raw.trade_date),
          symbol: strOrNull(raw.symbol),
          quantity: strOrNull(parsed?.quantity) ?? strOrNull(raw.quantity),
          unitPrice:
            strOrNull(parsed?.unit_price) ?? strOrNull(raw.unit_price),
          issues: toIssues(row.issues),
        },
      ];
    }),
    priorImport: prior
      ? `${str(prior.filename)} on ${str(prior.importedAt).slice(0, 10)}`
      : null,
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(str) : [];
}
