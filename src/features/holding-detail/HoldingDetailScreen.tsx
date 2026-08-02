import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { D, ZERO, divScale } from '../../domain/decimal';
import { financialYearFromLabel } from '../../domain/financial-year';
import { money, quantity, signedMoney, signedPct } from '../../domain/format';
import { parcelTwelveMonthDate } from '../../domain/models';
import {
  detailGain,
  detailValue,
  type HoldingDetailData,
} from '../../data/repository';
import { useHoldingDetail } from '../../data/queries';
import { useBreakpoint } from '../../layout/breakpoint';
import { useFinancialYear } from '../../layout/financial-year';
import { useLastHolding } from '../../layout/last-holding';
import { useLedgerColors, useSourceDot } from '../../theme/use-ledger-colors';
import { ActionButton } from '../../ui/ActionButton';
import { PlainTag, SourceDotChip } from '../../ui/chips';
import { LedgerTable } from '../../ui/table/LedgerTable';
import { Eyebrow, Mono, Sans } from '../../ui/text';
import {
  parcelColumns,
  parcelRowClassName,
  PARCEL_WIDTHS,
} from './parcelColumns';
import { txnColumns, TXN_WIDTHS } from './txnColumns';
import { incomeColumns, INCOME_WIDTHS } from './incomeColumns';

type Tab = 'parcels' | 'txns' | 'inc';

const sum = (widths: number[]) => widths.reduce((a, b) => a + b, 0);

/**
 * The holding-detail screen: header, key figures, and three tabs
 * (Parcels / Transactions / Income) for one (instrument, account) pair.
 * Port of `lib/screens/holding_detail_screen.dart`.
 *
 * The tabs stay local state rather than becoming route segments. They are
 * three views of one already-fetched payload with no independent data needs,
 * so routing them would add a refetch boundary for no gain.
 */
export function HoldingDetailScreen() {
  const router = useRouter();
  const colors = useLedgerColors();
  const sourceDot = useSourceDot();
  const { fy } = useFinancialYear();
  const { wide, horizontalPadding } = useBreakpoint();
  const { setSelected } = useLastHolding();
  const [tab, setTab] = useState<Tab>('parcels');

  const params = useLocalSearchParams<{
    instrumentId: string;
    accountId?: string;
  }>();
  const instrumentId = params.instrumentId ?? '';
  const accountId = params.accountId ?? '';

  const query = useHoldingDetail(instrumentId, accountId);
  const data = query.data;

  // Keeps the breadcrumb and the sidebar's detail item in step when the screen
  // is reached by deep link rather than by tapping a holdings row.
  useEffect(() => {
    if (data && instrumentId && accountId) {
      setSelected({ instrumentId, accountId, symbol: data.symbol });
    }
  }, [data, instrumentId, accountId, setSelected]);

  const backLink = (
    <Pressable
      testID="backToHoldings"
      accessibilityRole="link"
      onPress={() => router.push('/holdings')}
    >
      <Mono className="text-[11.5px] text-muted">‹ Holdings</Mono>
    </Pressable>
  );

  if (!instrumentId || !accountId) {
    return (
      <View style={{ padding: horizontalPadding }}>
        {backLink}
        <Sans className="mt-[18px] text-[13px] text-muted">
          Select a holding from the Holdings table to see its detail.
        </Sans>
      </View>
    );
  }

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
        <Sans testID="holdingDetailError" className="text-center text-mid">
          {`Could not load this holding: ${String(query.error)}`}
        </Sans>
      </View>
    );
  }

  const value = detailValue(data);
  const gain = detailGain(data);
  const gainPct = divScale(gain, data.costBase, 6).times(D(100));
  const gainClass = gain.greaterThanOrEqualTo(ZERO)
    ? 'text-positive'
    : 'text-negative';
  const financialYear = financialYearFromLabel(fy);
  const incomeForFy = data.income
    .filter((i) => i.financialYear === financialYear)
    .reduce((s, i) => s.plus(i.cash), ZERO);
  const pendingCount = data.income.filter((i) => i.pending).length;

  return (
    <ScrollView className="flex-1">
      <View style={{ paddingHorizontal: horizontalPadding, paddingTop: 20 }}>
        {backLink}
      </View>

      <Header
        data={data}
        sourceDot={sourceDot}
        horizontalPadding={horizontalPadding}
        onAddTransaction={() => router.push('/transactions/new')}
      />

      <View
        testID="keyFigures"
        className="flex-row flex-wrap pb-[18px]"
        style={{
          paddingHorizontal: horizontalPadding,
          columnGap: wide ? 38 : 18,
          rowGap: 14,
        }}
      >
        <KeyFigure label="UNITS" value={quantity(data.units)} />
        <KeyFigure label="COST BASE" value={money(data.costBase)} />
        <KeyFigure
          label="AVG COST"
          value={
            data.units.isZero()
              ? '—'
              : money(divScale(data.costBase, data.units, 6))
          }
        />
        <KeyFigure label="MARKET VALUE" value={money(value)} />
        <KeyFigure
          label="UNREALISED"
          value={signedMoney(gain)}
          trailing={signedPct(gainPct)}
          valueClassName={gainClass}
        />
        <KeyFigure label={`INCOME · ${fy}`} value={money(incomeForFy)} />
      </View>

      <View
        className="flex-row"
        style={{ paddingHorizontal: horizontalPadding }}
      >
        <TabButton
          label="Parcels"
          count={data.parcels.length}
          active={tab === 'parcels'}
          onPress={() => setTab('parcels')}
        />
        <TabButton
          label="Transactions"
          count={data.txns.length}
          active={tab === 'txns'}
          onPress={() => setTab('txns')}
        />
        <TabButton
          label="Income"
          count={data.income.length}
          active={tab === 'inc'}
          onPress={() => setTab('inc')}
        />
      </View>
      <View className="h-px bg-edge-sidebar" />

      {tab === 'parcels' ? (
        <ParcelsTab data={data} horizontalPadding={horizontalPadding} />
      ) : null}
      {tab === 'txns' ? (
        <TxnsTab data={data} horizontalPadding={horizontalPadding} />
      ) : null}
      {tab === 'inc' ? (
        <IncomeTab
          data={data}
          fy={fy}
          pendingCount={pendingCount}
          horizontalPadding={horizontalPadding}
        />
      ) : null}
    </ScrollView>
  );
}

function Header({
  data,
  sourceDot,
  horizontalPadding,
  onAddTransaction,
}: {
  data: HoldingDetailData;
  sourceDot: (source: string) => string;
  horizontalPadding: number;
  onAddTransaction: () => void;
}) {
  return (
    <View
      className="flex-row flex-wrap items-start justify-between gap-x-5 gap-y-3 pb-[18px] pt-3"
      style={{ paddingHorizontal: horizontalPadding }}
    >
      <View>
        <View className="flex-row flex-wrap items-center gap-x-3">
          <Mono className="font-mono-med text-[24px] tracking-[-0.24px] text-strong">
            {data.symbol}
          </Mono>
          <Sans className="text-[15px] text-strong">{data.name}</Sans>
        </View>
        <View className="mt-[9px] flex-row flex-wrap gap-1.5">
          <PlainTag label={data.exchange} />
          {data.amitFlag ? <PlainTag label="Unit trust · AMIT" /> : null}
          <SourceDotChip
            label={data.accountDisplayName}
            dotColor={sourceDot(data.accountDisplayName)}
          />
        </View>
      </View>
      <View className="flex-row gap-2">
        <ActionButton label="Export parcels" />
        <ActionButton
          label="Add transaction"
          primary
          testID="detailAddTransaction"
          onPress={onAddTransaction}
        />
      </View>
    </View>
  );
}

function KeyFigure({
  label,
  value,
  trailing,
  valueClassName = 'text-ink',
}: {
  label: string;
  value: string;
  trailing?: string;
  valueClassName?: string;
}) {
  return (
    <View>
      <Eyebrow className="text-faint">{label}</Eyebrow>
      <View className="mt-[7px] flex-row items-baseline">
        <Mono className={`text-[18px] ${valueClassName}`}>{value}</Mono>
        {trailing ? (
          <Mono className={`ml-[7px] text-[11.5px] ${valueClassName}`}>
            {trailing}
          </Mono>
        ) : null}
      </View>
    </View>
  );
}

function TabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`tab-${label.toLowerCase()}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-row items-center px-3.5 py-2.5 ${
        active ? 'border-b-2 border-ink' : ''
      }`}
    >
      <Sans className={`text-[13px] ${active ? 'text-ink' : 'text-muted'}`}>
        {label}
      </Sans>
      <Mono className="ml-1.5 text-[11px] text-faint">{String(count)}</Mono>
    </Pressable>
  );
}

/** The blue callout above the parcels table. */
function InfoBox({ children }: { children: string }) {
  return (
    <View className="flex-row items-start rounded-md border border-edge-info-box bg-surface-info-box px-3.5 py-[11px]">
      <View className="mt-px h-3.5 w-3.5 rounded-full border-[1.5px] border-link" />
      <Sans className="ml-[11px] flex-1 text-[12px] leading-[1.55] text-strong">
        {children}
      </Sans>
    </View>
  );
}

function Footnote({
  children,
  horizontalPadding,
}: {
  children: string;
  horizontalPadding: number;
}) {
  return (
    <View
      style={{ paddingHorizontal: horizontalPadding }}
      className="pb-[26px] pt-4"
    >
      <Mono className="text-[11px] leading-[1.6] text-faint">{children}</Mono>
    </View>
  );
}

function ParcelsTab({
  data,
  horizontalPadding,
}: {
  data: HoldingDetailData;
  horizontalPadding: number;
}) {
  const now = new Date();
  const parcels = data.parcels;

  const totalOrig = parcels.reduce((s, p) => s.plus(p.originalQuantity), ZERO);
  const totalRem = parcels.reduce((s, p) => s.plus(p.remainingQuantity), ZERO);
  const totalCost = parcels.reduce((s, p) => s.plus(p.costBase), ZERO);
  const eligibleUnits = parcels
    .filter((p) => now.getTime() > parcelTwelveMonthDate(p).getTime())
    .reduce((s, p) => s.plus(p.remainingQuantity), ZERO);

  return (
    <View>
      <View style={{ paddingHorizontal: horizontalPadding, paddingTop: 18 }}>
        <InfoBox>
          Parcels are derived from transactions and are read-only. To change a
          parcel, edit or reverse the transaction it came from — the parcel
          recalculates.
        </InfoBox>
      </View>

      {parcels.length === 0 ? (
        <View style={{ paddingHorizontal: horizontalPadding, paddingTop: 18 }}>
          <Sans className="text-[13px] text-muted">
            No parcels yet for this holding.
          </Sans>
        </View>
      ) : (
        <View className="mt-[18px]">
          <LedgerTable
            testID="parcelsTable"
            columns={parcelColumns(now, {
              originalQuantity: quantity(totalOrig),
              remainingQuantity: quantity(totalRem),
              costBase: money(totalCost),
              avgCost: money(divScale(totalCost, totalRem, 6)),
              eligibleUnits: quantity(eligibleUnits),
              pendingUnits: quantity(totalRem.minus(eligibleUnits)),
            })}
            rows={parcels}
            keyExtractor={(p) => p.id}
            minWidth={sum(PARCEL_WIDTHS)}
            horizontalPadding={horizontalPadding}
            rowClassName={parcelRowClassName}
            rowPaddingVertical={10}
            showTotals
          />
        </View>
      )}

      <Footnote horizontalPadding={horizontalPadding}>
        Cost base is pro-rated on partial disposal, not re-averaged. CGT
        discount is not applied on this screen -- see CLAUDE.md: eligibility is
        computed at disposal, not stored on the open parcel.
      </Footnote>
    </View>
  );
}

function TxnsTab({
  data,
  horizontalPadding,
}: {
  data: HoldingDetailData;
  horizontalPadding: number;
}) {
  const colors = useLedgerColors();
  const txns = data.txns;
  const countOf = (kind: string) => txns.filter((t) => t.kind === kind).length;

  return (
    <View>
      <View
        className="flex-row flex-wrap items-center justify-between gap-x-3.5 gap-y-2.5 pb-3.5 pt-4"
        style={{ paddingHorizontal: horizontalPadding }}
      >
        <Sans className="text-[12px] text-mid">
          Immutable records. A correction is entered as a reversing transaction
          — nothing is overwritten.
        </Sans>
        <View className="flex-row gap-1.5">
          <SourceDotChip
            label={`CSV ${countOf('csv')}`}
            dotColor={colors.link}
            dense
          />
          <SourceDotChip
            label={`Email ${countOf('email')}`}
            dotColor={colors.pendingText}
            dense
          />
          <SourceDotChip
            label={`Manual ${countOf('manual')}`}
            dotColor={colors.faint}
            dense
          />
        </View>
      </View>

      {txns.length === 0 ? (
        <View style={{ paddingHorizontal: horizontalPadding }}>
          <Sans className="text-[13px] text-muted">
            No transactions yet for this holding.
          </Sans>
        </View>
      ) : (
        <LedgerTable
          testID="txnsTable"
          columns={txnColumns(colors)}
          rows={txns}
          keyExtractor={(t) => t.id}
          minWidth={sum(TXN_WIDTHS)}
          horizontalPadding={horizontalPadding}
          rowPaddingVertical={10}
        />
      )}

      <Footnote horizontalPadding={horizontalPadding}>
        Every row retains its source artefact. Manual entries record who entered
        them and when.
      </Footnote>
    </View>
  );
}

function IncomeTab({
  data,
  fy,
  pendingCount,
  horizontalPadding,
}: {
  data: HoldingDetailData;
  fy: string;
  pendingCount: number;
  horizontalPadding: number;
}) {
  const income = data.income;
  const total = (pick: (i: (typeof income)[number]) => typeof ZERO) =>
    income.reduce((s, i) => s.plus(pick(i)), ZERO);

  return (
    <View>
      <View
        className="flex-row flex-wrap items-center justify-between gap-x-3.5 gap-y-2.5 pb-3.5 pt-4"
        style={{ paddingHorizontal: horizontalPadding }}
      >
        <Sans className="text-[12px] text-mid">
          Distributions received. Component detail comes from the annual AMIT
          statement.
        </Sans>
        {pendingCount > 0 ? (
          <View
            testID="pendingComponents"
            className="flex-row items-center rounded border border-edge-warn-box bg-surface-warn-box py-1 pl-2 pr-2.5"
          >
            <View className="h-[5px] w-[5px] rounded-full bg-pending-amber" />
            <Mono className="ml-[7px] text-[11px] text-pending-text">
              {`${pendingCount} payment${pendingCount === 1 ? '' : 's'} awaiting component entry`}
            </Mono>
          </View>
        ) : null}
      </View>

      {income.length === 0 ? (
        <View style={{ paddingHorizontal: horizontalPadding }}>
          <Sans className="text-[13px] text-muted">
            No distributions recorded yet for this holding.
          </Sans>
        </View>
      ) : (
        <LedgerTable
          testID="incomeTable"
          columns={incomeColumns({
            label: fy,
            franked: money(total((i) => i.franked)),
            unfranked: money(total((i) => i.unfranked)),
            frankingCredit: money(total((i) => i.frankingCredit)),
            cash: money(total((i) => i.cash)),
          })}
          rows={income}
          keyExtractor={(i, index = 0) =>
            `${i.paymentDate.toISOString()}-${index}`
          }
          minWidth={sum(INCOME_WIDTHS)}
          horizontalPadding={horizontalPadding}
          rowPaddingVertical={10}
          showTotals
        />
      )}

      <Footnote horizontalPadding={horizontalPadding}>
        Franking credits are recorded as stated on each statement. Where a
        source does not state a value it is left blank rather than derived.
        Units held at record date is not currently tracked.
      </Footnote>
    </View>
  );
}
