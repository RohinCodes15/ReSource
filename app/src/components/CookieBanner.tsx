import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { useAccountRequired } from '../lib/supabase';
import { authEmailStore, consentStore, createStore, setStorageConsent } from '../state/stores';
import { colors, MAX_CONTENT_WIDTH, radius, shadow, spacing } from '../theme';
import { Sheet } from './Sheet';
import { AppButton, AppText, LinkText, Toggle } from './ui';

/** Opens the storage preferences from anywhere (the footer and Settings both use it). */
export const cookieSettingsStore = createStore<boolean>(false);

/**
 * Storage consent. On the web a banner appears on the first visit with three choices of equal
 * weight: Accept all, Reject all, Manage preferences. Nothing optional is stored before a choice
 * is made, and the choice can be changed at any time from the footer or Settings.
 *
 * The app has no analytics, ads or trackers. The only optional item is keeping chat history on
 * the device, so "Reject all" costs nothing but that convenience.
 */
export function CookieBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const consent = consentStore.use();
  const managing = cookieSettingsStore.use();
  const [optional, setOptional] = useState(consent.choice === 'all');

  // Each time the preferences open, start the switch from the saved choice.
  const [wasManaging, setWasManaging] = useState(false);
  if (managing !== wasManaging) {
    setWasManaging(managing);
    if (managing) setOptional(consent.choice === 'all');
  }

  const close = () => cookieSettingsStore.set(false);
  // Phones have no cookies and no banner; optional storage stays off until turned on in Settings.
  const showBanner = Platform.OS === 'web' && consent.choice === null && !managing;
  // The banner usually floats just above the tab bar. On the account-required welcome screen
  // there is no tab bar and the age question sits low on the page, so the banner takes its own
  // space at the bottom instead of covering it.
  const accountRequired = useAccountRequired();
  const signedIn = authEmailStore.use() !== ''; // read on every render: hooks cannot sit behind &&
  const inline = accountRequired && !signedIn;

  return (
    <>
      {showBanner && (
        <View style={inline ? styles.inlineWrap : styles.wrap} pointerEvents="box-none">
          <View style={styles.banner} role="region" aria-label={t('storage.bannerTitle')} testID="cookie-banner">
            <AppText variant="h4" heading={2}>{t('storage.bannerTitle')}</AppText>
            <AppText variant="bodySmall" color={colors.text}>{t('storage.bannerBody')}</AppText>
            <LinkText variant="bodySmall" label={t('storage.readPolicy')} onPress={() => router.push('/cookies' as never)} testID="cookie-policy-link" />
            <View style={styles.actions}>
              <AppButton variant="outline" label={t('storage.acceptAll')} onPress={() => setStorageConsent('all')} style={styles.action} testID="cookie-accept" />
              <AppButton variant="outline" label={t('storage.rejectAll')} onPress={() => setStorageConsent('essential')} style={styles.action} testID="cookie-reject" />
              <AppButton variant="outline" label={t('storage.manage')} onPress={() => cookieSettingsStore.set(true)} style={styles.action} testID="cookie-manage" />
            </View>
          </View>
        </View>
      )}
      <Sheet visible={managing} onClose={close} title={t('storage.manageTitle')} testID="cookie-preferences">
        <AppText variant="bodySmall" color={colors.text}>{t('storage.manageIntro')}</AppText>
        <View style={styles.category}>
          <AppText variant="label">{t('storage.essentialTitle')}</AppText>
          <AppText variant="caption">{t('storage.essentialBody')}</AppText>
          <AppText variant="caption" color={colors.text}>{t('storage.alwaysOn')}</AppText>
        </View>
        <View style={styles.category}>
          <Toggle value={optional} onChange={setOptional} label={t('storage.optionalTitle')} description={t('storage.optionalBody')} testID="cookie-optional-toggle" />
        </View>
        <AppText variant="caption">{t('storage.noTracking')}</AppText>
        <AppButton variant="navy" label={t('storage.save')} onPress={() => { setStorageConsent(optional ? 'all' : 'essential'); close(); }} testID="cookie-save" />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 72, alignItems: 'center', paddingHorizontal: spacing.md, zIndex: 2000 },
  inlineWrap: { alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  banner: { ...shadow, shadowOpacity: 0.2, width: '100%', maxWidth: MAX_CONTENT_WIDTH, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.navy, padding: spacing.lg, gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  action: { flexGrow: 1, flexBasis: 150 },
  category: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
});
