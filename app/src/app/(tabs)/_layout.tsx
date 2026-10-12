import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { type ColorValue, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../lib/i18n';
import { colors, fonts } from '../../theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// `name` is the route file; `key` picks the translated header (titles.<key>) and tab label (tabs.<key>).
const TABS: { name: string; key: string; icon: IconName; iconOutline: IconName }[] = [
  { name: 'index', key: 'home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'map', key: 'map', icon: 'map-marker', iconOutline: 'map-marker-outline' },
  { name: 'resources', key: 'resources', icon: 'magnify', iconOutline: 'magnify' },
  { name: 'report', key: 'report', icon: 'clipboard-alert', iconOutline: 'clipboard-alert-outline' },
  { name: 'alerts', key: 'alerts', icon: 'bell', iconOutline: 'bell-outline' },
  { name: 'reptracker', key: 'reps', icon: 'account-tie', iconOutline: 'account-tie-outline' },
  { name: 'community', key: 'community', icon: 'forum', iconOutline: 'forum-outline' },
  { name: 'chat', key: 'chat', icon: 'chat-processing', iconOutline: 'chat-processing-outline' },
];

/** Tab icon with the gold dot that marks the active tab. */
function TabIcon({ name, color, focused }: { name: IconName; color: ColorValue; focused: boolean }) {
  return (
    <View style={styles.icon}>
      <MaterialCommunityIcons name={name} size={22} color={color} />
      <View style={[styles.dot, focused && styles.dotActive]} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Fixed height so the icon, gold dot and label all fit above the phone's home indicator.
  const tabBarSize = { height: 64 + insets.bottom, paddingBottom: insets.bottom + 8 };
  return (
    <Tabs
      screenOptions={{
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: [styles.tabBar, tabBarSize],
        // Eight tabs share the bar, so labels are small and tight to avoid truncation on phones.
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 9, letterSpacing: -0.3 },
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            // Home draws its own hero header.
            headerShown: tab.name !== 'index',
            title: t(`titles.${tab.key}`),
            tabBarLabel: t(`tabs.${tab.key}`),
            tabBarAccessibilityLabel: t(`titles.${tab.key}`),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? tab.icon : tab.iconOutline} color={color} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    // Soft shadow above the bar instead of a hard border line.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  icon: { alignItems: 'center', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  dotActive: { backgroundColor: colors.gold },
});
