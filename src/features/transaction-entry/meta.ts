import type { TransactionType } from '../../domain/wire';

/**
 * Static metadata for the eight manual-entry transaction types. Ported
 * verbatim from the `_TxnTypeMeta` extension in
 * `lib/screens/transaction_entry_screen.dart`.
 *
 * The copy here is load-bearing, not decoration. Every hint and effect line
 * states what the ledger will do; none of it evaluates, compares or
 * recommends. The ROC line about excess becoming a capital gain describes the
 * intended behaviour -- note that the engine currently floors cost base at
 * zero without emitting that gain, a divergence worth closing separately.
 */
export type TxnTypeKey =
  'buy' | 'sell' | 'drp' | 'div' | 'dist' | 'split' | 'roc' | 'tin';

export interface TxnTypeMeta {
  label: string;
  /** The transaction_type enum value written to the ledger. */
  dbType: TransactionType;
  /** One-line description under the type picker. */
  hint: string;
  /** The numbered "EFFECT ON THE LEDGER" list. Empty for SELL, which shows
   * the parcel-matching panel instead. */
  effectLines: string[];
  /** The note beneath the save buttons. */
  saveNote: string;
}

const IMMUTABLE_NOTE =
  'Saved records are immutable. Corrections are entered as reversing transactions.';

export const TXN_TYPE_ORDER: TxnTypeKey[] = [
  'buy',
  'sell',
  'drp',
  'div',
  'dist',
  'split',
  'roc',
  'tin',
];

export const TXN_TYPES: Record<TxnTypeKey, TxnTypeMeta> = {
  buy: {
    label: 'Buy',
    dbType: 'BUY',
    hint: 'Creates a new parcel dated on the trade date. Brokerage is added to the cost base.',
    effectLines: [
      'Creates a new parcel dated on the trade date. Cost base = consideration + brokerage.',
      'Average cost across the holding updates across all open parcels.',
      'Recorded with manual provenance and the entering user.',
    ],
    saveNote: IMMUTABLE_NOTE,
  },
  sell: {
    label: 'Sell',
    dbType: 'SELL',
    hint: 'Depletes existing parcels. Parcel selection is required before the disposal can be saved.',
    effectLines: [],
    saveNote:
      'Save is blocked until every disposed unit is matched to a parcel.',
  },
  drp: {
    label: 'DRP',
    dbType: 'DRP',
    hint: 'Creates a new parcel at the allocation price. The 12-month clock starts on the issue date, not the original holding.',
    effectLines: [
      'Creates a new parcel dated on the payment date at the allocation price.',
      'The 12-month date for the new parcel runs from the issue date, not the original holding.',
      'Residual cash is held against the holding and is not treated as income.',
    ],
    saveNote: IMMUTABLE_NOTE,
  },
  div: {
    label: 'Dividend',
    dbType: 'DIVIDEND',
    hint: 'Income only. No parcel is created or changed.',
    effectLines: [
      'No parcel change. Recorded against the current financial year income.',
      'Franking credit is stored exactly as stated on the statement.',
      'Appears in the income summary and the FY franking credit total.',
    ],
    saveNote: 'Save is blocked while the franking credit field is blank.',
  },
  dist: {
    label: 'Distribution',
    dbType: 'DISTRIBUTION',
    hint: 'Income only. Components are transcribed separately from the annual tax statement.',
    effectLines: [
      'Cash received recorded against the current financial year income.',
      'Marked components pending until the annual tax statement is transcribed.',
      'Tax-deferred and CGT concession components will adjust parcel cost bases on entry.',
    ],
    saveNote: IMMUTABLE_NOTE,
  },
  split: {
    label: 'Split / consolidation',
    dbType: 'SPLIT',
    hint: 'Restates units across all open parcels. Total cost base and acquisition dates are unchanged.',
    effectLines: [
      'Units restated across all open parcels at the entered ratio.',
      'Total cost base unchanged; per-unit cost base recalculated per parcel.',
      'Acquisition dates unchanged, so 12-month status is preserved.',
    ],
    saveNote: IMMUTABLE_NOTE,
  },
  roc: {
    label: 'Return of capital',
    dbType: 'RETURN_OF_CAPITAL',
    hint: 'Reduces the cost base of parcels held at the record date. No income is recorded.',
    effectLines: [
      'Reduces the cost base of parcels held at record date by the amount per unit.',
      'No income is recorded for this payment.',
      'If a parcel cost base reaches zero, the excess is recorded as a capital gain, itemised per parcel.',
    ],
    saveNote: IMMUTABLE_NOTE,
  },
  tin: {
    label: 'Transfer in',
    dbType: 'TRANSFER_IN',
    hint: 'Carries the original acquisition date and cost base, so 12-month status is inherited.',
    effectLines: [
      'Creates a parcel carrying the original acquisition date and cost base.',
      '12-month status is inherited from the original acquisition, not the transfer date.',
      'Evidence must be attached before the transfer can be confirmed.',
    ],
    saveNote: IMMUTABLE_NOTE,
  },
};
