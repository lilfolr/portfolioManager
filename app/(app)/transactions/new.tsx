import { View } from 'react-native';

import { Sans } from '@/src/ui/text';

// Placeholder until the transaction entry screen lands.
export default function TransactionEntryScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <Sans testID="transactionEntryPlaceholder">Transaction entry</Sans>
    </View>
  );
}
