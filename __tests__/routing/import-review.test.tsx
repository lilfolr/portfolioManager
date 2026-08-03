import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import * as repository from '@/src/data/repository';

import { renderApp, useFixtureBackend } from '../helpers/router';
import { setWideViewport } from '../helpers/viewport';

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/src/data/repository', () =>
  require('../helpers/repository-mock').repositoryMock(),
);
jest.mock('@/src/data/supabase', () => require('../helpers/supabase-mock'));
jest.mock(
  'react-native/Libraries/Utilities/useWindowDimensions',
  () => require('../helpers/viewport').mockedHook,
);
/* eslint-enable @typescript-eslint/no-require-imports */

const mockedRepo = repository as jest.Mocked<typeof repository>;

const CLEAN = 'b0000000-0000-4000-8000-000000000001';
const DUPLICATE = 'b0000000-0000-4000-8000-000000000002';
const BLOCKED = 'b0000000-0000-4000-8000-000000000003';

/**
 * The review queue, end to end.
 *
 * This screen is where CLAUDE.md rule 3 is enforced for imports, so the
 * assertions are about what cannot happen: a blocked row cannot be selected,
 * and confirming a whole import must not put every row id on the wire.
 */
it('reviews staged rows and confirms only what is confirmable', async () => {
  setWideViewport();
  useFixtureBackend();
  const app = await renderApp(
    '/import-review?sourceId=a0000000-0000-4000-8000-000000000001',
  );

  await waitFor(() =>
    expect(screen.getByTestId('reviewSummaryCard')).toBeOnTheScreen(),
  );
  expect(app.getPathname()).toBe('/import-review');

  // Three fixture rows: one clean, one with a note, one blocked.
  expect(screen.getByTestId(`reviewRow-${CLEAN}`)).toBeOnTheScreen();
  expect(screen.getByTestId(`reviewRow-${BLOCKED}`)).toBeOnTheScreen();
  expect(screen.getByText('2 of 3 rows can be confirmed')).toBeOnTheScreen();

  // A duplicate is a note, not a barrier -- the user decides (rule 4).
  expect(
    screen.getByText('Matches T-3f2a91c4, already in the ledger'),
  ).toBeOnTheScreen();

  // The blocked row says why, and its checkbox is disabled.
  expect(screen.getByText('ZZZ is not a known instrument')).toBeOnTheScreen();
  expect(screen.getByTestId(`select-${BLOCKED}`)).toBeDisabled();

  // Selecting a blocked row is impossible; selecting a good one works.
  await fireEvent.press(screen.getByTestId(`select-${BLOCKED}`));
  await fireEvent.press(screen.getByTestId(`select-${CLEAN}`));
  await waitFor(() =>
    expect(screen.getByTestId('confirmSelected')).toHaveTextContent(
      'Confirm 1 selected',
    ),
  );

  // Select-all takes the two confirmable rows and leaves the blocked one.
  await fireEvent.press(screen.getByTestId('selectAll'));
  await waitFor(() =>
    expect(screen.getByTestId('confirmSelected')).toHaveTextContent(
      'Confirm 2 selected',
    ),
  );

  await fireEvent.press(screen.getByTestId('confirmSelected'));
  await waitFor(() => expect(mockedRepo.confirmReviewRows).toHaveBeenCalled());

  const ids = mockedRepo.confirmReviewRows.mock.calls[0]?.[0] ?? [];
  expect([...ids].sort()).toEqual([CLEAN, DUPLICATE]);
  expect(ids).not.toContain(BLOCKED);

  // Confirming the whole import sends one source id, never a list of rows --
  // a 10,000-row import must not become a 10,000-UUID request body.
  await fireEvent.press(screen.getByTestId('confirmAll'));
  await waitFor(() => expect(mockedRepo.confirmWholeImport).toHaveBeenCalled());
  expect(mockedRepo.confirmWholeImport.mock.calls[0]?.[0]).toBe(
    'a0000000-0000-4000-8000-000000000001',
  );
});
