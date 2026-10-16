import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { BrowseOnly, ConsentFields, useConsent } from '../../components/ConsentFields';
import { Screen } from '../../components/Page';
import { AppButton, AppText, Banner, Card, Field } from '../../components/ui';
import { useTranslation } from '../../lib/i18n';
import { signInAvailable, supabase } from '../../lib/supabase';
import { ageStore, authEmailStore } from '../../state/stores';
import { colors, spacing } from '../../theme';

/**
 * Optional sign-in by email link. Nothing in the app requires it: browsing, reporting, posting
 * and alerts all work without an account. Signing in only lets your reports and posts follow
 * you to another device, and lets a project admin moderate.
 */
export default function SignInScreen() {
  const { t } = useTranslation();
  const age = ageStore.use();
  const consent = useConsent();
  const [email, setEmail] = useState('');
  const signedInAs = authEmailStore.use(); // kept current by watchAuth in the root layout
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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
    if (!supabase || !consent.check()) return;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/sign-in` } });
    if (error) setNotice({ tone: 'warning', text: t('signIn.googleFailed') });
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setNotice({ tone: 'success', text: t('signIn.signedOut') });
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
          <AppButton variant="outline" icon="logout" label={t('signIn.signOut')} onPress={signOut} testID="sign-out" />
        </Card>
      ) : age === 'under13' ? <BrowseOnly /> : (
        <Card style={styles.block}>
          <Field label={t('alerts.emailLabel')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" required error={emailError} testID="sign-in-email" />
          <ConsentFields purpose={t('signIn.consent')} consent={consent} />
          <AppButton variant="gold" icon="email-fast" label={t('signIn.send')} loading={sending} onPress={sendLink} testID="sign-in-send" />
          <AppButton variant="outline" icon="login" label={t('signIn.google')} onPress={signInWithGoogle} testID="sign-in-google" />
          <AppText variant="caption">{t('signIn.transactional')}</AppText>
        </Card>
      )}
      {notice && <Banner tone={notice.tone} body={notice.text} live />}
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: spacing.md } });
