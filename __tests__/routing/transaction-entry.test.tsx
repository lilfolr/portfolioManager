import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

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
 * Ports the Flutter transaction-entry tests: the type buttons switch the hint
 * text, the BUY effect panel renders, DIVIDEND blocks save while franking
 * credit is blank, SELL shows the parcel-matching panel, and Cancel returns to
 * Holdings.
 *
 * One render for the file -- see helpers/router.tsx for why.
 */
it('switches type, gates saving and shows the right panel per type', async () => {
  setWideViewport();
  useFixtureBackend();
  const app = await renderApp('/transactions/new');

  await waitFor(() =>
    expect(screen.getByText('New transaction')).toBeOnTheScreen(),
  );

  // --- BUY is the default ---
  expect(screen.getByTestId('typeHint')).toHaveTextContent(
    'Creates a new parcel dated on the trade date. Brokerage is added to the cost base.',
  );
  expect(screen.getByText('EFFECT ON THE LEDGER')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Creates a new parcel dated on the trade date. Cost base = consideration + brokerage.',
    ),
  ).toBeOnTheScreen();
  // The no-inference note, which is a CLAUDE.md rule stated to the user.
  expect(screen.getByText(/No classification is inferred/)).toBeOnTheScreen();
  expect(screen.getByTestId('saveNote')).toHaveTextContent(
    'Saved records are immutable. Corrections are entered as reversing transactions.',
  );

  // The BUY consideration breakdown updates as figures are typed.
  await fireEvent.changeText(screen.getByTestId('field-units'), '100');
  await fireEvent.changeText(screen.getByTestId('field-unit_price'), '96.55');
  await fireEvent.changeText(screen.getByTestId('field-brokerage'), '9.50');
  await waitFor(() =>
    // 100 x 96.55 = 9,655.00 consideration, plus 9.50 brokerage into the
    // cost base of the new parcel.
    expect(screen.getByTestId('consideration')).toHaveTextContent(
      /Consideration9,655\.00Plus brokerage\+9\.50Cost base of new parcel9,664\.50/,
    ),
  );

  // --- SELL ---
  await fireEvent.press(screen.getByTestId('txnType-sell'));
  await waitFor(() =>
    expect(screen.getByText('PARCEL MATCHING')).toBeOnTheScreen(),
  );
  expect(screen.getByTestId('typeHint')).toHaveTextContent(
    'Depletes existing parcels. Parcel selection is required before the disposal can be saved.',
  );
  expect(screen.getByText('FIFO')).toBeOnTheScreen();
  expect(screen.getByText('Select specific parcels')).toBeOnTheScreen();
  expect(screen.getByTestId('saveNote')).toHaveTextContent(
    'Save is blocked until every disposed unit is matched to a parcel.',
  );
  // Switching type clears the form, so parcels cannot load yet.
  expect(
    screen.getByText('Enter symbol and source account to load open parcels.'),
  ).toBeOnTheScreen();
  // No effect panel on SELL -- the parcel matcher takes its place.
  expect(screen.queryByTestId('effectPanel')).toBeNull();

  // --- DIVIDEND ---
  await fireEvent.press(screen.getByTestId('txnType-div'));
  await waitFor(() =>
    expect(screen.getByTestId('typeHint')).toHaveTextContent(
      'Income only. No parcel is created or changed.',
    ),
  );
  expect(screen.getByTestId('saveNote')).toHaveTextContent(
    'Save is blocked while the franking credit field is blank.',
  );
  // Blank franking credit is called out rather than defaulted to zero.
  expect(screen.getByTestId('warn-franking_credit')).toHaveTextContent(
    'Not stated in the source. Enter from the statement — this value is never derived.',
  );
  // Once transcribed, the warning goes.
  await fireEvent.changeText(
    screen.getByTestId('field-franking_credit'),
    '136.54',
  );
  await waitFor(() =>
    expect(screen.queryByTestId('warn-franking_credit')).toBeNull(),
  );

  // --- Return of capital derives its Total ---
  await fireEvent.press(screen.getByTestId('txnType-roc'));
  await waitFor(() =>
    expect(screen.getByTestId('field-amount_per_unit')).toBeOnTheScreen(),
  );
  await fireEvent.changeText(
    screen.getByTestId('field-amount_per_unit'),
    '0.1234',
  );
  await fireEvent.changeText(screen.getByTestId('field-units'), '500');
  await waitFor(() =>
    expect(screen.getByTestId('field-total').props.value).toBe('61.70'),
  );

  // --- Cancel returns to Holdings ---
  await fireEvent.press(screen.getByTestId('cancelEntry'));
  await waitFor(() => expect(app.getPathname()).toBe('/holdings'));
});
