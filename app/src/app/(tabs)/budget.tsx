import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Budget, BudgetTable } from '../../../../shared/types';
import { BarList, ChartCard, DataTable, LedgerRow, ShareBar } from '../../components/Charts';
import { Illustration } from '../../components/illustrations';
import { Screen } from '../../components/Page';
import { AppText, Banner, ErrorState, Eyebrow, LoadingList, Rule, Section, SourceLine } from '../../components/ui';
import { bundledBudget } from '../../data';
import { useApi } from '../../hooks/useData';
import { getBudget } from '../../lib/api';
import { formatDate, formatMoney, useTranslation } from '../../lib/i18n';
import { colors, MAX_CONTENT_WIDTH, SCREEN_PADDING, spacing } from '../../theme';

/**
 * Budget Transparency: where the reductions come from, with the City document behind every
 * number. Figure labels are shown as written in those documents (English).
 */
export default function BudgetScreen() {
  const { t, locale } = useTranslation();
  const { width } = useWindowDimensions();
  // Mission Peak keeps its own 4:1 shape: the full column on a phone, at most 360px wide.
  const peakWidth = Math.min(360, Math.min(width, MAX_CONTENT_WIDTH) - SCREEN_PADDING * 2);
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
      <Illustration name="peak" width={peakWidth} height={peakWidth / 4} />
      <AppText color={colors.text} style={styles.measure}>{t('budget.intro')}</AppText>
      <Banner tone="info" icon="translate" body={t('budget.englishNote')} />

      <Section title={t('budget.keyNumbers')}>
        <View>
          {budget.headline.map((item, i) => (
            <View key={item.id}>
              {i > 0 && <Rule />}
              <LedgerRow value={formatMoney(item.amount)} label={item.label} source={source(item.source, item.page)} testID={`headline-${item.id}`} />
            </View>
          ))}
        </View>
      </Section>

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
        <ShareBar items={shares.items} label={t('budget.sharesTitle')} />
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
        <Section key={section.caption} title={section.caption} level={3}>
          <DataTable caption={section.caption} {...table(section)} />
          {!!section.note && <AppText variant="caption">{section.note}</AppText>}
          {source(section.source, section.page)}
        </Section>
      ))}

      <Section title={t('budget.contextTitle')}>
        {budget.context.map((item, i) => (
          <View key={item.id} style={styles.fact}>
            {i > 0 && <Rule />}
            <AppText color={colors.text}>{item.text}</AppText>
            {source(item.source, item.page)}
          </View>
        ))}
      </Section>

      <Section title={t('budget.timelineTitle')}>
        {/* A line down the side with a mark for each event, newest at the bottom. */}
        <View role="list" accessibilityLabel={t('budget.timelineTitle')}>
          {budget.timeline.map((event, i) => (
            <View key={event.date + event.title} role="listitem" style={styles.event}>
              <View style={styles.rail} aria-hidden>
                <View style={[styles.dot, i === budget.timeline.length - 1 && styles.dotLast]} />
                {i < budget.timeline.length - 1 && <View style={styles.line} />}
              </View>
              <View style={styles.eventBody}>
                <Eyebrow>{formatDate(event.date, locale)}</Eyebrow>
                <AppText variant="h4" heading={3}>{event.title}</AppText>
                <AppText variant="bodySmall" color={colors.text}>{event.text}</AppText>
                {source(event.source)}
              </View>
            </View>
          ))}
        </View>
      </Section>
      <AppText variant="caption">{t('budget.notEndorsed')}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  measure: { maxWidth: 600 },
  fact: { gap: spacing.sm },
  sources: { gap: spacing.xs },
  event: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3, borderWidth: 2, borderColor: colors.navy, backgroundColor: colors.background },
  dotLast: { backgroundColor: colors.gold, borderColor: colors.goldDark },
  line: { flex: 1, width: 2, backgroundColor: colors.rule, marginVertical: 2 },
  eventBody: { flex: 1, gap: spacing.xs, paddingBottom: spacing.xl },
});
