import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BrowseOnly, ConsentFields, useConsent } from '../../components/ConsentFields';
import { Screen } from '../../components/Page';
import { AppButton, AppText, Banner, Card, Field, LinkText } from '../../components/ui';
import { useTranslation } from '../../lib/i18n';
import { useAccountRequired, signInAvailable, signOut, supabase } from '../../lib/supabase';
import { ageStore, authEmailStore, authRoleStore } from '../../state/stores';
import { colors, spacing } from '../../theme';

/**
 * Sign-in by email link or Google.
 *
 * With EXPO_PUBLIC_ACCOUNT_REQUIRED off (today), nothing in the app requires it: browsing,
 * reporting, posting and alerts all work without an account. With it on, this is the welcome
 * screen everyone lands on first: an age question, then sign-in, then on to Home.
 */
export default function SignInScreen() {
  const { t } = useTranslation();
  const age = ageStore.use();
  const consent = useConsent();
  const [email, setEmail] = useState('');
  const signedInAs = authEmailStore.use(); // kept current by watchAuth in the root layout
  const accountRequired = useAccountRequired();
  const isAdmin = authRoleStore.use() === 'admin';
  const router = useRouter();
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Account-required build: once signed in, the welcome screen has done its job.
  useEffect(() => {
    if (accountRequired && signedInAs) router.replace('/' as never);
  }, [accountRequired, signedInAs, router]);

  async function sendLink() {
    const valid = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim());
    setEmailError(valid ? null : t('alerts.emailInvalid'));
    if (!supabase || !valid || !consent.check() || sending) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/sign-in` } });
    setNotice(error ? { tone: 'warning', text: t('signIn.failed') } : { tone: 'success', text: t('signIn.sent') });
    setSent(!error);
    setSending(false);
  }

  /** Leaves for Google and comes back to /sign-in, where detectSessionInUrl reads the session. */
  async function signInWithGoogle() {
    if (!supabase || !consent.check()) return;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/sign-in` } });
    if (error) setNotice({ tone: 'warning', text: t('signIn.googleFailed') });
  }

  async function onSignOut() {
    await signOut();
    setNotice({ tone: 'success', text: t('signIn.signedOut') });
  }

  function startOver() {
    setSent(false);
    setNotice(null);
    setEmail('');
  }

  const form = (
    <Card style={styles.block}>
      <Field label={t('alerts.emailLabel')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" required error={emailError} testID="sign-in-email" />
      <ConsentFields purpose={t(accountRequired ? 'account.consent' : 'signIn.consent')} consent={consent} />
      <AppButton variant="gold" icon="email-fast" label={t('signIn.send')} loading={sending} onPress={sendLink} testID="sign-in-send" />
      {accountRequired && sent && <AppButton variant="outline" small label={t('account.useOtherEmail')} onPress={startOver} testID="sign-in-other-email" />}
      <AppButton variant="outline" icon="login" label={t('signIn.google')} onPress={signInWithGoogle} testID="sign-in-google" />
      {!accountRequired && <AppText variant="caption">{t('signIn.googleNote')}</AppText>}
      <AppText variant="caption">{t('signIn.transactional')}</AppText>
    </Card>
  );

  if (accountRequired) {
    return (
      <Screen title={t('account.welcomeTitle')} testID="sign-in-screen">
        <AppText variant="h2" heading={1}>{t('account.welcomeTitle')}</AppText>
        <AppText color={colors.text}>{t('account.welcomeBody')}</AppText>
        <AppText variant="bodySmall" color={colors.text}>{t('account.why')}</AppText>
        {!supabase ? (
          <Banner tone="warning" icon="account-off-outline" body={t('account.notConfigured')} testID="sign-in-off" />
        ) : !signInAvailable ? (
          <Banner tone="info" icon="web" body={t('account.webOnly')} testID="sign-in-web-only" />
        ) : age === 'under13' ? (
          <Banner tone="info" title={t('account.under13Title')} body={t('account.under13Body')} testID="account-under-13" />
        ) : age === null ? (
          <Card style={styles.block} testID="account-age-gate">
            <AppText variant="h3" heading={2}>{t('account.ageQuestion')}</AppText>
            <AppButton variant="navy" label={t('account.ageYes')} onPress={() => ageStore.set('over13')} testID="age-gate-yes" />
            <AppButton variant="outline" label={t('account.ageNo')} onPress={() => ageStore.set('under13')} testID="age-gate-no" />
          </Card>
        ) : signedInAs ? null : form}
        {notice && <Banner tone={notice.tone} body={notice.text} live />}
        <View style={styles.links}>
          <LinkText label={t('titles.privacy')} onPress={() => router.push('/privacy' as never)} testID="welcome-privacy" />
          <LinkText label={t('titles.terms')} onPress={() => router.push('/terms' as never)} testID="welcome-terms" />
          <LinkText label={t('titles.cookies')} onPress={() => router.push('/cookies' as never)} testID="welcome-cookies" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={t('titles.signIn')} testID="sign-in-screen">
      <AppText color={colors.text}>{t('signIn.intro')}</AppText>
      {!supabase ? (
        <Banner tone="info" icon="account-off-outline" title={t('signIn.offTitle')} body={t('settings.accountOff')} testID="sign-in-off" />
      ) : !signInAvailable ? (
        <Banner tone="info" icon="web" body={t('signIn.webOnly')} testID="sign-in-web-only" />
      ) : signedInAs ? (
        <Card style={styles.block}>
          <AppText>{t('signIn.signedInAs', { email: signedInAs })}</AppText>
          {isAdmin && <AppButton variant="navy" icon="shield-account" label={t('signIn.openAdmin')} onPress={() => router.push('/admin' as never)} testID="open-admin" />}
          <AppButton variant="outline" icon="logout" label={t('signIn.signOut')} onPress={onSignOut} testID="sign-out" />
        </Card>
      ) : age === 'under13' ? <BrowseOnly /> : form}
      {notice && <Banner tone={notice.tone} body={notice.text} live />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
