import { StyleSheet, View } from 'react-native';
import type { Budget, BudgetTable } from '../../../../shared/types';
import { BarList, ChartCard, DataTable, StatTile } from '../../components/Charts';
import { Screen } from '../../components/Page';
import { AppText, Banner, Card, ErrorState, LoadingList, SourceLine } from '../../components/ui';
import { bundledBudget } from '../../data';
import { useApi } from '../../hooks/useData';
import { getBudget } from '../../lib/api';
import { formatDate, formatMoney, useTranslation } from '../../lib/i18n';
import { colors, spacing } from '../../theme';

/**
 * Budget Transparency: where the reductions come from, with the City document behind every
 * number. Figure labels are shown as written in those documents (English).
 */
export default function BudgetScreen() {
  const { t, locale } = useTranslation();
  const { data, loading, error, reload } = useApi(getBudget, () => bundledBudget);

  if (loading) return <Screen title={t('titles.budget')}><LoadingList /></Screen>;
  if (error || !data) return <Screen title={t('titles.budget')}><ErrorState onRetry={reload} /></Screen>;
  const budget: Budget = data;

  /** The document a figure came from, as a link, with its page number where we have one. */
  const source = (id: string, page?: number | null, key?: string) => {
    const doc = budget.sources[id];
    return <SourceLine key={key} title={page ? t('budget.sourcePage', { title: doc.title, page }) : doc.title} url={doc.url} retrieved={budget.retrieved} />;
  };
  const table = (data: BudgetTable) => ({ columns: [t('budget.item'), ...data.columns], rows: data.rows.map((row) => [row.label, ...row.values.map((v) => v.toFixed(1))]) });
  const shares = budget.general_fund_shares;

  return (
    <Screen title={t('titles.budget')} testID="budget-screen">
      <AppText variant="bodySmall" color={colors.text}>{t('budget.intro')}</AppText>
      <Banner tone="info" icon="translate" body={t('budget.englishNote')} />

      <View style={styles.block}>
        <AppText variant="h3" heading={2}>{t('budget.keyNumbers')}</AppText>
        {budget.headline.map((item) => (
          <Card key={item.id} style={styles.fact} testID={`headline-${item.id}`}>
            <View style={styles.tileRow}><StatTile value={formatMoney(item.amount)} label={item.label} /></View>
            {source(item.source, item.page)}
          </Card>
        ))}
      </View>

      <ChartCard
        title={t('budget.reductionsTitle')}
        summary={t('budget.reductionsSummary')}
        table={{ columns: [t('budget.item'), t('budget.amount'), t('budget.year')], rows: budget.reductions.map((r) => [r.label, formatMoney(r.amount), r.fiscal_year]) }}
        footer={<View style={styles.sources}>{budget.reductions.map((r) => source(r.source, r.page, r.id))}</View>}
        testID="chart-reductions"
      >
        <BarList items={budget.reductions.map((r) => ({ label: r.label, value: r.amount, display: formatMoney(r.amount), note: r.detail }))} />
      </ChartCard>

      <ChartCard
        title={t('budget.positionsTitle')}
        summary={t('budget.positionsSummary')}
        table={{ columns: [t('budget.item'), t('budget.positions')], rows: budget.positions.map((p) => [p.label, p.count]) }}
        footer={<View style={styles.sources}>{Array.from(new Set(budget.positions.map((p) => p.source))).map((id) => source(id, undefined, id))}</View>}
        testID="chart-positions"
      >
        <BarList items={budget.positions.map((p) => ({ label: p.label, value: p.count, display: String(p.count) }))} />
      </ChartCard>

      <ChartCard
        title={t('budget.sharesTitle')}
        summary={`${shares.caption}. ${shares.note}`}
        table={{ columns: [t('budget.item'), t('budget.share')], rows: shares.items.map((s) => [s.label, `${s.percent}%`]) }}
        footer={source(shares.source, shares.page)}
        testID="chart-shares"
      >
        <BarList max={100} items={shares.items.map((s) => ({ label: s.label, value: s.percent, display: `${s.percent}%` }))} />
      </ChartCard>

      <ChartCard
        title={t('budget.reservesTitle')}
        summary={budget.reserves.caption}
        table={{ columns: [t('budget.item'), t('budget.amount')], rows: budget.reserves.items.map((r) => [r.label, formatMoney(r.amount)]) }}
        footer={source(budget.reserves.source, budget.reserves.page)}
        testID="chart-reserves"
      >
        <BarList items={budget.reserves.items.map((r) => ({ label: r.label, value: r.amount, display: formatMoney(r.amount), note: r.note }))} />
      </ChartCard>

      {[budget.revenue, budget.staffing].map((section) => (
        <Card key={section.caption} style={styles.block}>
          <AppText variant="h4" heading={3}>{section.caption}</AppText>
          <DataTable caption={section.caption} {...table(section)} />
          {!!section.note && <AppText variant="caption">{section.note}</AppText>}
          {source(section.source, section.page)}
        </Card>
      ))}

      <View style={styles.block}>
        <AppText variant="h3" heading={2}>{t('budget.contextTitle')}</AppText>
        {budget.context.map((item) => (
          <Card key={item.id} style={styles.fact}>
            <AppText color={colors.text}>{item.text}</AppText>
            {source(item.source, item.page)}
          </Card>
        ))}
      </View>

      <View style={styles.block}>
        <AppText variant="h3" heading={2}>{t('budget.timelineTitle')}</AppText>
        {budget.timeline.map((event) => (
          <Card key={event.date + event.title} style={styles.fact}>
            <AppText variant="caption">{formatDate(event.date, locale)}</AppText>
            <AppText variant="h4" heading={3}>{event.title}</AppText>
            <AppText variant="bodySmall" color={colors.text}>{event.text}</AppText>
            {source(event.source)}
          </Card>
        ))}
      </View>
      <AppText variant="caption">{t('budget.notEndorsed')}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  fact: { gap: spacing.sm },
  // A row, so the tile's flex basis sets its width and not its height.
  tileRow: { flexDirection: 'row' },
  sources: { gap: spacing.xs },
});
