import { View } from 'react-native';

import { Eyebrow, Mono, Sans } from '../../ui/text';

/**
 * The non-SELL right panel. Port of `_buildEffectPanel`.
 *
 * Each line states what saving will do to the ledger. The closing note is the
 * app's no-inference rule stated to the user: a value the source does not
 * state is left blank and the transaction saves incomplete, rather than being
 * estimated into existence.
 */
export function EffectPanel({ lines }: { lines: string[] }) {
  return (
    <View className="px-[26px] pb-[22px] pt-5">
      <Eyebrow className="text-faint">EFFECT ON THE LEDGER</Eyebrow>

      <View
        testID="effectPanel"
        className="mt-3.5 overflow-hidden rounded-md border border-edge-subtle"
      >
        {lines.map((line, index) => (
          <View
            key={line}
            className={`flex-row items-start bg-surface-card px-[15px] py-[13px] ${
              index < lines.length - 1 ? 'border-b border-edge-row' : ''
            }`}
          >
            <Mono className="text-[11px] text-icon-muted">
              {String(index + 1).padStart(2, '0')}
            </Mono>
            <Sans className="ml-3 flex-1 text-[12.5px] leading-[1.6] text-strong">
              {line}
            </Sans>
          </View>
        ))}
      </View>

      <View className="mt-4 flex-row items-start rounded-md border border-edge-info-box bg-surface-info-box px-[15px] py-3">
        <View className="mt-px h-3.5 w-3.5 rounded-full border-[1.5px] border-link" />
        <Sans className="ml-[11px] flex-1 text-[12px] leading-[1.6] text-strong">
          No classification is inferred. Where a statement does not state a
          value, the field stays blank and the transaction saves as incomplete
          rather than being estimated.
        </Sans>
      </View>
    </View>
  );
}
