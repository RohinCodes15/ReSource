import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AREA_CODES } from '../../../../shared/constants';
import type { ServiceStatus } from '../../../../shared/types';
import { ChartCard, StackedBarList, StatTile } from '../../components/Charts';
import { Screen } from '../../components/Page';
import { AppButton, AppText, Card, Chip, EmptyState, ErrorState, LoadingList, SourceLine, StatusBadge } from '../../components/ui';
import { bundledServices } from '../../data';
import { useApi } from '../../hooks/useData';
import { getServices } from '../../lib/api';
import { formatDate, useTranslation } from '../../lib/i18n';
import { colors, spacing, statusTone } from '../../theme';

const STATUSES: ServiceStatus[] = ['reduced', 'closed', 'open'];

/** Service Status Dashboard: how many services are in each state, filters, and what changed lately. */
export default function StatusScreen() {
  const { t, tx, locale } = useTranslation();
  const router = useRouter();
  const { data, loading, error, reload, bundled } = useApi(getServices, () => bundledServices);
  const [category, setCategory] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);

  const services = useMemo(() => data ?? [], [data]);
  const categories = useMemo(() => Array.from(new Set(services.map((s) => s.category))).sort(), [services]);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, services.filter((x) => x.status === s).length])) as Record<ServiceStatus, number>, [services]);
  const shown = services.filter((s) => (!category || s.category === category) && (!area || s.area === area) && (!status || s.status === status));
  const recent = useMemo(() => [...services].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).slice(0, 5), [services]);
  const latest = services.reduce((max, s) => ((s.retrieved ?? '') > max ? (s.retrieved ?? '') : max), '');

  const byCategory = categories.map((key) => {
    const rows = services.filter((s) => s.category === key);
    return { label: tx('category', key), total: rows.length, values: Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length])) };
  });
  const series = STATUSES.map((s) => ({ key: s, label: t(`status.${s}`), color: statusTone(s).color }));

  if (loading) return <Screen title={t('titles.status')}><LoadingList /></Screen>;
  if (error) return <Screen title={t('titles.status')}><ErrorState onRetry={reload} /></Screen>;

  return (
    <Screen title={t('titles.status')} testID="status-screen">
      <AppText variant="bodySmall" color={colors.text}>{t('statusPage.intro')}</AppText>
      <View style={styles.tiles} testID="status-counts">
        {STATUSES.map((s) => (
          <StatTile key={s} value={String(counts[s])} label={t(`status.${s}`)} icon={statusTone(s).icon} onPress={() => setStatus(status === s ? null : s)} testID={`count-${s}`} />
        ))}
      </View>
      <SourceLine title={t('statusPage.sourceNote')} retrieved={latest} />
      {bundled && <AppText variant="caption">{t('offline.savedCopy')}</AppText>}

      <ChartCard
        title={t('statusPage.byCategory')}
        summary={t('statusPage.byCategorySummary', { reduced: counts.reduced, total: services.length })}
        table={{ columns: [t('statusPage.category'), ...STATUSES.map((s) => t(`status.${s}`))], rows: byCategory.map((row) => [row.label, ...STATUSES.map((s) => row.values[s])]) }}
        testID="status-chart"
      >
        <StackedBarList items={byCategory} series={series} totalLabel={(total) => String(total)} />
      </ChartCard>

      <View style={styles.block}>
        <AppText variant="h3" heading={2}>{t('statusPage.recent')}</AppText>
        {recent.map((s) => (
          <Card key={s.id} style={styles.recent} testID={`recent-${s.id}`}>
            <AppText variant="caption">{formatDate(s.updated_at, locale)}</AppText>
            <AppText variant="h4" heading={3}>{s.name}</AppText>
            <StatusBadge status={s.status} />
            <AppText variant="bodySmall" color={colors.text}>{s.summary}</AppText>
            <SourceLine title={s.source_title} url={s.source_url} />
          </Card>
        ))}
      </View>

      <View style={styles.block}>
        <AppText variant="h3" heading={2}>{t('statusPage.allServices')}</AppText>
        <AppText variant="label">{t('statusPage.category')}</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={t('common.all')} selected={!category} onPress={() => setCategory(null)} testID="status-cat-all" />
          {categories.map((key) => <Chip key={key} label={tx('category', key)} selected={category === key} onPress={() => setCategory(category === key ? null : key)} testID={`status-cat-${key}`} />)}
        </ScrollView>
        <AppText variant="label">{t('statusPage.area')}</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={t('common.all')} selected={!area} onPress={() => setArea(null)} testID="status-area-all" />
          {AREA_CODES.map((key) => <Chip key={key} label={tx('area', key)} selected={area === key} onPress={() => setArea(area === key ? null : key)} testID={`status-area-${key}`} />)}
        </ScrollView>
        <AppText variant="caption" live="polite" testID="status-count">{t('statusPage.showing', { count: shown.length, total: services.length })}</AppText>
        {shown.length === 0 ? <EmptyState icon="filter-off-outline" title={t('statusPage.none')} /> : shown.map((s) => (
          <Card key={s.id} style={styles.recent} testID={`status-row-${s.id}`}>
            <AppText variant="h4" heading={3}>{s.name}</AppText>
            <AppText variant="caption">{tx('category', s.category)} · {tx('area', s.area)}</AppText>
            <StatusBadge status={s.status} />
            <AppText variant="bodySmall" color={colors.text}>{s.summary}</AppText>
            <AppButton variant="outline" small icon="map-marker" label={t('statusPage.onMap')} accessibilityLabel={`${t('statusPage.onMap')}: ${s.name}`} onPress={() => router.push({ pathname: '/map', params: { service: s.id } } as never)} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  block: { gap: spacing.md },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  recent: { gap: spacing.sm },
});
