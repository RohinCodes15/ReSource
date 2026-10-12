import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AlertSeverity } from '../../../../shared/types';
import { Page } from '../../components/Page';
import { EmptyState, NATIVE_DRIVER, Pill } from '../../components/ui';
import { initialAlerts } from '../../data';
import { cardSurface, colors, fonts, radius, SCREEN_PADDING, spacing, type } from '../../theme';

const SEVERITY: Record<AlertSeverity, { color: string; bg: string; text: string; label: string }> = {
  critical: { color: colors.danger, bg: colors.dangerLight, text: colors.dangerDark, label: 'Critical' },
  warning: { color: colors.warning, bg: colors.warningLight, text: colors.warningDark, label: 'Warning' },
  info: { color: colors.navy, bg: colors.navyLight, text: colors.navy, label: 'Info' },
};

/** "Today" and "Yesterday" read better as a relative time in a timeline. */
const relativeTime = (date: string) => (date === 'Today' ? 'Earlier today' : date);

/** Pill-shaped toggle that turns gold when on. */
function PillSwitch({ value, onChange, label }: { value: boolean; onChange: (next: boolean) => void; label: string }) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(position, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: NATIVE_DRIVER }).start();
  }, [value, position]);
  const translateX = position.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.track, value && styles.trackOn]}
    >
      <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [view, setView] = useState<'all' | 'subscribed'>('all');
  const count = alerts.filter((a) => a.subscribed).length;
  const allOn = count === alerts.length;
  const data = view === 'all' ? alerts : alerts.filter((a) => a.subscribed);

  const toggle = (id: string, value: boolean) =>
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, subscribed: value } : a)));

  return (
    <Page>
      <FlatList
        data={data}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.tabs}>
              {(['all', 'subscribed'] as const).map((key) => {
                const active = view === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setView(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {key === 'all' ? `All (${alerts.length})` : `Subscribed (${count})`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => setAlerts((prev) => prev.map((a) => ({ ...a, subscribed: !allOn })))}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.link}>{allOn ? 'Unsubscribe all' : 'Subscribe to all'}</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="bell-check-outline" title="All caught up" body="You are not subscribed to any alerts yet. Turn one on under All to follow it here." />
        }
        renderItem={({ item, index }) => {
          const s = SEVERITY[item.severity];
          const last = index === data.length - 1;
          return (
            <View style={styles.row}>
              {/* Timeline rail: colored dot with a line running down to the next alert */}
              <View style={styles.rail}>
                <View style={[styles.dotRing, { borderColor: s.bg }]}>
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                </View>
                {!last && <View style={styles.line} />}
              </View>
              <View style={styles.card}>
                <View style={styles.meta}>
                  <Pill label={s.label} color={s.text} bg={s.bg} />
                  <Text style={type.caption}>{relativeTime(item.date)} · {item.area}</Text>
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={type.bodySmall}>{item.body}</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{item.subscribed ? 'Notifications on' : 'Notify me about updates'}</Text>
                  <PillSwitch
                    value={item.subscribed}
                    onChange={(v) => toggle(item.id, v)}
                    label={`Subscribe to updates: ${item.title}`}
                  />
                </View>
              </View>
            </View>
          );
        }}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  list: { padding: SCREEN_PADDING, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  tabs: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 3 },
  tab: { paddingHorizontal: spacing.lg, height: 36, borderRadius: 10, justifyContent: 'center' },
  tabActive: { ...cardSurface, borderRadius: 10 },
  tabText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  tabTextActive: { fontFamily: fonts.semibold, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.navy },
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 24, alignItems: 'center' },
  dotRing: { width: 24, height: 24, borderRadius: 12, borderWidth: 5, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  dot: { width: 14, height: 14, borderRadius: 7 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: spacing.xs },
  card: { ...cardSurface, flex: 1, padding: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.text },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  switchLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  track: { width: 52, height: 30, borderRadius: 15, backgroundColor: colors.border, justifyContent: 'center' },
  trackOn: { backgroundColor: colors.gold },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
