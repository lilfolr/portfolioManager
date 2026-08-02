import { D } from '@/src/domain/decimal';
import type { Holding } from '@/src/domain/models';
import {
  filterHoldings,
  nextSort,
  sortHoldings,
  sourcePrefixes,
} from '@/src/features/holdings/sort';

import { accounts, holdings } from './fixtures/portfolio';

const symbols = (list: Holding[]) => list.map((h) => h.symbol);

describe('source filtering', () => {
  it('passes everything through for "all"', () => {
    expect(filterHoldings(holdings, 'all')).toHaveLength(holdings.length);
  });

  it('matches both Stake accounts from the single "Stake" prefix', () => {
    // Port of "Stake source filter matches both Stake AU and Stake US via
    // prefix match".
    const result = filterHoldings(holdings, 'Stake');
    expect(symbols(result).sort()).toEqual(['A200', 'GOLD', 'VOO']);
  });

  it('matches a single-account prefix exactly', () => {
    expect(symbols(filterHoldings(holdings, 'MUFG'))).toEqual(['TLS']);
  });

  it('returns nothing for an unknown prefix', () => {
    expect(filterHoldings(holdings, 'Nope')).toEqual([]);
  });
});

describe('source prefixes', () => {
  it('dedupes to one chip per prefix, in account order', () => {
    expect(sourcePrefixes(accounts)).toEqual([
      'CommSec',
      'Computershare',
      'Stake',
      'MUFG',
    ]);
  });

  it('splits on a middle dot as well as a space', () => {
    expect(sourcePrefixes([{ displayName: 'Computershare · SRN' }])).toEqual([
      'Computershare',
    ]);
  });
});

describe('sorting', () => {
  it('sorts symbols alphabetically in both directions', () => {
    expect(symbols(sortHoldings(holdings, 'sym', false))[0]).toBe('A200');
    expect(symbols(sortHoldings(holdings, 'sym', true))[0]).toBe('VOO');
  });

  it('sorts by market value, descending by default', () => {
    // VAS: 460 * 102.15 = 46,989.00, the largest. TLS: 900 * 4.12 = 3,708.00,
    // the smallest -- note it also has the most units, so this genuinely
    // exercises value rather than quantity.
    expect(symbols(sortHoldings(holdings, 'value', true))[0]).toBe('VAS');
    expect(symbols(sortHoldings(holdings, 'value', false))[0]).toBe('TLS');
  });

  it('compares Decimal columns by value, not by string', () => {
    // The trap: '9' > '10' lexicographically. Sorting by units must put 900
    // above 22 regardless.
    const twoHoldings: Holding[] = [
      { ...holdings[0]!, symbol: 'SMALL', units: D('22') },
      { ...holdings[0]!, symbol: 'BIG', units: D('900') },
    ];
    expect(symbols(sortHoldings(twoHoldings, 'units', true))).toEqual([
      'BIG',
      'SMALL',
    ]);
  });

  it('does not mutate the input list', () => {
    const before = symbols(holdings);
    sortHoldings(holdings, 'gain', true);
    expect(symbols(holdings)).toEqual(before);
  });
});

describe('sort state machine', () => {
  it('starts a newly tapped column descending', () => {
    // Port of "tapping a new column header sorts desc, tapping again flips
    // to asc".
    expect(nextSort({ key: 'value', desc: true }, 'units')).toEqual({
      key: 'units',
      desc: true,
    });
  });

  it('flips direction when the active column is tapped again', () => {
    expect(nextSort({ key: 'units', desc: true }, 'units')).toEqual({
      key: 'units',
      desc: false,
    });
    expect(nextSort({ key: 'units', desc: false }, 'units')).toEqual({
      key: 'units',
      desc: true,
    });
  });
});
