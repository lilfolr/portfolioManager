import { Redirect, Slot } from 'expo-router';

import { useSession } from '@/src/auth/session';

export default function AuthLayout() {
  const { session } = useSession();
  if (session) return <Redirect href="/holdings" />;
  return <Slot />;
}
