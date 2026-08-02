import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Sans } from './text';

/**
 * Placeholder for the five nav items not covered by the hi-fi pass. Port of
 * `lib/screens/not_in_pass_screen.dart`.
 */
export function NotInPass() {
  return (
    <View className="flex-1 items-center justify-center px-[26px] py-20">
      <View className="w-full max-w-[380px] items-center">
        <Sans className="text-center text-[13px] font-sans-med leading-[1.4] text-strong">
          Not in this pass
        </Sans>
        <Sans className="mt-2 text-center text-[12px] leading-[1.6] text-mid">
          This hi-fi pass covers the holdings dashboard and holding detail. The
          other seven screens exist as wireframes.
        </Sans>
        <Link href="/holdings" asChild>
          <Pressable
            accessibilityRole="button"
            className="mt-4 h-8 justify-center rounded-[5px] border border-edge-button bg-surface-card px-[13px] hover:bg-surface-hover active:bg-surface-hover"
          >
            <Sans className="text-[12.5px] text-strong">Back to holdings</Sans>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
