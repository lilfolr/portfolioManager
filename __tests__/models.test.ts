import { D, ZERO } from '@/src/domain/decimal';
import {
  holdingAvgCost,
  holdingGain,
  holdingGainPct,
  holdingValue,
  parcelFullyDepleted,
  parcelPartiallyDepleted,
  parcelPerUnit,
  parcelTwelveMonthDate,
  type Holding,
  type Parcel,
} from '@/src/domain/models';

/**
 * These exist because of a hazard the Flutter source cannot warn about: Dart's
 * `Decimal` overrides `==`, so `remainingQuantity == Decimal.zero` was a value
 * comparison. Translated literally to `===` in JS it becomes a reference
 * comparison that is always false, and TypeScript accepts it silently. Every
 * getter that compared Decimals gets an assertion here.
 */

const holding = (over: Partial<Holding> = {}): Holding => ({
  instrumentId: 'ins-vas',
  accountId: 'acc-commsec',
  symbol: 'VAS',
  name: 'Vanguard Australian Shares Index ETF',
  exchange: 'ASX',
  units: D('460'),
  costBase: D('41400'),
  price: D('105.92'),
  accountDisplayName: 'CommSec 0421',
  ...over,
});

const parcel = (over: Partial<Parcel> = {}): Parcel => ({
  id: 'p-1',
  openTransactionId: 't-1',
  acquiredDate: new Date(Date.UTC(2024, 2, 14)),
  originalQuantity: D('100'),
  remainingQuantity: D('100'),
  costBase: D('9000'),
  reducedCostBase: D('9000'),
  ...over,
});

describe('holding derivations', () => {
  it('computes value, gain and gain percent', () => {
    const h = holding();
    expect(holdingValue(h).toString()).toBe('48723.2');
    expect(holdingGain(h).toString()).toBe('7323.2');
    expect(holdingGainPct(h).toFixed(4)).toBe('17.6889');
  });

  it('returns zero rather than throwing when cost base is zero', () => {
    // Port of `_div`'s guard. A TRANSFER_IN with no asserted cost base, or a
    // fully written-down parcel, reaches this.
    const h = holding({ costBase: ZERO });
    expect(holdingGainPct(h).isZero()).toBe(true);
    expect(holdingAvgCost(h).isZero()).toBe(true);
  });

  it('returns zero average cost for a zero-unit holding', () => {
    expect(holdingAvgCost(holding({ units: ZERO })).isZero()).toBe(true);
  });

  it('keeps full precision on fractional units', () => {
    const h = holding({ units: D('48.36219178'), costBase: D('4000'), price: D('105.92') });
    // 48.36219178 * 105.92 -- all ten decimal places survive the multiply.
    expect(holdingValue(h).toString()).toBe('5122.5233533376');
  });

  it('sums fractional cost bases without float drift', () => {
    // The case that actually breaks under `number`: 0.1 + 0.2 !== 0.3.
    const units = [D('0.1'), D('0.2')].reduce((a, b) => a.plus(b), D(0));
    expect(units.toString()).toBe('0.3');
    expect(holdingValue(holding({ units, price: D('3') })).toString()).toBe('0.9');
  });
});

describe('parcel derivations', () => {
  it('reports a full parcel as neither partially nor fully depleted', () => {
    const p = parcel();
    expect(parcelPartiallyDepleted(p)).toBe(false);
    expect(parcelFullyDepleted(p)).toBe(false);
  });

  it('reports a part-sold parcel as partially depleted', () => {
    const p = parcel({ remainingQuantity: D('40') });
    expect(parcelPartiallyDepleted(p)).toBe(true);
    expect(parcelFullyDepleted(p)).toBe(false);
  });

  it('reports an exhausted parcel as fully depleted', () => {
    // The reference-equality trap: `remainingQuantity === D(0)` is always
    // false, so a literal port of the Dart would report this as open.
    const p = parcel({ remainingQuantity: D('0') });
    expect(parcelFullyDepleted(p)).toBe(true);
    expect(parcelPartiallyDepleted(p)).toBe(false);
  });

  it('treats a zero written with a scale as zero', () => {
    // PostgREST sends numeric(20,8) as text, so an exhausted parcel arrives as
    // '0.00000000', not '0'.
    expect(parcelFullyDepleted(parcel({ remainingQuantity: D('0.00000000') }))).toBe(
      true,
    );
  });

  it('computes cost base per remaining unit', () => {
    expect(parcelPerUnit(parcel({ remainingQuantity: D('40'), costBase: D('3600') })).toString()).toBe(
      '90',
    );
  });

  it('returns zero per-unit for a depleted parcel instead of dividing by zero', () => {
    expect(parcelPerUnit(parcel({ remainingQuantity: ZERO })).isZero()).toBe(true);
  });

  it('dates the 12-month mark one year after acquisition, in UTC', () => {
    const p = parcel({ acquiredDate: new Date(Date.UTC(2024, 2, 14)) });
    expect(parcelTwelveMonthDate(p).toISOString()).toBe('2025-03-14T00:00:00.000Z');
  });

  it('rolls 29 February forward the way Date.UTC does', () => {
    // Documents the behaviour rather than asserting it is correct policy:
    // discount eligibility is decided by the engine, not by this date.
    const p = parcel({ acquiredDate: new Date(Date.UTC(2024, 1, 29)) });
    expect(parcelTwelveMonthDate(p).toISOString()).toBe('2025-03-01T00:00:00.000Z');
  });
});
