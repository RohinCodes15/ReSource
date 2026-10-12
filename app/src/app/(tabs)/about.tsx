import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { APP_NAME, PROJECT } from '../../../../shared/constants';
import { Screen } from '../../components/Page';
import { AppButton, AppText, Banner, Card, LinkText, SourceLine } from '../../components/ui';
import { bundledBudget } from '../../data';
import { useTranslation } from '../../lib/i18n';
import { colors, spacing } from '../../theme';

/** About and contact: who made this, what it is for, what it costs (nothing), and how to reach the creator. */
export default function AboutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const facts: [string, string][] = [
    [t('about.project'), APP_NAME],
    [t('about.creator'), PROJECT.creator],
    [t('about.contact'), PROJECT.contactEmail],
    [t('about.locationLabel'), PROJECT.location],
  ];
  return (
    <Screen title={t('titles.about')} testID="about-screen">
      <AppText variant="h2" heading={2}>{t('about.heading')}</AppText>
      <AppText color={colors.text}>{t('about.purpose')}</AppText>
      <Banner tone="info" icon="school" title={t('about.independentTitle')} body={t('home.independent')} testID="about-independent" />

      <Card style={styles.block}>
        {facts.map(([label, value]) => (
          <View key={label} style={styles.fact}>
            <AppText variant="caption">{label}</AppText>
            <AppText selectable>{value}</AppText>
          </View>
        ))}
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3" heading={2}>{t('about.freeTitle')}</AppText>
        <AppText color={colors.text}>{t('about.freeBody')}</AppText>
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3" heading={2}>{t('about.dataTitle')}</AppText>
        <AppText color={colors.text}>{t('about.dataBody')}</AppText>
        <SourceLine title={t('about.dataChecked')} retrieved={bundledBudget.retrieved} />
        <LinkText label={t('titles.credits')} onPress={() => router.push('/credits' as never)} />
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3" heading={2}>{t('about.aiTitle')}</AppText>
        <AppText color={colors.text}>{t('about.aiBody')}</AppText>
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3" heading={2}>{t('about.feedbackTitle')}</AppText>
        <AppText color={colors.text}>{t('about.feedbackBody')}</AppText>
        <AppButton variant="gold" icon="message-alert" label={t('about.feedbackButton')} onPress={() => router.push('/settings' as never)} testID="about-feedback" />
      </Card>

      <View style={styles.links}>
        <LinkText label={t('titles.privacy')} onPress={() => router.push('/privacy' as never)} />
        <LinkText label={t('titles.terms')} onPress={() => router.push('/terms' as never)} />
        <LinkText label={t('titles.cookies')} onPress={() => router.push('/cookies' as never)} />
        <LinkText label={t('titles.dataRequest')} onPress={() => router.push('/data-request' as never)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  fact: { gap: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.sm },
});
