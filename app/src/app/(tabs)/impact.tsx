import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AdminGate } from '../../components/AdminGate';
import { BarList, ChartCard, IMPACT_RAMP, StackedBarList, StatTile } from '../../components/Charts';
import { Screen } from '../../components/Page';
import { AppButton, AppText, Banner, EmptyState, ErrorState, LoadingList } from '../../components/ui';
import { useApi } from '../../hooks/useData';
import { type Breakdown, getImpactCsv, getImpactSummary } from '../../lib/api';
import { formatDate, useTranslation } from '../../lib/i18n';
import { saveTextFile } from '../../lib/platform';
import { adminTokenStore } from '../../state/stores';
import { colors, spacing } from '../../theme';

const LEVELS = ['high', 'medium', 'low'] as const;

function Dashboard() {
  const { t, tx, locale } = useTranslation();
  const { data, loading, error, reload } = useApi(getImpactSummary, undefined, [], 0); // always current when the screen is opened
  const [exported, setExported] = useState<string | null>(null);

  async function exportCsv() {
    try {
      const outcome = await saveTextFile('resource-verified-reports.csv', await getImpactCsv(), 'text/csv');
      setExported(t(outcome === 'failed' ? 'impact.exportFailed' : 'impact.exported'));
    } catch {
      setExported(t('impact.exportFailed'));
    }
  }

  if (loading) return <LoadingList />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const series = LEVELS.map((level) => ({ key: level, label: tx('impact', level), color: IMPACT_RAMP[level] }));
  const stacked = (rows: Breakdown[], label: (key: string) => string) =>
    rows.map((row) => ({ label: label(row.key), total: row.total, values: { high: row.high, medium: row.medium, low: row.low } }));
  const tableOf = (rows: Breakdown[], first: string, label: (key: string) => string) => ({
    columns: [first, ...LEVELS.map((level) => tx('impact', level)), t('impact.total')],
    rows: rows.map((row) => [label(row.key), row.high, row.medium, row.low, row.total]),
  });
  const top = data.by_service[0];

  return (
    <View style={styles.block} testID="impact-dashboard">
      <View style={styles.tiles}>
        <StatTile value={String(data.verified_total)} label={t('impact.verified')} icon="check-decagram" basis={96} testID="impact-verified" />
        <StatTile value={String(data.pending_total)} label={t('impact.pending')} icon="clock-outline" basis={96} testID="impact-pending" />
        <StatTile value={String(data.rejected_total)} label={t('impact.rejected')} icon="close-circle-outline" basis={96} />
      </View>
      <AppText variant="caption">{t('impact.generated', { date: formatDate(data.generated_at, locale) })}</AppText>
      <AppButton variant="gold" icon="download" label={t('impact.export')} onPress={exportCsv} testID="impact-export" />
      {exported && <Banner tone="info" body={exported} live />}

      {data.verified_total === 0 ? (
        <EmptyState icon="chart-box-outline" title={t('impact.emptyTitle')} body={t('impact.emptyBody')} />
      ) : (
        <>
          <ChartCard
            title={t('impact.byLevel')}
            summary={t('impact.byLevelSummary', { total: data.verified_total, high: data.by_impact.find((i) => i.key === 'high')?.total ?? 0 })}
            table={{ columns: [t('impact.level'), t('impact.reports')], rows: data.by_impact.map((i) => [tx('impact', i.key), i.total]) }}
            testID="impact-by-level"
          >
            <BarList items={data.by_impact.map((i) => ({ label: tx('impact', i.key), value: i.total, display: String(i.total) }))} />
          </ChartCard>
          <ChartCard
            title={t('impact.byService')}
            summary={t('impact.byServiceSummary', { name: top.key, count: top.total })}
            table={tableOf(data.by_service, t('impact.service'), (key) => key)}
            testID="impact-by-service"
          >
            <StackedBarList items={stacked(data.by_service, (key) => key)} series={series} totalLabel={(total) => String(total)} />
          </ChartCard>
          <ChartCard
            title={t('impact.byArea')}
            summary={t('impact.byAreaSummary', { count: data.by_area.length })}
            table={tableOf(data.by_area, t('impact.area'), (key) => tx('area', key))}
            testID="impact-by-area"
          >
            <StackedBarList items={stacked(data.by_area, (key) => tx('area', key))} series={series} totalLabel={(total) => String(total)} />
          </ChartCard>
        </>
      )}
    </View>
  );
}

/** Community Impact dashboard: verified reports by service, area and impact level, with CSV export. */
export default function ImpactScreen() {
  const { t } = useTranslation();
  const token = adminTokenStore.use();
  return (
    <Screen title={t('titles.impact')} testID="impact-screen">
      <AppText variant="bodySmall" color={colors.text}>{t('impact.intro')}</AppText>
      <AdminGate>{token ? <Dashboard /> : null}</AdminGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
