import { waitFor } from 'expo-router/testing-library';

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

it('sends a signed-in visitor away from the sign-in screen', async () => {
  setWideViewport();
  useFixtureBackend();
  const app = await renderApp('/login');

  await waitFor(() => expect(app.getPathname()).toBe('/holdings'));
});
