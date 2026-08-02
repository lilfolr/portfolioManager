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

import { holdingDetailData, holdingsScreenData } from '../fixtures/portfolio';
import { setSession } from './supabase-mock';

const mockedRepo = repository as jest.Mocked<typeof repository>;

/** Points the repository at fixtures and signs a user in. */
export function useFixtureBackend(
  { signedIn = true }: { signedIn?: boolean } = {},
) {
  setSession(signedIn ? { user: { email: 'alice@example.com' } } : null);
  mockedRepo.fetchHoldingsScreenData.mockResolvedValue(holdingsScreenData);
  mockedRepo.fetchHoldingDetail.mockResolvedValue(holdingDetailData);
  mockedRepo.fetchOpenParcels.mockResolvedValue([]);
  mockedRepo.submitManualTransaction.mockResolvedValue('test-txn-id');
}

/** Renders the real route tree at `url`. Call at most once per file. */
export function renderApp(url: string) {
  return renderRouter('app', { initialUrl: url });
}
