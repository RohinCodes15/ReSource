import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BrowseOnly } from '../../components/ConsentFields';
import { cookieSettingsStore } from '../../components/CookieBanner';
import { LanguageList } from '../../components/LanguageSelector';
import { LocationChip } from '../../components/LocationChip';
import { Screen } from '../../components/Page';
import { Sheet } from '../../components/Sheet';
import { AppButton, AppText, Banner, Card, Chip, Field, LinkText, Segmented } from '../../components/ui';
import { ApiError, deleteMyData, exportMyData, sendFeedback } from '../../lib/api';
import { formatDate, useTranslation } from '../../lib/i18n';
import { saveTextFile } from '../../lib/platform';
import { authEnabled, signInAvailable } from '../../lib/supabase';
import { ageStore, consentStore, locationStore, resetDeviceData, TEXT_SCALES, textScaleStore } from '../../state/stores';
import { colors, spacing } from '../../theme';

type Notice = { tone: 'success' | 'warning' | 'info'; text: string };
const KINDS = ['problem', 'data_error', 'idea'] as const;

export default function SettingsScreen() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const scale = textScaleStore.use();
  const location = locationStore.use();
  const consent = consentStore.use();
  const age = ageStore.use();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirm, setConfirm] = useState<'server' | 'device' | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('problem');
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);

  const offlineOr = (reason: unknown, fallback: string) => t(reason instanceof ApiError && reason.isNetwork ? 'settings.needsConnection' : fallback);

  async function download() {
    setBusy(true);
    try {
      const outcome = await saveTextFile('resource-my-data.json', JSON.stringify(await exportMyData(), null, 2), 'application/json');
      setNotice({ tone: outcome === 'failed' ? 'warning' : 'success', text: t(outcome === 'failed' ? 'errors.generic' : 'settings.downloaded') });
    } catch (reason) {
      setNotice({ tone: 'warning', text: offlineOr(reason, 'errors.generic') });
    }
    setBusy(false);
  }

  async function confirmDelete() {
    const which = confirm;
    setConfirm(null);
    setBusy(true);
    try {
      if (which === 'server') {
        const receipt = await deleteMyData();
        const total = Object.values(receipt.deleted).reduce((sum, n) => sum + n, 0);
        setNotice({ tone: 'success', text: t('settings.deleted', { count: total, receipt: receipt.receipt_id, date: formatDate(receipt.completed_at, locale) }) });
      } else {
        await resetDeviceData();
        setNotice({ tone: 'success', text: t('settings.deviceCleared') });
      }
    } catch (reason) {
      setNotice({ tone: 'warning', text: offlineOr(reason, 'errors.generic') });
    }
    setBusy(false);
  }

  async function submitFeedback() {
    const text = message.trim();
    setMessageError(text.length < 5 ? t('settings.feedbackTooShort') : null);
    if (text.length < 5) return;
    try {
      await sendFeedback(kind, text);
      setMessage('');
      setNotice({ tone: 'success', text: t('settings.feedbackSent') });
    } catch (reason) {
      setNotice({ tone: 'warning', text: offlineOr(reason, reason instanceof ApiError && reason.status === 429 ? 'errors.rateLimited' : 'errors.generic') });
    }
  }

  return (
    <Screen title={t('titles.settings')} testID="settings-screen">
      {notice && <Banner tone={notice.tone} body={notice.text} live testID="settings-notice" />}

      <Card style={styles.block}>
        <AppText variant="h3" heading={2}>{t('language.select')}</AppText>
        <LanguageList />
        <AppText variant="caption">{t('language.reviewNote')}</AppText>
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3" heading={2}>{t('settings.textSize')}</AppText>
        <Segmented label={t('settings.textSize')} value={String(scale)} onChange={(value) => textScaleStore.set(Number(value))}
          options={TEXT_SCALES.map((value, i) => ({ value: String(value), label: t(`settings.textSize_${i}`) }))} />
        <AppText>{t('settings.textSample')}</AppText>
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3" heading={2}>{t('settings.location')}</AppText>
        <LocationChip />
        {location && <AppButton variant="outline" icon="map-marker-off" label={t('location.clear')} onPress={() => locationStore.set(null)} testID="settings-clear-location" />}
        <AppText variant="caption">{t('location.privacy')}</AppText>
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3" heading={2}>{t('settings.privacyTitle')}</AppText>
        <AppText variant="bodySmall" color={colors.text}>{t('settings.privacyBody')}</AppText>
        <AppText variant="caption" testID="storage-choice">{t(consent.choice === 'all' ? 'settings.storageAll' : consent.choice === 'essential' ? 'settings.storageEssential' : 'settings.storageUnset')}</AppText>
        <AppButton variant="outline" icon="cookie-cog" label={t('footer.storageSettings')} onPress={() => cookieSettingsStore.set(true)} testID="open-storage-settings" />
        <AppButton variant="outline" icon="download" label={t('settings.download')} loading={busy} onPress={download} testID="download-data" />
        <AppButton variant="danger" icon="delete-forever" label={t('settings.delete')} onPress={() => setConfirm('server')} testID="delete-data" />
        <AppButton variant="danger" icon="cellphone-remove" label={t('settings.clearDevice')} onPress={() => setConfirm('device')} testID="clear-device" />
        <LinkText label={t('titles.privacy')} onPress={() => router.push('/privacy' as never)} />
        <LinkText label={t('titles.dataRequest')} onPress={() => router.push('/data-request' as never)} />
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3" heading={2}>{t('settings.account')}</AppText>
        <AppText variant="bodySmall" color={colors.text}>{t(signInAvailable ? 'settings.accountOptional' : authEnabled ? 'signIn.webOnly' : 'settings.accountOff')}</AppText>
        {signInAvailable && <AppButton variant="outline" icon="login" label={t('titles.signIn')} onPress={() => router.push('/sign-in' as never)} testID="go-sign-in" />}
      </Card>

      <Card style={styles.block} testID="feedback-form">
        <AppText variant="h3" heading={2}>{t('settings.feedbackTitle')}</AppText>
        <AppText variant="bodySmall" color={colors.text}>{t('settings.feedbackBody')}</AppText>
        {age === 'under13' ? <BrowseOnly /> : (
          <>
            <View style={styles.chips} role="radiogroup" accessibilityLabel={t('settings.feedbackKind')}>
              {KINDS.map((value) => <Chip key={value} role="radio" label={t(`settings.kind_${value}`)} selected={kind === value} onPress={() => setKind(value)} testID={`feedback-${value}`} />)}
            </View>
            <Field label={t('settings.feedbackLabel')} hint={t('consent.noPersonalDetails')} value={message} onChangeText={setMessage} multiline maxLength={1000} error={messageError} testID="feedback-message" />
            <AppButton variant="navy" icon="send" label={t('settings.feedbackSend')} onPress={submitFeedback} testID="feedback-send" />
          </>
        )}
      </Card>

      <Sheet visible={!!confirm} onClose={() => setConfirm(null)} title={t(confirm === 'device' ? 'settings.clearDevice' : 'settings.delete')} testID="confirm-delete">
        <AppText color={colors.text}>{t(confirm === 'device' ? 'settings.clearDeviceConfirm' : 'settings.deleteConfirm')}</AppText>
        <AppButton variant="danger" icon="delete-forever" label={t('settings.confirmYes')} onPress={confirmDelete} testID="confirm-delete-yes" />
        <AppButton variant="outline" label={t('common.cancel')} onPress={() => setConfirm(null)} testID="confirm-delete-no" />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
