import * as api from '@/src/data/api';
import {
  confirmWholeImport,
  fetchImportJobs,
  fetchImportReview,
} from '@/src/data/repository';
import {
  importJobConfirmable,
  importJobSettled,
  reviewRowBlocked,
  reviewRowConfirmable,
  type ImportJob,
} from '@/src/domain/models';

/**
 * The import half of the repository: wire rows in, view models out.
 *
 * The assertions that matter here are the same ones the rest of the repository
 * cares about -- a decimal string that quietly became a float, and a jsonb
 * column whose shape nothing has guaranteed.
 */
jest.mock('@/src/data/api', () => ({
  fetchImportJobs: jest.fn(),
  fetchStagedRowsForReview: jest.fn(),
  confirmImportSource: jest.fn(),
  confirmStagedRows: jest.fn(),
  rejectStagedRows: jest.fn(),
  rejectImportSource: jest.fn(),
  voidImportSource: jest.fn(),
  uploadImportFile: jest.fn(),
  removeImportFile: jest.fn(),
  previewImport: jest.fn(),
  commitImport: jest.fn(),
  importObjectPath: jest.fn(),
  // Unused here, but the module is mocked wholesale.
  fetchAccounts: jest.fn(),
  fetchInstruments: jest.fn(),
  fetchLatestPrices: jest.fn(),
  fetchActiveTransactions: jest.fn(),
  fetchImportSources: jest.fn(),
  fetchStagedRows: jest.fn(),
  fetchIncomeSummary: jest.fn(),
  fetchParcelsAndDisposals: jest.fn(),
  insertManualStagedRow: jest.fn(),
  confirmStagedRow: jest.fn(),
}));

const mocked = api as jest.Mocked<typeof api>;

beforeEach(() => jest.resetAllMocks());

const jobRow = (over: Record<string, unknown> = {}) => ({
  id: 'src-1',
  kind: 'csv',
  filename_or_message_id: 'commsec-2024-fy.csv',
  imported_at: '2026-07-02T03:00:00Z',
  status: 'processed',
  parser_version: 'native@1',
  raw_blob_ref: 'u/src-1/commsec.csv',
  content_hash: 'abc',
  row_count: 42,
  error_message: null,
  staged_total: 42,
  staged_pending: 7,
  staged_confirmed: 34,
  staged_rejected: 1,
  staged_blocked: 2,
  staged_with_issues: 5,
  ...over,
});

const stagedRow = (over: Record<string, unknown> = {}) => ({
  id: 'row-1',
  source_id: 'src-1',
  row_number: 118,
  raw_payload: { type: 'BUY', symbol: 'VAS' },
  parsed_payload: {
    type: 'BUY',
    trade_date: '2026-07-01',
    instrument_id: 'ins-vas',
    quantity: '40.00000000',
    unit_price: '101.20',
    brokerage: '19.95',
    currency: 'AUD',
    external_ref: 'N1',
  },
  issues: [],
  dedupe_key: 'k',
  status: 'pending',
  transaction_id: null,
  ...over,
});

describe('fetchImportJobs', () => {
  it('maps a job row onto the view model', async () => {
    mocked.fetchImportJobs.mockResolvedValue([jobRow()]);
    const [job] = await fetchImportJobs();

    expect(job).toMatchObject({
      id: 'src-1',
      kind: 'csv',
      label: 'commsec-2024-fy.csv',
      status: 'processed',
      parserVersion: 'native@1',
      total: 42,
      pending: 7,
      confirmed: 34,
      rejected: 1,
      blocked: 2,
    });
    expect(job?.importedAt.getUTCFullYear()).toBe(2026);
  });

  it('maps the voided status through', async () => {
    // Voided is the whole undo mechanism; if it degraded to 'pending' the
    // status column would tell the user the opposite of the truth.
    mocked.fetchImportJobs.mockResolvedValue([jobRow({ status: 'voided' })]);
    expect((await fetchImportJobs())[0]?.status).toBe('voided');
  });

  it('falls back to pending for a status it does not know', async () => {
    mocked.fetchImportJobs.mockResolvedValue([jobRow({ status: 'weird' })]);
    expect((await fetchImportJobs())[0]?.status).toBe('pending');
  });

  it('renders a null filename as an em dash rather than "null"', async () => {
    mocked.fetchImportJobs.mockResolvedValue([
      jobRow({ filename_or_message_id: null }),
    ]);
    expect((await fetchImportJobs())[0]?.label).toBe('—');
  });

  it('treats missing counts as zero', async () => {
    mocked.fetchImportJobs.mockResolvedValue([
      jobRow({ staged_total: null, staged_pending: undefined }),
    ]);
    const [job] = await fetchImportJobs();
    expect(job?.total).toBe(0);
    expect(job?.pending).toBe(0);
  });
});

describe('import job predicates', () => {
  const job = (over: Partial<ImportJob>): ImportJob => ({
    id: 'src-1',
    kind: 'csv',
    label: 'f.csv',
    importedAt: new Date(),
    status: 'processed',
    parserVersion: 'native@1',
    rawBlobRef: null,
    total: 10,
    pending: 0,
    confirmed: 10,
    rejected: 0,
    blocked: 0,
    withIssues: 0,
    errorMessage: null,
    ...over,
  });

  it('counts only unblocked pending rows as confirmable', () => {
    expect(importJobConfirmable(job({ pending: 7, blocked: 2 }))).toBe(5);
  });

  it('never reports a negative confirmable count', () => {
    expect(importJobConfirmable(job({ pending: 1, blocked: 3 }))).toBe(0);
  });

  it('is settled once nothing is pending and the job has resolved', () => {
    expect(importJobSettled(job({ pending: 0 }))).toBe(true);
    expect(importJobSettled(job({ pending: 3 }))).toBe(false);
    expect(importJobSettled(job({ pending: 0, status: 'pending' }))).toBe(false);
  });
});

describe('fetchImportReview', () => {
  it('converts payload decimals through Decimal, not through a float', async () => {
    mocked.fetchStagedRowsForReview.mockResolvedValue([stagedRow()]);
    const page = await fetchImportReview({ sourceId: 'src-1' });
    const parsed = page.rows[0]?.parsed;

    expect(parsed?.quantity?.toString()).toBe('40');
    expect(parsed?.unitPrice?.toString()).toBe('101.2');
    // The product is what the screen shows as consideration; a float would
    // land on 4047.9999999999995.
    expect(parsed?.quantity?.times(parsed.unitPrice!).toString()).toBe('4048');
  });

  it('keeps a row whose payload is null, so it can still be reviewed', async () => {
    mocked.fetchStagedRowsForReview.mockResolvedValue([
      stagedRow({
        parsed_payload: null,
        issues: [
          { code: 'unknown_instrument', field: 'symbol', message: 'x', blocking: true },
        ],
      }),
    ]);
    const [row] = (await fetchImportReview({})).rows;
    expect(row?.parsed).toBeNull();
    expect(reviewRowBlocked(row!)).toBe(true);
    expect(reviewRowConfirmable(row!)).toBe(false);
  });

  it('treats a malformed issues column as no issues rather than crashing', async () => {
    mocked.fetchStagedRowsForReview.mockResolvedValue([
      stagedRow({ issues: 'not an array' }),
    ]);
    expect((await fetchImportReview({})).rows[0]?.issues).toEqual([]);
  });

  it('reports another page when the fetch returns one more than asked for', async () => {
    // The repository asks for pageSize + 1 so "is there more" needs no count
    // query; the extra row must not be handed to the screen.
    mocked.fetchStagedRowsForReview.mockResolvedValue([
      stagedRow({ id: 'a' }),
      stagedRow({ id: 'b' }),
      stagedRow({ id: 'c' }),
    ]);
    const page = await fetchImportReview({ pageSize: 2 });
    expect(page.rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(page.hasMore).toBe(true);
  });

  it('requests the right window for a later page', async () => {
    mocked.fetchStagedRowsForReview.mockResolvedValue([]);
    await fetchImportReview({ page: 2, pageSize: 100, sourceId: 'src-1' });
    expect(mocked.fetchStagedRowsForReview).toHaveBeenCalledWith({
      sourceId: 'src-1',
      status: 'pending',
      from: 200,
      to: 300,
    });
  });
});

describe('confirmWholeImport', () => {
  it('keeps calling until the server says nothing remains', async () => {
    mocked.confirmImportSource
      .mockResolvedValueOnce({ confirmed: 500, remaining: 500 })
      .mockResolvedValueOnce({ confirmed: 500, remaining: 0 });

    const seen: number[] = [];
    const total = await confirmWholeImport('src-1', (p) => seen.push(p.confirmed));

    expect(total).toBe(1000);
    expect(mocked.confirmImportSource).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([500, 1000]);
  });

  it('reports a running total against the work still outstanding', async () => {
    mocked.confirmImportSource
      .mockResolvedValueOnce({ confirmed: 2, remaining: 3 })
      .mockResolvedValueOnce({ confirmed: 3, remaining: 0 });

    const seen: { confirmed: number; total: number }[] = [];
    await confirmWholeImport('src-1', (p) => seen.push(p));

    expect(seen).toEqual([
      { confirmed: 2, total: 5 },
      { confirmed: 5, total: 5 },
    ]);
  });

  it('stops when a batch confirms nothing, rather than looping forever', async () => {
    // What a residue of blocked rows looks like: the server reports them as
    // remaining but will never confirm them.
    mocked.confirmImportSource.mockResolvedValue({ confirmed: 0, remaining: 4 });
    await expect(confirmWholeImport('src-1')).resolves.toBe(0);
    expect(mocked.confirmImportSource).toHaveBeenCalledTimes(1);
  });
});
