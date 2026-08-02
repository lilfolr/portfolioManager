import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * The Supabase client. Replaces `Supabase.initialize` in `lib/main.dart` and
 * `lib/supabase_config.dart`'s compile-time `String.fromEnvironment` pair.
 *
 * The anon key is public by design: RLS is the tenant boundary, not client-side
 * secrecy (see the header comment on api.ts). `EXPO_PUBLIC_` is therefore the
 * correct prefix, and the values must be referenced as full static expressions
 * -- Expo inlines them at build time, so destructuring `process.env` or
 * building the key name dynamically yields undefined.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local and fill it in from `make db-status`.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Web already persists to localStorage; native needs an explicit store.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Only the web build can receive a session in a URL fragment. Leaving this
    // on for native makes the client parse a URL that will never carry one.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

if (Platform.OS !== 'web') {
  // Without this a backgrounded app returns with an expired JWT and every
  // RLS-protected read 401s. The web build refreshes on its own timer.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
