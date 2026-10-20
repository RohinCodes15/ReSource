import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { Resource, Service, ServiceStatus } from '../../../../shared/types';
import { LocationChip } from '../../components/LocationChip';
import { Footer, Screen } from '../../components/Page';
import ServiceMap from '../../components/ServiceMap';
import type { MapPin } from '../../components/ServiceMap.types';
import { Sheet } from '../../components/Sheet';
import { Icon, AppButton, AppText, Banner, Card, Chip, EmptyState, ErrorState, IconAction, LoadingList, Segmented, SourceLine, StatusBadge } from '../../components/ui';
import type { IconName } from '../../components/icons';
import { bundledResources, bundledServices, RESOURCE_ICONS, SERVICE_ICONS } from '../../data';
import { useApi } from '../../hooks/useData';
import { getResources, getServices } from '../../lib/api';
import { formatDate, formatMoney, useTranslation } from '../../lib/i18n';
import { directionsUrl, MAP_AVAILABLE, telUrl } from '../../lib/platform';
import { useOrigin } from '../../state/stores';
import { colors, fonts, MIN_TOUCH, radius, spacing, statusTone } from '../../theme';

const STATUS_FILTERS: ('all' | ServiceStatus)[] = ['all', 'reduced', 'closed', 'open'];

/** Which kinds of place the map shows: City services, places to get help, or both. */
type Layer = 'all' | 'services' | 'resources';
const LAYERS: { value: Layer; icon?: IconName }[] = [
  { value: 'all' },
  { value: 'services', icon: 'office-building' },
  { value: 'resources', icon: 'hand-heart' },
];

const hasStreetAddress = (address: string) => /^\d+\s/.test(address);

/**
 * Several places share one building (City Hall), which would stack their pins exactly on top
 * of each other. Pins at the same point are drawn in a small ring around it (a fixed number
 * of pixels at every zoom), so each one can be selected.
 */
function spread(points: Omit<MapPin, 'dx' | 'dy'>[]): MapPin[] {
  const groups = new Map<string, Omit<MapPin, 'dx' | 'dy'>[]>();
  points.forEach((p) => {
    const key = `${p.latitude},${p.longitude}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  });
  const pins: MapPin[] = [];
  groups.forEach((group) => {
    group.forEach((point, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      const radius = group.length > 1 ? Math.max(24, group.length * 7) : 0;
      pins.push({ ...point, dx: Math.round(radius * Math.cos(angle)), dy: Math.round(radius * Math.sin(angle)) });
    });
  });
  return pins;
}

/** Everything about one service, with the actions someone might take next. */
function ServiceDetail({ service, onClose }: { service: Service; onClose: () => void }) {
  const { t, tx, locale } = useTranslation();
  const router = useRouter();
  const categories = service.alt_categories.length ? service.alt_categories : ['Referral'];
  const go = (pathname: string, params: Record<string, string>) => { onClose(); router.push({ pathname, params } as never); };
  return (
    <View style={styles.detail} testID="service-detail">
      <StatusBadge status={service.status} />
      <AppText variant="caption" color={colors.text}>{tx('category', service.category)} · {tx('area', service.area)}</AppText>
      <AppText>{service.summary}</AppText>
      {!!service.detail && <AppText variant="bodySmall">{service.detail}</AppText>}
      {service.before && service.after && (
        <Card style={styles.comparison}>
          <View style={styles.comparisonPart}>
            <AppText variant="caption">Before</AppText>
            <AppText variant="bodySmall" color={colors.text}>{service.before}</AppText>
          </View>
          <View style={styles.comparisonPart}>
            <AppText variant="caption">After</AppText>
            <AppText variant="bodySmall" color={colors.text}>{service.after}</AppText>
          </View>
        </Card>
      )}
      {service.cut_amount != null && (
        <Banner tone="warning" icon="cash-minus" title={t('map.reduction', { amount: formatMoney(service.cut_amount) })} body={service.cut_amount_note ?? undefined} />
      )}
      {!!service.effective_date && <AppText variant="bodySmall">{t('map.effective', { date: formatDate(service.effective_date, locale) })}</AppText>}
      <View style={styles.facts}>
        <AppText variant="bodySmall" color={colors.text}>{service.location_note ? `${service.location_note}. ` : ''}{service.address}</AppText>
        {!!service.hours && <AppText variant="bodySmall" color={colors.text}>{t('common.hours')}: {service.hours}</AppText>}
        {service.coords === 'approximate' && <AppText variant="caption">{t('map.approximate')}</AppText>}
      </View>
      <AppButton variant="gold" icon="compass" label={t('map.findAlternative')} onPress={() => go('/resources', { categories: categories.join(','), from: service.name, at: String(Date.now()) })} testID="find-alternative" />
      <View style={styles.actions}>
        {!!service.phone && <AppButton variant="outline" icon="phone" label={t('common.callNumber', { phone: service.phone })} href={telUrl(service.phone)} style={styles.action} testID="detail-call" />}
        <AppButton variant="outline" icon="directions" label={t('common.directions')} href={directionsUrl(service.address)} style={styles.action} testID="detail-directions" />
        {!!service.action_url && <AppButton variant="outline" icon="open-in-new" label={service.action_label ?? t('common.learnMore')} href={service.action_url} style={styles.action} />}
        <AppButton variant="outline" icon="clipboard-alert" label={t('map.reportImpact')} onPress={() => go('/report', { service: service.id })} style={styles.action} testID="detail-report" />
      </View>
      <SourceLine title={service.source_title} url={service.source_url} retrieved={service.retrieved} />
    </View>
  );
}

/** A place to get help, with the ways to reach it. */
function ResourceDetail({ resource }: { resource: Resource }) {
  const { t, tx } = useTranslation();
  return (
    <View style={styles.detail} testID="resource-detail">
      <AppText variant="caption" color={colors.text}>{tx('resourceCategory', resource.category)}</AppText>
      <AppText>{resource.description}</AppText>
      <View style={styles.facts}>
        <AppText variant="bodySmall" color={colors.text} selectable>{resource.address}</AppText>
        {!!resource.hours && <AppText variant="bodySmall" color={colors.text}>{t('common.hours')}: {resource.hours}</AppText>}
        {resource.languages.length > 0 && <AppText variant="bodySmall" color={colors.text}>{t('resources.languages')}: {resource.languages.join(', ')}</AppText>}
        {!!resource.language_note && <AppText variant="caption">{resource.language_note}</AppText>}
        {resource.coords === 'approximate' && <AppText variant="caption">{t('map.approximate')}</AppText>}
      </View>
      <View style={styles.actions}>
        {!!resource.phone && <AppButton variant="outline" icon="phone" label={t('common.callNumber', { phone: resource.phone })} href={telUrl(resource.phone)} style={styles.action} testID="resource-detail-call" />}
        {hasStreetAddress(resource.address) && <AppButton variant="outline" icon="directions" label={t('common.directions')} href={directionsUrl(resource.address)} style={styles.action} />}
        {!!resource.website && <AppButton variant="outline" icon="web" label={t('map.website')} href={resource.website} style={styles.action} />}
      </View>
      <SourceLine title={t('resources.sourceLabel')} url={resource.source_url} retrieved={resource.retrieved} />
    </View>
  );
}

type ListRow = { kind: 'service'; item: Service } | { kind: 'resource'; item: Resource };

export default function MapScreen() {
  const { t, tx } = useTranslation();
  const params = useLocalSearchParams<{ service?: string }>();
  const { data, loading: servicesLoading, error, reload } = useApi(getServices, () => bundledServices);
  const { data: resourceData, loading: resourcesLoading } = useApi(getResources, () => bundledResources);
  const loading = servicesLoading || resourcesLoading;
  const { origin, location } = useOrigin();
  const [view, setView] = useState<'map' | 'list'>(MAP_AVAILABLE ? 'map' : 'list');
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [layer, setLayer] = useState<Layer>('all');
  const [status, setStatus] = useState<'all' | ServiceStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);

  // A link such as /map?service=svc-pavement opens straight to that service.
  const [seenParam, setSeenParam] = useState<string | undefined>(undefined);
  if (params.service !== seenParam) {
    setSeenParam(params.service);
    if (params.service) setSelectedId(params.service);
  }

  // A status filter is about City services, so places to get help show only while it is "All".
  const showServices = layer !== 'resources';
  const showResources = layer !== 'services' && status === 'all';

  const visible = useMemo(() => {
    if (!showServices) return [];
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((s) =>
      (status === 'all' || s.status === status) &&
      (!q || [s.name, s.summary, s.address, s.location_note ?? '', tx('category', s.category), tx('area', s.area)].some((v) => v.toLowerCase().includes(q))));
  }, [data, query, status, tx, showServices]);

  // Only places with a position belong on the map; phone lines stay in Resources.
  const visibleResources = useMemo(() => {
    if (!showResources) return [];
    const q = query.trim().toLowerCase();
    return (resourceData ?? []).filter((r) =>
      r.lat != null && r.lng != null &&
      (!q || [r.name, r.description, r.address, tx('resourceCategory', r.category)].some((v) => v.toLowerCase().includes(q))));
  }, [resourceData, query, tx, showResources]);

  const pins = useMemo(() => spread([
    ...visible.filter((s) => s.lat != null && s.lng != null).map((s) => {
      const tone = statusTone(s.status);
      return { id: s.id, kind: 'service' as const, glyph: tone.glyph, fg: tone.text, bg: tone.bg, latitude: s.lat as number, longitude: s.lng as number, label: `${s.name}, ${t(`status.${tone.key}`)}` };
    }),
    ...visibleResources.map((r) => ({
      id: r.id, kind: 'resource' as const, glyph: '+', fg: colors.white, bg: colors.navy, latitude: r.lat as number, longitude: r.lng as number,
      label: t('map.resourcePin', { name: r.name, category: tx('resourceCategory', r.category) }),
    })),
  ]), [visible, visibleResources, t, tx]);
  const rows = useMemo<ListRow[]>(() => [
    ...visible.map((item) => ({ kind: 'service' as const, item })),
    ...visibleResources.map((item) => ({ kind: 'resource' as const, item })),
  ], [visible, visibleResources]);
  const selected = (data ?? []).find((s) => s.id === selectedId) ?? null;
  const selectedResource = selected ? null : (resourceData ?? []).find((r) => r.id === selectedId) ?? null;
  const countText = showServices && showResources
    ? t('map.countBoth', { services: visible.length, resources: visibleResources.length })
    : showResources ? t('map.countResources', { count: visibleResources.length }) : t('map.count', { count: visible.length });
  const mapLabels = useMemo(() => ({
    map: t('map.mapLabel'), you: t('map.you'), zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut'), tilesFailed: t('map.tilesFailed'),
    cluster: (count: number, names: string) => t('map.cluster', { count, names }),
  }), [t]);

  const controls = (
    <View style={styles.controls}>
      <View style={[styles.search, searchFocused && styles.searchFocused]}>
        <Icon name="magnify" size={22} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder={t('map.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t('map.searchLabel')}
          returnKeyType="search"
          testID="map-search"
          style={styles.searchInput}
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('common.clearSearch')} style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]} testID="map-search-clear">
            <Icon name="close-circle" size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {LAYERS.map(({ value, icon }) => (
          <Chip key={value} label={t(`map.layer.${value}`)} icon={icon} selected={layer === value} onPress={() => { setLayer(value); if (value === 'resources') setStatus('all'); }} testID={`map-layer-${value}`} />
        ))}
      </ScrollView>
      {showServices && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_FILTERS.map((value) => (
          <Chip key={value} label={t(value === 'all' ? 'common.all' : `status.${value}`)} icon={value === 'all' ? undefined : statusTone(value).icon} selected={status === value} onPress={() => setStatus(value)} testID={`map-filter-${value}`} />
        ))}
      </ScrollView>}
      <View style={styles.row}>
        {MAP_AVAILABLE
          ? <Segmented label={t('map.viewLabel')} value={view} onChange={setView} options={[{ value: 'map', label: t('map.viewMap') }, { value: 'list', label: t('map.viewList') }]} />
          : <AppText variant="caption" testID="map-list-only">{t('map.listOnly')}</AppText>}
        <View style={styles.flex} />
        {view === 'map' && <IconAction icon="image-filter-center-focus" label={t('map.recenter')} onPress={() => setRecenterKey((key) => key + 1)} testID="map-recenter" />}
      </View>
      <LocationChip compact />
      <AppText variant="caption" live="polite" testID="map-count">{countText}</AppText>
    </View>
  );

  return (
    <Screen title={t('titles.map')} scroll={false} testID="map-screen">
      {loading ? <View style={styles.pad}><LoadingList /></View> : error ? <ErrorState onRetry={reload} /> : view === 'map' ? (
        // On a tall screen the map fills what is left; on a short one, or with larger text, the column scrolls
        // so the map keeps a usable height and the note stays reachable.
        <ScrollView style={styles.fill} contentContainerStyle={styles.mapColumn} keyboardShouldPersistTaps="handled">
          {controls}
          <View style={styles.mapWrap}>
            <ServiceMap
              pins={pins}
              selectedId={selectedId}
              onSelect={setSelectedId}
              center={origin}
              you={location ? origin : null}
              recenterKey={recenterKey}
              labels={mapLabels}
            />
            {!pins.length && <View style={styles.mapEmpty}><Banner tone="info" body={t('map.none')} live /></View>}
          </View>
          <AppText variant="caption" style={styles.mapNote}>{t('map.legend')} {t('map.pinsNote')}{Platform.OS === 'web' ? ` ${t('map.osmCredit')}` : ''}</AppText>
        </ScrollView>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={controls}
          ListEmptyComponent={<EmptyState art="niles" icon="map-search-outline" title={t('map.none')} body={t('map.noneBody')} />}
          ListFooterComponent={<Footer />}
          renderItem={({ item: row }) => row.kind === 'resource' ? (
            <Card style={styles.listCard}>
              <View style={styles.listHead}>
                <View style={[styles.listIcon, styles.listIconResource]}><Icon name={RESOURCE_ICONS[row.item.category] ?? 'hand-heart'} size={22} color={colors.white} /></View>
                <View style={styles.flex}>
                  <AppText variant="h4" heading={2}>{row.item.name}</AppText>
                  <AppText variant="caption">{tx('resourceCategory', row.item.category)}</AppText>
                </View>
              </View>
              <AppText variant="bodySmall" color={colors.text}>{row.item.description}</AppText>
              <AppButton variant="outline" small label={t('map.details')} accessibilityLabel={`${t('map.details')}: ${row.item.name}`} onPress={() => setSelectedId(row.item.id)} testID={`place-${row.item.id}`} />
            </Card>
          ) : (
            <Card style={styles.listCard}>
              <View style={styles.listHead}>
                <View style={styles.listIcon}><Icon name={SERVICE_ICONS[row.item.category] ?? 'office-building'} size={22} color={colors.navy} /></View>
                <View style={styles.flex}>
                  <AppText variant="h4" heading={2}>{row.item.name}</AppText>
                  <AppText variant="caption">{tx('category', row.item.category)} · {tx('area', row.item.area)}</AppText>
                </View>
              </View>
              <StatusBadge status={row.item.status} />
              <AppText variant="bodySmall" color={colors.text}>{row.item.summary}</AppText>
              <AppButton variant="outline" small label={t('map.details')} accessibilityLabel={`${t('map.details')}: ${row.item.name}`} onPress={() => setSelectedId(row.item.id)} testID={`service-${row.item.id}`} />
            </Card>
          )}
        />
      )}
      <Sheet visible={!!selected} onClose={() => setSelectedId(null)} title={selected?.name ?? ''} testID="service-sheet">
        {selected && <ServiceDetail service={selected} onClose={() => setSelectedId(null)} />}
      </Sheet>
      <Sheet visible={!!selectedResource} onClose={() => setSelectedId(null)} title={selectedResource?.name ?? ''} testID="resource-sheet">
        {selectedResource && <ResourceDetail resource={selectedResource} />}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { flex: 1 },
  mapColumn: { flexGrow: 1 },
  pad: { padding: spacing.lg },
  controls: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  searchFocused: { borderColor: colors.navy },
  searchInput: { flex: 1, minHeight: MIN_TOUCH, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  clear: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  clearPressed: { opacity: 0.8 },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mapWrap: { flex: 1, minHeight: 260, backgroundColor: colors.navyLight, overflow: 'hidden' },
  mapEmpty: { position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, zIndex: 1000 },
  mapNote: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  list: { paddingBottom: spacing.xxl, gap: spacing.md },
  listCard: { marginHorizontal: spacing.lg, gap: spacing.sm },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  listIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.navyLight, alignItems: 'center', justifyContent: 'center' },
  listIconResource: { backgroundColor: colors.navy },
  detail: { gap: spacing.md },
  comparison: { gap: spacing.sm },
  comparisonPart: { gap: spacing.xs },
  facts: { gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 200 },
});
