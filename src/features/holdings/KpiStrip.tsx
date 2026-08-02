import { View } from 'react-native';

import { Eyebrow, Mono, Sans } from '../../ui/text';

/**
 * The four summary cards above the holdings table. Port of `KpiStripCards`
 * in `lib/screens/holdings_screen.dart`.
 *
 * Every figure is a fact with its working shown in the caption -- no
 * evaluation, no comparison, nothing framed as good or bad. The unrealised
 * gain card says so explicitly ("not adjusted for CGT discount") because the
 * discount is decided at disposal, not here.
 */
export interface Kpi {
  label: string;
  value: string;
  caption: string;
  /** Token class for the figure, e.g. 'text-ink' or 'text-positive'. */
  valueClassName: string;
  trailing?: string;
}

export function KpiStrip({
  cards,
  columns,
}: {
  cards: Kpi[];
  columns: number;
}) {
  const rows: Kpi[][] = [];
  for (let i = 0; i < cards.length; i += columns) {
    rows.push(cards.slice(i, i + columns));
  }

  return (
    <View
      testID="kpiStrip"
      className="overflow-hidden rounded-md border border-edge-subtle bg-surface-sidebar"
    >
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row">
          {row.map((card, index) => (
            <View
              key={card.label}
              className={`flex-1 px-4 py-3.5 ${
                index !== row.length - 1 ? 'border-r border-edge-row' : ''
              }`}
            >
              <Eyebrow className="text-faint">{card.label}</Eyebrow>
              <View className="mt-2.5 flex-row items-baseline">
                <Mono
                  numberOfLines={1}
                  className={`text-[23px] tracking-[-0.46px] ${card.valueClassName}`}
                >
                  {card.value}
                </Mono>
                {card.trailing ? (
                  <Mono className={`ml-2 text-[12.5px] ${card.valueClassName}`}>
                    {card.trailing}
                  </Mono>
                ) : null}
              </View>
              <Sans className="mt-1.5 text-[11px] leading-[1.3] text-muted">
                {card.caption}
              </Sans>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
