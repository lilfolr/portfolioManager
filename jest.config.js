module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/__tests__/helpers/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // The root layout imports global.css so NativeWind's Metro transform picks
    // up the stylesheet. Jest has no such transform and cannot parse CSS, and
    // the import has no runtime value, so it maps to an empty module.
    '\\.css$': '<rootDir>/__tests__/helpers/style-stub.js',
  },
  // `helpers/` and `fixtures/` hold no tests of their own.
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/supabase/', '/lib/'],
  // `standard-navigation` is a new expo-router SDK 57 dependency that ships
  // untranspiled ESM (`import * as React from 'react'` in its published
  // lib/), so it has to be transformed like the rest of the Expo stack --
  // without it every test that mounts a route fails with "Cannot use import
  // statement outside a module" pointing at the app's own files.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|react-native-css))',
  ],
};
