import { Pressable, ScrollView, View } from 'react-native';

import { light } from '@/src/theme/palette';
import { useCompRamp, useSourceDot } from '@/src/theme/use-ledger-colors';
import { useThemeMode, type ThemeMode } from '@/src/theme/theme-mode';
import { ColumnLabel, Eyebrow, Mono, Sans } from '@/src/ui/text';

/**
 * Theme spike. Renders every palette token, the composition ramp and the
 * source dots in whichever theme is active, so the CSS-variable mechanism can
 * be verified on web, iOS and Android before any screen is ported.
 *
 * Replaced by the holdings route once the shell lands.
 */

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

const SOURCES = [
  'CommSec 0421',
  'Stake AU',
  'Computershare · SRN',
  'MUFG · SRN',
  'Unknown Broker',
];

// The class names have to be literals for Tailwind's scanner to emit them.
const SWATCHES: { token: string; className: string }[] = [
  { token: 'ink', className: 'bg-ink' },
  { token: 'strong', className: 'bg-strong' },
  { token: 'mid', className: 'bg-mid' },
  { token: 'muted', className: 'bg-muted' },
  { token: 'faint', className: 'bg-faint' },
  { token: 'link', className: 'bg-link' },
  { token: 'link-hover', className: 'bg-link-hover' },
  { token: 'positive', className: 'bg-positive' },
  { token: 'negative', className: 'bg-negative' },
  { token: 'surface-sidebar', className: 'bg-surface-sidebar' },
  { token: 'surface-table', className: 'bg-surface-table' },
  { token: 'surface-top-bar', className: 'bg-surface-top-bar' },
  { token: 'surface-active', className: 'bg-surface-active' },
  { token: 'surface-group-head', className: 'bg-surface-group-head' },
  { token: 'surface-parcel-tint', className: 'bg-surface-parcel-tint' },
  { token: 'surface-info-box', className: 'bg-surface-info-box' },
  { token: 'surface-warn-box', className: 'bg-surface-warn-box' },
  { token: 'surface-page', className: 'bg-surface-page' },
  { token: 'surface-card', className: 'bg-surface-card' },
  { token: 'surface-hover', className: 'bg-surface-hover' },
  { token: 'edge-card', className: 'bg-edge-card' },
  { token: 'edge-sidebar', className: 'bg-edge-sidebar' },
  { token: 'edge-subtle', className: 'bg-edge-subtle' },
  { token: 'edge-row', className: 'bg-edge-row' },
  { token: 'edge-header-rule', className: 'bg-edge-header-rule' },
  { token: 'edge-control', className: 'bg-edge-control' },
  { token: 'edge-control-hover', className: 'bg-edge-control-hover' },
  { token: 'edge-button', className: 'bg-edge-button' },
  { token: 'edge-total-rule', className: 'bg-edge-total-rule' },
  { token: 'edge-info-box', className: 'bg-edge-info-box' },
  { token: 'edge-warn-box', className: 'bg-edge-warn-box' },
  { token: 'held-eligible-fg', className: 'bg-held-eligible-fg' },
  { token: 'held-eligible-bg', className: 'bg-held-eligible-bg' },
  { token: 'held-eligible-border', className: 'bg-held-eligible-border' },
  { token: 'held-not-yet-fg', className: 'bg-held-not-yet-fg' },
  { token: 'held-not-yet-bg', className: 'bg-held-not-yet-bg' },
  { token: 'held-not-yet-border', className: 'bg-held-not-yet-border' },
  { token: 'pending-amber', className: 'bg-pending-amber' },
  { token: 'pending-text', className: 'bg-pending-text' },
  { token: 'avatar-bg', className: 'bg-avatar-bg' },
  { token: 'avatar-border', className: 'bg-avatar-border' },
  { token: 'badge-bg', className: 'bg-badge-bg' },
  { token: 'badge-border', className: 'bg-badge-border' },
  { token: 'icon-muted', className: 'bg-icon-muted' },
];

const RAMP_BG = [
  'bg-comp-1',
  'bg-comp-2',
  'bg-comp-3',
  'bg-comp-4',
  'bg-comp-5',
  'bg-comp-6',
  'bg-comp-7',
  'bg-comp-8',
  'bg-comp-9',
];

export default function ThemeSpike() {
  const { mode, setMode } = useThemeMode();
  const ramp = useCompRamp();
  const sourceDot = useSourceDot();

  return (
    <ScrollView className="flex-1 bg-surface-page" contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Eyebrow>THEME MODE</Eyebrow>
        <View className="flex-row gap-2">
          {MODES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              className={`rounded border px-3 py-1.5 ${
                mode === m
                  ? 'border-edge-control-hover bg-surface-active'
                  : 'border-edge-button bg-surface-card hover:bg-surface-hover active:bg-surface-hover'
              }`}
            >
              <Sans className="text-strong">{m}</Sans>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Eyebrow>TOKENS ({SWATCHES.length})</Eyebrow>
        <View className="flex-row flex-wrap gap-2">
          {SWATCHES.map((s) => (
            <View
              key={s.token}
              className="w-[150px] rounded border border-edge-card bg-surface-card p-2"
            >
              <View className={`mb-1.5 h-8 rounded ${s.className}`} />
              <Mono className="text-[10px] text-muted">{s.token}</Mono>
            </View>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Eyebrow>COMPOSITION RAMP</Eyebrow>
        <View className="h-6 flex-row overflow-hidden rounded">
          {RAMP_BG.map((bg) => (
            <View key={bg} className={`flex-1 ${bg}`} />
          ))}
        </View>
        <Mono className="text-[10px] text-muted">
          hook returns {ramp.length} stops
        </Mono>
      </View>

      <View className="gap-2">
        <Eyebrow>SOURCE DOTS (last one falls back to `faint`)</Eyebrow>
        {SOURCES.map((source) => (
          <View key={source} className="flex-row items-center gap-2">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: sourceDot(source) }}
            />
            <Sans>{source}</Sans>
          </View>
        ))}
      </View>

      <View className="gap-1">
        <Eyebrow>TYPE</Eyebrow>
        <Sans>Sans 13 — the quick brown fox</Sans>
        <Mono>Mono 12.5 — 1,234,567.89 / 48.36219178</Mono>
        <ColumnLabel>MARKET VALUE</ColumnLabel>
        <Mono className="text-[10px] text-faint">
          {Object.keys(light).length} tokens defined per theme
        </Mono>
      </View>
    </ScrollView>
  );
}
