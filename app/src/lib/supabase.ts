/**
 * Sign-in (email magic link or Google) through Supabase Auth. Only the public anon key is used.
 *
 * Two builds, chosen by EXPO_PUBLIC_ACCOUNT_REQUIRED at build time (off by default):
 *  - Off (today): sign-in is optional and the session is kept in memory only, so signing in adds
 *    no stored identifier and closing the app signs you out.
 *  - On: everyone signs in before using the app (see AccountGate). The session is kept on the
 *    device under the declared `session` storage key until the person signs out.
 * When EXPO_PUBLIC_SUPABASE_URL is not set, `supabase` is null and the Sign in screen says so.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { sessionStorageAdapter, STORAGE_KEYS } from './storage';
import { adminTokenStore, authEmailStore, authReadyStore, authRoleStore, authTokenStore, serverAccountRequiredStore } from '../state/stores';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * The account-required build. Off unless the build sets EXPO_PUBLIC_ACCOUNT_REQUIRED to 1 or true.
 * It decides where the session is kept, which cannot change after start-up. Screens ask
 * useAccountRequired() instead, which also listens to the API.
 */
export const accountRequiredBuild = ['1', 'true'].includes((process.env.EXPO_PUBLIC_ACCOUNT_REQUIRED ?? '').toLowerCase());

/**
 * Whether accounts are required right now. The API's `account_required` (GET /config) wins when
 * it gives one; otherwise (an older API, offline, not asked yet) the build flag stands. The API
 * can turn a required-account build off, but cannot turn it on in a build without the flag: that
 * build keeps the session in memory only and carries the no-account policy text.
 */
export function effectiveAccountRequired(build: boolean, server: boolean | null | undefined): boolean {
  return build && server !== false;
}

export const isAccountRequired = () => effectiveAccountRequired(accountRequiredBuild, serverAccountRequiredStore.get());
export const useAccountRequired = () => effectiveAccountRequired(accountRequiredBuild, serverAccountRequiredStore.use());

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
      auth: accountRequiredBuild
        ? { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, storage: sessionStorageAdapter, storageKey: STORAGE_KEYS.session.key }
        : { autoRefreshToken: true, persistSession: false, detectSessionInUrl: true },
    })
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

/**
 * Signs out of Supabase (which also removes the saved session) and, in the account-required
 * build, forgets an admin passcode unlock too, so nothing of the session outlives it.
 */
export async function signOut(): Promise<void> {
  await supabase?.auth.signOut().catch(() => undefined);
  if (isAccountRequired()) adminTokenStore.set('');
}
