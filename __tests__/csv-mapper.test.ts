import { dedupeKey } from '../supabase/functions/_shared/csv/dedupe.ts';
import { mapRows } from '../supabase/functions/_shared/csv/map.ts';
import {
  detectProfile,
  nativeProfile,
  parserVersion,
  rankProfiles,
} from '../supabase/functions/_shared/csv/profiles/index.ts';
import { tokenize } from '../supabase/functions/_shared/csv/tokenize.ts';
import type {
  MapContext,
  MappedRow,
} from '../supabase/functions/_shared/csv/types.ts';

/**
 * The mapper turns a broker's rows into staged rows. It is the piece that
 * decides what reaches the ledger, so these cases lean on two things:
 *
 *   - a row that cannot become a valid transaction must be *blocking* and
 *     carry a null parsed_payload, never a payload that explodes later at
 *     confirm_staged_row's casts (the manual-entry defect documented at
 *     src/features/transaction-entry/payload.ts:147);
 *   - a row that is merely suspicious must not be blocking, because the app
 *     computes and the user decides (CLAUDE.md rule 4).
 */

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CBA_ID = '22222222-2222-4222-8222-222222222222';
const BHP_ID = '33333333-3333-4333-8333-333333333333';
const VTS_ASX_ID = '44444444-4444-4444-8444-444444444444';
const VTS_NYSE_ID = '55555555-5555-4555-8555-555555555555';

function context(overrides: Partial<MapContext> = {}): MapContext {
  return {
    accountId: ACCOUNT_ID,
    instruments: [
      { id: CBA_ID, symbol: 'CBA', exchange: 'ASX' },
      { id: BHP_ID, symbol: 'BHP', exchange: 'ASX' },
      { id: VTS_ASX_ID, symbol: 'VTS', exchange: 'ASX' },
      { id: VTS_NYSE_ID, symbol: 'VTS', exchange: 'NYSE' },
    ],
    ...overrides,
  };
}

function map(csv: string, overrides: Partial<MapContext> = {}) {
  const { headers, records } = tokenize(csv);
  return mapRows({
    headers,
    records,
    profile: nativeProfile,
    context: context(overrides),
  });
}

const codes = (row: MappedRow) => row.issues.map((issue) => issue.code);
const blocking = (row: MappedRow) => row.issues.some((i) => i.blocking);

const HEADER = 'type,trade_date,symbol,quantity,unit_price,brokerage';

describe('profile detection', () => {
  it('recognises a native file', () => {
    expect(detectProfile(['type', 'trade_date', 'symbol'])?.id).toBe('native');
  });

  it('matches headers regardless of case and spacing', () => {
    expect(detectProfile(['Type', 'Trade Date', 'Symbol'])?.id).toBe('native');
  });

  it('scores a fuller file higher than a bare one', () => {
    const bare = rankProfiles(['type', 'trade_date'])[0]?.confidence ?? 0;
    const full =
      rankProfiles(['type', 'trade_date', 'symbol', 'quantity', 'unit_price'])[0]
        ?.confidence ?? 0;
    expect(full).toBeGreaterThan(bare);
  });

  it('declines a file with neither of the two essential columns', () => {
    // Without a type and a date there is no transaction, whatever else is
    // present -- better to say so than to stage a file of blocked rows.
    expect(detectProfile(['ticker', 'amount'])).toBeUndefined();
    expect(detectProfile([])).toBeUndefined();
  });

  it('reports parser_version as id@version, which is what gets stored', () => {
    expect(parserVersion(nativeProfile)).toBe('native@1');
  });
});

describe('mapping a clean file', () => {
  it('produces a payload with real UUIDs and an ISO date', () => {
    const result = map(
      `${HEADER}\nBUY,2026-08-03,CBA,100,105.50,19.95\n`,
    );

    expect(result.totals).toEqual({ rows: 1, ok: 1, warning: 0, blocking: 0 });
    expect(result.rows[0]?.parsed_payload).toEqual({
      account_id: ACCOUNT_ID,
      instrument_id: CBA_ID,
      type: 'BUY',
      trade_date: '2026-08-03',
      settlement_date: null,
      quantity: '100',
      unit_price: '105.50',
      brokerage: '19.95',
      fees: '0',
      currency: 'AUD',
      fx_rate_to_aud: '1',
      external_ref: null,
    });
  });

  it('keeps every value a string, never a number', () => {
    // A JSON number here would undo the ::text casts the views exist for.
    const payload = map(`${HEADER}\nBUY,2026-08-03,CBA,100,105.50,19.95\n`)
      .rows[0]?.parsed_payload;
    for (const [key, value] of Object.entries(payload ?? {})) {
      expect(typeof value === 'string' || value === null).toBe(true);
      expect(typeof value).not.toBe('number');
      void key;
    }
  });

  it('applies the declared fallbacks for absent optional columns', () => {
    const payload = map('type,trade_date,symbol,quantity,unit_price\n' +
      'BUY,2026-08-03,CBA,100,105.50\n').rows[0]?.parsed_payload;
    expect(payload?.brokerage).toBe('0');
    expect(payload?.fees).toBe('0');
    expect(payload?.currency).toBe('AUD');
    expect(payload?.fx_rate_to_aud).toBe('1');
  });

  it('retains the source cells verbatim in raw_payload', () => {
    // CLAUDE.md rule 6: a bad parse has to be reprocessable without going back
    // to the user for the file.
    const row = map(`${HEADER}\nBUY,2026-08-03,CBA,100,105.50,19.95\n`).rows[0];
    expect(row?.raw_payload).toEqual({
      type: 'BUY',
      trade_date: '2026-08-03',
      symbol: 'CBA',
      quantity: '100',
      unit_price: '105.50',
      brokerage: '19.95',
    });
  });

  it('numbers rows by their physical line, so provenance points at the file', () => {
    const result = map(`${HEADER}\nBUY,2026-08-03,CBA,100,105.50,19.95\n\nSELL,2026-08-04,BHP,50,42.10,19.95\n`);
    expect(result.rows.map((r) => r.row_number)).toEqual([2, 4]);
  });

  it('reports which headers it used and which it ignored', () => {
    const result = map(
      'type,trade_date,symbol,quantity,unit_price,Adviser Note\n' +
        'BUY,2026-08-03,CBA,100,105.50,ignore me\n',
    );
    expect(result.unmappedHeaders).toEqual(['Adviser Note']);
    expect(
      result.headerMapping.find((m) => m.header === 'Adviser Note')?.field,
    ).toBeNull();
    expect(result.headerMapping.find((m) => m.header === 'symbol')?.field).toBe(
      'symbol',
    );
    expect(result.missingColumns).toContain('settlement_date');
  });

  it('accepts alias headers so a file need not use our exact names', () => {
    const payload = map(
      'Type,Date,Code,Units,Price,Commission\n' +
        'BUY,2026-08-03,CBA,100,105.50,19.95\n',
    ).rows[0]?.parsed_payload;
    expect(payload?.instrument_id).toBe(CBA_ID);
    expect(payload?.quantity).toBe('100');
    expect(payload?.brokerage).toBe('19.95');
  });
});

describe('blocking issues', () => {
  it('blocks an unknown symbol', () => {
    const row = map(`${HEADER}\nBUY,2026-08-03,ZZZ,100,10.00,0\n`).rows[0]!;
    expect(codes(row)).toContain('unknown_instrument');
    expect(blocking(row)).toBe(true);
    expect(row.parsed_payload).toBeNull();
  });

  it('blocks a symbol listed on two exchanges rather than picking one', () => {
    // Guessing attaches the parcel to the wrong instrument, which stays
    // invisible until a tax pack is wrong.
    const row = map(`${HEADER}\nBUY,2026-08-03,VTS,100,10.00,0\n`, {
      instruments: [
        { id: VTS_ASX_ID, symbol: 'VTS', exchange: 'NASDAQ' },
        { id: VTS_NYSE_ID, symbol: 'VTS', exchange: 'NYSE' },
      ],
    }).rows[0]!;
    expect(codes(row)).toContain('ambiguous_instrument');
    expect(blocking(row)).toBe(true);
  });

  it('resolves an ambiguous symbol when the file names the exchange', () => {
    const row = map(
      'type,trade_date,symbol,exchange,quantity,unit_price\n' +
        'BUY,2026-08-03,VTS,NYSE,100,10.00\n',
    ).rows[0]!;
    expect(row.parsed_payload?.instrument_id).toBe(VTS_NYSE_ID);
    expect(blocking(row)).toBe(false);
  });

  it('prefers the profile default exchange when the file gives none', () => {
    const row = map(`${HEADER}\nBUY,2026-08-03,VTS,100,10.00,0\n`).rows[0]!;
    expect(row.parsed_payload?.instrument_id).toBe(VTS_ASX_ID);
  });

  it('blocks an unparseable date', () => {
    const row = map(`${HEADER}\nBUY,03/08/2026,CBA,100,10.00,0\n`).rows[0]!;
    expect(codes(row)).toContain('unparseable_date');
    expect(row.parsed_payload).toBeNull();
  });

  it('blocks an unknown transaction type', () => {
    const row = map(`${HEADER}\nPURCHASE,2026-08-03,CBA,100,10.00,0\n`).rows[0]!;
    expect(codes(row)).toContain('unknown_transaction_type');
    expect(row.parsed_payload).toBeNull();
  });

  it('blocks a missing required column value', () => {
    const row = map(`${HEADER}\n,2026-08-03,CBA,100,10.00,0\n`).rows[0]!;
    expect(codes(row)).toContain('missing_required');
    expect(row.parsed_payload).toBeNull();
  });

  it('blocks a BUY with no quantity', () => {
    const row = map(`${HEADER}\nBUY,2026-08-03,CBA,,10.00,0\n`).rows[0]!;
    expect(codes(row)).toContain('missing_required');
    expect(row.issues.find((i) => i.field === 'quantity')?.blocking).toBe(true);
  });

  it('blocks a negative or zero quantity rather than taking its absolute value', () => {
    // Direction comes from `type`; a negative SELL quantity would deplete a
    // parcel backwards.
    const negative = map(`${HEADER}\nSELL,2026-08-03,CBA,-50,10.00,0\n`).rows[0]!;
    expect(codes(negative)).toContain('invalid_quantity');
    expect(negative.parsed_payload).toBeNull();

    const zero = map(`${HEADER}\nBUY,2026-08-03,CBA,0,10.00,0\n`).rows[0]!;
    expect(codes(zero)).toContain('invalid_quantity');
  });

  it('blocks a SPLIT with no ratio in unit_price', () => {
    const row = map(`${HEADER}\nSPLIT,2026-08-03,CBA,,,0\n`).rows[0]!;
    expect(row.issues.find((i) => i.field === 'unit_price')?.blocking).toBe(
      true,
    );
  });

  it('does not require an instrument for the cash-only types', () => {
    const row = map(`${HEADER}\nINTEREST,2026-08-03,,,,0\n`).rows[0]!;
    expect(blocking(row)).toBe(false);
    expect(row.parsed_payload?.instrument_id).toBeNull();
    expect(row.parsed_payload?.type).toBe('INTEREST');
  });

  it('blocks a decimal it cannot represent', () => {
    const row = map(`${HEADER}\nBUY,2026-08-03,CBA,100,n/a,0\n`).rows[0]!;
    expect(codes(row)).toContain('unparseable_decimal');
    expect(row.parsed_payload).toBeNull();
  });
});

describe('non-blocking issues', () => {
  it('warns about a ragged row without blocking it', () => {
    // A trailing empty column is common; the per-field checks catch anything
    // that actually went missing.
    const row = map(`${HEADER}\nBUY,2026-08-03,CBA,100,105.50,19.95,\n`).rows[0]!;
    expect(codes(row)).toContain('ragged_row');
    expect(blocking(row)).toBe(false);
    expect(row.parsed_payload).not.toBeNull();
  });

  it('keeps cells beyond the header under a positional key', () => {
    const row = map(`${HEADER}\nBUY,2026-08-03,CBA,100,105.50,19.95,extra\n`)
      .rows[0]!;
    expect(row.raw_payload.column_7).toBe('extra');
  });

  it('warns, without blocking, when a row matches the existing ledger', () => {
    const clean = map(`${HEADER}\nBUY,2026-08-03,CBA,100,105.50,19.95\n`);
    const key = clean.rows[0]!.dedupe_key!;

    const result = map(`${HEADER}\nBUY,2026-08-03,CBA,100,105.50,19.95\n`, {
      existingDedupeKeys: new Map([[key, 'T-3f2a91c4']]),
    });
    const row = result.rows[0]!;
    expect(codes(row)).toContain('duplicate_suspected');
    expect(blocking(row)).toBe(false);
    // Still fully importable -- the decision is the user's.
    expect(row.parsed_payload).not.toBeNull();
    expect(result.totals).toEqual({ rows: 1, ok: 0, warning: 1, blocking: 0 });
  });

  it('flags a line repeated within the same file, naming the earlier row', () => {
    const result = map(
      `${HEADER}\nBUY,2026-08-03,CBA,100,105.50,19.95\nBUY,2026-08-03,CBA,100,105.50,19.95\n`,
    );
    expect(codes(result.rows[0]!)).toEqual([]);
    expect(result.rows[1]!.issues[0]?.message).toContain('row 2');
    expect(blocking(result.rows[1]!)).toBe(false);
  });

  it('does not flag two genuinely different trades', () => {
    const result = map(
      `${HEADER}\nBUY,2026-08-03,CBA,100,105.50,19.95\nBUY,2026-08-03,CBA,100,105.51,19.95\n`,
    );
    expect(result.totals.warning).toBe(0);
  });
});

describe('dedupeKey', () => {
  const base = {
    account_id: ACCOUNT_ID,
    instrument_id: CBA_ID,
    type: 'BUY' as const,
    trade_date: '2026-08-03',
    quantity: '100',
    unit_price: '105.50',
    external_ref: null,
  };

  it('is stable across equivalent decimal spellings', () => {
    // The CSV and the registry email will not agree on trailing zeroes.
    expect(dedupeKey({ ...base, quantity: '100.00' })).toBe(dedupeKey(base));
  });

  it('changes when an identifying field changes', () => {
    expect(dedupeKey({ ...base, unit_price: '105.51' })).not.toBe(
      dedupeKey(base),
    );
    expect(dedupeKey({ ...base, trade_date: '2026-08-04' })).not.toBe(
      dedupeKey(base),
    );
  });

  it('prefers a broker reference when there is one', () => {
    // Two fills of the same size at the same price on the same day are a real
    // thing that field-matching would wrongly collapse.
    const withRef = dedupeKey({ ...base, external_ref: 'N123456' });
    const sameRef = dedupeKey({
      ...base,
      unit_price: '99.00',
      external_ref: 'n123456',
    });
    expect(withRef).toBe(sameRef);
    expect(withRef).not.toBe(dedupeKey(base));
  });

  it('scopes a reference to its account, since brokers reuse numbers', () => {
    expect(dedupeKey({ ...base, external_ref: 'N1' })).not.toBe(
      dedupeKey({ ...base, account_id: BHP_ID, external_ref: 'N1' }),
    );
  });
});

describe('totals', () => {
  it('counts each row exactly once, by its worst issue', () => {
    const result = map(
      `${HEADER}\n` +
        'BUY,2026-08-03,CBA,100,105.50,19.95\n' + // ok
        'BUY,2026-08-04,ZZZ,100,105.50,19.95\n' + // blocking
        'BUY,2026-08-03,CBA,100,105.50,19.95\n', // duplicate of row 2
    );
    expect(result.totals).toEqual({ rows: 3, ok: 1, warning: 1, blocking: 1 });
  });
});
