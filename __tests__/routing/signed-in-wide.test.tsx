import { screen, waitFor } from 'expo-router/testing-library';

import { renderApp, useFixtureBackend } from '../helpers/router';
import { setWideViewport } from '../helpers/viewport';

/* eslint-disable @typescript-eslint/no-require-imports --
   jest.mock factories are hoisted above imports. */
jest.mock('@/src/data/repository', () =>
  require('../helpers/repository-mock').repositoryMock(),
);
jest.mock('@/src/data/supabase', () => require('../helpers/supabase-mock'));
jest.mock(
  'react-native/Libraries/Utilities/useWindowDimensions',
  () => require('../helpers/viewport').mockedHook,
);
/* eslint-enable @typescript-eslint/no-require-imports */

// The Flutter equivalent pumped the shell at 1600x1000.
it('renders the sidebar shell for a signed-in user at desktop width', async () => {
  setWideViewport();
  useFixtureBackend();
  const app = await renderApp('/holdings');

  await waitFor(() =>
    expect(screen.getByTestId('holdingsTable')).toBeOnTheScreen(),
  );
  expect(app.getPathname()).toBe('/holdings');

  // Sidebar, not the chip row.
  expect(screen.queryByTestId('mobileNavChips')).toBeNull();
  expect(screen.getByText('PORTFOLIO')).toBeOnTheScreen();
  expect(screen.getByText('LEDGER INPUT')).toBeOnTheScreen();

  // All eight nav entries, including the badge on Import review.
  // 'Holdings' matches the nav item and the screen body, hence getAllByText.
  expect(screen.getAllByText('Holdings').length).toBeGreaterThan(0);
  for (const label of [
    'holding detail',
    'Income summary',
    'Capital gains',
    'Property',
    'Import review',
    'Import sources',
    'Transaction entry',
  ]) {
    expect(screen.getByText(label)).toBeOnTheScreen();
  }
  expect(screen.getByText('7')).toBeOnTheScreen();

  // User footer: identity, sign-out, tri-state theme switcher.
  expect(screen.getByText('alice@example.com')).toBeOnTheScreen();
  expect(screen.getByText('AL')).toBeOnTheScreen(); // initials
  expect(screen.getByText('Sign out')).toBeOnTheScreen();
  expect(screen.getByText('System')).toBeOnTheScreen();
  expect(screen.getByText('Light')).toBeOnTheScreen();
  expect(screen.getByText('Dark')).toBeOnTheScreen();

  // Top bar: breadcrumb, search (wide only), FY selector.
  expect(screen.getByTestId('breadcrumb')).toHaveTextContent(
    'Portfolio / Holdings',
  );
  expect(screen.getByText('Search symbol, parcel, txn id')).toBeOnTheScreen();
  expect(screen.getByTestId('fySelect')).toHaveTextContent('FY 2025–26');
});
