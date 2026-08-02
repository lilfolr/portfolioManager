import { View } from 'react-native';

import { useLedgerColors } from '../theme/use-ledger-colors';
import { Mono } from './text';

/**
 * Port of `lib/widgets/source_chip.dart`.
 *
 * The dot colours come from the palette accessor rather than a class, because
 * they are keyed by an account display name at runtime -- Tailwind can only
 * emit classes it can see in the source.
 */

/** Small dot + label badge for source-account tags and provenance markers. */
export function SourceDotChip({
  label,
  dotColor,
  textClassName = 'text-mid',
  dense = false,
}: {
  label: string;
  dotColor: string;
  textClassName?: string;
  dense?: boolean;
}) {
  return (
    <View
      className="flex-row items-center self-start rounded border border-edge-sidebar bg-surface-table pl-1.5 pr-2"
      style={{ paddingVertical: dense ? 1 : 2 }}
    >
      <View
        className="h-[5px] w-[5px] rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <Mono
        numberOfLines={1}
        className={`ml-1.5 shrink ${dense ? 'text-[10.5px]' : 'text-[11px]'} ${textClassName}`}
      >
        {label}
      </Mono>
    </View>
  );
}

/** A plain outlined tag with no dot, e.g. "ASX", "Unit trust · AMIT". */
export function PlainTag({ label }: { label: string }) {
  return (
    <View className="self-start rounded border border-edge-sidebar bg-surface-table px-2 py-0.5">
      <Mono className="text-[10.5px] text-mid">{label}</Mono>
    </View>
  );
}

/**
 * The "eligible" / "not yet" 12-month CGT-discount status pill.
 *
 * The wording is deliberately a statement of fact about the holding period,
 * not a recommendation -- eligibility is computed by the engine at disposal,
 * and this only reports it.
 */
export function HeldStatusPill({
  eligible,
  heldDate,
}: {
  eligible: boolean;
  heldDate: string;
}) {
  const colors = useLedgerColors();
  const fg = eligible ? colors.heldEligibleFg : colors.heldNotYetFg;

  return (
    <View>
      <View
        className={`flex-row items-center self-start rounded border pl-1.5 pr-2 py-0.5 ${
          eligible
            ? 'border-held-eligible-border bg-held-eligible-bg'
            : 'border-held-not-yet-border bg-held-not-yet-bg'
        }`}
      >
        <View
          className="h-[5px] w-[5px] rounded-full"
          style={{ backgroundColor: fg }}
        />
        <Mono
          className={`ml-1.5 text-[10.5px] ${
            eligible ? 'text-held-eligible-fg' : 'text-held-not-yet-fg'
          }`}
        >
          {eligible ? 'eligible' : 'not yet'}
        </Mono>
      </View>
      <Mono className="mt-[3px] text-[10px] text-faint">{heldDate}</Mono>
    </View>
  );
}
