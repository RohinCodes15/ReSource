import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CutService } from '../../../../shared/types';
import { Page } from '../../components/Page';
import ServiceMap from '../../components/ServiceMap';
import { AppButton, type IconName, NATIVE_DRIVER, StatusBadge } from '../../components/ui';
import { cutServices, SERVICE_ICONS } from '../../data';
import { cardSurface, colors, fonts, radius, SCREEN_PADDING, spacing, statusTone, type } from '../../theme';

const SHEET_TRAVEL = 420;

export default function MapScreen() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // The search bar filters both the chips and the pins on the map.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cutServices;
    return cutServices.filter((s) => [s.name, s.address, s.category, s.status].some((v) => v.toLowerCase().includes(q)));
  }, [query]);

  const selected = cutServices.find((s) => s.id === selectedId) ?? null;
  // `shown` keeps the last service on screen while the sheet slides away.
  const [shown, setShown] = useState<CutService | null>(null);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selected) setShown(selected);
    Animated.spring(slide, { toValue: selected ? 1 : 0, bounciness: 4, useNativeDriver: NATIVE_DRIVER }).start(
      ({ finished }) => { if (finished && !selected) setShown(null); },
    );
  }, [selected, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [SHEET_TRAVEL, 0] });

  return (
    <Page>
      <View style={styles.fill}>
        <ServiceMap services={visible} selectedId={selectedId} onSelect={setSelectedId} />

        {/* Floating search bar and quick-pick chips */}
        <View style={styles.top} pointerEvents="box-none">
          <View style={styles.search}>
            <MaterialCommunityIcons name="magnify" size={22} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search services or neighborhoods"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Search services on the map"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
                <MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} />
              </Pressable>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {visible.map((s) => {
              const active = s.id === selectedId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedId(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${s.name}, ${statusTone(s.status).label}`}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <View style={[styles.chipDot, { backgroundColor: statusTone(s.status).color }]} />
                  <Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{s.name}</Text>
                </Pressable>
              );
            })}
            {!visible.length && (
              <View style={styles.chip}><Text style={styles.chipText}>No services match “{query.trim()}”</Text></View>
            )}
          </ScrollView>
        </View>

        {/* Slide-up sheet with the selected service */}
        {shown && (
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetIcon}>
                <MaterialCommunityIcons name={SERVICE_ICONS[shown.category] as IconName} size={24} color={colors.navy} />
              </View>
              <View style={styles.sheetTitle}>
                <Text style={type.h4}>{shown.name}</Text>
                <StatusBadge status={shown.status} />
              </View>
              <Pressable onPress={() => setSelectedId(null)} accessibilityRole="button" accessibilityLabel="Close details" hitSlop={10} style={styles.close}>
                <MaterialCommunityIcons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <View style={styles.row}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.muted} />
              <Text style={styles.rowText}>{shown.address}</Text>
            </View>
            <View style={styles.row}>
              <MaterialCommunityIcons name="information-outline" size={18} color={colors.muted} />
              <Text style={styles.rowText}>{shown.change} · {shown.effective}</Text>
            </View>
            <Text style={[type.bodySmall, styles.details]}>{shown.details}</Text>
            <AppButton variant="gold" icon="compass-outline" label="Find Alternative" onPress={() => router.push('/resources' as never)} />
          </Animated.View>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden', backgroundColor: colors.navyLight },
  // zIndex sits above Leaflet's own layers on the web.
  top: { position: 'absolute', top: spacing.md, left: 0, right: 0, zIndex: 1100, gap: spacing.sm },
  search: {
    ...cardSurface,
    marginHorizontal: SCREEN_PADDING,
    height: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowOpacity: 0.12,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text, height: 48, outlineWidth: 0 } as never,
  chips: { paddingHorizontal: SCREEN_PADDING, gap: spacing.sm, paddingBottom: spacing.sm },
  chip: {
    ...cardSurface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 36,
    maxWidth: 240,
  },
  chipActive: { backgroundColor: colors.navy },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, flexShrink: 1 },
  chipTextActive: { color: colors.white },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1100,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.xs },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  sheetIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.navyLight, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { flex: 1, gap: spacing.sm },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  details: { marginBottom: spacing.xs },
});
