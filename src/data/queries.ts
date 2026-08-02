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
