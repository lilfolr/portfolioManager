import { Text, type TextProps } from 'react-native';

import { cn } from './cn';

/**
 * The `LedgerText` component set. Port of `LedgerText.sans/mono/columnLabel/
 * eyebrow` in `lib/theme/ledger_theme.dart`.
 *
 * Every text node in the app renders through one of these, and nothing outside
 * this file uses a bare `<Text>`. React Native has no `DefaultTextStyle`, so an
 * unstyled `<Text>` inherits nothing -- it would render in the platform default
 * colour and turn invisible in one of the two themes. Baking a theme token into
 * each component is what makes that failure impossible rather than merely
 * unlikely.
 *
 * Numeric cells must use `<Mono>`: the design relies on tabular figures
 * throughout, and `fontVariant: ['tabular-nums']` is unreliable on Android.
 * IBM Plex Mono is inherently tabular, so routing figures through it gets the
 * alignment for free on every platform.
 */

export interface LedgerTextProps extends TextProps {
  className?: string;
}

/** `LedgerText.sans` -- 13px, regular, body copy. */
export function Sans({ className, ...rest }: LedgerTextProps) {
  return (
    <Text
      className={cn('font-sans text-[13px] leading-[1.35] text-mid', className)}
      {...rest}
    />
  );
}

/** `LedgerText.mono` -- 12.5px, regular, tabular. Every figure goes through this. */
export function Mono({ className, ...rest }: LedgerTextProps) {
  return (
    <Text
      className={cn('font-mono text-[12.5px] leading-[1.3] text-strong', className)}
      {...rest}
    />
  );
}

/** `LedgerText.columnLabel` -- e.g. "MARKET VALUE". */
export function ColumnLabel({ className, ...rest }: LedgerTextProps) {
  return (
    <Text
      numberOfLines={1}
      className={cn(
        'font-mono-med text-[9.5px] leading-[1.3] tracking-[1.1px] text-muted',
        className,
      )}
      {...rest}
    />
  );
}

/** `LedgerText.eyebrow` -- section label, e.g. "TOTAL VALUE". */
export function Eyebrow({ className, ...rest }: LedgerTextProps) {
  return (
    <Text
      numberOfLines={1}
      className={cn(
        'font-mono-med text-[9.5px] leading-none tracking-[1.05px] text-muted',
        className,
      )}
      {...rest}
    />
  );
}
