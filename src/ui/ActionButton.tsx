import { Pressable } from 'react-native';

import { Sans } from './text';

/** Port of `_ActionButton` in `lib/screens/holdings_screen.dart`. */
export function ActionButton({
  label,
  primary = false,
  onPress,
  testID,
}: {
  label: string;
  primary?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      className={`h-8 justify-center rounded-[5px] border px-[13px] ${
        primary
          ? 'border-ink bg-ink'
          : 'border-edge-button bg-surface-card hover:bg-surface-hover active:bg-surface-hover'
      }`}
    >
      <Sans
        className={`text-[12.5px] ${
          primary ? 'font-sans-med text-surface-page' : 'text-strong'
        }`}
      >
        {label}
      </Sans>
    </Pressable>
  );
}
