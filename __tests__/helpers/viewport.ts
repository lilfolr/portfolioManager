/**
 * Controls the measured window size for tests that mount the real route tree.
 *
 * `renderRouter` renders `app/` as the app defines it, so the `WidthOverride`
 * context that component-level tests use is not in play -- the layout calls
 * `useWindowDimensions()` for real. This replaces that hook, which is the
 * equivalent of `tester.view.physicalSize` in the Flutter tests.
 *
 * Import this module, then `jest.mock('react-native/Libraries/Utilities/
 * useWindowDimensions', () => require('./helpers/viewport').mockedHook)`.
 */
const viewport = { width: 1600, height: 1000, scale: 1, fontScale: 1 };

export const mockedHook = {
  __esModule: true,
  default: () => viewport,
};

/** Wide enough for the sidebar (>= 1000px), matching the Flutter tests' 1600x1000. */
export function setWideViewport() {
  viewport.width = 1600;
  viewport.height = 1000;
}

/** The mobile path: chip row instead of sidebar, matching the 900x1200 test. */
export function setMobileViewport() {
  viewport.width = 900;
  viewport.height = 1200;
}

/** Below the 600px narrow threshold. */
export function setNarrowViewport() {
  viewport.width = 500;
  viewport.height = 900;
}
