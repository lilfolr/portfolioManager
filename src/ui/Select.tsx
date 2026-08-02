import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Mono } from './text';

/**
 * A small dropdown, standing in for Flutter's `DropdownButton`. React Native
 * has no picker primitive that renders the same on web and native, so this is a
 * pressable trigger plus a modal list -- dense enough for the top bar's FY
 * selector and predictable on every platform.
 */
export function Select({
  value,
  options,
  onChange,
  testID,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="h-7 justify-center rounded-[5px] border border-edge-control px-1.5 hover:border-edge-control-hover"
      >
        <Mono className="text-[12px] text-strong">{value}</Mono>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-ink/30 p-6"
          onPress={() => setOpen(false)}
        >
          <View className="w-full max-w-[260px] overflow-hidden rounded-md border border-edge-card bg-surface-card">
            {options.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`border-b border-edge-row px-3 py-2.5 hover:bg-surface-hover active:bg-surface-hover ${
                  option === value ? 'bg-surface-active' : ''
                }`}
              >
                <Mono className="text-[12px] text-strong">{option}</Mono>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
