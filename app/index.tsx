import { Redirect } from 'expo-router';

/** The ledger opens on Holdings; the group layouts decide sign-in vs app. */
export default function Index() {
  return <Redirect href="/holdings" />;
}
