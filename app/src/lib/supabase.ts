/**
 * Optional sign-in (email magic link) through Supabase Auth. The app works fully without it:
 * when EXPO_PUBLIC_SUPABASE_URL is not set, `supabase` is null and the Sign in screen says so.
 *
 * Only the public anon key is ever used here. The session is kept in memory, not in device
 * storage, so signing in adds no stored identifier; closing the app signs you out.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { authEmailStore, authTokenStore } from '../state/stores';

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
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    authEmailStore.set(session?.user.email ?? '');
    authTokenStore.set(session?.access_token ?? '');
  });
  return () => data.subscription.unsubscribe();
}
