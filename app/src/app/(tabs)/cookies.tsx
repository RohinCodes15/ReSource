import { StyleSheet, View } from 'react-native';
import { POLICY_EFFECTIVE_DATE } from '../../../../shared/constants';
import { cookieSettingsStore } from '../../components/CookieBanner';
import { Screen } from '../../components/Page';
import { AppButton, AppText, Card, Pill } from '../../components/ui';
import { formatDate, useTranslation } from '../../lib/i18n';
import { STORAGE_KEYS } from '../../lib/storage';
import { colors, spacing } from '../../theme';

/**
 * Cookie Policy. The table is drawn from STORAGE_KEYS in lib/storage.ts, the single list of
 * everything the app keeps on a device, so this page cannot drift from what the code does.
 */
export default function CookiesScreen() {
  const { t, locale } = useTranslation();
  return (
    <Screen title={t('titles.cookies')} testID="cookies-screen">
      <AppText variant="caption">{t('legal.effective', { date: formatDate(POLICY_EFFECTIVE_DATE, locale) })}</AppText>
      <AppText color={colors.text}>{t('cookiePolicy.intro')}</AppText>
      <AppText color={colors.text}>{t('cookiePolicy.none')}</AppText>
      <AppButton variant="navy" icon="cookie-cog" label={t('footer.storageSettings')} onPress={() => cookieSettingsStore.set(true)} testID="cookies-open-settings" />

      <AppText variant="h3" heading={2}>{t('cookiePolicy.listTitle')}</AppText>
      {Object.values(STORAGE_KEYS).map((entry) => (
        <Card key={entry.key} style={styles.item} testID={`storage-${entry.i18n}`}>
          <AppText variant="label" selectable>{entry.key}</AppText>
          <Pill
            label={t(entry.category === 'essential' ? 'storage.essentialTitle' : 'storage.optionalTitle')}
            icon={entry.category === 'essential' ? 'lock' : 'tune'}
            color={entry.category === 'essential' ? colors.navy : colors.goldDark}
            bg={entry.category === 'essential' ? colors.navyLight : colors.goldLight}
          />
          <View style={styles.row}><AppText variant="caption">{t('cookiePolicy.purpose')}</AppText><AppText variant="bodySmall" color={colors.text}>{t(`storageKeys.${entry.i18n}`)}</AppText></View>
          <View style={styles.row}><AppText variant="caption">{t('cookiePolicy.duration')}</AppText><AppText variant="bodySmall" color={colors.text}>{t('cookiePolicy.untilCleared')}</AppText></View>
        </Card>
      ))}

      <AppText variant="h3" heading={2}>{t('cookiePolicy.othersTitle')}</AppText>
      <AppText color={colors.text}>{t('cookiePolicy.others')}</AppText>
      <AppText variant="h3" heading={2}>{t('cookiePolicy.changeTitle')}</AppText>
      <AppText color={colors.text}>{t('cookiePolicy.change')}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { gap: spacing.sm },
  row: { gap: 2 },
});
