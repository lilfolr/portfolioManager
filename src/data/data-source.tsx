import { createContext, useContext, type PropsWithChildren } from 'react';

import {
  fetchHoldingDetail,
  fetchHoldingsScreenData,
  fetchOpenParcels,
  submitManualTransaction,
  type HoldingDetailData,
  type HoldingsScreenData,
  type OpenParcel,
} from './repository';
import type { Row } from './api';

/**
 * The seam tests inject fixtures through.
 *
 * The Flutter app threaded each fetcher down as a default-valued widget prop
 * from `LedgerAppShell` (`holdingsFetchData`, `parcelsFetcher`,
 * `transactionSubmitter`). That is structurally unavailable here: Expo Router
 * instantiates route components from the filesystem, so a test cannot pass
 * props to `app/(app)/holdings/index.tsx`.
 *
 * A context also fixes something that was a small smell in the original --
 * `fetchData` was a test-only parameter sitting in a production widget's
 * constructor. Presentational components keep taking plain props, so the
 * fastest tests still need no provider at all; only the data boundary goes
 * through here.
 */
export interface PortfolioDataSource {
  fetchHoldingsScreenData(financialYear: number): Promise<HoldingsScreenData>;
  fetchHoldingDetail(args: {
    instrumentId: string;
    accountId: string;
  }): Promise<HoldingDetailData>;
  fetchOpenParcels(args: {
    symbol: string;
    accountId: string;
  }): Promise<OpenParcel[]>;
  submitManualTransaction(payload: Row): Promise<string>;
}

const liveDataSource: PortfolioDataSource = {
  fetchHoldingsScreenData,
  fetchHoldingDetail,
  fetchOpenParcels,
  submitManualTransaction,
};

const DataSourceContext = createContext<PortfolioDataSource>(liveDataSource);

export function DataSourceProvider({
  value = liveDataSource,
  children,
}: PropsWithChildren<{ value?: PortfolioDataSource }>) {
  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}

export const useDataSource = () => useContext(DataSourceContext);
