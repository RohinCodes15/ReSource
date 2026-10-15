import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_NAME } from '../../../../shared/constants';
import type { Budget } from '../../../../shared/types';
import { LedgerRow, ShareBar } from '../../components/Charts';
import { LanguageSelector } from '../../components/LanguageSelector';
import { LocationChip } from '../../components/LocationChip';
import { Illustration } from '../../components/illustrations';
import { Footer, Screen } from '../../components/Page';
import { AppButton, AppText, Eyebrow, FadeIn, Icon, type IconName, Rule, Skeleton, SourceLine } from '../../components/ui';
import { ALERT_ICONS, bundledAlerts, bundledBudget, bundledResources, bundledServices } from '../../data';
import { useApi } from '../../hooks/useData';
import { getAlerts, getBudget, getStats, type Stats } from '../../lib/api';
import { formatDate, formatMoney, useTranslation } from '../../lib/i18n';
import { colors, MAX_CONTENT_WIDTH, radius, spacing } from '../../theme';

// The Community Board and Community Impact are reached from More.
// `key` picks the translated title and subtitle: home.<key>Title and home.<key>Subtitle.
const ACTIONS: { href: string; key: string; icon: IconName }[] = [
  { href: '/resources', key: 'resources', icon: 'hand-heart' },
  { href: '/map', key: 'map', icon: 'map-marker-radius' },
  { href: '/status', key: 'status', icon: 'clipboard-list' },
  { href: '/budget', key: 'budget', icon: 'chart-bar' },
  { href: '/report', key: 'report', icon: 'clipboard-alert' },
  { href: '/chat', key: 'chat', icon: 'chat-processing' },
  { href: '/reptracker', key: 'reps', icon: 'account-tie' },
];

/** The money figures listed under "What has been cut so far", by their id in budget.json. */
const CUT_FIGURES = ['ops_cut', 'maint_cut'];

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
  const { width } = useWindowDimensions();
  const { t, dirIcon, locale } = useTranslation();
  const stats = useApi(getStats, bundledStats);
  const alerts = useApi(getAlerts, () => bundledAlerts);
  // The hero shows the copy bundled with the app straight away, then the server's copy when it arrives.
  const budgetState = useApi(getBudget, () => bundledBudget);
  const budget: Budget = budgetState.data ?? bundledBudget;
  const latest = alerts.data?.[0];
  const wide = width >= 720;

  const total = budget.headline.find((item) => item.id === 'total2627');
  const generalFund = budget.headline.find((item) => item.id === 'gf2627');
  const year = total?.label.match(/FY \d{4}\/\d{2}/)?.[0] ?? '';
  const shares = budget.general_fund_shares;
  const topThree = shares.items.filter((item) => item.label !== 'Other').slice(0, 3).reduce((sum, item) => sum + item.percent, 0);
  const sharesSource = budget.sources[shares.source];
  const sourceFor = (id: string, page?: number | null) => {
    const doc = budget.sources[id];
    return doc ? <SourceLine title={page ? t('budget.sourcePage', { title: doc.title, page }) : doc.title} url={doc.url} /> : null;
  };

  const s = stats.data;
  const reduced = s ? s.services_reduced + s.services_closed : 0;
  const heroLead = total ? t('home.heroLead', { total: formatMoney(total.amount) }) : '';

  return (
    <Screen title={APP_NAME} contentStyle={styles.content} footer={false} testID="home-screen">
      <View style={[styles.masthead, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.mastheadTop}>
          <AppText variant="h1" heading={1} color={colors.navy} accessibilityLabel={APP_NAME} style={styles.wordmark}>
            {APP_NAME}<AppText variant="h1" color={colors.gold} style={styles.wordmark}>.</AppText>
          </AppText>
          <LanguageSelector />
        </View>
        <AppText color={colors.text} style={styles.tagline}>{t('home.tagline')}</AppText>
        <AppText variant="caption" testID="independent-notice">{t('home.independent')}</AppText>
      </View>
      {/* Mission Peak, the ridge most of Fremont sees every day. */}
      <Illustration name="peak" width={Math.min(width, MAX_CONTENT_WIDTH)} height={88} />

      <View style={styles.body}>
        {/* The hero: one real figure from the City's budget, and where that money goes. */}
        <View style={[styles.hero, wide && styles.heroWide]} testID="home-hero">
          <View style={[styles.heroFigure, wide && styles.half]}>
            <Rule strong />
            <Eyebrow>{t('home.heroEyebrow', { year })}</Eyebrow>
            {generalFund && (
              <AppText variant="display" testID="home-hero-value" accessibilityLabel={`${formatMoney(generalFund.amount)}. ${heroLead}`}>
                {formatMoney(generalFund.amount)}
              </AppText>
            )}
            {!!heroLead && <AppText color={colors.text} style={styles.heroLead}>{heroLead}</AppText>}
            {generalFund && sourceFor(generalFund.source, generalFund.page)}
          </View>
          <View style={[styles.heroChart, wide && styles.half]}>
            <Rule strong />
            <AppText variant="h3" heading={2}>{t('home.whereTitle')}</AppText>
            <AppText variant="bodySmall" color={colors.text}>{t('home.whereSummary', { share: topThree })}</AppText>
            <ShareBar items={shares.items} label={t('home.whereTitle')} testID="home-shares" />
            {sharesSource && <SourceLine title={t('budget.sourcePage', { title: sharesSource.title, page: shares.page })} url={sharesSource.url} retrieved={budget.retrieved} />}
          </View>
        </View>

        {/* The main thing the app is for, and the one gold button on this screen. */}
        <View style={styles.forMe} testID="home-for-me">
          <AppText variant="h2" heading={2}>{t('home.forMeTitle')}</AppText>
          <AppText color={colors.text} style={styles.measure}>{t('home.forMeBody')}</AppText>
          <AppButton variant="gold" icon="text-box-search" label={t('home.forMeButton')} onPress={() => router.push('/for-me' as never)} style={styles.forMeButton} testID="home-action-forMe" />
          <LocationChip />
        </View>

        <View style={styles.section}>
          <Rule strong />
          <AppText variant="h2" heading={2}>{t('home.cutsTitle')}</AppText>
          {stats.loading ? (
            <View style={styles.ledger}><Skeleton height={56} /><Skeleton height={56} style={styles.skeletonGap} /></View>
          ) : (
            <View style={styles.ledger} testID="home-stats">
              {s && reduced > 0 && (
                <LedgerRow value={String(reduced)} label={t('home.cutServices', { total: s.services_tracked })} onPress={() => router.push('/status' as never)} testID="stat-reduced" />
              )}
              {budget.headline.filter((item) => CUT_FIGURES.includes(item.id)).map((item, i) => (
                <FadeIn key={item.id} delay={80 * (i + 1)}>
                  <Rule />
                  <LedgerRow value={formatMoney(item.amount)} label={item.label} source={sourceFor(item.source, item.page)} testID={`home-fact-${item.id}`} />
                </FadeIn>
              ))}
              {/* Shown only once there is something to count: "0 verified" tells a resident nothing. */}
              {s && s.reports_verified > 0 && (
                <View>
                  <Rule />
                  <LedgerRow value={String(s.reports_verified)} label={t('home.cutReports')} onPress={() => router.push('/impact' as never)} testID="stat-reports" />
                </View>
              )}
            </View>
          )}
          <AppText variant="caption">{t(stats.bundled ? 'home.cutsOffline' : 'home.cutsNote')}</AppText>
        </View>

        {latest && (
          <FadeIn style={styles.section}>
            <Rule strong />
            <Pressable
              onPress={() => router.push('/alerts' as never)}
              accessibilityRole="button"
              accessibilityLabel={`${t('home.latestUpdate')}: ${latest.title}. ${t('home.viewAlerts')}`}
              testID="latest-alert"
              style={({ pressed }) => [styles.latest, pressed && styles.pressed]}
            >
              <View style={styles.latestHead}>
                <Icon name={ALERT_ICONS[latest.category] ?? 'bell'} size={16} color={colors.goldDark} />
                <Eyebrow color={colors.goldDark}>{t('home.latestUpdate')}</Eyebrow>
                <AppText variant="caption">{formatDate(latest.published_at, locale)}</AppText>
              </View>
              <AppText variant="h3">{latest.title}</AppText>
              <AppText variant="bodySmall" numberOfLines={3}>{latest.body}</AppText>
              <View style={styles.latestFoot}>
                <AppText variant="label" color={colors.navy}>{t('home.viewAlerts')}</AppText>
                <Icon name={dirIcon('chevron-right')} size={18} color={colors.navy} />
              </View>
            </Pressable>
          </FadeIn>
        )}

        <View style={styles.section}>
          <Rule strong />
          <AppText variant="h2" heading={2}>{t('home.whatDoYouNeed')}</AppText>
          <View style={[styles.index, wide && styles.indexWide]}>
            {ACTIONS.map((action) => {
              const title = t(`home.${action.key}Title`);
              const subtitle = action.key === 'resources'
                ? t('home.resourcesSubtitle', { count: s?.resources ?? bundledResources.length })
                : t(`home.${action.key}Subtitle`);
              return (
                <Pressable
                  key={action.href}
                  onPress={() => router.push(action.href as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}. ${subtitle}`}
                  testID={`home-action-${action.key}`}
                  style={({ pressed }) => [styles.indexRow, wide && styles.indexRowWide, pressed && styles.pressed]}
                >
                  <Icon name={action.icon} size={24} color={colors.navy} />
                  <View style={styles.indexText}>
                    <AppText variant="h4">{title}</AppText>
                    <AppText variant="bodySmall" testID={action.key === 'resources' ? 'stat-resources-value' : undefined}>{subtitle}</AppText>
                  </View>
                  <Icon name={dirIcon('chevron-right')} size={20} color={colors.muted} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Rule strong />
          <AppText variant="h4" heading={2}>{t('home.emergencyTitle')}</AppText>
          <AppText variant="bodySmall" color={colors.text} style={styles.measure}>{t('home.emergencyBody')}</AppText>
        </View>
        {latest && <SourceLine title={t('home.dataSources')} retrieved={latest.retrieved} />}
        <Footer />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 0, gap: 0, paddingBottom: spacing.xxl },
  masthead: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  mastheadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  wordmark: { fontSize: 34, lineHeight: 40 },
  tagline: { maxWidth: 520, fontSize: 19, lineHeight: 27 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxxl, gap: spacing.huge },
  hero: { gap: spacing.huge },
  heroWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxxl },
  half: { flex: 1 },
  heroFigure: { gap: spacing.sm },
  heroLead: { maxWidth: 360 },
  heroChart: { gap: spacing.sm },
  measure: { maxWidth: 560 },
  forMe: { gap: spacing.md, padding: spacing.xl, backgroundColor: colors.navyLight, borderRadius: radius.lg, borderStartWidth: 4, borderStartColor: colors.gold },
  forMeButton: { alignSelf: 'flex-start', paddingHorizontal: spacing.xxl },
  section: { gap: spacing.md },
  ledger: { gap: 0 },
  skeletonGap: { marginTop: spacing.sm },
  latest: { gap: spacing.sm },
  latestHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  latestFoot: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  index: { gap: 0 },
  indexWide: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xxl },
  indexRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md, minHeight: 64, borderTopWidth: 1, borderTopColor: colors.border },
  indexRowWide: { flexBasis: '45%', flexGrow: 1 },
  indexText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});
