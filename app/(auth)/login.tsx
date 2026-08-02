import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { AuthError } from '@supabase/supabase-js';

import { supabase } from '@/src/data/supabase';
import { useLedgerColors } from '@/src/theme/use-ledger-colors';
import { Eyebrow, Mono, Sans } from '@/src/ui/text';

/**
 * Email + password sign-in and sign-up. Port of `lib/auth/login_screen.dart`.
 *
 * Successful auth does not navigate: it updates the Supabase session, the
 * session context re-renders, and the `(auth)` layout redirects. Same
 * arrangement the Flutter `AuthGate` had.
 */
export default function LoginScreen() {
  const colors = useLedgerColors();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignIn = mode === 'signIn';

  const validate = (): string | null => {
    if (!email.includes('@')) return 'Enter a valid email';
    if (password.length < 6) return 'At least 6 characters';
    return null;
  };

  const submit = async () => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credentials = { email: email.trim(), password };
      const { error: authError } = isSignIn
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
      if (authError) setError(authError.message);
    } catch (caught) {
      setError(
        caught instanceof AuthError
          ? caught.message
          : 'Something went wrong. Try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-surface-page"
      contentContainerClassName="flex-grow items-center justify-center p-6"
    >
      <View className="w-full max-w-[360px] rounded-lg border border-edge-card bg-surface-card p-7">
        <View className="flex-row items-center">
          <View className="h-6 w-6 items-center justify-center rounded-[5px] bg-ink">
            <Mono className="font-mono-med text-[11px] text-surface-page">
              L
            </Mono>
          </View>
          <Sans className="ml-2.5 font-sans-semi text-[13px] tracking-[-0.13px] text-strong">
            Ledger
          </Sans>
        </View>

        <Sans className="mt-5 font-sans-semi text-[18px] text-strong">
          {isSignIn ? 'Sign in' : 'Create account'}
        </Sans>
        <Sans className="mt-1 text-[12.5px] text-muted">
          {isSignIn
            ? 'Sign in to view your ledger.'
            : 'Register to start a ledger.'}
        </Sans>

        <Eyebrow className="mt-5 text-faint">EMAIL</Eyebrow>
        <TextInput
          testID="email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.faint}
          onSubmitEditing={() => void submit()}
          className="mt-1.5 rounded-md border border-edge-control px-3 py-3 font-sans text-[13px] text-strong focus:border-link"
        />

        <Eyebrow className="mt-3.5 text-faint">PASSWORD</Eyebrow>
        <TextInput
          testID="password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSignIn ? 'current-password' : 'new-password'}
          placeholder="••••••••"
          placeholderTextColor={colors.faint}
          onSubmitEditing={() => void submit()}
          className="mt-1.5 rounded-md border border-edge-control px-3 py-3 font-sans text-[13px] text-strong focus:border-link"
        />

        {error ? (
          <Sans testID="authError" className="mt-3 text-[12px] text-negative">
            {error}
          </Sans>
        ) : null}

        <Pressable
          testID="submit"
          accessibilityRole="button"
          disabled={loading}
          onPress={() => void submit()}
          className="mt-5 items-center rounded-md bg-ink py-3"
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.surfacePage} />
          ) : (
            <Sans className="font-sans-med text-[13px] text-surface-page">
              {isSignIn ? 'Sign in' : 'Create account'}
            </Sans>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => {
            setMode(isSignIn ? 'signUp' : 'signIn');
            setError(null);
          }}
          className="mt-3.5 items-center"
        >
          <Sans className="text-[12px] text-link">
            {isSignIn
              ? "Don't have an account? Create one"
              : 'Already have an account? Sign in'}
          </Sans>
        </Pressable>
      </View>
    </ScrollView>
  );
}
