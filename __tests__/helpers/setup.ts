/* eslint-disable @typescript-eslint/no-require-imports --
   jest.mock factories are hoisted above imports, so they have to use require. */

// @testing-library/react-native v12.4+ ships its jest matchers built in, so
// there is nothing to extend here.

// AsyncStorage has no native module under jest. The theme controller and the
// Supabase session store both swallow storage errors, but mocking keeps the
// console clean and lets persistence assertions work.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
