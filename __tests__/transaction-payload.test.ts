import { D, ZERO } from '@/src/domain/decimal';
import type { OpenParcel } from '@/src/data/repository';
import {
  buildPayload,
  canSave,
  consideration,
  effectiveAlloc,
  fifoAlloc,
  parseDecimal,
  parseUnits,
  rocTotal,
  summariseAllocation,
} from '@/src/features/transaction-entry/payload';

const parcel = (over: Partial<OpenParcel> = {}): OpenParcel => ({
  id: '00000001-0000-0000-0000-000000000000',
  acquiredDate: new Date(Date.UTC(2019, 10, 14)),
  available: D('120'),
  costPerUnit: D('68.45'),
  discountEligible: true,
  ...over,
});

const older = parcel();
const newer = parcel({
  id: '00000002-0000-0000-0000-000000000000',
  acquiredDate: new Date(Date.UTC(2020, 7, 3)),
  available: D('42'),
  costPerUnit: D('75.51'),
  discountEligible: false,
});

describe('parsing typed values', () => {
  it('strips thousands separators and treats blank as zero', () => {
    expect(parseDecimal('1,234.50').toString()).toBe('1234.5');
    expect(parseDecimal('').isZero()).toBe(true);
    expect(parseDecimal(undefined).isZero()).toBe(true);
  });

  it('treats unparseable input as zero rather than throwing', () => {
    // A half-typed figure must not crash the form on every keystroke.
    expect(parseDecimal('12.').toString()).toBe('12');
    expect(parseDecimal('abc').isZero()).toBe(true);
    expect(parseDecimal('-').isZero()).toBe(true);
  });

  it('reads whole units only, rejecting zero and negatives', () => {
    expect(parseUnits('38')).toBe(38);
    expect(parseUnits(' 38 ')).toBe(38);
    expect(parseUnits('0')).toBe(0);
    expect(parseUnits('-5')).toBe(0);
    expect(parseUnits('')).toBe(0);
  });
});

describe('FIFO allocation', () => {
  it('consumes the oldest parcel first', () => {
    expect(fifoAlloc([older, newer], 100)).toEqual({ [older.id]: 100 });
  });

  it('spills into the next parcel once the first is exhausted', () => {
    expect(fifoAlloc([older, newer], 150)).toEqual({
      [older.id]: 120,
      [newer.id]: 30,
    });
  });

  it('allocates only what is available when the disposal exceeds the holding', () => {
    // The engine rejects an oversell; the panel shows the shortfall rather
    // than inventing units.
    expect(fifoAlloc([older, newer], 500)).toEqual({
      [older.id]: 120,
      [newer.id]: 42,
    });
  });

  it('allocates nothing for a zero disposal', () => {
    expect(fifoAlloc([older, newer], 0)).toEqual({});
  });

  it('ignores a fractional remainder rather than rounding units up', () => {
    const fractional = parcel({ available: D('48.36219178') });
    expect(fifoAlloc([fractional], 100)).toEqual({ [fractional.id]: 48 });
  });
});

describe('effective allocation', () => {
  it('computes FIFO when that is the asserted method', () => {
    expect(effectiveAlloc([older, newer], 'fifo', 130, {})).toEqual({
      [older.id]: 120,
      [newer.id]: 10,
    });
  });

  it('uses only what was typed under specific identification', () => {
    expect(
      effectiveAlloc([older, newer], 'specific', 130, {
        [older.id]: '30',
        [newer.id]: '40',
      }),
    ).toEqual({ [older.id]: 30, [newer.id]: 40 });
  });

  it('ignores blank and non-positive entries', () => {
    expect(
      effectiveAlloc([older, newer], 'specific', 130, {
        [older.id]: '',
        [newer.id]: '0',
      }),
    ).toEqual({});
  });
});

describe('allocation summary', () => {
  const price = D('96.55');

  it('reports a complete allocation with its gain', () => {
    const allocation = fifoAlloc([older, newer], 100);
    const summary = summariseAllocation([older, newer], allocation, price, 100);
    expect(summary.allocatedUnits).toBe(100);
    expect(summary.complete).toBe(true);
    expect(summary.over).toBe(false);
    expect(summary.shortfall).toBe(0);
    // 100 * 68.45 = 6,845 cost; 100 * 96.55 = 9,655 proceeds.
    expect(summary.costBaseUsed.toString()).toBe('6845');
    expect(summary.gain.toString()).toBe('2810');
  });

  it('splits out the gain from parcels held over twelve months', () => {
    // The older parcel is discount-eligible, the newer one is not. Reporting
    // the split is a fact; the discount itself is applied by the FY report.
    const allocation = { [older.id]: 100, [newer.id]: 42 };
    const summary = summariseAllocation([older, newer], allocation, price, 142);
    expect(summary.gain.toString()).toBe('3693.68');
    expect(summary.gainFromLongHeld.toString()).toBe('2810');
  });

  it('reports a shortfall when units are unmatched', () => {
    const summary = summariseAllocation([older], { [older.id]: 30 }, price, 50);
    expect(summary.shortfall).toBe(20);
    expect(summary.complete).toBe(false);
    expect(summary.over).toBe(false);
  });

  it('reports over-allocation as negative shortfall', () => {
    const summary = summariseAllocation([older], { [older.id]: 60 }, price, 50);
    expect(summary.shortfall).toBe(-10);
    expect(summary.over).toBe(true);
    expect(summary.complete).toBe(false);
  });

  it('is not complete when nothing is being disposed', () => {
    expect(summariseAllocation([older], {}, price, 0).complete).toBe(false);
  });
});

describe('save gating', () => {
  it('blocks a SELL until every unit is matched', () => {
    const short = summariseAllocation([older], { [older.id]: 10 }, D('10'), 50);
    const done = summariseAllocation([older], { [older.id]: 50 }, D('10'), 50);
    expect(canSave('sell', {}, short)).toBe(false);
    expect(canSave('sell', {}, done)).toBe(true);
  });

  it('blocks a DIVIDEND while franking credit is blank', () => {
    // Never derived: the value has to be transcribed from the statement.
    expect(canSave('div', {})).toBe(false);
    expect(canSave('div', { franking_credit: '  ' })).toBe(false);
    expect(canSave('div', { franking_credit: '136.54' })).toBe(true);
  });

  it('allows the other types without extra conditions', () => {
    for (const type of ['buy', 'drp', 'dist', 'split', 'roc', 'tin'] as const) {
      expect(canSave(type, {})).toBe(true);
    }
  });
});

describe('consideration breakdown', () => {
  it('adds brokerage to the cost base on a BUY', () => {
    const rows = consideration('buy', {
      units: '100',
      unit_price: '96.55',
      brokerage: '9.50',
    });
    expect(rows.map((r) => r.value.toString())).toEqual([
      '9655',
      '9.5',
      '9664.5',
    ]);
  });

  it('subtracts brokerage from proceeds on a SELL', () => {
    const rows = consideration('sell', {
      units: '100',
      unit_price: '96.55',
      brokerage: '9.50',
    });
    expect(rows.map((r) => r.value.toString())).toEqual([
      '9655',
      '9.5',
      '9645.5',
    ]);
  });

  it('shows nothing for types with no consideration', () => {
    expect(consideration('div', {})).toEqual([]);
  });
});

describe('ROC total', () => {
  it('multiplies amount per unit by units at two decimal places', () => {
    expect(rocTotal({ amount_per_unit: '0.1234', units: '500' })).toBe('61.70');
  });

  it('stays blank until both operands are present', () => {
    expect(rocTotal({ amount_per_unit: '0.1234' })).toBe('');
    expect(rocTotal({})).toBe('');
  });
});

describe('buildPayload', () => {
  it('includes only the fields the active type declares', () => {
    const payload = buildPayload('buy', {
      trade_date: '16/03/2026',
      symbol: 'vas',
      units: '100',
      unit_price: '96.55',
      brokerage: '9.50',
      account: 'CommSec 0421',
      ref: 'C123',
    });

    expect(payload).toEqual({
      type: 'BUY',
      trade_date: '16/03/2026',
      account_id: 'CommSec 0421',
      symbol: 'VAS',
      quantity: '100',
      unit_price: '96.55',
      brokerage: '9.50',
      external_ref: 'C123',
    });
  });

  it('carries the transfer-in original acquisition details', () => {
    const payload = buildPayload('tin', {
      trade_date: '01/07/2026',
      symbol: 'BHP',
      units: '140',
      orig_date: '14/11/2019',
      orig_cost: '5768.00',
      account: 'Computershare · SRN',
    });
    expect(payload.original_acquisition_date).toBe('14/11/2019');
    expect(payload.original_cost_base).toBe('5768.00');
    expect(payload.type).toBe('TRANSFER_IN');
  });

  it('attaches the parcel allocation for a SELL', () => {
    const payload = buildPayload(
      'sell',
      { trade_date: '02/05/2024', symbol: 'VAS', units: '38', account: 'X' },
      { [older.id]: 38 },
    );
    expect(payload.parcel_allocation).toEqual({ [older.id]: 38 });
  });

  it('maps every type to its ledger enum value', () => {
    const expected = {
      buy: 'BUY',
      sell: 'SELL',
      drp: 'DRP',
      div: 'DIVIDEND',
      dist: 'DISTRIBUTION',
      split: 'SPLIT',
      roc: 'RETURN_OF_CAPITAL',
      tin: 'TRANSFER_IN',
    } as const;
    for (const [key, dbType] of Object.entries(expected)) {
      expect(buildPayload(key as keyof typeof expected, {}).type).toBe(dbType);
    }
  });
});

/**
 * KNOWN DEFECT, ported from the Flutter build rather than introduced here.
 *
 * `confirm_staged_row()` does `(v_parsed->>'account_id')::uuid` and casts
 * `trade_date` to `date`, but the form sends the free-text source-account
 * display name and a DD/MM/YYYY string, and never sends `instrument_id` at
 * all. Every manual save therefore fails at runtime. No Flutter test caught
 * it because the submitter was stubbed in all of them.
 *
 * Written as `test.failing` so it documents the defect and keeps CI green,
 * and flips to a normal pass the moment the payload is fixed -- which needs
 * an account picker yielding the real UUID and an ISO date, i.e. a behaviour
 * change rather than a port.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

test.failing(
  'payload should carry an account UUID and an ISO date the RPC can cast',
  () => {
    const payload = buildPayload('buy', {
      trade_date: '16/03/2026',
      symbol: 'VAS',
      units: '100',
      unit_price: '96.55',
      account: 'CommSec 0421',
    });

    expect(String(payload.account_id)).toMatch(UUID);
    expect(String(payload.trade_date)).toMatch(ISO_DATE);
    expect(payload.instrument_id).toBeDefined();
  },
);

describe('zero handling', () => {
  it('summarises an empty allocation without dividing by anything', () => {
    const summary = summariseAllocation([], {}, ZERO, 0);
    expect(summary.allocatedUnits).toBe(0);
    expect(summary.costBaseUsed.isZero()).toBe(true);
    expect(summary.gain.isZero()).toBe(true);
  });
});
