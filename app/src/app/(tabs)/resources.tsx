import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Page } from '../../components/Page';
import { EmptyState, IconAction, type IconName, SkeletonCard } from '../../components/ui';
import { resources as bundledResources } from '../../data';
import { useUserLocation } from '../../hooks/useUserLocation';
import { fetchResources, type ApiResource } from '../../lib/api';
import { cardSurface, colors, fonts, radius, SCREEN_PADDING, spacing, type } from '../../theme';
import { distanceMiles, formatMiles, FREMONT_CENTER, type LatLng } from '../../utils/geo';

// Always-shown filters; any other category found in the data is added after them.
const BASE_FILTERS = ['All', 'Food', 'Health', 'Transit', 'Education'];

const CATEGORY_STYLE: Record<string, { color: string; icon: IconName }> = {
  Food: { color: colors.gold, icon: 'food-apple' },
  Health: { color: colors.success, icon: 'hospital-box' },
  Transit: { color: colors.navy, icon: 'bus' },
  Education: { color: '#6366F1', icon: 'school' },
  Housing: { color: '#0EA5E9', icon: 'home-city' },
};
const categoryStyle = (category: string) => CATEGORY_STYLE[category] ?? { color: colors.muted, icon: 'hand-heart' as IconName };

/** The resource list shipped with the app, used when the API cannot be reached. */
function bundledList(origin: LatLng): ApiResource[] {
  return bundledResources
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category as string,
      address: r.address,
      phone: r.phone,
      website: (r as { website?: string }).website ?? '',
      lat: r.latitude,
      lng: r.longitude,
      description: r.description,
      languages: [] as string[],
      distance_miles: distanceMiles(origin, r),
    }))
    .sort((a, b) => a.distance_miles - b.distance_miles);
}

export default function ResourcesScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [resources, setResources] = useState<ApiResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const { location, status, request } = useUserLocation();

  useEffect(() => { void request(); }, [request]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchResources(location?.latitude, location?.longitude)
      .then((rows) => { if (active) { setResources(rows); setOffline(false); } })
      .catch(() => {
        if (active) { setResources(bundledList(location ?? FREMONT_CENTER)); setOffline(true); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [location?.latitude, location?.longitude]);

  const filters = useMemo(
    () => [...BASE_FILTERS, ...Array.from(new Set(resources.map((r) => r.category))).filter((c) => !BASE_FILTERS.includes(c))],
    [resources],
  );

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources
      .filter((r) => filter === 'All' || r.category === filter)
      .filter((r) => !q || [r.name, r.address, r.category, r.description, ...r.languages].some((v) => v.toLowerCase().includes(q)));
  }, [query, filter, resources]);

  const locationNote =
    status === 'granted'
      ? 'Sorted by distance from you'
      : status === 'denied'
        ? 'Location off · sorted from Fremont City Hall'
        : 'Sorted from Fremont City Hall';

  const header = (
    <View style={styles.header}>
      <View style={styles.search}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search food, clinics, nonprofits…"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Search resources"
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
        {filters.map((f) => {
          const active = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.locationRow}>
        <Text style={type.caption}>{offline ? 'Offline · showing the saved list' : locationNote}</Text>
        <Pressable onPress={request} accessibilityRole="button" accessibilityLabel="Use my location" style={styles.locate} hitSlop={8}>
          <MaterialCommunityIcons name="crosshairs-gps" size={14} color={colors.navy} />
          <Text style={styles.locateText}>{status === 'loading' ? 'Locating…' : 'Use my location'}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Page>
      <FlatList
        data={loading ? [] : data}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        // The search bar and filter chips stay pinned while the list scrolls.
        stickyHeaderIndices={[0]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletons}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
          ) : (
            <EmptyState icon="map-search-outline" title="No resources found" body="Try a different search or filter, or clear them to see everything." />
          )
        }
        renderItem={({ item }) => {
          const style = categoryStyle(item.category);
          return (
            <View style={[styles.card, { borderLeftColor: style.color }]}>
              <View style={styles.cardTop}>
                <View style={[styles.cardIcon, { backgroundColor: `${style.color}22` }]}>
                  <MaterialCommunityIcons name={style.icon} size={22} color={style.color} />
                </View>
                <View style={styles.cardTitle}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={type.caption}>{item.category}</Text>
                </View>
                <View style={styles.distance}>
                  <Text style={styles.distanceText}>{formatMiles(item.distance_miles)}</Text>
                </View>
              </View>
              <Text style={type.bodySmall}>{item.description}</Text>
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.muted} />
                <Text style={styles.meta}>{item.address}</Text>
              </View>
              {item.languages.length > 0 && (
                <View style={styles.metaRow}>
                  <MaterialCommunityIcons name="translate" size={16} color={colors.muted} />
                  <Text style={styles.meta}>{item.languages.join(', ')}</Text>
                </View>
              )}
              <View style={styles.actions}>
                <Text style={styles.phone}>{item.phone}</Text>
                {!!item.website && (
                  <IconAction icon="web" label={`Open the website for ${item.name}`} onPress={() => Linking.openURL(item.website)} />
                )}
                <IconAction
                  icon="directions"
                  label={`Directions to ${item.name}`}
                  onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`)}
                />
                <IconAction
                  icon="phone"
                  tone="gold"
                  label={`Call ${item.name} at ${item.phone}`}
                  onPress={() => Linking.openURL(`tel:${item.phone.replace(/\D/g, '')}`)}
                />
              </View>
            </View>
          );
        }}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxxl },
  header: { backgroundColor: colors.background, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.md },
  search: {
    ...cardSurface,
    marginHorizontal: SCREEN_PADDING,
    height: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text, height: 48, outlineWidth: 0 } as never,
  chips: { paddingHorizontal: SCREEN_PADDING, gap: spacing.sm },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.white },
  locationRow: { paddingHorizontal: SCREEN_PADDING, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  locate: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locateText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.navy },
  skeletons: { paddingHorizontal: SCREEN_PADDING, gap: spacing.md },
  card: {
    ...cardSurface,
    marginHorizontal: SCREEN_PADDING,
    marginBottom: spacing.md,
    padding: spacing.lg,
    gap: spacing.sm,
    // Left edge takes the category color.
    borderLeftWidth: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  distance: { backgroundColor: colors.navyLight, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  distanceText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.navy },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  meta: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  phone: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
