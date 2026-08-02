// Global test environment. @testing-library/react-native v12.4+ ships its jest
// matchers built in, so there is nothing to extend here.

// src/data/supabase.ts throws on a missing config rather than silently
// pointing at nothing, which is the behaviour we want in the app. Tests never
// reach a network, but the module is still imported, so give it a valid shape.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54361';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Font loading is real async work against a native module that does not exist
// here, and the splash gate holds the whole tree until it reports done. Tests
// assert on layout and behaviour, never on which typeface rendered, so this
// reports loaded immediately.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [true, null],
  loadAsync: () => Promise.resolve(),
  isLoaded: () => true,
}));

// The splash screen has no native module either; hiding it is a no-op.
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => Promise.resolve(),
  hideAsync: () => Promise.resolve(),
  setOptions: () => {},
}));

// AsyncStorage has no native module under jest. The shipped jest mock defers
// its callbacks through the event loop, which deadlocks under the fake timers
// `renderRouter` installs -- the theme provider then never reports ready and
// the splash gate renders nothing. This mock resolves on the microtask queue
// instead, so it settles regardless of the timer implementation.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        store.delete(key);
        return Promise.resolve();
      },
      clear: () => {
        store.clear();
        return Promise.resolve();
      },
    },
  };
});
