/**
 * Stand-in for `src/data/supabase.ts` in tests that mount the app tree.
 *
 * Only the auth surface the client actually uses is implemented. Everything
 * that reads data goes through the repository, which those tests mock
 * separately, so there is no PostgREST surface to fake here.
 */
interface FakeSession {
  user: { email: string };
}

let session: FakeSession | null = null;

export const signOutSpy = jest.fn();
export const signInSpy = jest.fn();
export const signUpSpy = jest.fn();

/** Sets the session the next `getSession()` resolves with. */
export function setSession(next: FakeSession | null) {
  session = next;
}

export function resetAuthMocks() {
  session = null;
  signOutSpy.mockReset();
  signInSpy.mockReset().mockResolvedValue({ error: null });
  signUpSpy.mockReset().mockResolvedValue({ error: null });
}

export const supabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session } }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signOut: (...args: unknown[]) => {
      session = null;
      return signOutSpy(...args);
    },
    signInWithPassword: (...args: unknown[]) => signInSpy(...args),
    signUp: (...args: unknown[]) => signUpSpy(...args),
    startAutoRefresh: () => {},
    stopAutoRefresh: () => {},
  },
};
