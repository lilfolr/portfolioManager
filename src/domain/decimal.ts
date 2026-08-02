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
const PRECISION = 40;

Decimal.set({
  precision: PRECISION,
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
 * Guarded division at an explicit scale, matching Dart's
 * `(a / b).toDecimal(scaleOnInfinitePrecision: n)`.
 *
 * The subtlety worth preserving: Dart applies the scale ONLY when the division
 * does not terminate. An exact quotient keeps its full precision, so
 * `1/32` is `0.03125` there, not `0.0313`. A plain `toDecimalPlaces(n)` would
 * silently round exact results and drift from the Flutter build's figures, so
 * the quotient is tested for exactness first.
 *
 * A zero denominator yields zero rather than throwing, as `_div()` did.
 */
export function divScale(a: Decimal, b: Decimal, scale: number): Decimal {
  if (b.isZero()) return ZERO;
  const quotient = a.div(b);
  // Exactness is detected from the significant-digit count, not by
  // multiplying back: at PRECISION significant digits `quotient.times(b)`
  // rounds to `a` even when the division does not terminate, so that test
  // would report every division as exact. A quotient that needed fewer than
  // the full precision was not truncated.
  return quotient.precision() < PRECISION
    ? quotient
    : quotient.toDecimalPlaces(scale);
}

/** Port of `_div()` in `lib/models/portfolio.dart` -- scale 10. */
export function div(a: Decimal, b: Decimal): Decimal {
  return divScale(a, b, 10);
}
