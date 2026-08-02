import { View } from 'react-native';

import { ZERO } from '../../domain/decimal';
import { money, quantity, signedMoney, signedPct } from '../../domain/format';
import {
  holdingAvgCost,
  holdingGain,
  holdingGainPct,
  type Holding,
} from '../../domain/models';
import { SourceDotChip } from '../../ui/chips';
import { Mono, Sans } from '../../ui/text';
import type { Column } from '../../ui/table/types';
import type { SortKey } from './sort';

/**
 * The Holdings table columns. Widths are transcribed verbatim from
 * `_colWidths` and the header cells in `lib/screens/holdings_screen.dart`:
 * the symbol column absorbs leftover space with a 190 floor, then
 * 82 / 100 / 92 / 128 / 84 / 168 / 30.
 */
export const HOLDINGS_TABLE_MIN_WIDTH = 996;

const gainClass = (holding: Holding) =>
  holdingGain(holding).greaterThanOrEqualTo(ZERO)
    ? 'text-positive'
    : 'text-negative';

export interface HoldingsTotals {
  positionCount: number;
  gain: string;
  gainPct: string;
  gainClass: string;
  costBase: string;
}

export function holdingsColumns(
  sourceDot: (source: string) => string,
  totals: HoldingsTotals,
): Column<Holding>[] {
  return [
    {
      key: 'sym',
      label: 'SYMBOL / CODE',
      width: 190,
      flexible: true,
      paddingHorizontal: 14,
      render: (h) => (
        <View className="flex-row">
          <Mono className="text-[12.5px] tracking-[0.12px] text-strong">
            {h.symbol}
          </Mono>
          <View className="ml-[9px] flex-1">
            <Sans
              numberOfLines={1}
              className="text-[12.5px] leading-[1.35] text-strong"
            >
              {h.name}
            </Sans>
            {h.fxSubLine ? (
              <Mono
                numberOfLines={1}
                className="mt-0.5 text-[10.5px] text-faint"
              >
                {h.fxSubLine}
              </Mono>
            ) : null}
          </View>
        </View>
      ),
      renderTotal: () => (
        <Mono className="font-mono-med text-[11px] tracking-[0.9px] text-mid">
          {`TOTAL · ${totals.positionCount} POSITIONS`}
        </Mono>
      ),
    },
    {
      key: 'units',
      label: 'UNITS',
      width: 82,
      align: 'right',
      render: (h) => (
        <Mono className="text-[12.5px] text-strong">{quantity(h.units)}</Mono>
      ),
    },
    {
      key: 'avg',
      label: 'PURCHASE $',
      width: 100,
      align: 'right',
      render: (h) => (
        <Mono className="text-[12.5px] text-strong">
          {money(holdingAvgCost(h))}
        </Mono>
      ),
    },
    {
      key: 'price',
      label: 'LAST $',
      width: 92,
      align: 'right',
      render: (h) => (
        <Mono className="text-[12.5px] text-mid">{money(h.price)}</Mono>
      ),
    },
    {
      key: 'gain',
      label: 'PROFIT/LOSS $',
      width: 128,
      align: 'right',
      render: (h) => (
        <Mono className={`text-[12.5px] ${gainClass(h)}`}>
          {signedMoney(holdingGain(h))}
        </Mono>
      ),
      renderTotal: () => (
        <Mono className={`font-mono-med text-[13px] ${totals.gainClass}`}>
          {totals.gain}
        </Mono>
      ),
    },
    {
      key: 'pct',
      label: 'PROFIT/LOSS %',
      width: 84,
      align: 'right',
      render: (h) => (
        <Mono className={`text-[12px] ${gainClass(h)}`}>
          {signedPct(holdingGainPct(h))}
        </Mono>
      ),
      renderTotal: () => (
        <Mono className={`font-mono-med text-[12.5px] ${totals.gainClass}`}>
          {totals.gainPct}
        </Mono>
      ),
    },
    {
      key: 'src',
      label: 'SOURCE',
      width: 168,
      render: (h) => (
        <SourceDotChip
          label={h.accountDisplayName}
          dotColor={sourceDot(h.accountDisplayName)}
        />
      ),
      renderTotal: () => (
        <Mono className="text-[11px] text-faint">{`cost base ${totals.costBase}`}</Mono>
      ),
    },
    {
      key: 'chevron',
      label: '',
      width: 30,
      align: 'right',
      paddingHorizontal: 8,
      render: () => <Mono className="text-[13px] text-icon-muted">›</Mono>,
    },
  ];
}

/** Column key -> sort key. The chevron column isn't sortable. */
export function holdingsSortKey(column: Column<Holding>): SortKey | undefined {
  return column.key === 'chevron' ? undefined : (column.key as SortKey);
}
