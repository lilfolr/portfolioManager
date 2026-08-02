import { D } from '@/src/domain/decimal';
import type {
  AccountRef,
  Holding,
  IncomeRow,
  Parcel,
  Txn,
} from '@/src/domain/models';
import type { PortfolioDataSource } from '@/src/data/data-source';
import type {
  HoldingDetailData,
  HoldingsScreenData,
} from '@/src/data/repository';

/**
 * Fixture data ported from `test/widget_test.dart`, values unchanged, so the
 * ported UI tests assert against exactly what the Flutter build asserted
 * against. These stand in for a live Supabase project, which is unreachable in
 * the test environment.
 */

export const commsec: AccountRef = {
  id: 'acc-commsec',
  kind: 'broker',
  displayName: 'CommSec 0421',
};
export const computershare: AccountRef = {
  id: 'acc-cs',
  kind: 'registry',
  displayName: 'Computershare · SRN',
};
export const stakeAu: AccountRef = {
  id: 'acc-stake-au',
  kind: 'broker',
  displayName: 'Stake AU',
};
export const stakeUs: AccountRef = {
  id: 'acc-stake-us',
  kind: 'broker',
  displayName: 'Stake US',
};
export const mufg: AccountRef = {
  id: 'acc-mufg',
  kind: 'registry',
  displayName: 'MUFG · SRN',
};

export const accounts: AccountRef[] = [
  commsec,
  computershare,
  stakeAu,
  stakeUs,
  mufg,
];

export const holdings: Holding[] = [
  {
    instrumentId: 'ins-vas',
    accountId: commsec.id,
    symbol: 'VAS',
    name: 'Vanguard Australian Shares Index ETF',
    exchange: 'ASX',
    units: D('460'),
    costBase: D('39920.04'),
    price: D('102.15'),
    accountDisplayName: commsec.displayName,
  },
  {
    instrumentId: 'ins-vgs',
    accountId: commsec.id,
    symbol: 'VGS',
    name: 'Vanguard MSCI Intl Shares ETF',
    exchange: 'ASX',
    units: D('310'),
    costBase: D('29822.00'),
    price: D('112.80'),
    accountDisplayName: commsec.displayName,
  },
  {
    instrumentId: 'ins-a200',
    accountId: stakeAu.id,
    symbol: 'A200',
    name: 'Betashares Australia 200 ETF',
    exchange: 'ASX',
    units: D('180'),
    costBase: D('23058.00'),
    price: D('141.35'),
    accountDisplayName: stakeAu.displayName,
  },
  {
    instrumentId: 'ins-voo',
    accountId: stakeUs.id,
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    exchange: 'NYSEARCA',
    units: D('22'),
    costBase: D('15106.74'),
    price: D('783.72'),
    accountDisplayName: stakeUs.displayName,
    fxSubLine: 'USD 452.10 avg cost · FX 1.5296 to AUD at trade date',
  },
  {
    instrumentId: 'ins-cba',
    accountId: computershare.id,
    symbol: 'CBA',
    name: 'Commonwealth Bank of Australia',
    exchange: 'ASX',
    units: D('65'),
    costBase: D('6246.50'),
    price: D('172.40'),
    accountDisplayName: computershare.displayName,
  },
  {
    instrumentId: 'ins-bhp',
    accountId: computershare.id,
    symbol: 'BHP',
    name: 'BHP Group Ltd',
    exchange: 'ASX',
    units: D('140'),
    costBase: D('5768.00'),
    price: D('43.85'),
    accountDisplayName: computershare.displayName,
  },
  {
    instrumentId: 'ins-gold',
    accountId: stakeAu.id,
    symbol: 'GOLD',
    name: 'Global X Physical Gold',
    exchange: 'ASX',
    units: D('150'),
    costBase: D('4110.00'),
    price: D('34.90'),
    accountDisplayName: stakeAu.displayName,
  },
  {
    instrumentId: 'ins-arg',
    accountId: computershare.id,
    symbol: 'ARG',
    name: 'Argo Investments Ltd',
    exchange: 'ASX',
    units: D('500'),
    costBase: D('4300.00'),
    price: D('9.35'),
    accountDisplayName: computershare.displayName,
  },
  {
    instrumentId: 'ins-tls',
    accountId: mufg.id,
    symbol: 'TLS',
    name: 'Telstra Group Ltd',
    exchange: 'ASX',
    units: D('900'),
    costBase: D('3465.00'),
    price: D('4.12'),
    accountDisplayName: mufg.displayName,
  },
];

export const holdingsScreenData: HoldingsScreenData = {
  holdings,
  accounts,
  incomeTotal: D('2584.54'),
  frankingCreditTotal: D('136.54'),
  transactionCount: 38,
  latestPriceDate: new Date(Date.UTC(2026, 7, 1)),
};

export const detailParcels: Parcel[] = [
  {
    id: '00000001-0000-0000-0000-000000000000',
    openTransactionId: '00000001-0000-0000-0000-000000000000',
    acquiredDate: new Date(Date.UTC(2019, 10, 14)),
    originalQuantity: D('120'),
    remainingQuantity: D('120'),
    costBase: D('8214.00'),
    reducedCostBase: D('8214.00'),
  },
  {
    id: '00000002-0000-0000-0000-000000000000',
    openTransactionId: '00000002-0000-0000-0000-000000000000',
    acquiredDate: new Date(Date.UTC(2020, 7, 3)),
    originalQuantity: D('80'),
    remainingQuantity: D('42'),
    costBase: D('3171.42'),
    reducedCostBase: D('3171.42'),
  },
];

export const detailTxns: Txn[] = [
  {
    id: '00000042-0000-0000-0000-000000000000',
    tradeDate: new Date(Date.UTC(2026, 2, 16)),
    type: 'DRP',
    quantity: D('48'),
    unitPrice: D('103.89'),
    amount: D('4986.72'),
    kind: 'email',
    source: 'vanguard-drp-mar-2026.eml',
    parcelInfo: 'P-00000042',
  },
  {
    id: '00000031-0000-0000-0000-000000000000',
    tradeDate: new Date(Date.UTC(2024, 4, 2)),
    type: 'SELL',
    quantity: D('38'),
    unitPrice: D('96.55'),
    amount: D('3668.90'),
    kind: 'csv',
    source: 'commsec-2024-fy.csv · row 118',
    parcelInfo: 'P-00000002 · FIFO',
  },
];

export const detailIncome: IncomeRow[] = [
  {
    paymentDate: new Date(Date.UTC(2025, 6, 18)),
    financialYear: 2026,
    type: 'Distribution',
    franked: D('318.60'),
    unfranked: D('104.22'),
    frankingCredit: D('136.54'),
    cash: D('742.18'),
    componentStatement: 'AMIT-2025-Q4',
    pending: false,
  },
  {
    paymentDate: new Date(Date.UTC(2026, 0, 19)),
    financialYear: 2026,
    type: 'Distribution',
    franked: D('501.20'),
    unfranked: D('268.44'),
    frankingCredit: D('0'),
    cash: D('1842.36'),
    componentStatement: null,
    pending: true,
  },
];

export const holdingDetailData: HoldingDetailData = {
  symbol: 'VAS',
  name: 'Vanguard Australian Shares Index ETF',
  exchange: 'ASX',
  amitFlag: true,
  accountDisplayName: commsec.displayName,
  accountKind: commsec.kind,
  units: D('162'),
  costBase: D('11385.42'),
  price: D('102.15'),
  parcels: detailParcels,
  txns: detailTxns,
  income: detailIncome,
};

/** The default injected data source: the Flutter tests' four fetcher overrides. */
export const fixtureDataSource: PortfolioDataSource = {
  fetchHoldingsScreenData: async () => holdingsScreenData,
  fetchHoldingDetail: async () => holdingDetailData,
  fetchOpenParcels: async () => [],
  submitManualTransaction: async () => 'test-txn-id',
};
