import '../global.css';

import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ledgerFonts } from '@/src/theme/fonts';
import { ThemeModeProvider, useThemeMode } from '@/src/theme/theme-mode';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Holds the splash until both the fonts and the persisted theme mode have
 * resolved. The Flutter app awaited `ThemeController.load()` before `runApp`
 * for the same reason: without it the first frame paints in the wrong theme
 * and then snaps.
 */
function SplashGate() {
  const [fontsLoaded, fontError] = useFonts(ledgerFonts);
  const { ready: themeReady } = useThemeMode();
  const ready = (fontsLoaded || !!fontError) && themeReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeModeProvider>
        <StatusBar style="auto" />
        <SplashGate />
      </ThemeModeProvider>
    </SafeAreaProvider>
  );
}
