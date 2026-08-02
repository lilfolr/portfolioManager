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

/**
 * The Flutter shell collapsed the five unbuilt nav entries into one
 * `LedgerScreen.other`; each now has a real, deep-linkable route so it can be
 * replaced with a single file when it is built. This asserts one of them
 * end to end -- the other four are the same one-line component.
 */
it('deep-links to a stub route and shows the not-in-this-pass placeholder', async () => {
  setWideViewport();
  useFixtureBackend();
  const app = await renderApp('/import-review');

  await waitFor(() =>
    expect(screen.getByText('Not in this pass')).toBeOnTheScreen(),
  );
  expect(app.getPathname()).toBe('/import-review');
  expect(screen.getByText('Back to holdings')).toBeOnTheScreen();

  // Still inside the shell.
  expect(screen.getByText('PORTFOLIO')).toBeOnTheScreen();
  expect(screen.getByTestId('breadcrumb')).toHaveTextContent('Portfolio');
});
