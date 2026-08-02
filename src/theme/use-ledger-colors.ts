import { useCallback } from 'react';
import { useColorScheme } from 'nativewind';

import { dark, light, ramp, sourceDots, type LedgerPalette } from './palette';

export type { LedgerPalette };

/**
 * The `LedgerColors.of(context)` equivalent, for the cases a utility class
 * can't express: a colour passed as a prop, the composition ramp, the
 * source-dot map.
 *
 * Prefer a class name (`className="bg-surface-card"`) wherever one works --
 * those resolve through CSS variables and swap with the theme without a
 * re-render. This hook reads the same `palette.js` the Tailwind config was
 * built from, so the two can't disagree.
 */
export function useLedgerColors(): LedgerPalette {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? dark : light;
}

/** `LedgerPalette.compRamp` -- nine stops, used when segmenting "by holding". */
export function useCompRamp(): readonly string[] {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? ramp.dark : ramp.light;
}

/**
 * `LedgerPalette.sourceDot(source)` -- the dot colour for an account display
 * name, falling back to `faint` for a name the palette doesn't know, exactly
 * as the Dart `sourceDots[source] ?? textFaint` did.
 */
export function useSourceDot(): (source: string) => string {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return useCallback(
    (source: string) => {
      const dots = isDark ? sourceDots.dark : sourceDots.light;
      return dots[source] ?? (isDark ? dark : light).faint;
    },
    [isDark],
  );
}
