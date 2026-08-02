import type { EngineResult, WireParcel } from '@/src/domain/wire';
import { holdingValue } from '@/src/domain/models';
import * as api from '@/src/data/api';
import {
  fetchHoldings,
  fetchOpenParcels,
  fetchTxnsFor,
  submitManualTransaction,
} from '@/src/data/repository';
import { financialYearFromLabel } from '@/src/domain/financial-year';

// The repository is pure composition over api.ts, so the wire layer is mocked
// and the assertions are about mapping: grouping, summing, the FX sub-line,
// provenance labels, parcel linkage and sort order. This is the code path where
// a decimal-string that quietly became a float, or a Decimal compared by
// reference, would show up as a wrong number rather than an error.
jest.mock('@/src/data/api', () => ({
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

const parcel = (over: Partial<WireParcel> = {}): WireParcel => ({
  id: 'p-1',
  instrumentId: 'ins-vas',
  accountId: 'acc-commsec',
  openTransactionId: 't-1',
  acquiredDate: '2024-03-14',
  originalQuantity: '100',
  remainingQuantity: '100',
  costBase: '9000',
  reducedCostBase: '9000',
  costBaseNative: null,
  currency: 'AUD',
  ...over,
});

const engine = (
  parcels: WireParcel[],
  disposals: EngineResult['disposals'] = [],
) => ({ parcels, disposals }) as EngineResult;

beforeEach(() => {
  jest.resetAllMocks();
  mocked.fetchInstruments.mockResolvedValue([
    {
      id: 'ins-vas',
      symbol: 'VAS',
      name: 'Vanguard Australian Shares Index ETF',
      exchange: 'ASX',
      amit_flag: true,
    },
    {
      id: 'ins-voo',
      symbol: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      exchange: 'NYSEARCA',
      amit_flag: false,
    },
  ]);
  mocked.fetchAccounts.mockResolvedValue([
    { id: 'acc-commsec', kind: 'broker', display_name: 'CommSec 0421' },
    { id: 'acc-stake-us', kind: 'broker', display_name: 'Stake US' },
  ]);
  mocked.fetchLatestPrices.mockResolvedValue([
    { instrument_id: 'ins-vas', price_date: '2026-08-01', close: '102.15' },
    { instrument_id: 'ins-voo', price_date: '2026-08-01', close: '783.72' },
  ]);
  mocked.fetchImportSources.mockResolvedValue([]);
  mocked.fetchStagedRows.mockResolvedValue([]);
  mocked.fetchActiveTransactions.mockResolvedValue([]);
  mocked.fetchIncomeSummary.mockResolvedValue([]);
});

describe('financialYearFromLabel', () => {
  it('reads the label year and adds one, per CLAUDE.md FY convention', () => {
    expect(financialYearFromLabel('FY 2025–26')).toBe(2026);
    expect(financialYearFromLabel('FY 2026–27')).toBe(2027);
  });

  it('falls back to the current calendar year when no year is present', () => {
    expect(financialYearFromLabel('all years')).toBe(new Date().getFullYear());
  });
});

describe('fetchHoldings', () => {
  it('groups parcels by (instrument, account) and sums units and cost base', async () => {
    mocked.fetchParcelsAndDisposals.mockResolvedValue(
      engine([
        parcel({ id: 'p-1', remainingQuantity: '100', costBase: '9000' }),
        parcel({ id: 'p-2', remainingQuantity: '60', costBase: '6000' }),
      ]),
    );

    const [holding] = await fetchHoldings();
    expect(holding).toBeDefined();
    expect(holding!.units.toString()).toBe('160');
    expect(holding!.costBase.toString()).toBe('15000');
    expect(holding!.symbol).toBe('VAS');
    expect(holding!.accountDisplayName).toBe('CommSec 0421');
  });

  it('keeps parcels in different accounts as separate holdings', async () => {
    mocked.fetchParcelsAndDisposals.mockResolvedValue(
      engine([
        parcel({ id: 'p-1', accountId: 'acc-commsec' }),
        parcel({ id: 'p-2', accountId: 'acc-stake-us' }),
      ]),
    );
    const result = await fetchHoldings();
    expect(result).toHaveLength(2);
    expect(result.map((h) => h.accountId).sort()).toEqual([
      'acc-commsec',
      'acc-stake-us',
    ]);
  });

  it('excludes fully depleted parcels', async () => {
    mocked.fetchParcelsAndDisposals.mockResolvedValue(
      engine([
        parcel({ id: 'p-1', remainingQuantity: '0.00000000' }),
        parcel({ id: 'p-2', remainingQuantity: '25' }),
      ]),
    );
    const [holding] = await fetchHoldings();
    expect(holding!.units.toString()).toBe('25');
  });

  it('drops a holding entirely when every parcel is depleted', async () => {
    mocked.fetchParcelsAndDisposals.mockResolvedValue(
      engine([parcel({ remainingQuantity: '0' })]),
    );
    expect(await fetchHoldings()).toHaveLength(0);
  });

  it('sorts by market value descending', async () => {
    mocked.fetchParcelsAndDisposals.mockResolvedValue(
      engine([
        // VAS: 10 * 102.15 = 1021.50
        parcel({ id: 'p-1', instrumentId: 'ins-vas', remainingQuantity: '10' }),
        // VOO: 5 * 783.72 = 3918.60
        parcel({
          id: 'p-2',
          instrumentId: 'ins-voo',
          accountId: 'acc-stake-us',
          remainingQuantity: '5',
        }),
      ]),
    );
    const result = await fetchHoldings();
    expect(result.map((h) => h.symbol)).toEqual(['VOO', 'VAS']);
    expect(holdingValue(result[0]!).toString()).toBe('3918.6');
  });

  it('builds the FX sub-line only for foreign-currency parcels', async () => {
    mocked.fetchParcelsAndDisposals.mockResolvedValue(
      engine([
        parcel({
          id: 'p-usd',
          instrumentId: 'ins-voo',
          accountId: 'acc-stake-us',
          remainingQuantity: '22',
          costBase: '15206.79',
          costBaseNative: '9946.20',
          currency: 'USD',
        }),
      ]),
    );
    const [holding] = await fetchHoldings();
    // 9946.20 / 22 = 452.1 exactly; 15206.79 / 9946.20 does not terminate and
    // is therefore rounded to the 4 places Dart's scaleOnInfinitePrecision used.
    expect(holding!.fxSubLine).toBe(
      'USD 452.1 avg cost · FX 1.5289 to AUD at trade date',
    );
  });

  it('leaves the FX sub-line null for AUD holdings', async () => {
    mocked.fetchParcelsAndDisposals.mockResolvedValue(engine([parcel()]));
    const [holding] = await fetchHoldings();
    expect(holding!.fxSubLine).toBeNull();
  });

  it('skips parcels whose instrument or account is not visible', async () => {
    // RLS can hide a referenced row; the Dart version skipped rather than threw.
    mocked.fetchParcelsAndDisposals.mockResolvedValue(
      engine([parcel({ instrumentId: 'ins-unknown' })]),
    );
    expect(await fetchHoldings()).toHaveLength(0);
  });
});

describe('fetchTxnsFor', () => {
  const txnRow = (over: Record<string, unknown> = {}) => ({
    id: '00000042-0000-0000-0000-000000000000',
    account_id: 'acc-commsec',
    instrument_id: 'ins-vas',
    type: 'BUY',
    trade_date: '2026-03-16',
    quantity: '48',
    unit_price: '103.89',
    brokerage: '0',
    fees: '0',
    currency: 'AUD',
    fx_rate_to_aud: '1',
    source_id: null,
    ...over,
  });

  it('labels a transaction with no import source as manual entry', async () => {
    mocked.fetchActiveTransactions.mockResolvedValue([txnRow()]);
    mocked.fetchParcelsAndDisposals.mockResolvedValue(engine([]));

    const [txn] = await fetchTxnsFor({
      instrumentId: 'ins-vas',
      accountId: 'acc-commsec',
    });
    expect(txn!.kind).toBe('manual');
    expect(txn!.source).toBe('manual entry');
  });

  it('labels a CSV-sourced transaction with its filename and row number', async () => {
    mocked.fetchActiveTransactions.mockResolvedValue([
      txnRow({ source_id: 'src-1' }),
    ]);
    mocked.fetchImportSources.mockResolvedValue([
      {
        id: 'src-1',
        kind: 'csv',
        filename_or_message_id: 'commsec-2024-fy.csv',
      },
    ]);
    mocked.fetchStagedRows.mockResolvedValue([
      {
        source_id: 'src-1',
        row_number: 118,
        transaction_id: '00000042-0000-0000-0000-000000000000',
      },
    ]);
    mocked.fetchParcelsAndDisposals.mockResolvedValue(engine([]));

    const [txn] = await fetchTxnsFor({
      instrumentId: 'ins-vas',
      accountId: 'acc-commsec',
    });
    expect(txn!.kind).toBe('csv');
    expect(txn!.source).toBe('commsec-2024-fy.csv · row 118');
  });

  it('derives the parcel reference for opening types from the transaction id', async () => {
    for (const type of ['BUY', 'DRP', 'TRANSFER_IN']) {
      mocked.fetchActiveTransactions.mockResolvedValue([txnRow({ type })]);
      mocked.fetchParcelsAndDisposals.mockResolvedValue(engine([]));
      const [txn] = await fetchTxnsFor({
        instrumentId: 'ins-vas',
        accountId: 'acc-commsec',
      });
      expect(txn!.parcelInfo).toBe('P-00000042');
    }
  });

  it('lists every parcel a SELL touched', async () => {
    mocked.fetchActiveTransactions.mockResolvedValue([
      txnRow({ type: 'SELL' }),
    ]);
    mocked.fetchParcelsAndDisposals.mockResolvedValue(
      engine(
        [],
        [
          {
            id: 'd-1',
            sellTransactionId: '00000042-0000-0000-0000-000000000000',
            parcelId: '00000001-0000-0000-0000-000000000000',
            sellDate: '2026-03-16',
            quantity: '10',
            proceeds: '1000',
            costBaseUsed: '900',
            gainLoss: '100',
            discountEligible: true,
          },
          {
            id: 'd-2',
            sellTransactionId: '00000042-0000-0000-0000-000000000000',
            parcelId: '00000002-0000-0000-0000-000000000000',
            sellDate: '2026-03-16',
            quantity: '5',
            proceeds: '500',
            costBaseUsed: '450',
            gainLoss: '50',
            discountEligible: false,
          },
        ],
      ),
    );

    const [txn] = await fetchTxnsFor({
      instrumentId: 'ins-vas',
      accountId: 'acc-commsec',
    });
    expect(txn!.parcelInfo).toBe('P-00000001, P-00000002 · FIFO');
  });

  it('marks distributions as components pending', async () => {
    mocked.fetchActiveTransactions.mockResolvedValue([
      txnRow({ type: 'DISTRIBUTION', quantity: null, unit_price: null }),
    ]);
    mocked.fetchParcelsAndDisposals.mockResolvedValue(engine([]));
    const [txn] = await fetchTxnsFor({
      instrumentId: 'ins-vas',
      accountId: 'acc-commsec',
    });
    expect(txn!.parcelInfo).toBe('components pending');
    expect(txn!.amount).toBeNull();
  });

  it('computes amount as quantity times unit price, at full precision', async () => {
    mocked.fetchActiveTransactions.mockResolvedValue([
      txnRow({ quantity: '48.36219178', unit_price: '103.89' }),
    ]);
    mocked.fetchParcelsAndDisposals.mockResolvedValue(engine([]));
    const [txn] = await fetchTxnsFor({
      instrumentId: 'ins-vas',
      accountId: 'acc-commsec',
    });
    expect(txn!.amount!.toString()).toBe('5024.3481040242');
  });

  it('excludes transactions belonging to another account', async () => {
    mocked.fetchActiveTransactions.mockResolvedValue([
      txnRow({ account_id: 'acc-stake-us' }),
    ]);
    mocked.fetchParcelsAndDisposals.mockResolvedValue(engine([]));
    expect(
      await fetchTxnsFor({ instrumentId: 'ins-vas', accountId: 'acc-commsec' }),
    ).toHaveLength(0);
  });

  it('sorts newest first', async () => {
    mocked.fetchActiveTransactions.mockResolvedValue([
      txnRow({
        id: 'aaaaaaaa-0000-0000-0000-000000000000',
        trade_date: '2024-05-02',
      }),
      txnRow({
        id: 'bbbbbbbb-0000-0000-0000-000000000000',
        trade_date: '2026-03-16',
      }),
    ]);
    mocked.fetchParcelsAndDisposals.mockResolvedValue(engine([]));
    const txns = await fetchTxnsFor({
      instrumentId: 'ins-vas',
      accountId: 'acc-commsec',
    });
    expect(txns.map((t) => t.tradeDate.toISOString().slice(0, 10))).toEqual([
      '2026-03-16',
      '2024-05-02',
    ]);
  });
});

describe('fetchOpenParcels', () => {
  it('matches the symbol case-insensitively and scopes to the account', async () => {
    mocked.fetchParcelsAndDisposals.mockResolvedValue(
      engine([
        parcel({
          id: 'p-1',
          accountId: 'acc-commsec',
          remainingQuantity: '40',
          costBase: '3600',
        }),
        parcel({ id: 'p-2', accountId: 'acc-stake-us' }),
      ]),
    );
    const result = await fetchOpenParcels({
      symbol: 'vas',
      accountId: 'acc-commsec',
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('p-1');
    expect(result[0]!.costPerUnit.toString()).toBe('90');
  });

  it('returns nothing for an unknown symbol rather than throwing', async () => {
    expect(
      await fetchOpenParcels({ symbol: 'NOPE', accountId: 'acc-commsec' }),
    ).toEqual([]);
    expect(mocked.fetchParcelsAndDisposals).not.toHaveBeenCalled();
  });

  it('flags discount eligibility from the holding period and sorts oldest first', async () => {
    mocked.fetchParcelsAndDisposals.mockResolvedValue(
      engine([
        parcel({ id: 'recent', acquiredDate: '2026-07-01' }),
        parcel({ id: 'old', acquiredDate: '2019-11-14' }),
      ]),
    );
    const result = await fetchOpenParcels({
      symbol: 'VAS',
      accountId: 'acc-commsec',
    });
    expect(result.map((p) => p.id)).toEqual(['old', 'recent']);
    expect(result[0]!.discountEligible).toBe(true);
    expect(result[1]!.discountEligible).toBe(false);
  });
});

describe('submitManualTransaction', () => {
  it('stages then confirms, returning the confirmed transaction id', async () => {
    mocked.insertManualStagedRow.mockResolvedValue('staged-1');
    mocked.confirmStagedRow.mockResolvedValue({ id: 'txn-1' });

    const payload = { type: 'BUY', trade_date: '2026-03-16' };
    await expect(submitManualTransaction(payload)).resolves.toBe('txn-1');

    expect(mocked.insertManualStagedRow).toHaveBeenCalledWith(payload);
    expect(mocked.confirmStagedRow).toHaveBeenCalledWith('staged-1');
  });

  it('does not confirm when staging fails', async () => {
    mocked.insertManualStagedRow.mockRejectedValue(new Error('rls: denied'));
    await expect(submitManualTransaction({})).rejects.toThrow('rls: denied');
    expect(mocked.confirmStagedRow).not.toHaveBeenCalled();
  });
});
