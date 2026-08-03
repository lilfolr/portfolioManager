import { D, Decimal, ZERO, div } from './decimal';

/**
 * Port of `lib/models/portfolio.dart`.
 *
 * Quantities and money are `Decimal` end to end -- see CLAUDE.md's money rules
 * and `20260801000004_views.sql`'s comment on why every numeric column is cast
 * to text on the wire. `number` appears only in `format.ts`, at the point of
 * turning a figure into display text.
 *
 * Dart's classes carried computed getters; here they are free functions over
 * plain interfaces. That is not just style: Dart's `Decimal` overrides `==`, so
 * `remainingQuantity == Decimal.zero` was value equality, whereas in JS `===`
 * on two `Decimal` objects is reference equality and is silently always false.
 * Keeping the comparisons in named functions concentrates every one of them in
 * this file, where they use `.eq()` / `.isZero()` and are unit-tested.
 */

/** A brokerage/registry/property/cash account, as returned by `accounts`. */
export interface AccountRef {
  id: string;
  kind: string;
  displayName: string;
}

/**
 * A single share/ETF/fund position, one row per (instrument, account) -- the
 * grain the parcel engine itself uses.
 */
export interface Holding {
  instrumentId: string;
  accountId: string;
  symbol: string;
  name: string;
  exchange: string;
  units: Decimal;
  costBase: Decimal;
  /** Latest close, AUD. */
  price: Decimal;
  accountDisplayName: string;
  /**
   * Present only for holdings whose acquisitions were in a foreign currency;
   * built from the transaction's own stored `fx_rate_to_aud`, never a
   * looked-up rate.
   */
  fxSubLine?: string | null;
}

export const holdingValue = (h: Holding): Decimal => h.units.times(h.price);
export const holdingGain = (h: Holding): Decimal =>
  holdingValue(h).minus(h.costBase);
export const holdingGainPct = (h: Holding): Decimal =>
  div(holdingGain(h), h.costBase).times(D(100));
export const holdingAvgCost = (h: Holding): Decimal => div(h.costBase, h.units);

/** A parcel (tax lot), as computed by the parcel engine. */
export interface Parcel {
  id: string;
  openTransactionId: string;
  acquiredDate: Date;
  originalQuantity: Decimal;
  remainingQuantity: Decimal;
  costBase: Decimal;
  reducedCostBase: Decimal;
}

export const parcelPerUnit = (p: Parcel): Decimal =>
  div(p.costBase, p.remainingQuantity);

export const parcelPartiallyDepleted = (p: Parcel): boolean =>
  p.remainingQuantity.greaterThan(ZERO) &&
  p.remainingQuantity.lessThan(p.originalQuantity);

export const parcelFullyDepleted = (p: Parcel): boolean =>
  p.remainingQuantity.isZero();

/**
 * Date the CGT discount's 12-month holding period is reached. A date fact, not
 * a tax conclusion -- `discount_eligible` itself is computed at disposal, not
 * stored on the parcel (see `engine.ts`'s `isDiscountEligible`).
 */
export const parcelTwelveMonthDate = (p: Parcel): Date =>
  new Date(
    Date.UTC(
      p.acquiredDate.getUTCFullYear() + 1,
      p.acquiredDate.getUTCMonth(),
      p.acquiredDate.getUTCDate(),
    ),
  );

export type TxnKind = 'csv' | 'email' | 'manual';

/**
 * A single immutable transaction record, from `v_active_transactions` joined to
 * its import provenance.
 */
export interface Txn {
  id: string;
  tradeDate: Date;
  type: string;
  quantity: Decimal | null;
  unitPrice: Decimal | null;
  amount: Decimal | null;
  kind: TxnKind;
  /** e.g. `commsec-2024-fy.csv · row 118`. */
  source: string;
  /**
   * e.g. `P-0002 · FIFO`, or `components pending` for an unconfirmed
   * distribution. Built by the repository from the parcel-engine result
   * (opens) and `disposals` (sells) -- never invented client-side.
   */
  parcelInfo: string;
}

/** A distribution/dividend income row, from `v_income_summary`. */
export interface IncomeRow {
  paymentDate: Date;
  financialYear: number;
  type: string;
  franked: Decimal;
  unfranked: Decimal;
  frankingCredit: Decimal;
  cash: Decimal;
  componentStatement: string | null;
  pending: boolean;
}

/**
 * Units held at record date is not available -- it would require replaying
 * parcel state as of a past date, which no view currently exposes. Rendered as
 * an em dash rather than derived.
 */
export const incomeUnitsDisplay = (): string => '—';

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

/** Mirrors the `import_source_status` enum. `voided` means the job was
 * discarded: its transactions still exist but no longer count. */
export type ImportStatus = 'pending' | 'processed' | 'error' | 'voided';

/** Mirrors the `staged_row_status` enum. */
export type StagedRowStatus = 'pending' | 'confirmed' | 'rejected';

/**
 * One thing wrong with, or worth saying about, one staged row. Same shape the
 * mapper writes into `staged_rows.issues`.
 *
 * `blocking` is the distinction that matters: a blocking issue means the row
 * cannot become a valid transaction and confirm will refuse it. A non-blocking
 * one -- a duplicate suspicion, a ragged row -- is information for the user,
 * who decides (CLAUDE.md rule 4).
 */
export interface RowIssue {
  code: string;
  field: string | null;
  message: string;
  blocking: boolean;
}

/** One import job, from `v_import_jobs`. */
export interface ImportJob {
  id: string;
  kind: TxnKind;
  /** The uploaded filename, or the message id for an email import. */
  label: string;
  importedAt: Date;
  status: ImportStatus;
  /** `{profileId}@{version}`, e.g. `native@1`. Null for manual entry. */
  parserVersion: string | null;
  rawBlobRef: string | null;
  total: number;
  pending: number;
  confirmed: number;
  rejected: number;
  blocked: number;
  withIssues: number;
  errorMessage: string | null;
}

/** True once every row has been dealt with one way or another. */
export const importJobSettled = (job: ImportJob): boolean =>
  job.status !== 'pending' && job.pending === 0;

/** Rows this job could still put on the ledger. */
export const importJobConfirmable = (job: ImportJob): number =>
  Math.max(0, job.pending - job.blocked);

/** One row awaiting review, from `staged_rows`. */
export interface ReviewRow {
  id: string;
  sourceId: string;
  rowNumber: number | null;
  status: StagedRowStatus;
  issues: RowIssue[];
  transactionId: string | null;
  /** Null when the row could not be parsed into a transaction at all. */
  parsed: {
    type: string;
    tradeDate: string;
    instrumentId: string | null;
    quantity: Decimal | null;
    unitPrice: Decimal | null;
    brokerage: Decimal;
    currency: string;
    externalRef: string | null;
  } | null;
  /** The original cells, for showing what the file actually said. */
  raw: Record<string, string>;
}

export const reviewRowBlocked = (row: ReviewRow): boolean =>
  row.issues.some((issue) => issue.blocking);

/** Confirmable means pending, parsed, and not blocked -- the same predicate
 * `confirm_import_source` uses server-side. */
export const reviewRowConfirmable = (row: ReviewRow): boolean =>
  row.status === 'pending' && row.parsed !== null && !reviewRowBlocked(row);
