import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageSelector } from '../../components/LanguageSelector';
import { Icon, type IconName } from '../../components/ui';
import { useTranslation } from '../../lib/i18n';
import { accountRequired } from '../../lib/supabase';
import { authEmailStore } from '../../state/stores';
import { colors, fonts, MIN_TOUCH, SCREEN_PADDING, spacing } from '../../theme';

// The six destinations in the tab bar. `key` picks the translated title (titles.<key>) and label (tabs.<key>).
const TABS: { name: string; key: string; icon: IconName; iconOutline: IconName }[] = [
  { name: 'index', key: 'home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'map', key: 'map', icon: 'map-marker', iconOutline: 'map-marker-outline' },
  { name: 'resources', key: 'resources', icon: 'hand-heart', iconOutline: 'hand-heart-outline' },
  { name: 'alerts', key: 'alerts', icon: 'bell', iconOutline: 'bell-outline' },
  { name: 'chat', key: 'chat', icon: 'chat-processing', iconOutline: 'chat-processing-outline' },
  { name: 'more', key: 'more', icon: 'dots-horizontal-circle', iconOutline: 'dots-horizontal-circle-outline' },
];

// Routes that keep the tab bar on screen but are reached from Home and More, not from a tab.
// Eight tabs would not fit a 360px phone, so the bar holds six and the rest live here.
const INNER = ['for-me', 'status', 'report', 'reptracker', 'community', 'budget', 'impact', 'admin', 'settings', 'about', 'privacy', 'terms', 'cookies', 'credits', 'data-request', 'sign-in'];
const INNER_TITLES: Record<string, string> = { 'for-me': 'forMe', reptracker: 'reps', 'data-request': 'dataRequest', 'sign-in': 'signIn' };

const TAB_LABEL = { fontFamily: fonts.semibold, fontSize: 10, lineHeight: 14, letterSpacing: -0.2 } as const;

function BackButton() {
  const router = useRouter();
  const { t, dirIcon } = useTranslation();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/more' as never))}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      testID="header-back"
      style={styles.headerButton}
    >
      <Icon name={dirIcon('arrow-left')} size={24} color={colors.text} />
    </Pressable>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const signedIn = authEmailStore.use() !== '';
  return (
    <Tabs
      // Back returns to the screen you came from (More, Home...), not always to the first tab.
      backBehavior="history"
      screenOptions={{
        sceneStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontFamily: fonts.display, fontWeight: '600', fontSize: 20, color: colors.text },
        // A long title shortens with "…" on a narrow phone and never runs under the language button.
        // The header reserves 52px for the right side, and the language button is wider than that.
        headerTitleContainerStyle: { flexShrink: 1, maxWidth: '100%' },
        headerRightContainerStyle: { flexBasis: 'auto', flexShrink: 0 },
        headerShadowVisible: false,
        headerRight: () => <View style={styles.headerRight}><LanguageSelector /></View>,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        // Account-required build: no tab bar until signed in, since every tab would send you back here.
        tabBarStyle: accountRequired && !signedIn
          ? { display: 'none' }
          : [styles.tabBar, { height: 64 + insets.bottom, paddingTop: 4, paddingBottom: insets.bottom + 4 }],
        // 10px with tight tracking: each tab has 50px for its label on a 360px phone, and "Resources" must fit.
        tabBarLabelStyle: TAB_LABEL,
        // The bar has a fixed height; the label stays one size so six tabs always fit.
        tabBarAllowFontScaling: false,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            headerShown: tab.name !== 'index', // Home draws its own hero header
            title: t(`titles.${tab.key}`),
            tabBarLabel: tab.key === 'more'
              // "More" alone does not say where it goes, so the link also carries words that are
              // read aloud but not shown. The spoken name still starts with the visible word.
              ? ({ color }) => (
                <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                  {t('tabs.more')}<Text style={styles.visuallyHidden}>{` ${t('tabs.moreHint')}`}</Text>
                </Text>
              )
              : t(`tabs.${tab.key}`),
            // The spoken name starts with the visible label, so voice control ("tap Resources") works.
            tabBarAccessibilityLabel: tab.key === 'more' ? `${t('tabs.more')} ${t('tabs.moreHint')}` : t(`tabs.${tab.key}`),
            tabBarButtonTestID: `tab-${tab.key}`,
            tabBarIcon: ({ color, focused }) => <Icon name={focused ? tab.icon : tab.iconOutline} size={24} color={String(color)} />,
          }}
        />
      ))}
      {INNER.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{ href: null, title: t(`titles.${INNER_TITLES[name] ?? name}`), headerLeft: () => <BackButton /> }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: { ...TAB_LABEL, textAlign: 'center' },
  // Present for screen readers and link text, invisible on screen.
  visuallyHidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  tabBar: { backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border, elevation: 0, shadowOpacity: 0 },
  headerButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginStart: 6, marginEnd: 2 },
  // The language button ends on the same line as the screen content below it.
  headerRight: { marginStart: spacing.sm, marginEnd: SCREEN_PADDING },
});
