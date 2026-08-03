/**
 * Shared wiring for the route-level tests.
 *
 * These mount the real `app/` tree, so only the two modules that would reach a
 * network are replaced -- the repository (fixtures) and the auth client (a
 * session). Routing, layouts, redirects and the breakpoint switch are the real
 * thing.
 *
 * ONE `renderRouter` CALL PER TEST FILE. A second call in the same module
 * registry renders an empty tree -- reproducible with a two-line app and no
 * app code involved, so it is an expo-router SDK 57 limitation rather than
 * anything about this codebase. Each file therefore covers one scenario and
 * makes all of its assertions after a single render. That is also why the
 * Flutter suite's shell tests arrive here split across files rather than as one
 * `describe`.
 */
import { renderRouter } from 'expo-router/testing-library';

import * as repository from '@/src/data/repository';

import {
  holdingDetailData,
  holdingsScreenData,
  importJobs,
  reviewRows,
} from '../fixtures/portfolio';
import { setSession } from './supabase-mock';

const mockedRepo = repository as jest.Mocked<typeof repository>;

/**
 * Points the repository at fixtures and signs a user in.
 *
 * The import fetchers are stubbed for every scenario, not just the import
 * tests: the app shell's nav badge reads the pending-row count on every
 * screen, so leaving them unset would have each route test exercising an
 * error path it does not mean to.
 */
export function useFixtureBackend({
  signedIn = true,
}: { signedIn?: boolean } = {}) {
  setSession(signedIn ? { user: { email: 'alice@example.com' } } : null);
  mockedRepo.fetchHoldingsScreenData.mockResolvedValue(holdingsScreenData);
  mockedRepo.fetchHoldingDetail.mockResolvedValue(holdingDetailData);
  mockedRepo.fetchOpenParcels.mockResolvedValue([]);
  mockedRepo.submitManualTransaction.mockResolvedValue('test-txn-id');

  mockedRepo.fetchImportJobs.mockResolvedValue(importJobs);
  mockedRepo.fetchImportReview.mockResolvedValue({
    rows: reviewRows,
    hasMore: false,
  });
  mockedRepo.confirmReviewRows.mockResolvedValue(0);
  mockedRepo.confirmWholeImport.mockResolvedValue(0);
  mockedRepo.rejectStagedRows.mockResolvedValue(undefined);
  mockedRepo.rejectImportSource.mockResolvedValue(undefined);
  mockedRepo.voidImportSource.mockResolvedValue(undefined);
  mockedRepo.abandonImport.mockResolvedValue(undefined);
}

/**
 * Renders the real route tree at `url` and waits for the first render to
 * settle. Call at most once per file.
 *
 * Two sharp edges are handled here so no test has to remember them.
 * @testing-library/react-native v14 made `render` and `fireEvent` async, and
 * `renderRouter` hands that promise straight back with its routing helpers
 * assigned *onto the promise object* -- so awaiting it settles the render but
 * loses `getPathname`. Hence: await the promise for its effect, then expose the
 * helpers from the original handle.
 *
 * Forgetting either await leaves state updates unflushed, which surfaces as
 * assertions failing against a stale tree rather than as an error.
 */
export async function renderApp(url: string) {
  const handle = renderRouter('app', { initialUrl: url });
  await handle;
  return {
    getPathname: () => handle.getPathname(),
    getSearchParams: () => handle.getSearchParams(),
    getSegments: () => handle.getSegments(),
  };
}
