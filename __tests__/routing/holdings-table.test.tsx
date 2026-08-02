import {
  fireEvent,
  screen,
  waitFor,
  within,
} from 'expo-router/testing-library';

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
 * Port of the Flutter holdings tests: all nine rows render, the Stake filter
 * prefix-matches both Stake accounts, the sort headers toggle, and the Add
 * transaction button navigates.
 *
 * One render for the file -- see helpers/router.tsx for why.
 */
it('renders the holdings table and responds to filter, sort and navigation', async () => {
  setWideViewport();
  useFixtureBackend();
  const app = await renderApp('/holdings');

  await waitFor(() =>
    expect(screen.getByTestId('holdingsTable')).toBeOnTheScreen(),
  );

  // Scoped to the table: the sidebar also shows a "VAS" symbol on its
  // holding-detail nav item.
  const table = () => within(screen.getByTestId('holdingsTable'));

  // All nine fixture rows.
  for (const symbol of [
    'VAS',
    'VGS',
    'A200',
    'VOO',
    'CBA',
    'BHP',
    'GOLD',
    'ARG',
    'TLS',
  ]) {
    expect(table().getByText(symbol)).toBeOnTheScreen();
  }

  // Header summary and totals row, both derived from the same filtered set.
  expect(screen.getByTestId('holdingsSummary')).toHaveTextContent(
    '9 positions · 5 source accounts · prices as at 01 Aug 2026',
  );
  expect(screen.getByText('TOTAL · 9 POSITIONS')).toBeOnTheScreen();

  // The four KPI cards, including the compliance-safe captions.
  expect(screen.getByText('TOTAL VALUE')).toBeOnTheScreen();
  expect(screen.getByText('TOTAL COST BASE')).toBeOnTheScreen();
  expect(screen.getByText('UNREALISED GAIN')).toBeOnTheScreen();
  expect(screen.getByText('not adjusted for CGT discount')).toBeOnTheScreen();
  expect(screen.getByText('INCOME · FY 2025–26')).toBeOnTheScreen();

  // The foreign-currency footnote comes from the holding's stored FX rate.
  expect(
    screen.getByText(
      'VOO: USD 452.10 avg cost · FX 1.5296 to AUD at trade date',
    ),
  ).toBeOnTheScreen();

  // Filtering by the Stake prefix keeps both Stake AU and Stake US.
  await fireEvent.press(screen.getByTestId('sourceChip-Stake'));
  await waitFor(() => expect(table().queryByText('VAS')).toBeNull());
  expect(table().getByText('A200')).toBeOnTheScreen();
  expect(table().getByText('GOLD')).toBeOnTheScreen();
  expect(table().getByText('VOO')).toBeOnTheScreen();
  expect(screen.getByText('TOTAL · 3 POSITIONS')).toBeOnTheScreen();

  // Back to everything.
  await fireEvent.press(screen.getByTestId('sourceChip-all'));
  await waitFor(() => expect(table().getByText('VAS')).toBeOnTheScreen());

  // Sorting. The default key is market value, which -- as in the Flutter
  // build -- has no header of its own, so no arrow shows until a real column
  // is tapped.
  expect(screen.queryByText(' ↓')).toBeNull();
  await fireEvent.press(screen.getByTestId('sort-units'));
  await waitFor(() => expect(screen.getByText(' ↓')).toBeOnTheScreen());
  await fireEvent.press(screen.getByTestId('sort-units'));
  await waitFor(() => expect(screen.getByText(' ↑')).toBeOnTheScreen());

  // Add transaction navigates to the entry screen.
  await fireEvent.press(screen.getByTestId('addTransaction'));
  await waitFor(() => expect(app.getPathname()).toBe('/transactions/new'));
});
