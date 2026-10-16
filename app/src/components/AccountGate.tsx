import { usePathname, useRouter } from 'expo-router';
import { useEffect, type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { getConfig } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { accountRequired, supabase } from '../lib/supabase';
import { authEmailStore, authReadyStore, offlineStore } from '../state/stores';
import { colors, spacing } from '../theme';
import { AppButton, AppText, Banner } from './ui';

/**
 * Pages anyone can open without an account: the sign-in screen itself, the legal pages (people
 * must be able to read the policy before agreeing to it), the data request page for parents, and
 * the admin passcode form. Everything else waits for a sign-in.
 */
export const OPEN_PATHS = ['/sign-in', '/privacy', '/terms', '/cookies', '/credits', '/data-request', '/admin'];

export function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.includes(pathname.replace(/\/+$/, '') || '/');
}

export type GateState = 'notConfigured' | 'loading' | 'offline' | 'redirect' | null;

/** What the gate shows in place of a screen, or null when the screen may be shown. */
export function gateState(input: { required: boolean; configured: boolean; ready: boolean; signedIn: boolean; offline: boolean; open: boolean }): GateState {
  if (!input.required || input.open) return null;
  if (!input.configured) return 'notConfigured';
  if (!input.ready) return 'loading';
  if (input.offline) return 'offline'; // no cached browsing in the account-required build
  if (!input.signedIn) return 'redirect';
  return null;
}

/**
 * The account-required build's front door (EXPO_PUBLIC_ACCOUNT_REQUIRED). With the flag off it
 * renders its children and nothing else. It only decides what to draw: the API refuses requests
 * without a sign-in on its own.
 */
export function AccountGate({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const ready = authReadyStore.use();
  const signedIn = authEmailStore.use() !== '';
  const offline = offlineStore.use();
  const state = gateState({ required: accountRequired, configured: supabase !== null, ready, signedIn, offline, open: isOpenPath(pathname) });

  useEffect(() => {
    if (state === 'redirect') router.replace('/sign-in' as never);
  }, [state, router]);

  if (state === null) return <>{children}</>;
  return (
    <View style={styles.fill}>
      {/* The navigator stays mounted, hidden, so the redirect has somewhere to go. */}
      <View style={styles.hidden}>{children}</View>
      <View style={styles.cover} role="main" testID={`account-gate-${state}`}>
        {state === 'notConfigured' ? (
          <Banner tone="warning" icon="account-off-outline" body={t('account.notConfigured')} />
        ) : state === 'offline' ? (
          <Banner tone="warning" icon="cloud-off-outline" title={t('account.offlineTitle')} body={t('account.offlineBody')}>
            <AppButton variant="outline" small label={t('common.retry')} onPress={() => { void getConfig().catch(() => undefined); }} testID="account-gate-retry" />
          </Banner>
        ) : (
          <View style={styles.loading} role="status" aria-live="polite">
            <ActivityIndicator color={colors.navy} />
            <AppText>{t('account.loading')}</AppText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
  cover: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background, maxWidth: 560, width: '100%', alignSelf: 'center' },
  loading: { alignItems: 'center', gap: spacing.md },
});
