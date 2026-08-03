import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Row } from './api';
import { useDataSource } from './data-source';

/**
 * The react-query layer. Direct replacement for fquery's `QueryBuilder` --
 * `QueryKey(['holdingsScreen', financialYear])` becomes the `queryKey` below,
 * unchanged.
 *
 * Note that the Holding Detail screen uses a query here too. The long comment
 * at `holding_detail_screen.dart:69-79` explaining why it had to use a plain
 * `FutureBuilder` describes a Flutter lifecycle problem -- fquery's observer
 * calling `setState` synchronously from `didChangeDependencies` when the screen
 * mounts as a side effect of another widget's rebuild. React has no equivalent
 * constraint, so both screens are ordinary queries.
 */

export const queryKeys = {
  holdingsScreen: (financialYear: number) =>
    ['holdingsScreen', financialYear] as const,
  holdingDetail: (instrumentId: string, accountId: string) =>
    ['holdingDetail', instrumentId, accountId] as const,
  openParcels: (symbol: string, accountId: string) =>
    ['openParcels', symbol, accountId] as const,
  importJobs: () => ['importJobs'] as const,
  importReview: (sourceId: string | undefined, page: number) =>
    ['importReview', sourceId ?? 'all', page] as const,
};

export function useHoldingsScreenData(financialYear: number) {
  const dataSource = useDataSource();
  return useQuery({
    queryKey: queryKeys.holdingsScreen(financialYear),
    queryFn: () => dataSource.fetchHoldingsScreenData(financialYear),
  });
}

export function useHoldingDetail(instrumentId: string, accountId: string) {
  const dataSource = useDataSource();
  return useQuery({
    queryKey: queryKeys.holdingDetail(instrumentId, accountId),
    queryFn: () => dataSource.fetchHoldingDetail({ instrumentId, accountId }),
    enabled: instrumentId !== '' && accountId !== '',
  });
}

/**
 * Open parcels for the SELL parcel-matching panel. Disabled until both a
 * symbol and an account have been typed, which is what the entry screen's
 * debounce was guarding against.
 */
export function useOpenParcels(symbol: string, accountId: string) {
  const dataSource = useDataSource();
  return useQuery({
    queryKey: queryKeys.openParcels(symbol, accountId),
    queryFn: () => dataSource.fetchOpenParcels({ symbol, accountId }),
    enabled: symbol.trim() !== '' && accountId.trim() !== '',
  });
}

/**
 * The manual-entry save. Invalidates both screens, because a confirmed
 * transaction changes derived parcel state everywhere -- parcels are a pure
 * function of the transaction set, so nothing can be patched in locally.
 */
export function useSubmitTransaction() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Row) => dataSource.submitManualTransaction(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['holdingsScreen'] });
      void queryClient.invalidateQueries({ queryKey: ['holdingDetail'] });
      void queryClient.invalidateQueries({ queryKey: ['openParcels'] });
    },
  });
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

export function useImportJobs() {
  const dataSource = useDataSource();
  return useQuery({
    queryKey: queryKeys.importJobs(),
    queryFn: () => dataSource.fetchImportJobs(),
  });
}

/**
 * Rows awaiting a decision, for the nav badge.
 *
 * Counts every pending row, blocked ones included -- a blocked row still needs
 * someone to reject it, so leaving it out of the badge would hide work rather
 * than reduce it. Null while loading or on failure, so the badge is absent
 * rather than wrong.
 */
export function usePendingReviewCount(): number | null {
  const query = useImportJobs();
  if (!query.data) return null;
  return query.data.reduce((sum, job) => sum + job.pending, 0);
}

export function useImportReview(sourceId: string | undefined, page = 0) {
  const dataSource = useDataSource();
  return useQuery({
    queryKey: queryKeys.importReview(sourceId, page),
    queryFn: () =>
      dataSource.fetchImportReview({ sourceId, status: 'pending', page }),
  });
}

/**
 * Everything a confirm, reject or void has to refresh.
 *
 * The whole set, every time: parcels are a pure function of the transaction
 * set, so a confirmed row changes derived state everywhere and nothing can be
 * patched in locally. Bare prefix arrays, matching `useSubmitTransaction`.
 */
function invalidateLedger(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of [
    'importJobs',
    'importReview',
    'holdingsScreen',
    'holdingDetail',
    'openParcels',
  ]) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}

/** Confirms a hand-picked selection of staged rows. */
export function useConfirmReviewRows() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => dataSource.confirmReviewRows(ids),
    onSuccess: () => invalidateLedger(queryClient),
  });
}

/**
 * Confirms an entire import, batch by batch.
 *
 * `onProgress` is threaded through rather than derived from the mutation state
 * because the work is a loop of server calls: without it the screen can only
 * show a spinner, and a ten-thousand-row import looks indistinguishable from a
 * hang.
 */
export function useConfirmWholeImport() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      sourceId: string;
      onProgress?: (progress: { confirmed: number; total: number }) => void;
    }) => dataSource.confirmWholeImport(args.sourceId, args.onProgress),
    onSuccess: () => invalidateLedger(queryClient),
  });
}

export function useRejectReviewRows() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => dataSource.rejectStagedRows(ids),
    onSuccess: () => invalidateLedger(queryClient),
  });
}

export function useRejectImportSource() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => dataSource.rejectImportSource(sourceId),
    onSuccess: () => invalidateLedger(queryClient),
  });
}

/** Discards a whole import. Nothing is deleted -- the job is marked voided and
 * its transactions stop counting. */
export function useVoidImportSource() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => dataSource.voidImportSource(sourceId),
    onSuccess: () => invalidateLedger(queryClient),
  });
}

/** Uploads and previews. Deliberately a mutation, not a query: it uploads a
 * file, so it must never be retried or refetched on its own. */
export function useStartImport() {
  const dataSource = useDataSource();
  return useMutation({
    mutationFn: (args: {
      userId: string;
      file: Blob;
      filename: string;
      accountId: string;
      profileId?: string;
    }) => dataSource.startImport(args),
  });
}

export function useFinishImport() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: {
      importId: string;
      storagePath: string;
      filename: string;
      accountId: string;
      profileId?: string;
    }) => dataSource.finishImport(request),
    onSuccess: () => invalidateLedger(queryClient),
  });
}
