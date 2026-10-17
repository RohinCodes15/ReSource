/**
 * Sign-in (email magic link or Google) through Supabase Auth. Only the public anon key is used.
 *
 * Sign-in is optional (it is how admins reach the admin pages). The session is kept in memory
 * only, so signing in adds no stored identifier and closing the app signs you out.
 * When EXPO_PUBLIC_SUPABASE_URL is not set, `supabase` is null and the Sign in screen says so.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { authEmailStore, authReadyStore, authRoleStore, authTokenStore } from '../state/stores';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, { auth: { autoRefreshToken: true, persistSession: false, detectSessionInUrl: true } })
    : null;

export const authEnabled = supabase !== null;
/**
 * The emailed link opens in a browser, and only the web app can pick the session up from there.
 * On phones there is no way back into the app yet, so sign-in is offered on the web only.
 */
export const signInAvailable = authEnabled && Platform.OS === 'web';

/**
 * Keeps the stores in step with the Supabase session. Called once from the root layout, so a
 * sign-in link is picked up whichever screen it lands on. Returns a function that stops it.
 */
export function watchAuth(): () => void {
  if (!supabase) {
    authReadyStore.set(true);
    return () => undefined;
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    authReadyStore.set(true); // the first event (INITIAL_SESSION) means any saved session is restored
    authEmailStore.set(session?.user.email ?? '');
    authTokenStore.set(session?.access_token ?? '');
    // app_metadata only: a user can edit their own user_metadata, so it must never grant admin.
    const role = session?.user.app_metadata?.role;
    authRoleStore.set(typeof role === 'string' ? role : '');
  });
  return () => data.subscription.unsubscribe();
}

/** Signs out of Supabase. */
export async function signOut(): Promise<void> {
  await supabase?.auth.signOut().catch(() => undefined);
}
