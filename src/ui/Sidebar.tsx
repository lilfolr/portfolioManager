import { useRouter, usePathname, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useSession } from '../auth/session';
import { usePendingReviewCount } from '../data/queries';
import { supabase } from '../data/supabase';
import { useLastHolding } from '../layout/last-holding';
import { SIDEBAR_WIDTH } from '../layout/breakpoint';
import { useThemeMode, type ThemeMode } from '../theme/theme-mode';
import { Eyebrow, Mono, Sans } from './text';

/**
 * Fixed-width left sidebar: brand mark, portfolio nav, ledger-input nav, and
 * the user/footer block. Port of `lib/widgets/sidebar_nav.dart`.
 *
 * The active item is derived from `usePathname()` rather than the four
 * `isHoldings`/`isDetail`/`isTxn` booleans the Flutter version was handed --
 * with real routes the pathname already is that state.
 */

function Brand() {
  return (
    <View className="flex-row items-center px-[18px] pb-4 pt-[18px]">
      <View className="h-6 w-6 items-center justify-center rounded-[5px] bg-ink">
        <Mono className="font-mono-med text-[11px] text-surface-page">L</Mono>
      </View>
      <Sans className="ml-2.5 font-sans-semi text-[13px] tracking-[-0.13px] text-strong">
        Ledger
      </Sans>
    </View>
  );
}

function SidebarLabel({ children }: { children: string }) {
  return (
    <Eyebrow className="px-[18px] pb-2 pt-[18px] text-faint">
      {children}
    </Eyebrow>
  );
}

function NavItem({
  label,
  href,
  selected,
  symbol,
  badge,
  bold = false,
  indent = false,
}: {
  label: string;
  href: Href;
  selected: boolean;
  symbol?: string;
  badge?: string;
  bold?: boolean;
  indent?: boolean;
}) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      className="hover:bg-surface-hover active:bg-surface-hover"
      style={{
        paddingLeft: indent ? 30 : 18,
        paddingRight: 18,
        paddingVertical: indent ? 7 : 8,
      }}
    >
      {selected ? (
        <View
          className="absolute bottom-0 top-0 w-0.5 bg-link"
          style={{ left: indent ? 18 : 0 }}
        />
      ) : null}
      <View className="flex-row items-center">
        {symbol ? (
          <>
            <Mono className="text-[11.5px] text-strong">{symbol}</Mono>
            <Sans
              numberOfLines={1}
              className="ml-[9px] flex-1 text-[12.5px] text-muted"
            >
              {label}
            </Sans>
          </>
        ) : (
          <Sans
            className={`flex-1 text-[13px] text-strong ${bold ? 'font-sans-med' : ''}`}
          >
            {label}
          </Sans>
        )}
        {badge ? (
          <View className="rounded-[9px] border border-badge-border bg-badge-bg px-1.5 py-px">
            <Mono className="font-mono-med text-[10px] leading-[1.5] text-link">
              {badge}
            </Mono>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Three-way System / Light / Dark control, as a small segmented row. */
function ThemeModeSwitcher() {
  const { mode, setMode } = useThemeMode();
  return (
    <View className="flex-row rounded-md border border-edge-control bg-surface-hover p-0.5">
      {MODES.map((option) => {
        const selected = option.value === mode;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => setMode(option.value)}
            className={`flex-1 items-center rounded py-1 ${
              selected ? 'border border-edge-button bg-surface-card' : ''
            }`}
          >
            <Sans
              className={`text-[10.5px] ${
                selected ? 'font-sans-med text-strong' : 'text-muted'
              }`}
            >
              {option.label}
            </Sans>
          </Pressable>
        );
      })}
    </View>
  );
}

function initials(email: string): string {
  const local = email.split('@')[0] ?? '';
  if (local === '') return '?';
  return local.length === 1
    ? local.toUpperCase()
    : local.substring(0, 2).toUpperCase();
}

/** Signed-in user block: avatar, email, sign-out, theme switcher. */
function UserFooter() {
  const { session } = useSession();
  const email = session?.user.email ?? 'signed in';

  return (
    <View className="border-t border-edge-subtle px-[18px] py-3.5">
      <View className="flex-row items-center">
        <View className="h-[22px] w-[22px] items-center justify-center rounded-full border border-avatar-border bg-avatar-bg">
          <Mono className="font-mono-med text-[9.5px] text-mid">
            {initials(email)}
          </Mono>
        </View>
        <Sans numberOfLines={1} className="ml-2 flex-1 text-[12px] text-mid">
          {email}
        </Sans>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void supabase.auth.signOut();
          }}
        >
          <Sans className="text-[11.5px] text-link">Sign out</Sans>
        </Pressable>
      </View>

      <View className="mt-2.5">
        <ThemeModeSwitcher />
      </View>

      <Mono className="mt-2.5 text-[10px] leading-[1.5] text-faint">
        {'All amounts AUD\nLedger current to 01 Aug 2026'}
      </Mono>
    </View>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const pendingReview = usePendingReviewCount();
  const { selected } = useLastHolding();

  const detailHref: Href = selected
    ? {
        pathname: '/holdings/[instrumentId]',
        params: {
          instrumentId: selected.instrumentId,
          accountId: selected.accountId,
        },
      }
    : '/holdings';

  return (
    <View
      className="border-r border-edge-sidebar bg-surface-sidebar"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <Brand />

      <SidebarLabel>PORTFOLIO</SidebarLabel>
      <NavItem
        label="Holdings"
        href="/holdings"
        selected={pathname === '/holdings'}
        bold
      />
      <NavItem
        label="holding detail"
        symbol={selected?.symbol ?? 'VAS'}
        href={detailHref}
        selected={pathname.startsWith('/holdings/')}
        indent
      />
      <NavItem
        label="Income summary"
        href="/income"
        selected={pathname === '/income'}
      />
      <NavItem
        label="Capital gains"
        href="/capital-gains"
        selected={pathname === '/capital-gains'}
      />
      <NavItem
        label="Property"
        href="/property"
        selected={pathname === '/property'}
      />

      <SidebarLabel>LEDGER INPUT</SidebarLabel>
      <NavItem
        label="Import review"
        href="/import-review"
        selected={pathname === '/import-review'}
        // Absent rather than zero when nothing is waiting, and absent while
        // the count is still loading -- a stale number here would send someone
        // to an empty queue.
        badge={pendingReview ? String(pendingReview) : undefined}
      />
      <NavItem
        label="Import sources"
        href="/import-sources"
        selected={pathname.startsWith('/import-sources')}
      />
      <NavItem
        label="Transaction entry"
        href="/transactions/new"
        selected={pathname === '/transactions/new'}
        bold={pathname === '/transactions/new'}
      />

      <View className="flex-1" />
      <UserFooter />
    </View>
  );
}
