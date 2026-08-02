// eslint-disable-next-line import/no-named-as-default -- decimal.js exports the
// class as both the default and a named export; the default is the documented
// import and the one the engine's decimal.ts uses.
import Decimal from 'decimal.js';

/**
 * The one configured `Decimal` for the client. CLAUDE.md is explicit: never
 * float, never JS `number`, for money or quantity.
 *
 * `precision` and the rounding mode match
 * `supabase/functions/_shared/engine/decimal.ts` so the client and the parcel
 * engine round identically -- a skew here is a silent cost-base bug.
 *
 * `toExpNeg`/`toExpPos` are set because `Decimal.prototype.toString()`
 * otherwise switches to exponential notation outside 1e-7..1e21, and
 * `quantity()` in format.ts splits the string on '.' to trim trailing zeros --
 * it would emit garbage for `1.2e-8`. Dart's `Decimal.toString()` never does
 * this, so there is nothing in the Flutter source to copy here. The chosen
 * window comfortably contains `numeric(20,8)` quantities and DRP fractions.
 */
Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 40,
});

export { Decimal };

/** Construct a Decimal. Mirrors `D()` in the engine's decimal.ts. */
export function D(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export const ZERO = new Decimal(0);

/**
 * Parse a wire value. Every numeric column crosses the wire as text (see the
 * `::text` casts in `20260801000004_views.sql`) precisely so it never becomes
 * a float; null and undefined read as zero, matching the Dart `_decimal()`
 * helper in `portfolio_repository.dart`.
 */
export function decimalFromWire(value: unknown): Decimal {
  if (value === null || value === undefined || value === '') return ZERO;
  return new Decimal(String(value));
}

/** Nullable variant, for columns that are genuinely absent rather than zero. */
export function decimalFromWireOrNull(value: unknown): Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  return new Decimal(String(value));
}

/**
 * Guarded division. Port of `_div()` in `lib/models/portfolio.dart`: a zero
 * denominator yields zero rather than throwing, and the quotient is fixed at
 * 10 decimal places, matching Dart's `scaleOnInfinitePrecision: 10`.
 */
export function div(a: Decimal, b: Decimal): Decimal {
  if (b.isZero()) return ZERO;
  return a.div(b).toDecimalPlaces(10);
}
