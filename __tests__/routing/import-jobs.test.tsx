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

/**
 * The import status screen, end to end through the real route tree.
 *
 * The assertion that earns its keep is the void confirmation: voiding takes a
 * whole import out of every derived figure, so it must not be a single
 * misplaced tap, and the copy has to say what actually happens (nothing is
 * deleted) rather than implying a delete.
 */
it('lists imports and confirms before voiding one', async () => {
  setWideViewport();
  useFixtureBackend();
  const app = await renderApp('/import-sources');

  await waitFor(() =>
    expect(screen.getByTestId('importJobsTable')).toBeOnTheScreen(),
  );
  expect(app.getPathname()).toBe('/import-sources');

  // Both fixture jobs, with the voided one labelled as such. By testID rather
  // than by text: "IMPORTED" is also a column header.
  expect(screen.getByText('commsec-2024-fy.csv')).toBeOnTheScreen();
  expect(screen.getByText('stake-us-2024-fy.csv')).toBeOnTheScreen();
  expect(screen.getByTestId('importStatus-processed')).toBeOnTheScreen();
  expect(screen.getByTestId('importStatus-voided')).toBeOnTheScreen();

  // 7 pending on the first job less its 2 blocked rows, 0 on the voided one.
  expect(screen.getByTestId('importJobsSummary')).toHaveTextContent(
    '2 imports · 5 rows awaiting review',
  );

  // A voided job offers no void action; the other one does.
  expect(
    screen.queryByTestId('voidImport-a0000000-0000-4000-8000-000000000002'),
  ).toBeNull();

  // Voiding asks first, and nothing has been sent yet.
  await fireEvent.press(
    screen.getByTestId('voidImport-a0000000-0000-4000-8000-000000000001'),
  );
  await waitFor(() =>
    expect(screen.getByTestId('voidConfirm')).toBeOnTheScreen(),
  );
  expect(mockedRepo.voidImportSource).not.toHaveBeenCalled();

  // The copy states the consequence, including that nothing is deleted.
  // Regexes, because toHaveTextContent matches a string exactly.
  expect(screen.getByTestId('voidConfirm')).toHaveTextContent(
    /will stop counting towards holdings/,
  );
  expect(screen.getByTestId('voidConfirm')).toHaveTextContent(
    /Nothing is deleted/,
  );

  // Backing out sends nothing.
  await fireEvent.press(screen.getByTestId('voidConfirmNo'));
  await waitFor(() => expect(screen.queryByTestId('voidConfirm')).toBeNull());
  expect(mockedRepo.voidImportSource).not.toHaveBeenCalled();

  // Confirming sends exactly that job's id.
  await fireEvent.press(
    screen.getByTestId('voidImport-a0000000-0000-4000-8000-000000000001'),
  );
  await waitFor(() =>
    expect(screen.getByTestId('voidConfirm')).toBeOnTheScreen(),
  );
  await fireEvent.press(screen.getByTestId('voidConfirmYes'));

  await waitFor(() =>
    expect(mockedRepo.voidImportSource).toHaveBeenCalledWith(
      'a0000000-0000-4000-8000-000000000001',
    ),
  );
  expect(mockedRepo.voidImportSource).toHaveBeenCalledTimes(1);
});
