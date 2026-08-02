import '../global.css';

import { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider, useSession } from '@/src/auth/session';
import { DataSourceProvider } from '@/src/data/data-source';
import { LastHoldingProvider } from '@/src/layout/last-holding';
import { ledgerFonts } from '@/src/theme/fonts';
import { ThemeModeProvider, useThemeMode } from '@/src/theme/theme-mode';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Holds the splash until the fonts, the persisted theme mode and the restored
 * session have all resolved.
 *
 * The Flutter app awaited `ThemeController.load()` before `runApp` and seeded
 * its auth `StreamBuilder` with `initialData` for the same two reasons: without
 * the first, the app paints in the wrong theme then snaps; without the second,
 * it renders the ledger, redirects to sign-in, then redirects back.
 */
function SplashGate() {
  const [fontsLoaded, fontError] = useFonts(ledgerFonts);
  const { ready: themeReady } = useThemeMode();
  const { loading: sessionLoading } = useSession();
  const ready = (fontsLoaded || !!fontError) && themeReady && !sessionLoading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return <Slot />;
}

export default function RootLayout() {
  // One client per mount. `retry: false` matters for tests: the default three
  // retries with exponential backoff hang any assertion on an error state.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <DataSourceProvider>
          <ThemeModeProvider>
            <SessionProvider>
              <LastHoldingProvider>
                <StatusBar style="auto" />
                <SplashGate />
              </LastHoldingProvider>
            </SessionProvider>
          </ThemeModeProvider>
        </DataSourceProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
