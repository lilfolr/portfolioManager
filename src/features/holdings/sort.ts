import type { Decimal } from '../../domain/decimal';
import {
  holdingAvgCost,
  holdingGain,
  holdingGainPct,
  holdingValue,
  type Holding,
} from '../../domain/models';

/**
 * Sorting and source filtering for the Holdings table. Pure functions, ported
 * from `_sorted` / `_filtered` in `lib/screens/holdings_screen.dart`.
 */

export type SortKey =
  'sym' | 'units' | 'avg' | 'price' | 'value' | 'gain' | 'pct' | 'src';

const decimalOf: Record<
  Exclude<SortKey, 'sym' | 'src'>,
  (holding: Holding) => Decimal
> = {
  units: (h) => h.units,
  avg: holdingAvgCost,
  price: (h) => h.price,
  value: holdingValue,
  gain: holdingGain,
  pct: holdingGainPct,
};

function compare(a: Holding, b: Holding, key: SortKey): number {
  if (key === 'sym') return a.symbol.localeCompare(b.symbol);
  if (key === 'src') {
    return a.accountDisplayName.localeCompare(b.accountDisplayName);
  }
  // `comparedTo`, not `<`: Decimal is an object, so the relational operators
  // would compare stringified values.
  return decimalOf[key](a).comparedTo(decimalOf[key](b));
}

export function sortHoldings(
  holdings: Holding[],
  key: SortKey,
  desc: boolean,
): Holding[] {
  return [...holdings].sort((a, b) =>
    desc ? compare(b, a, key) : compare(a, b, key),
  );
}

/**
 * Filters by source. `selected` is `'all'` or a display-name prefix, so a
 * single "Stake" chip covers both "Stake AU" and "Stake US".
 */
export function filterHoldings(
  holdings: Holding[],
  selected: string,
): Holding[] {
  if (selected === 'all') return holdings;
  return holdings.filter((h) => h.accountDisplayName.startsWith(selected));
}

/**
 * The unique display-name prefixes, in account order. The prefix is everything
 * up to the first space or middle dot, so "Computershare · SRN" becomes
 * "Computershare" and the two Stake accounts collapse to one chip.
 */
export function sourcePrefixes(accounts: { displayName: string }[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const account of accounts) {
    const prefix = account.displayName.split(/[\s·]/)[0] ?? '';
    if (prefix !== '' && !seen.has(prefix)) {
      seen.add(prefix);
      result.push(prefix);
    }
  }
  return result;
}

/** Tapping the active column flips direction; a new column starts descending. */
export function nextSort(
  current: { key: SortKey; desc: boolean },
  tapped: SortKey,
): { key: SortKey; desc: boolean } {
  return current.key === tapped
    ? { key: tapped, desc: !current.desc }
    : { key: tapped, desc: true };
}
