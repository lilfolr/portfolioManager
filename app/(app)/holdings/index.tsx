import { View } from 'react-native';

import { Sans } from '@/src/ui/text';

// Placeholder until the holdings table lands in the next stage.
export default function HoldingsScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <Sans testID="holdingsPlaceholder">Holdings</Sans>
    </View>
  );
}
