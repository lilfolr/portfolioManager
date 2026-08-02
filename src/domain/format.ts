import { Decimal, ZERO } from './decimal';

/**
 * Ports of the small formatting helpers from `lib/format.dart`, which in turn
 * ported the DC component's `m(n)`.
 *
 * This is the only module in the codebase that turns a figure into text, and
 * the only place a `number` is an acceptable representation of money --
 * everything upstream stays `Decimal`, per CLAUDE.md's money rules.
 *
 * The grouping is hand-rolled rather than `Intl.NumberFormat` on purpose: the
 * output is asserted character-for-character by the tests, and ICU data is not
 * guaranteed present on a React Native runtime (Android in particular ships a
 * cut-down ICU), so `en-AU` would silently degrade to a different grouping on
 * some devices.
 */

function group(wholeDigits: string): string {
  let out = '';
  const len = wholeDigits.length;
  for (let i = 0; i < len; i++) {
    if (i > 0 && (len - i) % 3 === 0) out += ',';
    out += wholeDigits[i];
  }
  return out;
}

function fixedParts(magnitude: string): [string, string] {
  const parts = magnitude.split('.');
  return [parts[0] ?? '0', parts[1] ?? '00'];
}

/**
 * `en-AU` grouped, 2-decimal-place magnitude with a leading `-` for negatives
 * and never a `+` for positives -- `money(-1234.5) === '-1,234.50'`.
 *
 * Accepts a `Decimal` so a figure that accumulated as `Decimal` never
 * round-trips through a float to get formatted. The `number` overload exists
 * only for genuinely non-monetary figures (percentages already reduced to a
 * scalar); prefer passing the `Decimal`.
 */
export function money(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  const sign = d.lessThan(ZERO) ? '-' : '';
  const [whole, frac] = fixedParts(d.abs().toFixed(2));
  return `${sign}${group(whole)}.${frac}`;
}

/**
 * A signed gain figure: `+` prefix when `n >= 0`, `-` (via [money]) otherwise.
 * Mirrors `(gain >= 0 ? '+' : '') + m(gain)`.
 */
export function signedMoney(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  return (d.greaterThanOrEqualTo(ZERO) ? '+' : '') + money(d);
}

/** A percentage with the same signed convention -- `signedPct(17.706)` is `'+17.71%'`. */
export function signedPct(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  return `${d.greaterThanOrEqualTo(ZERO) ? '+' : ''}${d.toFixed(2)}%`;
}

/**
 * A unit quantity: grouped whole part, decimals only when non-zero. Units are
 * `numeric(20,8)` -- DRP and US fractional shares produce long decimals that a
 * fixed 2dp would either truncate or clutter whole-share holdings with.
 */
export function quantity(n: Decimal): string {
  const parts = n.toString().split('.');
  const whole = parts[0] ?? '0';
  if (parts.length === 1) return group(whole);
  const decimals = (parts[1] ?? '').replace(/0+$/, '');
  return decimals === '' ? group(whole) : `${group(whole)}.${decimals}`;
}
