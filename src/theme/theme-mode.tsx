import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';

/**
 * App-wide theme mode (System / Light / Dark), persisted on-device. Port of
 * `lib/theme/theme_controller.dart`, down to the storage key.
 *
 * The tri-state `mode` drives the three-button switcher in the sidebar; the
 * resolved two-state scheme comes from NativeWind's `useColorScheme()`. That
 * is the same `ThemeMode` / `Brightness` split Flutter had.
 */
export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'themeMode'; // same key as ThemeController._prefsKey

interface ThemeModeValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** False until the persisted mode has been read, so the UI can hold. */
  ready: boolean;
}

const ThemeModeContext = createContext<ThemeModeValue>({
  mode: 'system',
  setMode: () => {},
  ready: true,
});

export function ThemeModeProvider({ children }: PropsWithChildren) {
  const { setColorScheme } = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);

  // <- ThemeController.load(), which the Dart app awaited before runApp.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        const next: ThemeMode =
          stored === 'light' || stored === 'dark' ? stored : 'system';
        setModeState(next);
        setColorScheme(next);
      })
      .catch(() => {
        // Storage unavailable (some test environments); stay on System, as
        // the Dart version did.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setColorScheme]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      setColorScheme(next);
      // Best-effort persistence; the in-memory value is already updated.
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    },
    [setColorScheme],
  );

  const value = useMemo(
    () => ({ mode, setMode, ready }),
    [mode, setMode, ready],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ThemeModeContext);
