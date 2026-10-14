import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { Service, ServiceStatus } from '../../../../shared/types';
import { LocationChip } from '../../components/LocationChip';
import { Footer, Screen } from '../../components/Page';
import ServiceMap from '../../components/ServiceMap';
import type { MapPin } from '../../components/ServiceMap.types';
import { Sheet } from '../../components/Sheet';
import { Icon, AppButton, AppText, Banner, Card, Chip, EmptyState, ErrorState, IconAction, LoadingList, Segmented, SourceLine, StatusBadge } from '../../components/ui';
import { bundledServices, SERVICE_ICONS } from '../../data';
import { useApi } from '../../hooks/useData';
import { getServices } from '../../lib/api';
import { formatDate, formatMoney, useTranslation } from '../../lib/i18n';
import { directionsUrl, MAP_AVAILABLE, telUrl } from '../../lib/platform';
import { useOrigin } from '../../state/stores';
import { colors, fonts, MIN_TOUCH, radius, spacing, statusTone } from '../../theme';

const STATUS_FILTERS: ('all' | ServiceStatus)[] = ['all', 'reduced', 'closed', 'open'];

/**
 * Several services share one building (City Hall), which would stack their pins exactly on top
 * of each other. Pins at the same point are drawn in a small ring around it (a fixed number
 * of pixels at every zoom), so each one can be selected.
 */
function spread(services: Service[], label: (s: Service) => string): MapPin[] {
  const groups = new Map<string, Service[]>();
  services.forEach((s) => {
    if (s.lat == null || s.lng == null) return;
    const key = `${s.lat},${s.lng}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  });
  const pins: MapPin[] = [];
  groups.forEach((group) => {
    group.forEach((service, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      const radius = group.length > 1 ? Math.max(24, group.length * 7) : 0;
      pins.push({ service, latitude: service.lat as number, longitude: service.lng as number, label: label(service), dx: Math.round(radius * Math.cos(angle)), dy: Math.round(radius * Math.sin(angle)) });
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

export default function MapScreen() {
  const { t, tx } = useTranslation();
  const params = useLocalSearchParams<{ service?: string }>();
  const { data, loading, error, reload } = useApi(getServices, () => bundledServices);
  const { origin, location } = useOrigin();
  const [view, setView] = useState<'map' | 'list'>(MAP_AVAILABLE ? 'map' : 'list');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | ServiceStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);

  // A link such as /map?service=svc-pavement opens straight to that service.
  const [seenParam, setSeenParam] = useState<string | undefined>(undefined);
  if (params.service !== seenParam) {
    setSeenParam(params.service);
    if (params.service) setSelectedId(params.service);
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((s) =>
      (status === 'all' || s.status === status) &&
      (!q || [s.name, s.summary, s.address, s.location_note ?? '', tx('category', s.category), tx('area', s.area)].some((v) => v.toLowerCase().includes(q))));
  }, [data, query, status, tx]);

  const pins = useMemo(() => spread(visible, (s) => `${s.name}, ${t(`status.${statusTone(s.status).key}`)}`), [visible, t]);
  const selected = (data ?? []).find((s) => s.id === selectedId) ?? null;

  const controls = (
    <View style={styles.controls}>
      <View style={styles.search}>
        <Icon name="magnify" size={22} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('map.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t('map.searchLabel')}
          returnKeyType="search"
          testID="map-search"
          style={styles.searchInput}
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('common.clearSearch')} style={styles.clear} testID="map-search-clear">
            <Icon name="close-circle" size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_FILTERS.map((value) => (
          <Chip key={value} label={t(value === 'all' ? 'common.all' : `status.${value}`)} icon={value === 'all' ? undefined : statusTone(value).icon} selected={status === value} onPress={() => setStatus(value)} testID={`map-filter-${value}`} />
        ))}
      </ScrollView>
      <View style={styles.row}>
        {MAP_AVAILABLE
          ? <Segmented label={t('map.viewLabel')} value={view} onChange={setView} options={[{ value: 'map', label: t('map.viewMap') }, { value: 'list', label: t('map.viewList') }]} />
          : <AppText variant="caption" testID="map-list-only">{t('map.listOnly')}</AppText>}
        <View style={styles.flex} />
        {view === 'map' && <IconAction icon="image-filter-center-focus" label={t('map.recenter')} onPress={() => setRecenterKey((key) => key + 1)} testID="map-recenter" />}
      </View>
      <LocationChip compact />
      <AppText variant="caption" live="polite" testID="map-count">{t('map.count', { count: visible.length })}</AppText>
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
              labels={{ map: t('map.mapLabel'), you: t('map.you'), zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut') }}
            />
            {!visible.length && <View style={styles.mapEmpty}><Banner tone="info" body={t('map.none')} live /></View>}
          </View>
          <AppText variant="caption" style={styles.mapNote}>{t('map.pinsNote')}{Platform.OS === 'web' ? ` ${t('map.osmCredit')}` : ''}</AppText>
        </ScrollView>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={controls}
          ListEmptyComponent={<EmptyState icon="map-search-outline" title={t('map.none')} body={t('map.noneBody')} />}
          ListFooterComponent={<Footer />}
          renderItem={({ item }) => (
            <Card style={styles.listCard}>
              <View style={styles.listHead}>
                <View style={styles.listIcon}><Icon name={SERVICE_ICONS[item.category] ?? 'office-building'} size={22} color={colors.navy} /></View>
                <View style={styles.flex}>
                  <AppText variant="h4" heading={3}>{item.name}</AppText>
                  <AppText variant="caption">{tx('category', item.category)} · {tx('area', item.area)}</AppText>
                </View>
              </View>
              <StatusBadge status={item.status} />
              <AppText variant="bodySmall" color={colors.text}>{item.summary}</AppText>
              <AppButton variant="outline" small label={t('map.details')} accessibilityLabel={`${t('map.details')}: ${item.name}`} onPress={() => setSelectedId(item.id)} testID={`service-${item.id}`} />
            </Card>
          )}
        />
      )}
      <Sheet visible={!!selected} onClose={() => setSelectedId(null)} title={selected?.name ?? ''} testID="service-sheet">
        {selected && <ServiceDetail service={selected} onClose={() => setSelectedId(null)} />}
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
  searchInput: { flex: 1, minHeight: MIN_TOUCH, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  clear: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mapWrap: { flex: 1, minHeight: 260, backgroundColor: colors.navyLight, overflow: 'hidden' },
  mapEmpty: { position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, zIndex: 1000 },
  mapNote: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  list: { paddingBottom: spacing.xxl, gap: spacing.md },
  listCard: { marginHorizontal: spacing.lg, gap: spacing.sm },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  listIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.navyLight, alignItems: 'center', justifyContent: 'center' },
  detail: { gap: spacing.md },
  facts: { gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 200 },
});
