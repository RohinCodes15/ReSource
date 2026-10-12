import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PROJECT } from '../../../../shared/constants';
import { Screen } from '../../components/Page';
import { AppButton, AppText, Banner, Card, Checkbox, Chip, Field, LinkText } from '../../components/ui';
import { ApiError, requestDeletion } from '../../lib/api';
import { formatDate, useTranslation } from '../../lib/i18n';
import { colors, spacing } from '../../theme';

/**
 * Data deletion request for people who cannot use "Delete my data" in Settings: someone on a
 * new device, or a parent or guardian asking for a child's data to be removed.
 */
export default function DataRequestScreen() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [details, setDetails] = useState('');
  const [relationship, setRelationship] = useState<'self' | 'parent_or_guardian'>('self');
  const [agree, setAgree] = useState(false);
  const [website, setWebsite] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ receipt_id: string; received_at: string; respond_within_days: number } | null>(null);

  const emailError = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim()) ? null : t('dataRequest.emailInvalid');
  const detailsError = details.trim().length >= 10 ? null : t('dataRequest.detailsShort');

  async function submit() {
    setTouched(true);
    if (emailError || detailsError || !agree || sending) return;
    setSending(true);
    setFailure(null);
    try {
      setReceipt(await requestDeletion({ contact_email: email.trim(), details: details.trim(), relationship, consent: agree, website }));
    } catch (reason) {
      setFailure(t(reason instanceof ApiError && reason.isNetwork ? 'dataRequest.offline' : reason instanceof ApiError && reason.status === 429 ? 'errors.rateLimited' : 'errors.generic', { email: PROJECT.contactEmail }));
    }
    setSending(false);
  }

  if (receipt) {
    return (
      <Screen title={t('titles.dataRequest')} testID="data-request-done">
        <Banner tone="success" title={t('dataRequest.sentTitle')} live
          body={t('dataRequest.sentBody', { id: receipt.receipt_id.slice(0, 8), date: formatDate(receipt.received_at, locale), days: receipt.respond_within_days })} />
        <AppButton variant="outline" icon="home" label={t('notFound.home')} onPress={() => router.replace('/' as never)} />
      </Screen>
    );
  }

  return (
    <Screen title={t('titles.dataRequest')} testID="data-request-screen">
      <AppText color={colors.text}>{t('dataRequest.intro')}</AppText>
      <Banner tone="info" icon="cellphone-check" title={t('dataRequest.fasterTitle')} body={t('dataRequest.fasterBody')}>
        <LinkText label={t('titles.settings')} onPress={() => router.push('/settings' as never)} />
      </Banner>
      <Card style={styles.block}>
        <AppText variant="label">{t('dataRequest.who')}</AppText>
        <View style={styles.chips} role="radiogroup" accessibilityLabel={t('dataRequest.who')}>
          <Chip role="radio" label={t('dataRequest.self')} selected={relationship === 'self'} onPress={() => setRelationship('self')} testID="request-self" />
          <Chip role="radio" label={t('dataRequest.parent')} selected={relationship === 'parent_or_guardian'} onPress={() => setRelationship('parent_or_guardian')} testID="request-parent" />
        </View>
        <Field label={t('dataRequest.emailLabel')} hint={t('dataRequest.emailHint')} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" required error={touched ? emailError : null} testID="request-email" />
        <Field label={t('dataRequest.detailsLabel')} hint={t('dataRequest.detailsHint')} value={details} onChangeText={setDetails} multiline maxLength={1000} required error={touched ? detailsError : null} testID="request-details" />
        <Checkbox checked={agree} onChange={setAgree} label={t('dataRequest.consent')} error={touched && !agree ? t('consent.consentRequired') : null} testID="request-consent" />
        <LinkText label={t('consent.readPrivacy')} onPress={() => router.push('/privacy' as never)} />
        {/* Honeypot for bots; hidden from people and assistive technology. */}
        <View style={styles.trap} aria-hidden><Field label="Website" value={website} onChangeText={setWebsite} /></View>
        {failure && <Banner tone="danger" body={failure} live />}
        <AppButton variant="gold" icon="send" label={t('dataRequest.submit')} loading={sending} onPress={submit} testID="request-submit" />
      </Card>
      <AppText variant="bodySmall">{t('dataRequest.byEmail', { email: PROJECT.contactEmail })}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  trap: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, left: -9999, display: 'none' },
});
