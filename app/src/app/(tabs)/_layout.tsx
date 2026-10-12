import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageSelector } from '../../components/LanguageSelector';
import { Icon, type IconName } from '../../components/ui';
import { useTranslation } from '../../lib/i18n';
import { colors, fonts, MIN_TOUCH, spacing } from '../../theme';

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
const INNER = ['status', 'report', 'reptracker', 'community', 'budget', 'impact', 'admin', 'settings', 'about', 'privacy', 'terms', 'cookies', 'credits', 'data-request', 'sign-in'];
const INNER_TITLES: Record<string, string> = { reptracker: 'reps', 'data-request': 'dataRequest', 'sign-in': 'signIn' };

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
  return (
    <Tabs
      // Back returns to the screen you came from (More, Home...), not always to the first tab.
      backBehavior="history"
      screenOptions={{
        sceneStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
        headerShadowVisible: false,
        headerRight: () => <View style={styles.headerRight}><LanguageSelector /></View>,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: [styles.tabBar, { height: 62 + insets.bottom, paddingBottom: insets.bottom + 6 }],
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        // The bar has a fixed height; the label stays one size so six tabs always fit.
        tabBarAllowFontScaling: false,
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            headerShown: tab.name !== 'index', // Home draws its own hero header
            title: t(`titles.${tab.key}`),
            tabBarLabel: t(`tabs.${tab.key}`),
            tabBarAccessibilityLabel: t(`titles.${tab.key}`),
            tabBarButtonTestID: `tab-${tab.key}`,
            tabBarIcon: ({ color, focused }) => <Icon name={focused ? tab.icon : tab.iconOutline} size={24} color={color} />,
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
  tabBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  headerButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.xs },
  headerRight: { marginHorizontal: spacing.md },
});
