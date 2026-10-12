/**
 * Optional sign-in (email magic link) through Supabase Auth. The app works fully without it:
 * when EXPO_PUBLIC_SUPABASE_URL is not set, `supabase` is null and the Sign in screen says so.
 *
 * Only the public anon key is ever used here. The session is kept in memory, not in device
 * storage, so signing in adds no stored identifier; closing the app signs you out.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, { auth: { autoRefreshToken: true, persistSession: false, detectSessionInUrl: true } })
    : null;

export const authEnabled = supabase !== null;
