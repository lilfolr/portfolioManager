import { View } from 'react-native';

import { formatDate } from '../../domain/dates';
import { money, quantity } from '../../domain/format';
import type { Txn, TxnKind } from '../../domain/models';
import type { LedgerPalette } from '../../theme/use-ledger-colors';
import { SourceDotChip } from '../../ui/chips';
import { Mono, Sans } from '../../ui/text';
import type { Column } from '../../ui/table/types';

/** Widths transcribed from `_TxnsTab._widths`. */
export const TXN_WIDTHS = [88, 108, 118, 76, 92, 116, 300, 116];

export const KIND_LABEL: Record<TxnKind, string> = {
  csv: 'CSV',
  email: 'EMAIL',
  manual: 'MANUAL',
};

/** Provenance colours are keyed by kind at runtime, so they come from the palette. */
export const kindColor = (colors: LedgerPalette, kind: TxnKind): string =>
  kind === 'csv'
    ? colors.link
    : kind === 'email'
      ? colors.pendingText
      : colors.mid;

/** Provenance text token class, matching the dot. */
const kindTextClass = (kind: TxnKind): string =>
  kind === 'csv'
    ? 'text-link'
    : kind === 'email'
      ? 'text-pending-text'
      : 'text-mid';

export function txnColumns(colors: LedgerPalette): Column<Txn>[] {
  const [w0, w1, w2, w3, w4, w5, w6, w7] = TXN_WIDTHS as [
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
      key: 'txn',
      label: 'TXN',
      width: w0,
      render: (t) => (
        <Mono className="text-[12px] text-link">{`T-${t.id.substring(0, 8)}`}</Mono>
      ),
    },
    {
      key: 'date',
      label: 'DATE',
      width: w1,
      render: (t) => (
        <Mono className="text-[12.5px] text-strong">
          {formatDate(t.tradeDate)}
        </Mono>
      ),
    },
    {
      key: 'type',
      label: 'TYPE',
      width: w2,
      render: (t) => <Sans className="text-[12px] text-strong">{t.type}</Sans>,
    },
    {
      key: 'units',
      label: 'UNITS',
      width: w3,
      align: 'right',
      render: (t) => (
        <Mono className="text-[12.5px] text-strong">
          {t.quantity === null ? '—' : quantity(t.quantity)}
        </Mono>
      ),
    },
    {
      key: 'price',
      label: 'PRICE',
      width: w4,
      align: 'right',
      render: (t) => (
        <Mono className="text-[12.5px] text-mid">
          {t.unitPrice === null ? '—' : money(t.unitPrice)}
        </Mono>
      ),
    },
    {
      key: 'amount',
      label: 'AMOUNT',
      width: w5,
      align: 'right',
      render: (t) => (
        <Mono className="text-[12.5px] text-strong">
          {t.amount === null ? '—' : money(t.amount)}
        </Mono>
      ),
    },
    {
      key: 'provenance',
      label: 'PROVENANCE',
      width: w6,
      render: (t) => (
        <View className="flex-row items-center">
          <SourceDotChip
            label={KIND_LABEL[t.kind]}
            dotColor={kindColor(colors, t.kind)}
            textClassName={kindTextClass(t.kind)}
            dense
          />
          <Mono
            numberOfLines={1}
            className="ml-2 flex-1 text-[11.5px] text-muted"
          >
            {t.source}
          </Mono>
        </View>
      ),
    },
    {
      key: 'parcel',
      label: 'PARCEL',
      width: w7,
      render: (t) => (
        <Mono className="text-[11.5px] text-strong">{t.parcelInfo}</Mono>
      ),
    },
  ];
}
