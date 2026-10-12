import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../components/Page';
import { AppButton, AppText } from '../components/ui';
import { useTranslation } from '../lib/i18n';
import { colors, spacing } from '../theme';

/** Shown for any address the app does not know. Always offers a way back to Home. */
export default function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen title={t('notFound.title')} testID="not-found">
      <View style={styles.box}>
        <AppText variant="h1" heading={1} center color={colors.navy}>{t('notFound.title')}</AppText>
        <AppText center>{t('notFound.body')}</AppText>
        <AppButton variant="gold" icon="home" label={t('notFound.home')} onPress={() => router.replace('/' as never)} testID="go-home" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { paddingVertical: spacing.huge, gap: spacing.lg, alignItems: 'center' },
});
