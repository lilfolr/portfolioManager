import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { D, ZERO, divScale } from '../../domain/decimal';
import { money, quantity, signedMoney, signedPct } from '../../domain/format';
import { holdingValue, type Holding } from '../../domain/models';
import { financialYearFromLabel } from '../../domain/financial-year';
import { useHoldingsScreenData } from '../../data/queries';
import { useBreakpoint } from '../../layout/breakpoint';
import { useFinancialYear } from '../../layout/financial-year';
import { useLastHolding } from '../../layout/last-holding';
import { useLedgerColors, useSourceDot } from '../../theme/use-ledger-colors';
import { ActionButton } from '../../ui/ActionButton';
import { LedgerTable } from '../../ui/table/LedgerTable';
import { Mono, Sans } from '../../ui/text';
import {
  holdingsColumns,
  holdingsSortKey,
  HOLDINGS_TABLE_MIN_WIDTH,
} from './columns';
import { KpiStrip, type Kpi } from './KpiStrip';
import { SourceFilterBar } from './SourceFilterBar';
import { filterHoldings, nextSort, sortHoldings, type SortKey } from './sort';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function shortDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Port of `lib/screens/holdings_screen.dart`. */
export function HoldingsScreen() {
  const router = useRouter();
  const colors = useLedgerColors();
  const sourceDot = useSourceDot();
  const { fy } = useFinancialYear();
  const { narrow, wide, horizontalPadding } = useBreakpoint();
  const { setSelected } = useLastHolding();

  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'value',
    desc: true,
  });
  const [source, setSource] = useState('all');

  const financialYear = financialYearFromLabel(fy);
  const query = useHoldingsScreenData(financialYear);

  const data = query.data;

  const filtered = useMemo(
    () => (data ? filterHoldings(data.holdings, source) : []),
    [data, source],
  );
  const rows = useMemo(
    () => sortHoldings(filtered, sort.key, sort.desc),
    [filtered, sort],
  );

  const totals = useMemo(() => {
    const value = filtered.reduce((sum, h) => sum.plus(holdingValue(h)), ZERO);
    const cost = filtered.reduce((sum, h) => sum.plus(h.costBase), ZERO);
    const gain = value.minus(cost);
    const gainPct = divScale(gain, cost, 6).times(D(100));
    const units = filtered.reduce((sum, h) => sum.plus(h.units), ZERO);
    return { value, cost, gain, gainPct, units };
  }, [filtered]);

  if (query.isPending) {
    return (
      <View className="flex-1 items-center justify-center p-12">
        <ActivityIndicator size="small" color={colors.link} />
      </View>
    );
  }

  if (query.isError || !data) {
    return (
      <View className="flex-1 items-center justify-center p-12">
        <Sans testID="holdingsError" className="text-center text-mid">
          {`Could not load holdings: ${String(query.error)}`}
        </Sans>
      </View>
    );
  }

  const gainClassName = totals.gain.greaterThanOrEqualTo(ZERO)
    ? 'text-positive'
    : 'text-negative';
  const distinctAccounts = new Set(filtered.map((h) => h.accountId)).size;
  const priceDateLabel = data.latestPriceDate
    ? `prices as at ${shortDate(data.latestPriceDate)}`
    : 'no priced instruments yet';
  const foreignHoldings = filtered.filter((h) => h.fxSubLine);

  const kpis: Kpi[] = [
    {
      label: 'TOTAL VALUE',
      value: money(totals.value),
      caption: `${filtered.length} positions · ${quantity(totals.units)} units`,
      valueClassName: 'text-ink',
    },
    {
      label: 'TOTAL COST BASE',
      value: money(totals.cost),
      caption: `from ${data.transactionCount} confirmed transactions`,
      valueClassName: 'text-ink',
    },
    {
      label: 'UNREALISED GAIN',
      value: signedMoney(totals.gain),
      caption: 'not adjusted for CGT discount',
      valueClassName: gainClassName,
      trailing: signedPct(totals.gainPct),
    },
    {
      label: `INCOME · ${fy}`,
      value: money(data.incomeTotal),
      caption: `+ ${money(data.frankingCreditTotal)} franking credits`,
      valueClassName: 'text-ink',
    },
  ];

  const openDetail = (holding: Holding) => {
    setSelected({
      instrumentId: holding.instrumentId,
      accountId: holding.accountId,
      symbol: holding.symbol,
    });
    router.push({
      pathname: '/holdings/[instrumentId]',
      params: {
        instrumentId: holding.instrumentId,
        accountId: holding.accountId,
      },
    });
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-[26px]">
      <View
        className="flex-row flex-wrap items-end justify-between gap-x-[18px] gap-y-3 pb-[18px] pt-[22px]"
        style={{ paddingHorizontal: horizontalPadding }}
      >
        <View>
          <Sans className="font-sans-semi text-[22px] tracking-[-0.33px] text-ink">
            Holdings
          </Sans>
          <Mono
            testID="holdingsSummary"
            className="mt-1.5 text-[12px] text-muted"
          >
            {`${filtered.length} positions · ${distinctAccounts} source accounts · ${priceDateLabel}`}
          </Mono>
        </View>
        <View className="flex-row gap-2">
          <ActionButton label="Export CSV" />
          <ActionButton
            label="Add transaction"
            primary
            testID="addTransaction"
            onPress={() => router.push('/transactions/new')}
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: horizontalPadding }}>
        <KpiStrip cards={kpis} columns={narrow ? 1 : wide ? 4 : 2} />
      </View>

      <View
        className="pb-3 pt-[18px]"
        style={{ paddingHorizontal: horizontalPadding }}
      >
        <SourceFilterBar
          accounts={data.accounts}
          selected={source}
          onChange={setSource}
        />
      </View>

      <LedgerTable
        testID="holdingsTable"
        columns={holdingsColumns(sourceDot, {
          positionCount: filtered.length,
          gain: signedMoney(totals.gain),
          gainPct: signedPct(totals.gainPct),
          gainClass: gainClassName,
          costBase: money(totals.cost),
        })}
        rows={rows}
        keyExtractor={(h) => `${h.instrumentId}|${h.accountId}`}
        minWidth={HOLDINGS_TABLE_MIN_WIDTH}
        horizontalPadding={horizontalPadding}
        onRowPress={openDetail}
        sort={{
          key: sort.key,
          desc: sort.desc,
          onSort: (key) => setSort((current) => nextSort(current, key)),
        }}
        sortKeyFor={holdingsSortKey}
        emptyMessage="No holdings yet. Confirm a transaction to see it here."
        showTotals
      />

      {foreignHoldings.length > 0 ? (
        <View
          className="flex-row flex-wrap gap-x-[22px] gap-y-1.5 pb-[26px] pt-4"
          style={{ paddingHorizontal: horizontalPadding }}
        >
          {foreignHoldings.map((h) => (
            <Mono
              key={h.instrumentId}
              className="text-[11px] leading-[1.6] text-faint"
            >
              {`${h.symbol}: ${h.fxSubLine}`}
            </Mono>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
