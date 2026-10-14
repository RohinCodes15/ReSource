import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_NAME } from '../../../../shared/constants';
import { StatTile } from '../../components/Charts';
import { LanguageSelector } from '../../components/LanguageSelector';
import { LocationChip } from '../../components/LocationChip';
import { Footer, Screen } from '../../components/Page';
import { Icon, AppButton, AppText, Banner, Card, FadeIn, type IconName, Pill, Skeleton, SourceLine } from '../../components/ui';
import { ALERT_ICONS, bundledAlerts, bundledResources, bundledServices } from '../../data';
import { useApi } from '../../hooks/useData';
import { getAlerts, getStats, type Stats } from '../../lib/api';
import { formatDate, useTranslation } from '../../lib/i18n';
import { cardSurface, colors, radius, spacing } from '../../theme';

// The Community Board and Community Impact are reached from More.
// `key` picks the translated title and subtitle: home.<key>Title and home.<key>Subtitle.
const ACTIONS: { href: string; key: string; icon: IconName }[] = [
  { href: '/map', key: 'map', icon: 'map-marker-radius' },
  { href: '/resources', key: 'resources', icon: 'hand-heart' },
  { href: '/status', key: 'status', icon: 'clipboard-list' },
  { href: '/budget', key: 'budget', icon: 'chart-bar' },
  { href: '/report', key: 'report', icon: 'clipboard-alert' },
  { href: '/chat', key: 'chat', icon: 'chat-processing' },
  { href: '/reptracker', key: 'reps', icon: 'account-tie' },
];

/** Counts worked out from the bundled data, used when the API is offline. Report counts need the API. */
function bundledStats(): Stats {
  return {
    reports_total: -1,
    reports_verified: -1,
    posts: 0,
    services_tracked: bundledServices.length,
    services_reduced: bundledServices.filter((s) => s.status === 'reduced').length,
    services_closed: bundledServices.filter((s) => s.status === 'closed').length,
    resources: bundledResources.length,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, dirIcon, locale } = useTranslation();
  const stats = useApi(getStats, bundledStats);
  const alerts = useApi(getAlerts, () => bundledAlerts);
  const latest = alerts.data?.[0];
  const count = (value: number | undefined) => (value === undefined ? '' : value < 0 ? '—' : String(value));

  return (
    <Screen title={APP_NAME} contentStyle={styles.content} footer={false} testID="home-screen">
      <LinearGradient colors={[colors.navy, colors.navyDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.heroTop}>
          <AppText variant="h1" heading={1} color={colors.white} accessibilityLabel={APP_NAME}>
            {APP_NAME}<AppText variant="h1" color={colors.gold}>.</AppText>
          </AppText>
          <LanguageSelector light />
        </View>
        <AppText color={colors.onNavyMuted} style={styles.tagline}>{t('home.tagline')}</AppText>
      </LinearGradient>

      <View style={styles.body}>
        <Banner tone="info" icon="school" body={t('home.independent')} testID="independent-notice" />
        {/* The main thing the app is for, so it comes first. */}
        <View style={styles.forMe} testID="home-for-me">
          <AppText variant="h2" heading={2}>{t('home.forMeTitle')}</AppText>
          <AppText color={colors.text}>{t('home.forMeBody')}</AppText>
          <AppButton variant="gold" icon="text-box-search" label={t('home.forMeButton')} onPress={() => router.push('/for-me' as never)} testID="home-action-forMe" />
        </View>
        <LocationChip />

        <View style={styles.sectionGap}>
          <AppText variant="h3" heading={2}>{t('home.numbersTitle')}</AppText>
          {stats.loading ? (
            <View style={styles.tiles}><Skeleton height={86} width="48%" round={radius.lg} /><Skeleton height={86} width="48%" round={radius.lg} /></View>
          ) : stats.data && (
            <View style={styles.tiles} testID="home-stats">
              <StatTile value={count(stats.data.services_reduced + stats.data.services_closed)} label={t('home.statReduced')} onPress={() => router.push('/status' as never)} testID="stat-reduced" />
              <StatTile value={count(stats.data.services_tracked)} label={t('home.statTracked')} onPress={() => router.push('/status' as never)} testID="stat-tracked" />
              <StatTile value={count(stats.data.resources)} label={t('home.statResources')} onPress={() => router.push('/resources' as never)} testID="stat-resources" />
              <StatTile value={count(stats.data.reports_verified)} label={t('home.statReports')} onPress={() => router.push('/report' as never)} testID="stat-reports" />
            </View>
          )}
          <AppText variant="caption">{t(stats.bundled ? 'home.numbersOffline' : 'home.numbersNote')}</AppText>
        </View>

        {latest && (
          <FadeIn>
            <Pressable
              onPress={() => router.push('/alerts' as never)}
              accessibilityRole="button"
              accessibilityLabel={`${t('home.latestUpdate')}: ${latest.title}. ${t('home.viewAlerts')}`}
              testID="latest-alert"
              style={({ pressed }) => [styles.alert, pressed && styles.pressed]}
            >
              <View style={styles.alertHead}>
                <Pill label={t('home.latestUpdate')} icon={ALERT_ICONS[latest.category] ?? 'bell'} color={colors.navy} bg={colors.navyLight} />
                <AppText variant="caption">{formatDate(latest.published_at, locale)}</AppText>
              </View>
              <AppText variant="h4">{latest.title}</AppText>
              <AppText variant="bodySmall" numberOfLines={3}>{latest.body}</AppText>
              <View style={styles.alertFoot}>
                <AppText variant="label" color={colors.navy}>{t('home.viewAlerts')}</AppText>
                <Icon name={dirIcon('chevron-right')} size={20} color={colors.navy} />
              </View>
            </Pressable>
          </FadeIn>
        )}

        <View style={styles.sectionGap}>
          <AppText variant="h3" heading={2}>{t('home.whatDoYouNeed')}</AppText>
          <View style={styles.grid}>
            {ACTIONS.map((action) => {
              const title = t(`home.${action.key}Title`);
              const subtitle = t(`home.${action.key}Subtitle`);
              return (
                <Pressable
                  key={action.href}
                  onPress={() => router.push(action.href as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}. ${subtitle}`}
                  testID={`home-action-${action.key}`}
                  style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                >
                  <View style={styles.actionIcon}><Icon name={action.icon} size={24} color={colors.navy} /></View>
                  <AppText variant="h4">{title}</AppText>
                  <AppText variant="bodySmall">{subtitle}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Card style={styles.sectionGap}>
          <AppText variant="h4" heading={2}>{t('home.emergencyTitle')}</AppText>
          <AppText variant="bodySmall" color={colors.text}>{t('home.emergencyBody')}</AppText>
        </Card>
        {latest && <SourceLine title={t('home.dataSources')} retrieved={latest.retrieved} />}
        {/* Inside the padded body: the hero above is full width, so the Screen itself has no padding. */}
        <Footer />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 0, gap: 0, paddingBottom: spacing.xxl },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  tagline: { marginTop: spacing.sm, maxWidth: 460 },
  body: { padding: spacing.lg, gap: spacing.lg },
  sectionGap: { gap: spacing.sm },
  forMe: { ...cardSurface, padding: spacing.lg, gap: spacing.md, borderTopWidth: 4, borderTopColor: colors.gold },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  alert: { ...cardSurface, padding: spacing.lg, gap: spacing.sm, borderStartWidth: 4, borderStartColor: colors.gold },
  alertHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  alertFoot: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  action: { ...cardSurface, flexGrow: 1, flexBasis: 150, padding: spacing.lg, gap: spacing.xs },
  actionIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.navyLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  pressed: { opacity: 0.85 },
});
