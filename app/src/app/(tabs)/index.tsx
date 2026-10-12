import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_NAME } from '../../../../shared/constants';
import { useTranslation } from '../../../lib/i18n';
import { LanguageSelector } from '../../components/LanguageSelector';
import { Page } from '../../components/Page';
import { FadeIn, type IconName, Skeleton } from '../../components/ui';
import { initialAlerts } from '../../data';
import { fetchServices, fetchStats, type ApiService, type ApiStats } from '../../lib/api';
import { cardSurface, colors, fonts, radius, SCREEN_PADDING, spacing, type } from '../../theme';

// `key` picks the translated title/subtitle: home.<key>Title and home.<key>Subtitle.
const ACTIONS: { href: string; key: string; icon: IconName }[] = [
  { href: '/map', key: 'map', icon: 'map-marker-radius' },
  { href: '/resources', key: 'resources', icon: 'magnify' },
  { href: '/report', key: 'report', icon: 'clipboard-alert' },
  { href: '/chat', key: 'chat', icon: 'chat-processing' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Name of a service that closed within the last 24 hours, if any. */
function recentClosure(services: ApiService[]): string | null {
  const now = Date.now();
  const hit = services.find(
    (s) =>
      s.status === 'closed' &&
      [s.effective_date, s.created_at].some((d) => {
        const time = d ? Date.parse(d) : NaN;
        return time >= now - DAY_MS && time <= now;
      }),
  );
  return hit?.name ?? null;
}

function useCountUp(target: number, durationMs = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t >= 1) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [target, durationMs]);
  return value;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useTranslation();
  const rtl = isRTL ? styles.rtl : null;
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [crisis, setCrisis] = useState<string | null>(null);
  const reportsCount = stats?.reports ?? 0;
  const counted = useCountUp(reportsCount);

  useEffect(() => {
    let active = true;
    fetchStats()
      .then((result) => { if (active) setStats(result); })
      .catch(() => { if (active) setStatsError(true); })
      .finally(() => { if (active) setStatsLoading(false); });
    // Crisis banner: a service closed in the last 24 hours. Without the API, fall back to
    // today's critical alert from the bundled sample data.
    fetchServices()
      .then((services) => { if (active) setCrisis(recentClosure(services)); })
      .catch(() => {
        const alert = initialAlerts.find((a) => a.severity === 'critical' && a.date === 'Today');
        if (active) setCrisis(alert?.title ?? null);
      });
    return () => { active = false; };
  }, []);

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[colors.navy, colors.navyDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}
        >
          <View style={styles.heroTop}>
            <Text style={styles.wordmark} accessibilityRole="header" accessibilityLabel={APP_NAME}>
              {APP_NAME}
              <Text style={styles.wordmarkDot}>.</Text>
            </Text>
            <LanguageSelector light />
          </View>
          <Text style={[styles.tagline, rtl]}>{t('home.tagline')}</Text>
        </LinearGradient>

        <View style={styles.body}>
          <FadeIn>
            <View
              style={styles.counter}
              accessible
              accessibilityLabel={`${t(statsError ? 'home.statsUnavailable' : 'home.reportsSubmitted')}: ${reportsCount}`}
            >
              <View style={styles.counterIcon}>
                <MaterialCommunityIcons name="account-group" size={26} color={colors.goldDark} />
              </View>
              <View style={styles.counterText}>
                {statsLoading ? (
                  <Skeleton width={96} height={34} />
                ) : (
                  <Text style={styles.counterNumber}>{statsError ? '—' : counted.toLocaleString('en-US')}</Text>
                )}
                <Text style={[type.bodySmall, rtl]}>
                  {t(statsError ? 'home.statsUnavailable' : 'home.reportsSubmitted')}
                </Text>
              </View>
            </View>
          </FadeIn>

          {crisis && (
            <FadeIn delay={80}>
              <Pressable
                onPress={() => router.push('/alerts' as never)}
                accessibilityRole="button"
                accessibilityLabel={`${t('home.crisisTitle')}: ${crisis}. ${t('home.crisisView')}`}
                style={({ pressed }) => [styles.crisis, pressed && styles.pressed]}
              >
                <View style={styles.crisisIcon}>
                  <MaterialCommunityIcons name="alert" size={20} color={colors.white} />
                </View>
                <View style={styles.crisisText}>
                  <Text style={[styles.crisisTitle, rtl]}>{t('home.crisisTitle')}</Text>
                  <Text style={[styles.crisisBody, rtl]} numberOfLines={2}>{crisis}</Text>
                </View>
                <MaterialCommunityIcons name={isRTL ? 'chevron-left' : 'chevron-right'} size={22} color={colors.dangerDark} />
              </Pressable>
            </FadeIn>
          )}

          <FadeIn delay={160}>
            <Text style={[type.h3, styles.sectionTitle, rtl]}>{t('home.whatDoYouNeed')}</Text>
            <View style={styles.grid}>
              {ACTIONS.map((a) => {
                const title = t(`home.${a.key}Title`);
                const subtitle = t(`home.${a.key}Subtitle`);
                return (
                  <Pressable
                    key={a.href}
                    onPress={() => router.push(a.href as never)}
                    accessibilityRole="button"
                    accessibilityLabel={`${title}. ${subtitle}`}
                    style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                  >
                    <View style={[styles.actionTop, isRTL && styles.rowReverse]}>
                      <View style={styles.actionIcon}>
                        <MaterialCommunityIcons name={a.icon} size={24} color={colors.navy} />
                      </View>
                      <View style={styles.arrow}>
                        <MaterialCommunityIcons name={isRTL ? 'arrow-left' : 'arrow-right'} size={16} color={colors.goldDark} />
                      </View>
                    </View>
                    <Text style={[styles.actionTitle, rtl]}>{title}</Text>
                    <Text style={[type.bodySmall, rtl]}>{subtitle}</Text>
                  </Pressable>
                );
              })}
            </View>
          </FadeIn>

          <Text style={styles.footnote}>{t('home.footnote')}</Text>
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  hero: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 64,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: fonts.bold, fontSize: 32, letterSpacing: -1, color: colors.white },
  wordmarkDot: { color: colors.gold },
  tagline: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: '#C9D6EA', marginTop: spacing.md, maxWidth: 340 },
  body: { paddingHorizontal: SCREEN_PADDING, gap: spacing.lg },
  // The counter card overlaps the bottom edge of the hero.
  counter: { ...cardSurface, marginTop: -40, padding: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  counterIcon: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  counterText: { flex: 1, gap: 2 },
  counterNumber: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: colors.navy },
  crisis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: spacing.lg,
  },
  crisisIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  crisisText: { flex: 1, gap: 2 },
  crisisTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.dangerDark },
  crisisBody: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  sectionTitle: { marginTop: spacing.sm, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  action: { ...cardSurface, flexGrow: 1, flexBasis: '45%', padding: spacing.lg, gap: spacing.xs, minHeight: 156 },
  actionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  actionIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.navyLight, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  footnote: { ...type.caption, textAlign: 'center', lineHeight: 18, marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  // Right-to-left languages (Dari).
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
});
