import { screen, waitFor } from 'expo-router/testing-library';

import { renderApp, useFixtureBackend } from '../helpers/router';
import { setWideViewport } from '../helpers/viewport';

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/src/data/repository', () => ({
  fetchHoldingsScreenData: jest.fn(),
  fetchHoldingDetail: jest.fn(),
  fetchOpenParcels: jest.fn(),
  submitManualTransaction: jest.fn(),
}));
jest.mock('@/src/data/supabase', () => require('../helpers/supabase-mock'));
jest.mock(
  'react-native/Libraries/Utilities/useWindowDimensions',
  () => require('../helpers/viewport').mockedHook,
);
/* eslint-enable @typescript-eslint/no-require-imports */

// The Flutter build had no coverage of the auth gate at all; with routes there
// is a redirect worth asserting.
it('sends an unauthenticated visitor to the sign-in screen', async () => {
  setWideViewport();
  useFixtureBackend({ signedIn: false });
  const app = await renderApp('/holdings');

  await waitFor(() => expect(app.getPathname()).toBe('/login'));

  expect(screen.getByTestId('email')).toBeOnTheScreen();
  expect(screen.getByTestId('password')).toBeOnTheScreen();
  expect(screen.getByText('Sign in to view your ledger.')).toBeOnTheScreen();

  // No ledger chrome leaks through before the redirect settles.
  expect(screen.queryByText('PORTFOLIO')).toBeNull();
  expect(screen.queryByTestId('breadcrumb')).toBeNull();
});
