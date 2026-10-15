import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../../components/Page';
import { Icon, AppText, type IconName, Rule } from '../../components/ui';
import { useTranslation } from '../../lib/i18n';
import { colors, MIN_TOUCH, spacing } from '../../theme';

// Every route that is not a tab is listed here, so nothing is reachable only by typing an address.
const GROUPS: { key: string; items: { href: string; title: string; icon: IconName }[] }[] = [
  {
    key: 'city',
    items: [
      { href: '/for-me', title: 'forMe', icon: 'account-search' },
      { href: '/status', title: 'status', icon: 'clipboard-list' },
      { href: '/budget', title: 'budget', icon: 'chart-bar' },
      { href: '/reptracker', title: 'reps', icon: 'account-tie' },
    ],
  },
  {
    key: 'takePart',
    items: [
      { href: '/report', title: 'report', icon: 'clipboard-alert' },
      { href: '/community', title: 'community', icon: 'forum' },
      { href: '/impact', title: 'impact', icon: 'chart-box' },
    ],
  },
  {
    key: 'app',
    items: [
      { href: '/settings', title: 'settings', icon: 'cog' },
      { href: '/about', title: 'about', icon: 'information' },
      { href: '/privacy', title: 'privacy', icon: 'shield-lock' },
      { href: '/terms', title: 'terms', icon: 'file-document' },
      { href: '/cookies', title: 'cookies', icon: 'cookie' },
      { href: '/data-request', title: 'dataRequest', icon: 'account-remove' },
      { href: '/credits', title: 'credits', icon: 'license' },
    ],
  },
  {
    key: 'staff',
    items: [
      { href: '/admin', title: 'admin', icon: 'shield-account' },
    ],
  },
];

export default function MoreScreen() {
  const { t, dirIcon } = useTranslation();
  const router = useRouter();
  return (
    <Screen title={t('titles.more')} testID="more-screen">
      {GROUPS.map((group) => (
        <View key={group.key} style={styles.group}>
          <Rule strong />
          <AppText variant="eyebrow" heading={2}>{t(`more.${group.key}`)}</AppText>
          <View>
            {group.items.map((item, i) => (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href as never)}
                accessibilityRole="button"
                accessibilityLabel={t(`titles.${item.title}`)}
                testID={`more-${item.title}`}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
              >
                <Icon name={item.icon} size={22} color={colors.navy} />
                <AppText variant="h4" style={styles.flex}>{t(`titles.${item.title}`)}</AppText>
                <Icon name={dirIcon('chevron-right')} size={22} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: spacing.sm, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: MIN_TOUCH + 12, paddingVertical: spacing.xs },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.7 },
});
