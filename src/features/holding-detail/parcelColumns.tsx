import { ZERO } from '../../domain/decimal';
import { formatDate } from '../../domain/dates';
import { money, quantity } from '../../domain/format';
import {
  parcelFullyDepleted,
  parcelPartiallyDepleted,
  parcelPerUnit,
  parcelTwelveMonthDate,
  type Parcel,
} from '../../domain/models';
import { HeldStatusPill } from '../../ui/chips';
import { Mono, Sans } from '../../ui/text';
import { TotalCell } from '../../ui/table/TotalCell';
import type { Column } from '../../ui/table/types';

/** Widths transcribed from `_ParcelsTab._widths`. */
export const PARCEL_WIDTHS = [88, 108, 96, 78, 84, 118, 96, 136, 130];

export interface ParcelTotals {
  originalQuantity: string;
  remainingQuantity: string;
  costBase: string;
  avgCost: string;
  eligibleUnits: string;
  pendingUnits: string;
}

/**
 * The Parcels tab. `now` is passed in rather than read here so the column set
 * stays a pure function of its inputs -- the same reason the engine takes no
 * clock reads.
 */
export function parcelColumns(
  now: Date,
  totals: ParcelTotals,
): Column<Parcel>[] {
  const isEligible = (p: Parcel) =>
    now.getTime() > parcelTwelveMonthDate(p).getTime();

  const [w0, w1, w2, w3, w4, w5, w6, w7, w8] = PARCEL_WIDTHS as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];

  return [
    {
      key: 'parcel',
      label: 'PARCEL',
      width: w0,
      render: (p) => (
        <Mono className="text-[12px] text-mid">{`P-${p.id.substring(0, 8)}`}</Mono>
      ),
      renderTotal: () => <TotalCell text="TOTAL" label />,
    },
    {
      key: 'acquired',
      label: 'ACQUIRED',
      width: w1,
      render: (p) => (
        <Mono className="text-[12.5px] text-strong">
          {formatDate(p.acquiredDate)}
        </Mono>
      ),
    },
    {
      key: 'fromTxn',
      label: 'FROM TXN',
      width: w2,
      render: (p) => (
        <Mono className="text-[12px] text-link">
          {`T-${p.openTransactionId.substring(0, 8)}`}
        </Mono>
      ),
    },
    {
      key: 'orig',
      label: 'ORIG',
      width: w3,
      align: 'right',
      render: (p) => (
        <Mono className="text-[12.5px] text-muted">
          {quantity(p.originalQuantity)}
        </Mono>
      ),
      renderTotal: () => <TotalCell text={totals.originalQuantity} />,
    },
    {
      key: 'remain',
      label: 'REMAIN',
      width: w4,
      align: 'right',
      render: (p) => (
        <Mono className="text-[12.5px] text-strong">
          {quantity(p.remainingQuantity)}
        </Mono>
      ),
      renderTotal: () => <TotalCell text={totals.remainingQuantity} />,
    },
    {
      key: 'costBase',
      label: 'COST BASE',
      width: w5,
      align: 'right',
      render: (p) => (
        <Mono className="text-[12.5px] text-strong">{money(p.costBase)}</Mono>
      ),
      renderTotal: () => <TotalCell text={totals.costBase} />,
    },
    {
      key: 'perUnit',
      label: 'PER UNIT',
      width: w6,
      align: 'right',
      render: (p) => (
        <Mono className="text-[12.5px] text-mid">
          {p.remainingQuantity.equals(ZERO) ? '—' : money(parcelPerUnit(p))}
        </Mono>
      ),
      renderTotal: () => <TotalCell text={totals.avgCost} />,
    },
    {
      key: 'held',
      label: '12-MONTH STATUS',
      width: w7,
      render: (p) => {
        const eligible = isEligible(p);
        return (
          <HeldStatusPill
            eligible={eligible}
            heldDate={`${eligible ? 'since' : 'from'} ${formatDate(
              parcelTwelveMonthDate(p),
            )}`}
          />
        );
      },
      renderTotal: () => (
        <TotalCell text={`${totals.eligibleUnits} eligible`} />
      ),
    },
    {
      key: 'state',
      label: 'PARCEL STATE',
      width: w8,
      render: (p) => (
        <Sans className="text-[11.5px] leading-[1.4] text-strong">
          {parcelFullyDepleted(p)
            ? 'Fully depleted'
            : parcelPartiallyDepleted(p)
              ? 'Partially depleted'
              : 'Open'}
        </Sans>
      ),
      renderTotal: () => <TotalCell text={`${totals.pendingUnits} pending`} />,
    },
  ];
}

/** Partially depleted parcels get a tint, as in the Flutter `rowBg`. */
export const parcelRowClassName = (p: Parcel) =>
  parcelPartiallyDepleted(p) ? 'bg-surface-parcel-tint' : 'bg-surface-card';
