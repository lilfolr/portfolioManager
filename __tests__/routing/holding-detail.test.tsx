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
  detailValue: jest.requireActual('@/src/data/repository').detailValue,
  detailGain: jest.requireActual('@/src/data/repository').detailGain,
}));
jest.mock('@/src/data/supabase', () => require('../helpers/supabase-mock'));
jest.mock(
  'react-native/Libraries/Utilities/useWindowDimensions',
  () => require('../helpers/viewport').mockedHook,
);
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * Port of "holding detail screen and all three tabs render without layout
 * errors", expanded to assert on the figures each tab shows rather than only
 * that it mounted.
 */
it('renders the holding detail header and all three tabs', async () => {
  setWideViewport();
  useFixtureBackend();
  const app = await renderApp('/holdings/ins-vas?accountId=acc-commsec');

  await waitFor(() =>
    expect(screen.getByTestId('parcelsTable')).toBeOnTheScreen(),
  );
  expect(app.getPathname()).toBe('/holdings/ins-vas');

  // Header: symbol, name, tags, and the account chip.
  expect(
    screen.getByText('Vanguard Australian Shares Index ETF'),
  ).toBeOnTheScreen();
  expect(screen.getByText('ASX')).toBeOnTheScreen();
  expect(screen.getByText('Unit trust · AMIT')).toBeOnTheScreen();

  // Key figures, scoped: several of these figures also appear in the tables.
  const figures = within(screen.getByTestId('keyFigures'));
  expect(figures.getByText('UNITS')).toBeOnTheScreen();
  expect(figures.getByText('162')).toBeOnTheScreen();
  expect(figures.getByText('11,385.42')).toBeOnTheScreen();
  // Market value 162 * 102.15 = 16,548.30; gain +5,162.88.
  expect(figures.getByText('16,548.30')).toBeOnTheScreen();
  expect(figures.getByText('+5,162.88')).toBeOnTheScreen();

  // The breadcrumb picks up the symbol once the detail data lands.
  await waitFor(() =>
    expect(screen.getByTestId('breadcrumb')).toHaveTextContent(
      'Portfolio / Holdings / VAS',
    ),
  );

  // --- Parcels tab (default) ---
  const parcels = within(screen.getByTestId('parcelsTable'));
  expect(parcels.getByText('P-00000001')).toBeOnTheScreen();
  expect(parcels.getByText('P-00000002')).toBeOnTheScreen();
  expect(parcels.getByText('T-00000001')).toBeOnTheScreen();
  expect(parcels.getByText('14 Nov 2019')).toBeOnTheScreen();
  // The second parcel is 42 of an original 80 -- partially depleted.
  expect(parcels.getByText('Partially depleted')).toBeOnTheScreen();
  expect(parcels.getByText('Open')).toBeOnTheScreen();
  // Totals: 200 original, 162 remaining, 11,385.42 cost base.
  expect(parcels.getByText('200')).toBeOnTheScreen();
  expect(parcels.getByText('TOTAL')).toBeOnTheScreen();
  // Both parcels are well past 12 months, so all remaining units are eligible.
  expect(parcels.getByText('162 eligible')).toBeOnTheScreen();
  expect(parcels.getByText('0 pending')).toBeOnTheScreen();
  // The read-only explanation, which is the whole point of the derived model.
  expect(
    screen.getByText(/Parcels are derived from transactions and are read-only/),
  ).toBeOnTheScreen();

  // --- Transactions tab ---
  await fireEvent.press(screen.getByTestId('tab-transactions'));
  await waitFor(() =>
    expect(screen.getByTestId('txnsTable')).toBeOnTheScreen(),
  );
  const txns = within(screen.getByTestId('txnsTable'));
  expect(txns.getByText('T-00000042')).toBeOnTheScreen();
  expect(txns.getByText('DRP')).toBeOnTheScreen();
  expect(txns.getByText('SELL')).toBeOnTheScreen();
  expect(txns.getByText('EMAIL')).toBeOnTheScreen();
  expect(txns.getByText('CSV')).toBeOnTheScreen();
  expect(txns.getByText('commsec-2024-fy.csv · row 118')).toBeOnTheScreen();
  expect(txns.getByText('P-00000002 · FIFO')).toBeOnTheScreen();
  expect(
    screen.getByText(/A correction is entered as a reversing transaction/),
  ).toBeOnTheScreen();
  expect(screen.queryByTestId('parcelsTable')).toBeNull();

  // --- Income tab ---
  await fireEvent.press(screen.getByTestId('tab-income'));
  await waitFor(() =>
    expect(screen.getByTestId('incomeTable')).toBeOnTheScreen(),
  );
  const income = within(screen.getByTestId('incomeTable'));
  expect(income.getByText('18 Jul 2025')).toBeOnTheScreen();
  expect(income.getByText('AMIT-2025-Q4')).toBeOnTheScreen();
  // The pending row shows its status rather than an invented statement ref.
  expect(income.getByText('awaiting entry')).toBeOnTheScreen();
  expect(screen.getByTestId('pendingComponents')).toHaveTextContent(
    '1 payment awaiting component entry',
  );
  // Units at record date is not tracked, so both rows render an em dash.
  expect(income.getAllByText('—')).toHaveLength(2);
  // Totals row is labelled with the financial year, not "TOTAL".
  expect(income.getByText('FY 2025–26')).toBeOnTheScreen();

  // --- Back to holdings ---
  await fireEvent.press(screen.getByTestId('backToHoldings'));
  await waitFor(() => expect(app.getPathname()).toBe('/holdings'));
});
