import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BrowseOnly, ConsentFields, useConsent } from '../../components/ConsentFields';
import { GoogleButton } from '../../components/GoogleButton';
import { Screen } from '../../components/Page';
import { AppButton, AppText, Banner, Card, Field, Icon } from '../../components/ui';
import { useTranslation } from '../../lib/i18n';
import { signInAvailable, signOut, supabase } from '../../lib/supabase';
import { ageStore, authEmailStore, authRoleStore } from '../../state/stores';
import { colors, radius, spacing } from '../../theme';

/**
 * Admin sign-in, by Google or email link. Residents never need an account: browsing, reporting,
 * posting and alerts all work without one. Admin rights come from the account's app_metadata role,
 * which the ReSource team sets in Supabase, so there is no public sign-up.
 */
export default function SignInScreen() {
  const { t } = useTranslation();
  const age = ageStore.use();
  const consent = useConsent();
  const [email, setEmail] = useState('');
  const signedInAs = authEmailStore.use(); // kept current by watchAuth in the root layout
  const isAdmin = authRoleStore.use() === 'admin';
  const router = useRouter();
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function sendLink() {
    const valid = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim());
    setEmailError(valid ? null : t('alerts.emailInvalid'));
    if (!supabase || !valid || !consent.check() || sending) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/sign-in` } });
    setNotice(error ? { tone: 'warning', text: t('signIn.failed') } : { tone: 'success', text: t('signIn.sent') });
    setSending(false);
  }

  /** Leaves for Google and comes back to /sign-in, where detectSessionInUrl reads the session. */
  async function signInWithGoogle() {
    if (!supabase || !consent.check() || leaving) return;
    setLeaving(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/sign-in` } });
    if (error) {
      setNotice({ tone: 'warning', text: t('signIn.googleFailed') });
      setLeaving(false);
    }
  }

  async function onSignOut() {
    await signOut();
    setNotice({ tone: 'success', text: t('signIn.signedOut') });
  }

  const form = (
    <Card style={styles.card}>
      <GoogleButton label={t('signIn.googleSignIn')} onPress={signInWithGoogle} loading={leaving} testID="sign-in-google" />
      <View style={styles.divider} aria-hidden>
        <View style={styles.dividerLine} />
        <AppText variant="caption">{t('signIn.or')}</AppText>
        <View style={styles.dividerLine} />
      </View>
      <Field label={t('alerts.emailLabel')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" required error={emailError} onSubmitEditing={sendLink} testID="sign-in-email" />
      <AppButton variant="navy" icon="email-fast" label={t('signIn.send')} loading={sending} onPress={sendLink} testID="sign-in-send" />
      <ConsentFields purpose={t('signIn.consent')} consent={consent} />
      <View style={styles.notes}>
        <AppText variant="caption">{t('signIn.googleNote')}</AppText>
        <AppText variant="caption">{t('signIn.transactional')}</AppText>
      </View>
    </Card>
  );

  const signedIn = (
    <Card style={styles.card}>
      <View style={styles.who}>
        <View style={styles.avatar}>
          <AppText variant="h3" color={colors.white}>{signedInAs.charAt(0).toUpperCase()}</AppText>
        </View>
        <View style={styles.whoText}>
          <AppText variant="label">{t('signIn.signedInAs', { email: signedInAs })}</AppText>
          {isAdmin && <AppText variant="caption" color={colors.successDark}>{t('signIn.adminBadge')}</AppText>}
        </View>
      </View>
      {isAdmin && <AppButton variant="gold" icon="shield-account" label={t('signIn.openAdmin')} onPress={() => router.push('/admin' as never)} testID="open-admin" />}
      <AppButton variant="outline" icon="logout" label={t('signIn.signOut')} onPress={onSignOut} testID="sign-out" />
    </Card>
  );

  return (
    <Screen title={t('titles.signIn')} testID="sign-in-screen">
      <View style={styles.column}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="shield-lock" size={28} color={colors.navyDark} />
          </View>
          <AppText variant="eyebrow" color={colors.onNavyMuted}>{t('signIn.eyebrow')}</AppText>
          <AppText variant="h1" heading={1} color={colors.white} center>{t('signIn.heading')}</AppText>
          <AppText color={colors.onNavyMuted} center>{t('signIn.intro')}</AppText>
        </View>
        {!supabase ? (
          <Banner tone="info" icon="account-off-outline" title={t('signIn.offTitle')} body={t('settings.accountOff')} testID="sign-in-off" />
        ) : !signInAvailable ? (
          <Banner tone="info" icon="web" body={t('signIn.webOnly')} testID="sign-in-web-only" />
        ) : signedInAs ? signedIn : age === 'under13' ? <BrowseOnly /> : form}
        {notice && <Banner tone={notice.tone} body={notice.text} live />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: spacing.lg },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  card: { gap: spacing.lg, padding: spacing.xxl },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  notes: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  whoText: { flex: 1, gap: 2 },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
});
