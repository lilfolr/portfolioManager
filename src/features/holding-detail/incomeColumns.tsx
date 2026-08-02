import { formatDate } from '../../domain/dates';
import { money } from '../../domain/format';
import { incomeUnitsDisplay, type IncomeRow } from '../../domain/models';
import { Mono, Sans } from '../../ui/text';
import { TotalCell } from '../../ui/table/TotalCell';
import type { Column } from '../../ui/table/types';

/** Widths transcribed from `_IncomeTab._widths`. */
export const INCOME_WIDTHS = [118, 130, 80, 108, 108, 116, 112, 200];

export interface IncomeTotals {
  label: string;
  franked: string;
  unfranked: string;
  frankingCredit: string;
  cash: string;
}

export function incomeColumns(totals: IncomeTotals): Column<IncomeRow>[] {
  const [w0, w1, w2, w3, w4, w5, w6, w7] = INCOME_WIDTHS as [
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
      key: 'payDate',
      label: 'PAY DATE',
      width: w0,
      render: (i) => (
        <Mono className="text-[12.5px] text-strong">
          {formatDate(i.paymentDate)}
        </Mono>
      ),
      renderTotal: () => <TotalCell text={totals.label} label />,
    },
    {
      key: 'type',
      label: 'TYPE',
      width: w1,
      render: (i) => <Sans className="text-[12px] text-strong">{i.type}</Sans>,
    },
    {
      key: 'units',
      label: 'UNITS',
      width: w2,
      align: 'right',
      // Units held at record date would need point-in-time parcel replay,
      // which no view exposes. Shown as an em dash rather than derived.
      render: () => (
        <Mono className="text-[12.5px] text-mid">{incomeUnitsDisplay()}</Mono>
      ),
    },
    {
      key: 'franked',
      label: 'FRANKED',
      width: w3,
      align: 'right',
      render: (i) => (
        <Mono className="text-[12.5px] text-strong">{money(i.franked)}</Mono>
      ),
      renderTotal: () => <TotalCell text={totals.franked} />,
    },
    {
      key: 'unfranked',
      label: 'UNFRANKED',
      width: w4,
      align: 'right',
      render: (i) => (
        <Mono className="text-[12.5px] text-strong">{money(i.unfranked)}</Mono>
      ),
      renderTotal: () => <TotalCell text={totals.unfranked} />,
    },
    {
      key: 'frankingCredit',
      label: 'FRANKING CR',
      width: w5,
      align: 'right',
      render: (i) => (
        <Mono className="text-[12.5px] text-strong">
          {money(i.frankingCredit)}
        </Mono>
      ),
      renderTotal: () => <TotalCell text={totals.frankingCredit} />,
    },
    {
      key: 'cash',
      label: 'CASH',
      width: w6,
      align: 'right',
      render: (i) => (
        <Mono className="text-[12.5px] text-strong">{money(i.cash)}</Mono>
      ),
      renderTotal: () => <TotalCell text={totals.cash} />,
    },
    {
      key: 'statement',
      label: 'STATEMENT',
      width: w7,
      render: (i) => (
        <Mono
          className={`text-[11.5px] ${i.pending ? 'text-pending-text' : 'text-muted'}`}
        >
          {i.pending ? 'awaiting entry' : (i.componentStatement ?? '—')}
        </Mono>
      ),
    },
  ];
}
