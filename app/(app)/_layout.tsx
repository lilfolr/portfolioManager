import { Redirect, Slot, usePathname } from 'expo-router';
import { View } from 'react-native';

import { useSession } from '@/src/auth/session';
import { useBreakpoint } from '@/src/layout/breakpoint';
import { FinancialYearProvider } from '@/src/layout/financial-year';
import { useLastHolding } from '@/src/layout/last-holding';
import { MobileNavChips } from '@/src/ui/MobileNavChips';
import { Sidebar } from '@/src/ui/Sidebar';
import { TopBar } from '@/src/ui/TopBar';

/**
 * The ledger shell: sidebar or chip row, top bar, and the active screen. Port
 * of `LedgerAppShell` in `lib/app_shell.dart` -- the `LayoutBuilder` becomes
 * `useBreakpoint()`, and the `switch (_screen)` becomes `<Slot />`.
 */

/** `_crumb`, derived from the route instead of from shell state. */
function useCrumb(): string {
  const pathname = usePathname();
  const { selected } = useLastHolding();

  if (pathname === '/transactions/new')
    return 'Ledger input / Transaction entry';
  if (pathname === '/import-sources/new')
    return 'Ledger input / Import sources / New import';
  if (pathname === '/import-sources') return 'Ledger input / Import sources';
  if (pathname === '/import-review') return 'Ledger input / Import review';
  if (pathname.startsWith('/holdings/')) {
    return selected?.symbol
      ? `Portfolio / Holdings / ${selected.symbol}`
      : 'Portfolio / Holdings';
  }
  if (pathname === '/holdings') return 'Portfolio / Holdings';
  return 'Portfolio';
}

function Shell() {
  const { wide, horizontalPadding } = useBreakpoint();
  const crumb = useCrumb();

  return (
    <View className="flex-1 flex-row bg-surface-page">
      {wide ? <Sidebar /> : null}
      <View className="flex-1 bg-surface-card">
        {wide ? null : <MobileNavChips />}
        <TopBar
          crumb={crumb}
          showSearch={wide}
          horizontalPadding={horizontalPadding}
        />
        <View className="flex-1">
          <Slot />
        </View>
      </View>
    </View>
  );
}

export default function AppLayout() {
  const { session, loading } = useSession();

  // The root splash gate already waits on `loading`; this guards the case
  // where a sign-out lands mid-render.
  if (loading) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <FinancialYearProvider>
      <Shell />
    </FinancialYearProvider>
  );
}
