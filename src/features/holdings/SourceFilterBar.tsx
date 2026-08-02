import { Pressable, View } from 'react-native';

import type { AccountRef } from '../../domain/models';
import { Sans } from '../../ui/text';
import { sourcePrefixes } from './sort';

/**
 * Source-account filter chip bar. Port of `_SrcFilterBar`.
 *
 * Uses display-name prefix matching so a single "Stake" chip covers both
 * "Stake AU" and "Stake US". `selected` is 'all' or a display-name prefix.
 */
export function SourceFilterBar({
  accounts,
  selected,
  onChange,
}: {
  accounts: AccountRef[];
  selected: string;
  onChange: (value: string) => void;
}) {
  const chips = [
    { value: 'all', label: 'All sources' },
    ...sourcePrefixes(accounts).map((prefix) => ({
      value: prefix,
      label: prefix,
    })),
  ];

  return (
    <View
      testID="sourceFilter"
      className="flex-row self-start overflow-hidden rounded-[5px] border border-edge-control"
    >
      {chips.map((chip, index) => {
        const isSelected = selected === chip.value;
        return (
          <Pressable
            key={chip.value}
            testID={`sourceChip-${chip.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(chip.value)}
            className={`px-[11px] py-1.5 ${
              index !== chips.length - 1 ? 'border-r border-edge-subtle' : ''
            } ${
              isSelected
                ? 'bg-surface-active'
                : 'bg-surface-card hover:bg-surface-hover active:bg-surface-hover'
            }`}
          >
            <Sans
              className={`text-[12px] ${
                isSelected ? 'font-sans-med text-ink' : 'text-mid'
              }`}
            >
              {chip.label}
            </Sans>
          </Pressable>
        );
      })}
    </View>
  );
}
