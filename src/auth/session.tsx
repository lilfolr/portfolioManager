import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../data/supabase';

/**
 * Port of `lib/auth/auth_gate.dart`'s `StreamBuilder<AuthState>`.
 *
 * `loading` exists for the same reason the Dart version seeded its
 * `StreamBuilder` with `initialData`: `getSession()` is async, so without a
 * gate the app renders the ledger, bounces to sign-in, then bounces back the
 * moment the restored session arrives.
 */
interface SessionValue {
  session: Session | null;
  loading: boolean;
}

const SessionContext = createContext<SessionValue>({
  session: null,
  loading: false,
});

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
      })
      .catch(() => {
        // Treated as signed out; the sign-in screen will surface any real
        // failure when the user submits.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        setSession(next);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, loading }), [session, loading]);
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
