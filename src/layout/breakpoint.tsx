import { createContext, useContext, type PropsWithChildren } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * The responsive thresholds from `lib/app_shell.dart`'s `LayoutBuilder`,
 * in one place: `wide = width >= 1000` (sidebar), `narrow = width < 600`,
 * horizontal padding 26 / 16.
 */
export const WIDE_BREAKPOINT = 1000;
export const NARROW_BREAKPOINT = 600;
export const SIDEBAR_WIDTH = 226;

/**
 * Test override for the measured width. `tester.view.physicalSize` has no
 * equivalent in @testing-library/react-native, and the mobile-layout test needs
 * to render at 900px wide.
 */
const WidthOverrideContext = createContext<number | null>(null);

export function WidthOverride({
  width,
  children,
}: PropsWithChildren<{ width?: number }>) {
  return (
    <WidthOverrideContext.Provider value={width ?? null}>
      {children}
    </WidthOverrideContext.Provider>
  );
}

export interface Breakpoint {
  width: number;
  wide: boolean;
  narrow: boolean;
  horizontalPadding: number;
}

export function useBreakpoint(): Breakpoint {
  const override = useContext(WidthOverrideContext);
  const window = useWindowDimensions();
  const width = override ?? window.width;
  const wide = width >= WIDE_BREAKPOINT;
  return {
    width,
    wide,
    narrow: width < NARROW_BREAKPOINT,
    horizontalPadding: wide ? 26 : 16,
  };
}
