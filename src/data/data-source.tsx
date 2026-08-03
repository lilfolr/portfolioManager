import { createContext, useContext, type PropsWithChildren } from 'react';

import {
  abandonImport,
  confirmReviewRows,
  confirmWholeImport,
  fetchHoldingDetail,
  fetchHoldingsScreenData,
  fetchImportJobs,
  fetchImportReview,
  fetchOpenParcels,
  finishImport,
  rejectImportSource,
  rejectStagedRows,
  startImport,
  submitManualTransaction,
  voidImportSource,
  type ConfirmProgress,
  type HoldingDetailData,
  type HoldingsScreenData,
  type OpenParcel,
  type ReviewPage,
} from './repository';
import type { ImportJob, StagedRowStatus } from '../domain/models';
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

  // --- CSV import ---------------------------------------------------------
  fetchImportJobs(): Promise<ImportJob[]>;
  fetchImportReview(args: {
    sourceId?: string;
    status?: StagedRowStatus;
    page?: number;
    pageSize?: number;
  }): Promise<ReviewPage>;
  /** Uploads the file and returns what importing it would do. Writes nothing
   * to the ledger. */
  startImport(args: {
    userId: string;
    file: Blob;
    filename: string;
    accountId: string;
    profileId?: string;
  }): Promise<{ importId: string; storagePath: string; preview: Row }>;
  finishImport(request: {
    importId: string;
    storagePath: string;
    filename: string;
    accountId: string;
    profileId?: string;
  }): Promise<string>;
  abandonImport(storagePath: string): Promise<void>;
  confirmReviewRows(ids: string[]): Promise<number>;
  confirmWholeImport(
    sourceId: string,
    onProgress?: (progress: ConfirmProgress) => void,
  ): Promise<number>;
  rejectStagedRows(ids: string[]): Promise<void>;
  rejectImportSource(sourceId: string): Promise<void>;
  voidImportSource(sourceId: string): Promise<void>;
}

const liveDataSource: PortfolioDataSource = {
  fetchHoldingsScreenData,
  fetchHoldingDetail,
  fetchOpenParcels,
  submitManualTransaction,
  fetchImportJobs,
  fetchImportReview,
  startImport,
  finishImport,
  abandonImport,
  confirmReviewRows,
  confirmWholeImport,
  rejectStagedRows,
  rejectImportSource,
  voidImportSource,
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
