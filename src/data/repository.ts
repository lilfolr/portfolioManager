import {
  D,
  Decimal,
  ZERO,
  decimalFromWire,
  decimalFromWireOrNull,
  divScale,
} from '../domain/decimal';
import {
  parcelFullyDepleted,
  type AccountRef,
  type Holding,
  type ImportJob,
  type ImportStatus,
  type IncomeRow,
  type Parcel,
  type ReviewRow,
  type RowIssue,
  type StagedRowStatus,
  type Txn,
  type TxnKind,
} from '../domain/models';
import type { WireDisposal, WireParcel } from '../domain/wire';
import {
  commitImport,
  confirmImportSource,
  confirmStagedRows,
  fetchAccounts,
  fetchActiveTransactions,
  fetchImportJobs as apiFetchImportJobs,
  fetchImportSources,
  fetchIncomeSummary,
  fetchInstruments,
  fetchLatestPrices,
  fetchParcelsAndDisposals,
  fetchStagedRows,
  fetchStagedRowsForReview,
  importObjectPath,
  previewImport,
  rejectImportSource,
  rejectStagedRows,
  removeImportFile,
  uploadImportFile,
  voidImportSource,
  confirmStagedRow,
  insertManualStagedRow,
  type Row,
} from './api';

/**
 * Composes the raw reads in `api.ts` into the view models the screens need.
 * Port of `lib/data/portfolio_repository.dart`. Each public function here is
 * meant to sit behind one react-query `useQuery` -- no component should call
 * `api.ts` directly.
 */

const date = (value: unknown): Date => new Date(String(value));
const str = (value: unknown): string => String(value ?? '');

/** The engine's `Parcel`, with its decimal strings converted. */
interface EngineParcel {
  id: string;
  instrumentId: string;
  accountId: string;
  openTransactionId: string;
  acquiredDate: Date;
  originalQuantity: Decimal;
  remainingQuantity: Decimal;
  costBase: Decimal;
  reducedCostBase: Decimal;
  costBaseNative: Decimal | null;
  currency: string;
}

const toEngineParcel = (p: WireParcel): EngineParcel => ({
  id: p.id,
  instrumentId: p.instrumentId,
  accountId: p.accountId,
  openTransactionId: p.openTransactionId,
  acquiredDate: date(p.acquiredDate),
  originalQuantity: decimalFromWire(p.originalQuantity),
  remainingQuantity: decimalFromWire(p.remainingQuantity),
  costBase: decimalFromWire(p.costBase),
  reducedCostBase: decimalFromWire(p.reducedCostBase),
  costBaseNative: decimalFromWireOrNull(p.costBaseNative),
  currency: p.currency,
});

async function fetchEngineResult(
  instrumentId?: string,
): Promise<{ parcels: EngineParcel[]; disposals: WireDisposal[] }> {
  const json = await fetchParcelsAndDisposals(instrumentId);
  return {
    parcels: (json.parcels ?? []).map(toEngineParcel),
    disposals: json.disposals ?? [],
  };
}

/**
 * The Holdings screen's rows: one per (instrument, account) with an open
 * (non-zero remaining quantity) parcel, grouped and summed.
 */
export async function fetchHoldings(): Promise<Holding[]> {
  const [engine, instrumentRows, accountRows, priceRows] = await Promise.all([
    fetchEngineResult(),
    fetchInstruments(),
    fetchAccounts(),
    fetchLatestPrices(),
  ]);

  const instruments = new Map(instrumentRows.map((i) => [str(i.id), i]));
  const accounts = new Map(accountRows.map((a) => [str(a.id), a]));
  const prices = new Map(priceRows.map((p) => [str(p.instrument_id), p]));

  const groups = new Map<string, EngineParcel[]>();
  for (const p of engine.parcels) {
    if (p.remainingQuantity.lessThanOrEqualTo(ZERO)) continue;
    const key = `${p.instrumentId}|${p.accountId}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }

  const holdings: Holding[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const instrument = instruments.get(first.instrumentId);
    const account = accounts.get(first.accountId);
    if (!instrument || !account) continue;

    const units = group.reduce((s, p) => s.plus(p.remainingQuantity), ZERO);
    const costBase = group.reduce((s, p) => s.plus(p.costBase), ZERO);
    const price = decimalFromWire(prices.get(first.instrumentId)?.close);

    let fxSubLine: string | null = null;
    const foreign = group.filter((p) => p.currency !== 'AUD');
    const foreignFirst = foreign[0];
    if (foreignFirst) {
      const nativeCost = foreign.reduce(
        (s, p) => s.plus(p.costBaseNative ?? ZERO),
        ZERO,
      );
      const foreignAudCost = foreign.reduce((s, p) => s.plus(p.costBase), ZERO);
      const foreignUnits = foreign.reduce(
        (s, p) => s.plus(p.remainingQuantity),
        ZERO,
      );
      if (nativeCost.greaterThan(ZERO) && foreignUnits.greaterThan(ZERO)) {
        const avgNative = divScale(nativeCost, foreignUnits, 4);
        const fxRate = divScale(foreignAudCost, nativeCost, 4);
        fxSubLine =
          `${foreignFirst.currency} ${avgNative.toString()} avg cost · ` +
          `FX ${fxRate.toString()} to AUD at trade date`;
      }
    }

    holdings.push({
      instrumentId: first.instrumentId,
      accountId: first.accountId,
      symbol: str(instrument.symbol),
      name: str(instrument.name),
      exchange: str(instrument.exchange),
      units,
      costBase,
      price,
      accountDisplayName: str(account.display_name),
      fxSubLine,
    });
  }

  // Descending by market value, matching `holdings.sort((a, b) =>
  // b.value.compareTo(a.value))`.
  holdings.sort((a, b) =>
    b.units.times(b.price).comparedTo(a.units.times(a.price)),
  );
  return holdings;
}

export async function fetchAccountRefs(): Promise<AccountRef[]> {
  const rows = await fetchAccounts();
  return rows.map((r) => ({
    id: str(r.id),
    kind: str(r.kind),
    displayName: str(r.display_name),
  }));
}

/**
 * All open parcels for one (instrument, account), oldest first (FIFO disposal
 * order) -- the Holding Detail screen's Parcels tab.
 */
export async function fetchParcelsFor(args: {
  instrumentId: string;
  accountId: string;
}): Promise<Parcel[]> {
  const { parcels } = await fetchEngineResult(args.instrumentId);
  return parcels
    .filter((p) => p.accountId === args.accountId)
    .sort((a, b) => a.acquiredDate.getTime() - b.acquiredDate.getTime())
    .map((p) => ({
      id: p.id,
      openTransactionId: p.openTransactionId,
      acquiredDate: p.acquiredDate,
      originalQuantity: p.originalQuantity,
      remainingQuantity: p.remainingQuantity,
      costBase: p.costBase,
      reducedCostBase: p.reducedCostBase,
    }));
}

const OPEN_TYPES = new Set(['BUY', 'DRP', 'TRANSFER_IN']);

/**
 * Transactions for one (instrument, account), newest first, with provenance and
 * parcel linkage resolved -- the Transactions tab.
 */
export async function fetchTxnsFor(args: {
  instrumentId: string;
  accountId: string;
}): Promise<Txn[]> {
  const [allTxnRows, sourceRows, stagedRowsData, engine] = await Promise.all([
    fetchActiveTransactions(args.instrumentId),
    fetchImportSources(),
    fetchStagedRows(),
    fetchEngineResult(args.instrumentId),
  ]);

  const txnRows = allTxnRows.filter(
    (t) => str(t.account_id) === args.accountId,
  );
  const sources = new Map(sourceRows.map((s) => [str(s.id), s]));

  const rowNumberByTxn = new Map<string, number>();
  for (const s of stagedRowsData) {
    if (s.transaction_id === null || s.transaction_id === undefined) continue;
    rowNumberByTxn.set(str(s.transaction_id), Number(s.row_number ?? 0));
  }

  const disposalsBySell = new Map<string, WireDisposal[]>();
  for (const d of engine.disposals) {
    const bucket = disposalsBySell.get(d.sellTransactionId);
    if (bucket) bucket.push(d);
    else disposalsBySell.set(d.sellTransactionId, [d]);
  }

  const txns: Txn[] = txnRows.map((row) => {
    const id = str(row.id);
    const type = str(row.type);
    const sourceId = row.source_id === null ? null : str(row.source_id);
    const importSource = sourceId ? sources.get(sourceId) : undefined;

    const kindValue = importSource?.kind;
    const kind: TxnKind =
      kindValue === 'csv' ? 'csv' : kindValue === 'email' ? 'email' : 'manual';

    const rowNumber = rowNumberByTxn.get(id);
    const filename = importSource?.filename_or_message_id;
    const source = !importSource
      ? 'manual entry'
      : rowNumber !== undefined
        ? `${str(filename)} · row ${rowNumber}`
        : filename === null || filename === undefined
          ? '—'
          : str(filename);

    let parcelInfo: string;
    if (OPEN_TYPES.has(type)) {
      parcelInfo = `P-${id.substring(0, 8)}`;
    } else if (type === 'SELL') {
      const disposals = disposalsBySell.get(id) ?? [];
      parcelInfo =
        disposals.length === 0
          ? '—'
          : `${disposals.map((d) => `P-${d.parcelId.substring(0, 8)}`).join(', ')} · FIFO`;
    } else if (type === 'DISTRIBUTION' || type === 'DIVIDEND') {
      parcelInfo = 'components pending';
    } else {
      parcelInfo = '—';
    }

    const hasAmount =
      row.quantity !== null &&
      row.quantity !== undefined &&
      row.unit_price !== null &&
      row.unit_price !== undefined;

    return {
      id,
      tradeDate: date(row.trade_date),
      type,
      quantity: decimalFromWireOrNull(row.quantity),
      unitPrice: decimalFromWireOrNull(row.unit_price),
      amount: hasAmount
        ? decimalFromWire(row.quantity).times(decimalFromWire(row.unit_price))
        : null,
      kind,
      source,
      parcelInfo,
    };
  });

  txns.sort((a, b) => b.tradeDate.getTime() - a.tradeDate.getTime());
  return txns;
}

/**
 * Everything the Holdings screen needs, fetched together so the screen sits
 * behind a single query.
 */
export interface HoldingsScreenData {
  holdings: Holding[];
  accounts: AccountRef[];
  incomeTotal: Decimal;
  frankingCreditTotal: Decimal;
  transactionCount: number;
  latestPriceDate: Date | null;
}

export async function fetchHoldingsScreenData(
  financialYear: number,
): Promise<HoldingsScreenData> {
  const [holdings, accounts, incomeRows, txnRows, priceRows] =
    await Promise.all([
      fetchHoldings(),
      fetchAccountRefs(),
      fetchIncomeSummary(),
      fetchActiveTransactions(),
      fetchLatestPrices(),
    ]);

  let incomeTotal = ZERO;
  let frankingCreditTotal = ZERO;
  for (const r of incomeRows) {
    if (Number(r.financial_year) === financialYear) {
      incomeTotal = incomeTotal.plus(decimalFromWire(r.gross_amount));
      frankingCreditTotal = frankingCreditTotal.plus(
        decimalFromWire(r.franking_credit),
      );
    }
  }

  let latestPriceDate: Date | null = null;
  for (const p of priceRows) {
    const d = date(p.price_date);
    if (latestPriceDate === null || d.getTime() > latestPriceDate.getTime()) {
      latestPriceDate = d;
    }
  }

  return {
    holdings,
    accounts,
    incomeTotal,
    frankingCreditTotal,
    transactionCount: txnRows.length,
    latestPriceDate,
  };
}

/**
 * Everything the Holding Detail screen needs for one (instrument, account),
 * fetched together so the screen sits behind a single query.
 */
export interface HoldingDetailData {
  symbol: string;
  name: string;
  exchange: string;
  amitFlag: boolean;
  accountDisplayName: string;
  accountKind: string;
  units: Decimal;
  costBase: Decimal;
  price: Decimal;
  parcels: Parcel[];
  txns: Txn[];
  income: IncomeRow[];
}

export const detailValue = (d: HoldingDetailData): Decimal =>
  d.units.times(d.price);
export const detailGain = (d: HoldingDetailData): Decimal =>
  detailValue(d).minus(d.costBase);

export async function fetchHoldingDetail(args: {
  instrumentId: string;
  accountId: string;
}): Promise<HoldingDetailData> {
  const [instrumentRows, accountRows, priceRows, parcels, txns, income] =
    await Promise.all([
      fetchInstruments(),
      fetchAccounts(),
      fetchLatestPrices(),
      fetchParcelsFor(args),
      fetchTxnsFor(args),
      fetchIncomeFor(args),
    ]);

  const instrument = instrumentRows.find(
    (i) => str(i.id) === args.instrumentId,
  );
  if (!instrument) throw new Error(`instrument ${args.instrumentId} not found`);
  const account = accountRows.find((a) => str(a.id) === args.accountId);
  if (!account) throw new Error(`account ${args.accountId} not found`);

  const price = priceRows.find(
    (p) => str(p.instrument_id) === args.instrumentId,
  );

  const open = parcels.filter((p) => !parcelFullyDepleted(p));
  const units = open.reduce((s, p) => s.plus(p.remainingQuantity), ZERO);
  const costBase = open.reduce((s, p) => s.plus(p.costBase), ZERO);

  return {
    symbol: str(instrument.symbol),
    name: str(instrument.name),
    exchange: str(instrument.exchange),
    amitFlag: instrument.amit_flag === true,
    accountDisplayName: str(account.display_name),
    accountKind: str(account.kind),
    units,
    costBase,
    price: price ? decimalFromWire(price.close) : ZERO,
    parcels,
    txns,
    income,
  };
}

/**
 * Distributions/dividends for one (instrument, account) -- the Income tab.
 * `v_income_summary` isn't account-scoped by the view itself, so this filters
 * client-side on the `account_id` column it does carry.
 */
export async function fetchIncomeFor(args: {
  instrumentId: string;
  accountId: string;
}): Promise<IncomeRow[]> {
  const rows = await fetchIncomeSummary(args.instrumentId);
  return rows
    .filter((r) => str(r.account_id) === args.accountId)
    .map((r) => ({
      paymentDate: date(r.payment_date),
      financialYear: Number(r.financial_year),
      type: 'Distribution',
      franked: decimalFromWire(r.franked),
      unfranked: decimalFromWire(r.unfranked),
      frankingCredit: decimalFromWire(r.franking_credit),
      cash: decimalFromWire(r.gross_amount),
      componentStatement:
        r.statement_ref === null || r.statement_ref === undefined
          ? null
          : str(r.statement_ref),
      pending: r.components_status === 'pending',
    }))
    .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
}

// ---------------------------------------------------------------------------
// Manual transaction entry
// ---------------------------------------------------------------------------

/**
 * A single open parcel as presented to the transaction-entry SELL panel.
 * Derived from the parcel engine response; not stored separately.
 */
export interface OpenParcel {
  id: string;
  acquiredDate: Date;
  /** Remaining units available to be matched against a SELL. */
  available: Decimal;
  /** Cost base / remaining quantity, AUD. */
  costPerUnit: Decimal;
  /** True if the parcel has been held for more than 12 months as of today. */
  discountEligible: boolean;
}

/**
 * Open parcels (remaining_quantity > 0) for a given symbol and account, sorted
 * oldest-first for FIFO display. Empty if the symbol isn't in `instruments`.
 */
export async function fetchOpenParcels(args: {
  symbol: string;
  accountId: string;
}): Promise<OpenParcel[]> {
  const instruments = await fetchInstruments();
  const match = instruments.find(
    (i) => str(i.symbol).toUpperCase() === args.symbol.toUpperCase(),
  );
  if (!match) return [];

  const json = await fetchParcelsAndDisposals(str(match.id));
  const now = Date.now();

  const result: OpenParcel[] = [];
  for (const p of json.parcels ?? []) {
    if (p.accountId !== args.accountId) continue;
    const available = decimalFromWire(p.remainingQuantity);
    if (available.lessThanOrEqualTo(ZERO)) continue;
    const acquiredDate = date(p.acquiredDate);
    const twelveMonths = Date.UTC(
      acquiredDate.getUTCFullYear() + 1,
      acquiredDate.getUTCMonth(),
      acquiredDate.getUTCDate(),
    );
    result.push({
      id: p.id,
      acquiredDate,
      available,
      costPerUnit: divScale(decimalFromWire(p.costBase), available, 10),
      discountEligible: now > twelveMonths,
    });
  }

  result.sort((a, b) => a.acquiredDate.getTime() - b.acquiredDate.getTime());
  return result;
}

/**
 * Atomic manual-entry save: stages the payload, then immediately confirms it
 * through `confirm_staged_row()`. Returns the confirmed transaction's UUID.
 *
 * The payload must include at minimum the fields `confirm_staged_row()` reads
 * from `parsed_payload`: account_id, instrument_id, type, trade_date. Optional
 * numeric fields (quantity, unit_price, brokerage, fees, currency,
 * fx_rate_to_aud, external_ref) are passed through as-is.
 */
export async function submitManualTransaction(payload: Row): Promise<string> {
  const stagedRowId = await insertManualStagedRow(payload);
  const txn = await confirmStagedRow(stagedRowId);
  return str(txn.id);
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

const int = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** `import_kind` -> `TxnKind`, the same mapping `fetchTxnsFor` uses for
 * provenance labels. */
const toKind = (value: unknown): TxnKind =>
  value === 'csv' ? 'csv' : value === 'email' ? 'email' : 'manual';

const toStatus = (value: unknown): ImportStatus => {
  const text = str(value);
  return text === 'processed' || text === 'error' || text === 'voided'
    ? text
    : 'pending';
};

/** Defensive: `issues` is jsonb and only our own writer fills it, but a
 * malformed value should render as "no issues" rather than crash a screen. */
function toIssues(value: unknown): RowIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const issue = entry as Record<string, unknown>;
    return [
      {
        code: str(issue.code),
        field: issue.field === null || issue.field === undefined
          ? null
          : str(issue.field),
        message: str(issue.message),
        blocking: issue.blocking === true,
      },
    ];
  });
}

function toRawPayload(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {};
  const out: Record<string, string> = {};
  for (const [key, cell] of Object.entries(value)) out[key] = str(cell);
  return out;
}

export async function fetchImportJobs(): Promise<ImportJob[]> {
  const rows = await apiFetchImportJobs();
  return rows.map((row) => ({
    id: str(row.id),
    kind: toKind(row.kind),
    label: row.filename_or_message_id === null ? '—' : str(row.filename_or_message_id),
    importedAt: date(row.imported_at),
    status: toStatus(row.status),
    parserVersion:
      row.parser_version === null || row.parser_version === undefined
        ? null
        : str(row.parser_version),
    rawBlobRef:
      row.raw_blob_ref === null || row.raw_blob_ref === undefined
        ? null
        : str(row.raw_blob_ref),
    total: int(row.staged_total),
    pending: int(row.staged_pending),
    confirmed: int(row.staged_confirmed),
    rejected: int(row.staged_rejected),
    blocked: int(row.staged_blocked),
    withIssues: int(row.staged_with_issues),
    errorMessage:
      row.error_message === null || row.error_message === undefined
        ? null
        : str(row.error_message),
  }));
}

/** One page of the review queue. `hasMore` tells the caller whether to ask for
 * the next one -- PostgREST caps a response at 1000 rows. */
export interface ReviewPage {
  rows: ReviewRow[];
  hasMore: boolean;
}

export async function fetchImportReview(args: {
  sourceId?: string;
  status?: StagedRowStatus;
  page?: number;
  pageSize?: number;
}): Promise<ReviewPage> {
  const pageSize = args.pageSize ?? 200;
  const page = args.page ?? 0;
  const from = page * pageSize;
  // Ask for one more than we need, so "is there another page" needs no count.
  const rows = await fetchStagedRowsForReview({
    sourceId: args.sourceId,
    status: args.status ?? 'pending',
    from,
    to: from + pageSize,
  });

  return {
    rows: rows.slice(0, pageSize).map(toReviewRow),
    hasMore: rows.length > pageSize,
  };
}

function toReviewRow(row: Row): ReviewRow {
  const parsedPayload = row.parsed_payload as Record<string, unknown> | null;

  return {
    id: str(row.id),
    sourceId: str(row.source_id),
    rowNumber:
      row.row_number === null || row.row_number === undefined
        ? null
        : int(row.row_number),
    status: (['pending', 'confirmed', 'rejected'] as const).find(
      (status) => status === row.status,
    ) ?? 'pending',
    issues: toIssues(row.issues),
    transactionId:
      row.transaction_id === null || row.transaction_id === undefined
        ? null
        : str(row.transaction_id),
    raw: toRawPayload(row.raw_payload),
    parsed: parsedPayload
      ? {
          type: str(parsedPayload.type),
          tradeDate: str(parsedPayload.trade_date),
          instrumentId:
            parsedPayload.instrument_id === null ||
            parsedPayload.instrument_id === undefined
              ? null
              : str(parsedPayload.instrument_id),
          // The payload carries decimal strings on purpose; converting through
          // Decimal here is the same boundary rule the rest of the repository
          // follows -- never a float.
          quantity: decimalFromWireOrNull(parsedPayload.quantity),
          unitPrice: decimalFromWireOrNull(parsedPayload.unit_price),
          brokerage: decimalFromWire(parsedPayload.brokerage),
          currency: str(parsedPayload.currency || 'AUD'),
          externalRef:
            parsedPayload.external_ref === null ||
            parsedPayload.external_ref === undefined
              ? null
              : str(parsedPayload.external_ref),
        }
      : null,
  };
}

export interface ConfirmProgress {
  confirmed: number;
  total: number;
}

/**
 * Confirms every confirmable row of one import, batch by batch, reporting
 * progress as it goes.
 *
 * The loop lives here rather than in the RPC so a large import shows movement
 * instead of a spinner that appears to hang, and so no single call has to
 * finish inside one statement timeout. It stops when the server says nothing
 * is left, or when a batch confirms nothing -- which means the remainder is
 * blocked and looping again would never terminate.
 */
export async function confirmWholeImport(
  sourceId: string,
  onProgress?: (progress: ConfirmProgress) => void,
): Promise<number> {
  let confirmed = 0;
  for (;;) {
    const batch = await confirmImportSource(sourceId);
    confirmed += batch.confirmed;
    onProgress?.({ confirmed, total: confirmed + batch.remaining });
    if (batch.remaining === 0 || batch.confirmed === 0) return confirmed;
  }
}

export async function confirmReviewRows(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const created = await confirmStagedRows(ids);
  return created.length;
}

export { rejectImportSource, rejectStagedRows, voidImportSource };

/**
 * Uploads a file and asks the edge function what importing it would do,
 * without writing anything to the ledger.
 *
 * The upload happens first because parsing is server-side over the retained
 * blob -- so what the preview describes is exactly what a later commit, or a
 * reprocess after a parser fix, would read.
 */
export async function startImport(args: {
  userId: string;
  file: Blob;
  filename: string;
  accountId: string;
  profileId?: string;
}): Promise<{ importId: string; storagePath: string; preview: Row }> {
  // Client-generated so it can name the storage folder and then be reused as
  // the import_sources primary key, which is what makes a double-clicked
  // commit land as one job rather than two.
  const importId = newImportId();
  const storagePath = importObjectPath(args.userId, importId, args.filename);

  await uploadImportFile(storagePath, args.file);
  const preview = await previewImport({
    importId,
    storagePath,
    filename: args.filename,
    accountId: args.accountId,
    profileId: args.profileId,
  });

  return { importId, storagePath, preview };
}

export async function finishImport(request: {
  importId: string;
  storagePath: string;
  filename: string;
  accountId: string;
  profileId?: string;
}): Promise<string> {
  const result = await commitImport(request);
  return str(result.sourceId);
}

/** Abandons an upload the user did not commit, so the bucket does not collect
 * orphans. Best effort -- a failure here must not surface as an import error. */
export async function abandonImport(storagePath: string): Promise<void> {
  try {
    await removeImportFile(storagePath);
  } catch {
    // Nothing the user can do about it, and nothing broken if it stays.
  }
}

function newImportId(): string {
  const globalCrypto = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  // React Native's Hermes has no randomUUID. This is an idempotency token, not
  // a secret, so Math.random is adequate -- but it must still be a valid v4
  // UUID because it becomes a uuid primary key.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

// Re-exported so screens can build Decimals without reaching past the
// repository into the domain layer.
export { D };
