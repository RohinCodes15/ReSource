/**
 * Charts, built from plain views so they render the same on phones and the web.
 *
 * Design rules followed here:
 *   - One hue for magnitude (navy). The only multi-color chart is the impact breakdown, whose
 *     three levels are ordered, so it uses one hue from light to dark (IMPACT_RAMP was checked
 *     with a colorblind-separation validator).
 *   - Thin bars growing from one baseline, rounded at the data end only, 2px gaps in stacks.
 *   - Every bar carries its exact value as text, in normal text colors, never the bar color.
 *   - Every chart has a "Show as table" switch and a one-sentence text summary.
 */
import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { colors, fonts, MIN_TOUCH, radius, spacing } from '../theme';
import { Icon, AppText, type IconName, LinkText, NATIVE_DRIVER, Rule, useReducedMotion } from './ui';

/** Low, medium, high impact: one hue, light to dark. */
export const IMPACT_RAMP = { low: '#7391C4', medium: '#375A9B', high: '#12284B' } as const;
const BAR_HEIGHT = 14;

export type TableData = { columns: string[]; rows: (string | number)[][] };

/** A real data table: column headers, row headers and cells are exposed to screen readers. */
export function DataTable({ caption, columns, rows }: TableData & { caption: string }) {
  const { isRTL } = useTranslation(); // numbers line up on the far side from the label column
  return (
    <View role="table" aria-label={caption} accessibilityLabel={caption} style={styles.table} testID="data-table">
      <View role="row" style={[styles.tableRow, styles.tableHead]}>
        {columns.map((column, i) => (
          <View key={column} role="columnheader" style={[styles.cell, i === 0 && styles.cellFirst]}>
            <AppText variant="caption" color={colors.text} style={i === 0 ? undefined : isRTL ? styles.left : styles.right}>{column}</AppText>
          </View>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} role="row" style={styles.tableRow}>
          {row.map((value, i) => (
            <View key={i} role={i === 0 ? 'rowheader' : 'cell'} style={[styles.cell, i === 0 && styles.cellFirst]}>
              <AppText variant="bodySmall" color={colors.text} style={i === 0 ? undefined : isRTL ? styles.left : styles.right}>{value}</AppText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** A chart with its title, text summary, the chart or its table, and the source underneath, set off by a rule. */
export function ChartCard({ title, summary, table, footer, children, testID }: PropsWithChildren<{ title: string; summary: string; table: TableData; footer?: ReactNode; testID?: string }>) {
  const { t } = useTranslation();
  const [asTable, setAsTable] = useState(false);
  return (
    <View style={styles.chartCard} testID={testID}>
      <Rule strong />
      <AppText variant="h3" heading={3}>{title}</AppText>
      <AppText variant="bodySmall" color={colors.text}>{summary}</AppText>
      {asTable ? <DataTable caption={title} {...table} /> : children}
      <LinkText icon={asTable ? 'chart-bar' : 'table'} label={t(asTable ? 'charts.showChart' : 'charts.showTable')} onPress={() => setAsTable(!asTable)} testID="toggle-table" />
      {footer}
    </View>
  );
}

export type BarItem = { label: string; value: number; display: string; note?: string };

/** Horizontal bars, one per row, sorted by the caller. The value sits at the end of each row. */
export function BarList({ items, max }: { items: BarItem[]; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((item) => item.value));
  return (
    <View style={styles.bars}>
      {items.map((item) => (
        <View key={item.label} style={styles.barRow} accessible accessibilityLabel={`${item.label}: ${item.display}`}>
          <View style={styles.barHead}>
            <AppText variant="bodySmall" color={colors.text} style={styles.flex}>{item.label}</AppText>
            <AppText variant="label">{item.display}</AppText>
          </View>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${Math.max(1.5, (item.value / top) * 100)}%`, backgroundColor: colors.navy }]} />
          </View>
          {!!item.note && <AppText variant="caption">{item.note}</AppText>}
        </View>
      ))}
    </View>
  );
}

export type StackSeries = { key: string; label: string; color: string };
export type StackItem = { label: string; values: Record<string, number>; total: number };

/** Stacked horizontal bars with a legend. Segments are separated by a 2px gap of the card color. */
export function StackedBarList({ items, series, totalLabel }: { items: StackItem[]; series: StackSeries[]; totalLabel: (total: number) => string }) {
  const top = Math.max(1, ...items.map((item) => item.total));
  return (
    <View style={styles.bars}>
      <View style={styles.legend} accessibilityRole="text">
        {series.map((entry) => (
          <View key={entry.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: entry.color }]} />
            <AppText variant="caption" color={colors.text}>{entry.label}</AppText>
          </View>
        ))}
      </View>
      {items.map((item) => {
        const parts = series.map((entry) => `${entry.label} ${item.values[entry.key] ?? 0}`).join(', ');
        return (
          <View key={item.label} style={styles.barRow} accessible accessibilityLabel={`${item.label}: ${totalLabel(item.total)} (${parts})`}>
            <View style={styles.barHead}>
              <AppText variant="bodySmall" color={colors.text} style={styles.flex}>{item.label}</AppText>
              <AppText variant="label">{totalLabel(item.total)}</AppText>
            </View>
            <View style={[styles.stack, { width: `${Math.max(3, (item.total / top) * 100)}%` }]}>
              {series.filter((entry) => (item.values[entry.key] ?? 0) > 0).map((entry, i, shown) => (
                <View
                  key={entry.key}
                  style={[
                    styles.segment,
                    { flexGrow: item.values[entry.key], backgroundColor: entry.color },
                    i === shown.length - 1 && styles.segmentEnd,
                  ]}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Shares of one whole, as one bar split into parts with a ruled key underneath. Parts are drawn
 * in navy from dark to light in the order given (largest first), and the last part, "Other",
 * in a warm grey. Every part is at least 3:1 against the page, and each key row carries its
 * label and percentage as text, so the bar itself is never the only way to read it.
 */
export const SHARE_RAMP = ['#12284B', '#375A9B', '#6A86B8', '#8F8470'] as const;

export function ShareBar({ items, label, testID }: { items: { label: string; percent: number }[]; label: string; testID?: string }) {
  const color = (i: number) => (i === items.length - 1 && items.length > 1 ? SHARE_RAMP[SHARE_RAMP.length - 1] : SHARE_RAMP[Math.min(i, SHARE_RAMP.length - 2)]);
  const { isRTL } = useTranslation();
  // The bar draws itself once from the start edge, unless the person asked for less motion.
  const reduced = useReducedMotion();
  const [grow] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) { grow.setValue(1); return; }
    Animated.timing(grow, { toValue: 1, duration: 700, delay: 150, useNativeDriver: NATIVE_DRIVER }).start();
  }, [grow, reduced]);
  return (
    <View style={styles.shares} testID={testID}>
      <Animated.View
        style={[styles.shareBar, { transformOrigin: isRTL ? 'right' : 'left', transform: [{ scaleX: grow }] }]}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {items.map((item, i) => (
          <View key={item.label} style={[styles.shareSegment, { flexGrow: item.percent, backgroundColor: color(i) }, i === 0 && styles.shareStart, i === items.length - 1 && styles.shareEnd]} />
        ))}
      </Animated.View>
      <View role="list" aria-label={label} accessibilityLabel={label}>
        {items.map((item, i) => (
          <View key={item.label} role="listitem" style={[styles.shareRow, i > 0 && styles.shareRowRule]} accessible accessibilityLabel={`${item.label}: ${item.percent}%`}>
            <View style={[styles.swatch, { backgroundColor: color(i) }]} />
            <AppText variant="body" color={colors.text} style={styles.flex}>{item.label}</AppText>
            <AppText variant="h3" color={colors.navy} style={styles.figure}>{item.percent}%</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** One line of a ledger: a large figure, what it counts, and where it came from. */
export function LedgerRow({ value, label, onPress, source, testID }: { value: string; label: string; onPress?: () => void; source?: ReactNode; testID: string }) {
  const { dirIcon } = useTranslation();
  const body = (
    <>
      <AppText variant="h1" color={colors.navy} style={styles.ledgerValue} testID={`${testID}-value`}>{value}</AppText>
      <View style={styles.ledgerText}>
        <AppText color={colors.text}>{label}</AppText>
        {source}
      </View>
      {onPress && <Icon name={dirIcon('chevron-right')} size={20} color={colors.navy} />}
    </>
  );
  if (!onPress) return <View style={styles.ledgerRow} testID={testID}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value} ${label}`} testID={testID} style={({ pressed }) => [styles.ledgerRow, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

/** A single headline number with its label. Used instead of a chart when one figure is the point. */
export function StatTile({ value, label, icon, tone = 'navy', basis = 140, onPress, selected, testID }: { value: string; label: string; icon?: IconName; tone?: 'navy' | 'status'; /** Narrowest the tile gets before the row wraps. */ basis?: number; onPress?: () => void; /** For a tile that works as a filter: whether its filter is on. */ selected?: boolean; testID?: string; color?: string }) {
  const body = (
    <>
      {icon && <Icon name={icon} size={22} color={tone === 'navy' ? colors.navy : colors.text} />}
      <AppText variant="h2" color={colors.navy} testID={testID ? `${testID}-value` : undefined}>{value}</AppText>
      <AppText variant="caption" color={colors.text}>{label}</AppText>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" aria-pressed={selected} accessibilityLabel={`${value} ${label}`} testID={testID} style={({ pressed }) => [styles.tile, { flexBasis: basis }, selected && styles.tileSelected, pressed && styles.pressed]}>{body}</Pressable>
    );
  }
  return <View style={[styles.tile, { flexBasis: basis }]} accessible accessibilityLabel={`${value} ${label}`} testID={testID}>{body}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  right: { textAlign: 'right' },
  left: { textAlign: 'left' },
  pressed: { opacity: 0.8 },
  tileSelected: { borderWidth: 2, borderColor: colors.navy, backgroundColor: colors.navyLight },
  chartCard: { gap: spacing.md },
  bars: { gap: spacing.md },
  barRow: { gap: 6 },
  barHead: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  track: { height: BAR_HEIGHT, backgroundColor: colors.background, borderRadius: 4 },
  // Square at the baseline, rounded at the data end.
  bar: { height: BAR_HEIGHT, borderTopEndRadius: 4, borderBottomEndRadius: 4 },
  stack: { height: BAR_HEIGHT, flexDirection: 'row', gap: 2 },
  segment: { height: BAR_HEIGHT, minWidth: 4 },
  segmentEnd: { borderTopEndRadius: 4, borderBottomEndRadius: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  tableHead: { backgroundColor: colors.navyLight, borderTopWidth: 0 },
  cell: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  cellFirst: { flex: 1.6 },
  // On a narrow phone the label drops under the figure rather than squeezing into a thin column.
  ledgerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.lg, rowGap: spacing.xs, paddingVertical: spacing.md, minHeight: MIN_TOUCH },
  ledgerValue: { minWidth: 112, flexShrink: 0, fontVariant: ['tabular-nums'] },
  ledgerText: { flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: spacing.xs },
  shares: { gap: spacing.md },
  shareBar: { flexDirection: 'row', height: 28, gap: 2 },
  shareSegment: { height: 28, minWidth: 6 },
  shareStart: { borderTopStartRadius: 4, borderBottomStartRadius: 4 },
  shareEnd: { borderTopEndRadius: 4, borderBottomEndRadius: 4 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  shareRowRule: { borderTopWidth: 1, borderTopColor: colors.border },
  figure: { fontFamily: fonts.display, fontVariant: ['tabular-nums'] },
  tile: { flexGrow: 1, flexBasis: 140, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
});
