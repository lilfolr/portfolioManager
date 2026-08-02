import type { TxnTypeKey } from './meta';

/**
 * One row in the left-hand fields panel. Ported verbatim from `_FieldSpec` and
 * the `_fieldSpecs` map in `lib/screens/transaction_entry_screen.dart`.
 *
 * `warningIfBlank` marks the franking-credit field: a value that must be
 * transcribed from the statement and is never derived, so leaving it blank is
 * called out rather than silently defaulted.
 */
export interface FieldSpec {
  label: string;
  key: string;
  placeholder?: string;
  hint?: string;
  rightAlign?: boolean;
  warningIfBlank?: boolean;
  readOnly?: boolean;
}

export const FIELD_SPECS: Record<TxnTypeKey, FieldSpec[]> = {
  buy: [
    {
      label: 'Trade date',
      key: 'trade_date',
      placeholder: 'DD/MM/YYYY',
      hint: 'settlement T+2',
    },
    { label: 'Symbol', key: 'symbol', placeholder: 'e.g. VAS', hint: 'ASX' },
    { label: 'Units', key: 'units', placeholder: '0', rightAlign: true },
    {
      label: 'Unit price',
      key: 'unit_price',
      placeholder: '0.00',
      hint: 'AUD',
      rightAlign: true,
    },
    {
      label: 'Brokerage',
      key: 'brokerage',
      placeholder: '0.00',
      hint: 'added to cost base',
      rightAlign: true,
    },
    {
      label: 'Source account',
      key: 'account',
      placeholder: 'e.g. CommSec 0421',
    },
    {
      label: 'Reference',
      key: 'ref',
      placeholder: 'not stated',
      hint: 'optional',
    },
  ],
  sell: [
    {
      label: 'Trade date',
      key: 'trade_date',
      placeholder: 'DD/MM/YYYY',
      hint: 'settlement T+2',
    },
    { label: 'Symbol', key: 'symbol', placeholder: 'e.g. VAS', hint: 'ASX' },
    { label: 'Units', key: 'units', placeholder: '0', rightAlign: true },
    {
      label: 'Unit price',
      key: 'unit_price',
      placeholder: '0.00',
      hint: 'AUD',
      rightAlign: true,
    },
    {
      label: 'Brokerage',
      key: 'brokerage',
      placeholder: '0.00',
      hint: 'reduces proceeds',
      rightAlign: true,
    },
    {
      label: 'Source account',
      key: 'account',
      placeholder: 'e.g. CommSec 0421',
    },
    {
      label: 'Reference',
      key: 'ref',
      placeholder: 'not stated',
      hint: 'optional',
    },
  ],
  drp: [
    { label: 'Payment date', key: 'trade_date', placeholder: 'DD/MM/YYYY' },
    { label: 'Symbol', key: 'symbol', placeholder: 'e.g. VAS', hint: 'ASX' },
    { label: 'Units issued', key: 'units', placeholder: '0', rightAlign: true },
    {
      label: 'Allocation price',
      key: 'unit_price',
      placeholder: '0.00',
      hint: 'AUD',
      rightAlign: true,
    },
    {
      label: 'Residual carried forward',
      key: 'residual',
      placeholder: '0.00',
      hint: 'to next DRP',
      rightAlign: true,
    },
    {
      label: 'Source account',
      key: 'account',
      placeholder: 'e.g. Computershare · SRN',
    },
  ],
  div: [
    { label: 'Payment date', key: 'trade_date', placeholder: 'DD/MM/YYYY' },
    { label: 'Symbol', key: 'symbol', placeholder: 'e.g. TLS', hint: 'ASX' },
    {
      label: 'Franked amount',
      key: 'franked',
      placeholder: '0.00',
      rightAlign: true,
    },
    {
      label: 'Unfranked amount',
      key: 'unfranked',
      placeholder: '0.00',
      rightAlign: true,
    },
    {
      label: 'Franking credit',
      key: 'franking_credit',
      placeholder: 'not stated',
      hint: 'from statement',
      rightAlign: true,
      warningIfBlank: true,
    },
    { label: 'Source account', key: 'account', placeholder: 'e.g. MUFG · SRN' },
  ],
  dist: [
    { label: 'Payment date', key: 'trade_date', placeholder: 'DD/MM/YYYY' },
    { label: 'Symbol', key: 'symbol', placeholder: 'e.g. VAS', hint: 'ASX' },
    {
      label: 'Cash received',
      key: 'cash',
      placeholder: '0.00',
      rightAlign: true,
    },
    {
      label: 'Units at record date',
      key: 'units',
      placeholder: '0',
      rightAlign: true,
    },
    {
      label: 'Source account',
      key: 'account',
      placeholder: 'e.g. CommSec 0421',
    },
  ],
  split: [
    { label: 'Effective date', key: 'trade_date', placeholder: 'DD/MM/YYYY' },
    { label: 'Symbol', key: 'symbol', placeholder: 'e.g. TLS', hint: 'ASX' },
    {
      label: 'Ratio new : old',
      key: 'ratio',
      placeholder: 'e.g. 2 : 1',
      rightAlign: true,
    },
    {
      label: 'Applies to',
      key: 'applies_to',
      placeholder: 'all open parcels',
      readOnly: true,
    },
  ],
  roc: [
    { label: 'Payment date', key: 'trade_date', placeholder: 'DD/MM/YYYY' },
    { label: 'Symbol', key: 'symbol', placeholder: 'e.g. ARG', hint: 'ASX' },
    {
      label: 'Amount per unit',
      key: 'amount_per_unit',
      placeholder: '0.0000',
      rightAlign: true,
    },
    {
      label: 'Units at record date',
      key: 'units',
      placeholder: '0',
      rightAlign: true,
    },
    {
      label: 'Total',
      key: 'total',
      placeholder: '0.00',
      hint: 'reduces cost base',
      rightAlign: true,
      readOnly: true,
    },
    {
      label: 'Source account',
      key: 'account',
      placeholder: 'e.g. Computershare · SRN',
    },
  ],
  tin: [
    { label: 'Transfer date', key: 'trade_date', placeholder: 'DD/MM/YYYY' },
    { label: 'Symbol', key: 'symbol', placeholder: 'e.g. BHP', hint: 'ASX' },
    { label: 'Units', key: 'units', placeholder: '0', rightAlign: true },
    {
      label: 'Original acquisition date',
      key: 'orig_date',
      placeholder: 'DD/MM/YYYY',
      hint: 'carries over',
    },
    {
      label: 'Original cost base',
      key: 'orig_cost',
      placeholder: '0.00',
      hint: 'carries over',
      rightAlign: true,
    },
    { label: 'From', key: 'from_broker', placeholder: 'e.g. external broker' },
    {
      label: 'To account',
      key: 'account',
      placeholder: 'e.g. Computershare · SRN',
    },
  ],
};

/** The blank-value warning shown under a `warningIfBlank` field. */
export const NOT_STATED_WARNING =
  'Not stated in the source. Enter from the statement — this value is never derived.';
