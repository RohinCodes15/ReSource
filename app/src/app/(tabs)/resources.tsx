import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { Resource } from '../../../../shared/types';
import { LocationChip } from '../../components/LocationChip';
import { Footer, Screen } from '../../components/Page';
import { Icon, AppText, Banner, Chip, EmptyState, ErrorState, IconAction, LinkText, LoadingList, Pill, Segmented, SourceLine } from '../../components/ui';
import { bundledResources, RESOURCE_ICONS } from '../../data';
import { useApi } from '../../hooks/useData';
import { getResources } from '../../lib/api';
import { useTranslation } from '../../lib/i18n';
import { directionsUrl, shareText, telUrl } from '../../lib/platform';
import { favoritesStore, toggleFavorite, useOrigin } from '../../state/stores';
import { cardSurface, colors, fonts, MIN_TOUCH, radius, spacing } from '../../theme';
import { formatMiles, sortByDistance } from '../../utils/geo';

type Row = Resource & { distance: number | null };
const hasStreetAddress = (address: string) => /^\d+\s/.test(address);

/** One resource. Memoized so typing in the search box does not redraw every card. */
const ResourceCard = memo(function ResourceCard({ item, saved, onShared }: { item: Row; saved: boolean; onShared: (message: string) => void }) {
  const { t, tx } = useTranslation();
  const share = async () => {
    const text = [item.name, item.phone, hasStreetAddress(item.address) ? item.address : '', item.website].filter(Boolean).join('\n');
    const outcome = await shareText(item.name, text);
    onShared(t(outcome === 'copied' ? 'resources.copied' : outcome === 'failed' ? 'resources.shareFailed' : 'resources.shared', { name: item.name }));
  };
  return (
    <View style={styles.card} testID={`resource-${item.id}`}>
      <View style={styles.cardTop}>
        <View style={styles.cardIcon}><Icon name={RESOURCE_ICONS[item.category] ?? 'hand-heart'} size={22} color={colors.navy} /></View>
        <View style={styles.flex}>
          <AppText variant="h4" heading={3}>{item.name}</AppText>
          <AppText variant="caption">{tx('resourceCategory', item.category)}</AppText>
        </View>
        <Pill
          label={item.distance == null ? t('resources.noLocation') : `${item.coords === 'approximate' ? '≈ ' : ''}${formatMiles(item.distance)}`}
          color={colors.navy}
          bg={colors.navyLight}
          icon={item.distance == null ? 'phone' : 'map-marker-distance'}
        />
      </View>
      <AppText variant="bodySmall" color={colors.text}>{item.description}</AppText>
      <View style={styles.facts}>
        <AppText variant="bodySmall" color={colors.text} selectable>{item.address}</AppText>
        {!!item.hours && <AppText variant="bodySmall" color={colors.text}>{t('common.hours')}: {item.hours}</AppText>}
        {item.languages.length > 0 && <AppText variant="bodySmall" color={colors.text}>{t('resources.languages')}: {item.languages.join(', ')}</AppText>}
        {!!item.language_note && <AppText variant="caption">{item.language_note}</AppText>}
      </View>
      <View style={styles.actions}>
        <LinkText variant="label" icon="phone" label={item.phone} href={telUrl(item.phone)} testID={`call-${item.id}`} />
        <View style={styles.actionIcons}>
        {hasStreetAddress(item.address) && <IconAction icon="directions" label={t('resources.directionsTo', { name: item.name })} href={directionsUrl(item.address)} testID={`directions-${item.id}`} />}
        {!!item.website && <IconAction icon="web" label={t('resources.websiteOf', { name: item.name })} href={item.website} testID={`website-${item.id}`} />}
        <IconAction icon="share-variant" label={t('resources.share', { name: item.name })} onPress={share} testID={`share-${item.id}`} />
        <IconAction
          icon={saved ? 'bookmark' : 'bookmark-outline'}
          tone="gold"
          active={saved}
          label={t(saved ? 'resources.unsave' : 'resources.save', { name: item.name })}
          onPress={() => toggleFavorite(item.id)}
          testID={`save-${item.id}`}
        />
        </View>
      </View>
      <SourceLine title={t('resources.sourceLabel')} url={item.source_url} retrieved={item.retrieved} />
    </View>
  );
});

export default function ResourcesScreen() {
  const { t, tx } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ categories?: string; from?: string; at?: string }>();
  const { data, loading, error, reload } = useApi(getResources, () => bundledResources);
  const { origin } = useOrigin();
  const favorites = favoritesStore.use();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState<'near' | 'name'>('near');
  const [notice, setNotice] = useState('');

  // Arriving from "Find Alternative" on the map pre-selects that service's categories. `at` changes
  // on every press, so pressing it again for the same service selects them again.
  const arrival = `${params.at ?? ''}|${params.categories ?? ''}`;
  const [seenParam, setSeenParam] = useState<string | undefined>(undefined);
  if (arrival !== seenParam) {
    setSeenParam(arrival);
    setSelected(params.categories ? params.categories.split(',').filter(Boolean) : []);
  }

  const categories = useMemo(() => Array.from(new Set((data ?? []).map((r) => r.category))).sort(), [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (data ?? []).filter((r) =>
      (selected.length === 0 || selected.includes(r.category)) &&
      (!savedOnly || favorites.includes(r.id)) &&
      (!q || [r.name, r.description, r.address, tx('resourceCategory', r.category), ...r.languages].some((v) => v.toLowerCase().includes(q))));
    const withDistance = sortByDistance(filtered, origin);
    return sort === 'near' ? withDistance : [...withDistance].sort((a, b) => a.name.localeCompare(b.name));
  }, [data, query, selected, savedOnly, favorites, origin, sort, tx]);

  const toggle = (category: string) => setSelected((current) => (current.includes(category) ? current.filter((c) => c !== category) : [...current, category]));
  const clearFilters = () => { setQuery(''); setSelected([]); setSavedOnly(false); router.setParams({ categories: '', from: '' } as never); };

  const header = (
    <View style={styles.header}>
      {!!params.from && (
        <Banner tone="info" icon="compass" title={t('resources.alternativesFor', { name: params.from })} testID="alternatives-banner">
          <LinkText label={t('resources.showAll')} onPress={clearFilters} testID="clear-alternatives" />
        </Banner>
      )}
      <View style={styles.search}>
        <Icon name="magnify" size={22} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('resources.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t('resources.searchLabel')}
          returnKeyType="search"
          testID="resource-search"
          style={styles.searchInput}
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('common.clearSearch')} style={styles.clear} testID="resource-search-clear">
            <Icon name="close-circle" size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={t('common.all')} selected={selected.length === 0 && !savedOnly} onPress={() => { setSelected([]); setSavedOnly(false); if (params.from) router.setParams({ from: '' } as never); }} testID="chip-all" />
        <Chip label={t('resources.saved', { count: favorites.length })} icon="bookmark" selected={savedOnly} onPress={() => setSavedOnly(!savedOnly)} testID="chip-saved" />
        {categories.map((category) => (
          <Chip key={category} label={tx('resourceCategory', category)} icon={RESOURCE_ICONS[category]} selected={selected.includes(category)} onPress={() => toggle(category)} testID={`chip-${category}`} />
        ))}
      </ScrollView>
      <LocationChip />
      <View style={styles.sortRow}>
        <Segmented label={t('resources.sortLabel')} value={sort} onChange={setSort} options={[{ value: 'near', label: t('resources.sortNear') }, { value: 'name', label: t('resources.sortName') }]} />
        <AppText variant="caption" live="polite" style={styles.flex} testID="resource-count">{t('resources.count', { count: rows.length })}</AppText>
      </View>
      {!!notice && <Banner tone="success" body={notice} live testID="resource-notice" />}
    </View>
  );

  return (
    <Screen title={t('titles.resources')} scroll={false} testID="resources-screen">
      <FlatList
        data={loading || error ? [] : rows}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? <View style={styles.pad}><LoadingList /></View>
            : error ? <ErrorState onRetry={reload} />
              : <EmptyState icon="map-search-outline" title={t('resources.emptyTitle')} body={t('resources.emptyBody')} action={<LinkText label={t('resources.showAll')} onPress={clearFilters} />} />
        }
        ListFooterComponent={<View style={styles.pad}><Footer /></View>}
        renderItem={({ item }) => <ResourceCard item={item} saved={favorites.includes(item.id)} onShared={setNotice} />}
        initialNumToRender={30}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: spacing.lg },
  list: { paddingBottom: spacing.xxl },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  searchInput: { flex: 1, minHeight: MIN_TOUCH, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  clear: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  sortRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  card: { ...cardSurface, marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, flexWrap: 'wrap' },
  cardIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.navyLight, alignItems: 'center', justifyContent: 'center' },
  facts: { gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  // The buttons stay together at the end of the row, and wrap as a group on a narrow phone.
  actionIcons: { flexDirection: 'row', gap: spacing.xs, marginStart: 'auto' },
});
