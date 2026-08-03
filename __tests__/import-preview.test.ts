import { previewFromRow } from '@/src/features/import/preview';

/**
 * The preview response crosses a process boundary as untyped JSON, so every
 * field here is one the screen would otherwise render as `undefined`. These
 * cases are mostly about a malformed or partial response degrading into an
 * empty-but-renderable shape rather than a crash.
 */

const full = {
  profileId: 'native',
  profileLabel: 'Native — columns match the ledger',
  parserVersion: 'native@1',
  headerMapping: [
    { header: 'type', field: 'type' },
    { header: 'Adviser Note', field: null },
  ],
  unmappedHeaders: ['Adviser Note'],
  missingColumns: ['settlement_date'],
  totals: { rows: 3, ok: 1, warning: 1, blocking: 1 },
  rows: [
    {
      row_number: 2,
      raw_payload: { type: 'BUY', trade_date: '2026-08-03', symbol: 'CBA' },
      parsed_payload: {
        type: 'BUY',
        trade_date: '2026-08-03',
        quantity: '100',
        unit_price: '105.50',
      },
      issues: [],
    },
  ],
  priorImportOfSameFile: {
    id: 'x',
    filename: 'commsec.csv',
    importedAt: '2026-07-02T03:00:00Z',
  },
};

describe('previewFromRow', () => {
  it('reads a complete response', () => {
    const preview = previewFromRow(full);
    expect(preview.profileId).toBe('native');
    expect(preview.parserVersion).toBe('native@1');
    expect(preview.totals).toEqual({ rows: 3, ok: 1, warning: 1, blocking: 1 });
    expect(preview.unmappedHeaders).toEqual(['Adviser Note']);
    expect(preview.missingColumns).toEqual(['settlement_date']);
    expect(preview.rows[0]).toEqual({
      rowNumber: 2,
      type: 'BUY',
      tradeDate: '2026-08-03',
      symbol: 'CBA',
      quantity: '100',
      unitPrice: '105.50',
      issues: [],
    });
  });

  it('names a prior import of the same file', () => {
    expect(previewFromRow(full).priorImport).toBe('commsec.csv on 2026-07-02');
  });

  it('has no prior import when the field is absent', () => {
    expect(previewFromRow({ ...full, priorImportOfSameFile: null }).priorImport)
      .toBeNull();
  });

  it('falls back to the raw cells for a row that failed to parse', () => {
    // The row a user most needs to look at is the one the parser rejected, so
    // it must not render as a line of em dashes.
    const preview = previewFromRow({
      ...full,
      rows: [
        {
          row_number: 4,
          raw_payload: { type: 'BUY', trade_date: '03/08/2026', symbol: 'ZZZ' },
          parsed_payload: null,
          issues: [
            {
              code: 'unknown_instrument',
              field: 'symbol',
              message: 'ZZZ is not a known instrument',
              blocking: true,
            },
          ],
        },
      ],
    });

    expect(preview.rows[0]?.type).toBe('BUY');
    expect(preview.rows[0]?.tradeDate).toBe('03/08/2026');
    expect(preview.rows[0]?.symbol).toBe('ZZZ');
    expect(preview.rows[0]?.issues[0]?.blocking).toBe(true);
  });

  it('keeps decimal values as strings', () => {
    // Nothing in the preview path may turn a quantity into a number.
    const row = previewFromRow(full).rows[0];
    expect(typeof row?.quantity).toBe('string');
    expect(typeof row?.unitPrice).toBe('string');
  });

  it('survives an empty response', () => {
    const preview = previewFromRow({});
    expect(preview.rows).toEqual([]);
    expect(preview.headerMapping).toEqual([]);
    expect(preview.totals).toEqual({ rows: 0, ok: 0, warning: 0, blocking: 0 });
    expect(preview.priorImport).toBeNull();
  });

  it('discards malformed entries rather than rendering them', () => {
    const preview = previewFromRow({
      ...full,
      headerMapping: ['not an object', null],
      rows: [null, 'nonsense'],
      totals: { rows: 'lots' },
    });
    expect(preview.headerMapping).toEqual([]);
    expect(preview.rows).toEqual([]);
    expect(preview.totals.rows).toBe(0);
  });

  it('treats a non-array issues field as no issues', () => {
    const preview = previewFromRow({
      ...full,
      rows: [{ row_number: 2, raw_payload: {}, parsed_payload: {}, issues: 'x' }],
    });
    expect(preview.rows[0]?.issues).toEqual([]);
  });
});
