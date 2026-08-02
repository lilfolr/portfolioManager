import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import type { OpenParcel } from '../../data/repository';
import { Decimal, ZERO } from '../../domain/decimal';
import { formatDate } from '../../domain/dates';
import { money, quantity, signedMoney } from '../../domain/format';
import { useLedgerColors } from '../../theme/use-ledger-colors';
import { HeldStatusPill } from '../../ui/chips';
import { Eyebrow, Mono, Sans } from '../../ui/text';
import type { AllocationSummary, Allocation, MatchMode } from './payload';

/**
 * The SELL right panel: parcel matching, disposal result, allocation status.
 * Port of `_buildSellPanel` / `_buildSellTable` / `_buildStatusCard`.
 *
 * Column widths transcribed from the Flutter `colWidths`.
 */
const COL = {
  parcel: 88,
  acquired: 108,
  avail: 82,
  costPerUnit: 96,
  unitsUsed: 108,
  costBaseUsed: 116,
  gain: 124,
  held: 118,
};
const TOTAL_WIDTH = Object.values(COL).reduce((a, b) => a + b, 0);

function HeaderCell({
  width,
  label,
  right = false,
  first = false,
}: {
  width: number;
  label: string;
  right?: boolean;
  first?: boolean;
}) {
  return (
    <View
      style={{ width, paddingHorizontal: first ? 14 : 12, paddingVertical: 9 }}
      className={right ? 'items-end' : 'items-start'}
    >
      <Eyebrow className="tracking-[1.1px] text-muted">{label}</Eyebrow>
    </View>
  );
}

function Cell({
  width,
  right = false,
  first = false,
  children,
}: {
  width: number;
  right?: boolean;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{ width, paddingHorizontal: first ? 14 : 12, paddingVertical: 8 }}
      className={right ? 'items-end' : 'items-start'}
    >
      {children}
    </View>
  );
}

function ParcelRow({
  parcel,
  used,
  unitPrice,
  mode,
  onChangeUnits,
}: {
  parcel: OpenParcel;
  used: number;
  unitPrice: Decimal;
  mode: MatchMode;
  onChangeUnits: (value: string) => void;
}) {
  const colors = useLedgerColors();
  const isFifo = mode === 'fifo';
  const costUsed = parcel.costPerUnit.times(used);
  const gain = unitPrice.times(used).minus(costUsed);
  const gainClass = gain.greaterThanOrEqualTo(ZERO)
    ? 'text-positive'
    : 'text-negative';

  return (
    <View
      testID={`sellParcelRow-${parcel.id}`}
      className={`flex-row items-center border-b border-edge-row ${
        used > 0 ? 'bg-surface-parcel-tint' : 'bg-surface-card'
      }`}
    >
      <Cell width={COL.parcel} first>
        <Mono className="text-[12px] text-mid">{`P-${parcel.id.substring(0, 8)}`}</Mono>
      </Cell>
      <Cell width={COL.acquired}>
        <Mono className="text-[12.5px] text-strong">
          {formatDate(parcel.acquiredDate)}
        </Mono>
      </Cell>
      <Cell width={COL.avail} right>
        <Mono className="text-[12.5px] text-mid">
          {quantity(parcel.available)}
        </Mono>
      </Cell>
      <Cell width={COL.costPerUnit} right>
        <Mono className="text-[12.5px] text-mid">
          {money(parcel.costPerUnit)}
        </Mono>
      </Cell>

      {/* Units used: computed and read-only under FIFO, typed under specific. */}
      <View
        style={{
          width: COL.unitsUsed,
          paddingLeft: 5,
          paddingRight: 10,
          paddingVertical: 5,
        }}
      >
        <TextInput
          testID={`sellUnits-${parcel.id}`}
          value={used > 0 ? String(used) : ''}
          editable={!isFifo}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.faint}
          onChangeText={(text) => onChangeUnits(text.replace(/[^0-9]/g, ''))}
          className={`h-7 rounded border px-2 text-right font-mono text-[12.5px] ${
            isFifo
              ? 'border-edge-subtle bg-surface-active text-mid'
              : `bg-surface-card text-ink ${
                  used > 0 ? 'border-edge-control-hover' : 'border-edge-control'
                }`
          }`}
        />
      </View>

      <Cell width={COL.costBaseUsed} right>
        <Mono
          className={`text-[12.5px] ${used > 0 ? 'text-strong' : 'text-icon-muted'}`}
        >
          {used > 0 ? money(costUsed) : '—'}
        </Mono>
      </Cell>
      <Cell width={COL.gain} right>
        <Mono
          className={`text-[12.5px] ${used > 0 ? gainClass : 'text-icon-muted'}`}
        >
          {used > 0 ? signedMoney(gain) : '—'}
        </Mono>
      </Cell>
      <Cell width={COL.held} first>
        {used > 0 ? (
          <HeldStatusPill
            eligible={parcel.discountEligible}
            heldDate={formatDate(parcel.acquiredDate)}
          />
        ) : (
          <Mono className="text-[10.5px] text-icon-muted">
            {parcel.discountEligible ? 'eligible' : 'not yet'}
          </Mono>
        )}
      </Cell>
    </View>
  );
}

function ResultLine({
  label,
  value,
  bold = false,
  valueClassName,
  labelClassName = 'text-mid',
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClassName?: string;
  labelClassName?: string;
}) {
  return (
    <View className="flex-row items-center justify-between py-[3.5px]">
      <Sans
        className={`flex-1 text-[11.5px] ${bold ? 'text-ink' : labelClassName}`}
      >
        {label}
      </Sans>
      <Mono
        className={
          valueClassName ??
          (bold
            ? 'font-mono-med text-[14px] text-ink'
            : 'text-[12.5px] text-mid')
        }
      >
        {value}
      </Mono>
    </View>
  );
}

function DisposalResult({
  want,
  proceeds,
  summary,
}: {
  want: number;
  proceeds: Decimal;
  summary: AllocationSummary;
}) {
  const gainClass = summary.gain.greaterThanOrEqualTo(ZERO)
    ? 'text-positive'
    : 'text-negative';

  return (
    <View
      testID="disposalResult"
      className="min-w-[250px] flex-1 rounded-md border border-edge-subtle bg-surface-top-bar p-[15px]"
    >
      <Eyebrow className="text-faint">DISPOSAL RESULT</Eyebrow>
      <View className="mt-[11px]">
        <ResultLine label="Units disposed" value={String(want)} />
        <ResultLine label="Net proceeds" value={money(proceeds)} />
        <ResultLine
          label="Cost base used"
          value={money(summary.costBaseUsed)}
        />
        <View className="my-2 h-px bg-edge-subtle" />
        <ResultLine
          label="Gross capital gain"
          value={signedMoney(summary.gain)}
          bold
          valueClassName={`font-mono-med text-[14px] ${gainClass}`}
        />
        <ResultLine
          label="From parcels held over 12 months"
          value={signedMoney(summary.gainFromLongHeld)}
          labelClassName="text-muted"
        />
      </View>
      {/* Stating the split is a fact; applying the discount is the FY report's
          job, and saying so keeps this screen out of tax-conclusion territory. */}
      <Mono className="mt-[11px] text-[10.5px] leading-[1.55] text-faint">
        CGT discount is not applied here. The FY capital gains report states
        discountable and non-discountable amounts separately.
      </Mono>
    </View>
  );
}

function AllocationStatus({
  summary,
  want,
  allocation,
  children,
}: {
  summary: AllocationSummary;
  want: number;
  allocation: Allocation;
  children?: React.ReactNode;
}) {
  const { complete, over, shortfall, allocatedUnits } = summary;

  const tone = complete
    ? {
        box: 'border-held-eligible-border bg-held-eligible-bg',
        dot: 'bg-positive',
        title: 'text-positive',
        label: 'text-held-eligible-fg',
      }
    : over
      ? {
          box: 'border-negative bg-surface-warn-box',
          dot: 'bg-negative',
          title: 'text-negative',
          label: 'text-negative',
        }
      : {
          box: 'border-edge-warn-box bg-surface-warn-box',
          dot: 'bg-pending-amber',
          title: 'text-pending-text',
          label: 'text-pending-text',
        };

  const parcelCount = Object.values(allocation).filter((v) => v > 0).length;
  const title = complete
    ? 'Allocation complete'
    : over
      ? `Over-allocated by ${-shortfall} units`
      : `${shortfall} units unallocated`;
  const body = complete
    ? `All ${want} units are matched across ${parcelCount} ${
        parcelCount === 1 ? 'parcel' : 'parcels'
      }.`
    : over
      ? 'Reduce a parcel allocation before saving. Allocated units cannot exceed the units being disposed.'
      : 'Allocate the remaining units to parcels. The disposal cannot be saved while any unit is unmatched.';

  const denominator = want > 0 ? want : 1;
  const matched = Math.min(allocatedUnits, want);
  const excess = Math.max(allocatedUnits - want, 0);

  return (
    <View
      testID="allocationStatus"
      className={`min-w-[250px] flex-1 rounded-md border p-[15px] ${tone.box}`}
    >
      <Eyebrow className={tone.label}>ALLOCATION STATUS</Eyebrow>
      <View className="mt-[11px] flex-row items-center">
        <View className={`h-2 w-2 rounded-full ${tone.dot}`} />
        <Sans
          className={`ml-[9px] flex-1 font-sans-med text-[13px] ${tone.title}`}
        >
          {title}
        </Sans>
      </View>
      <Sans className="mt-[7px] text-[11.5px] leading-[1.6] text-mid">
        {body}
      </Sans>

      <View className="mt-3 h-1.5 flex-row overflow-hidden rounded-sm">
        {matched > 0 ? (
          <View className="bg-link" style={{ flex: matched / denominator }} />
        ) : null}
        {excess > 0 ? (
          <View
            className="bg-negative"
            style={{ flex: excess / denominator }}
          />
        ) : null}
        {shortfall > 0 ? (
          <View
            className="bg-edge-control"
            style={{ flex: shortfall / denominator }}
          />
        ) : null}
      </View>
      <Mono className={`mt-1.5 text-[10.5px] ${tone.label}`}>
        {over
          ? `${want} units to dispose · ${-shortfall} units in excess`
          : `${allocatedUnits} of ${want} units allocated`}
      </Mono>

      {children}
    </View>
  );
}

export interface ParcelMatchPanelProps {
  symbol: string;
  account: string;
  unitsText: string;
  unitPrice: Decimal;
  brokerage: Decimal;
  want: number;
  mode: MatchMode;
  onModeChange: (mode: MatchMode) => void;
  parcels: OpenParcel[];
  isPending: boolean;
  error: unknown;
  allocation: Allocation;
  summary: AllocationSummary;
  onAllocate: (parcelId: string, units: string) => void;
  /** Save buttons, rendered inside the status card once allocation completes. */
  saveActions?: React.ReactNode;
}

export function ParcelMatchPanel({
  symbol,
  account,
  unitsText,
  unitPrice,
  brokerage,
  want,
  mode,
  onModeChange,
  parcels,
  isPending,
  error,
  allocation,
  summary,
  onAllocate,
  saveActions,
}: ParcelMatchPanelProps) {
  const colors = useLedgerColors();
  const hasInput = symbol !== '' && account !== '';
  const proceeds = unitPrice.times(want).minus(brokerage);

  return (
    <View>
      <View className="flex-row flex-wrap items-start justify-between gap-x-4 gap-y-2.5 px-[26px] pt-[18px]">
        <View className="flex-1">
          <Eyebrow className="text-faint">PARCEL MATCHING</Eyebrow>
          <Sans className="mt-[7px] text-[13px] leading-[1.4] text-strong">
            {`Disposing ${unitsText || '–'} units of ${symbol || '–'} — every unit must be matched.`}
          </Sans>
        </View>

        <View className="flex-row overflow-hidden rounded-[5px] border border-edge-control">
          {(['fifo', 'specific'] as const).map((option, index) => (
            <Pressable
              key={option}
              testID={`matchMode-${option}`}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === option }}
              onPress={() => onModeChange(option)}
              className={`px-[11px] py-1.5 ${
                index === 0 ? 'border-r border-edge-subtle' : ''
              } ${
                mode === option
                  ? 'bg-surface-active'
                  : 'bg-surface-card hover:bg-surface-hover active:bg-surface-hover'
              }`}
            >
              <Sans
                className={`text-[12px] ${
                  mode === option ? 'font-sans-med text-ink' : 'text-mid'
                }`}
              >
                {option === 'fifo' ? 'FIFO' : 'Select specific parcels'}
              </Sans>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Which method is in force is the user's assertion; this only says what
          the chosen one does. */}
      <Mono className="px-[26px] pb-3.5 pt-2.5 text-[11.5px] leading-[1.55] text-muted">
        {mode === 'fifo'
          ? 'Oldest parcels are consumed first. Units used are calculated, not editable — switch to specific selection to choose parcels yourself.'
          : 'Enter units against any parcel. Each parcel shows the gain that allocation produces as you type.'}
      </Mono>

      {!hasInput ? (
        <Sans className="px-[26px] pb-[22px] text-[13px] text-muted">
          Enter symbol and source account to load open parcels.
        </Sans>
      ) : isPending ? (
        <View className="px-[26px] py-2">
          <ActivityIndicator size="small" color={colors.link} />
        </View>
      ) : error ? (
        <Sans className="px-[26px] text-[13px] text-negative">
          {`Could not load parcels: ${String(error)}`}
        </Sans>
      ) : parcels.length === 0 ? (
        <Sans className="px-[26px] text-[13px] text-muted">
          {`No open parcels found for ${symbol} / ${account}.`}
        </Sans>
      ) : (
        <>
          <View className="border-t border-edge-sidebar">
            <View testID="sellParcelTable" style={{ width: TOTAL_WIDTH }}>
              <View className="flex-row border-b border-edge-header-rule bg-surface-table">
                <HeaderCell width={COL.parcel} label="PARCEL" first />
                <HeaderCell width={COL.acquired} label="ACQUIRED" />
                <HeaderCell width={COL.avail} label="AVAIL" right />
                <HeaderCell width={COL.costPerUnit} label="COST / UNIT" right />
                <HeaderCell width={COL.unitsUsed} label="UNITS USED" right />
                <HeaderCell
                  width={COL.costBaseUsed}
                  label="COST BASE USED"
                  right
                />
                <HeaderCell width={COL.gain} label="GAIN ON PARCEL" right />
                <HeaderCell width={COL.held} label="12-MONTH" />
              </View>

              {parcels.map((parcel) => (
                <ParcelRow
                  key={parcel.id}
                  parcel={parcel}
                  used={allocation[parcel.id] ?? 0}
                  unitPrice={unitPrice}
                  mode={mode}
                  onChangeUnits={(value) => onAllocate(parcel.id, value)}
                />
              ))}

              <View className="flex-row border-t-[1.5px] border-edge-total-rule bg-surface-table">
                <View
                  style={{
                    width: COL.parcel,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                  }}
                >
                  <Mono className="font-mono-med text-[11px] tracking-[0.9px] text-mid">
                    ALLOCATED
                  </Mono>
                </View>
                <View
                  style={{ width: COL.acquired + COL.avail + COL.costPerUnit }}
                />
                <View
                  style={{
                    width: COL.unitsUsed,
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                  }}
                  className="items-end"
                >
                  <Mono
                    testID="allocatedUnits"
                    className={`font-mono-med text-[13px] ${
                      summary.complete
                        ? 'text-positive'
                        : summary.over
                          ? 'text-negative'
                          : 'text-ink'
                    }`}
                  >
                    {String(summary.allocatedUnits)}
                  </Mono>
                </View>
                <View
                  style={{
                    width: COL.costBaseUsed,
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                  }}
                  className="items-end"
                >
                  <Mono className="font-mono-med text-[13px] text-strong">
                    {money(summary.costBaseUsed)}
                  </Mono>
                </View>
                <View
                  style={{
                    width: COL.gain,
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                  }}
                  className="items-end"
                >
                  <Mono
                    className={`font-mono-med text-[13px] ${
                      summary.gain.greaterThanOrEqualTo(ZERO)
                        ? 'text-positive'
                        : 'text-negative'
                    }`}
                  >
                    {signedMoney(summary.gain)}
                  </Mono>
                </View>
                <View style={{ width: COL.held }} />
              </View>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-4 px-[26px] pb-[22px] pt-4">
            <DisposalResult want={want} proceeds={proceeds} summary={summary} />
            <AllocationStatus
              summary={summary}
              want={want}
              allocation={allocation}
            >
              {saveActions}
            </AllocationStatus>
          </View>
        </>
      )}
    </View>
  );
}
