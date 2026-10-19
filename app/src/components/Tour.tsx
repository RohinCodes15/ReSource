import { useRouter } from 'expo-router';
import { RefObject, useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { markTourSeen, tourSeenStore } from '../state/stores';
import { colors, MIN_TOUCH, radius, SCREEN_PADDING, shadow, spacing } from '../theme';
import { AppButton, AppText, Card, Eyebrow, FadeIn, LinkText, useReducedMotion } from './ui';

export type TourStepKey = 'welcome' | 'forMe' | 'map' | 'resources' | 'chat' | 'report';

/** The parts of the screen the tour points at. The welcome step points at nothing. */
export type TourTargets = Partial<Record<Exclude<TourStepKey, 'welcome'>, RefObject<View | null>>>;

// Each step's title reuses the label the person will see on screen, so the tour names things the way the app does.
const STEPS: { key: TourStepKey; title: string; body: string; where: string; doThis: string; route?: string }[] = [
  { key: 'welcome', title: 'tour.welcomeTitle', body: 'tour.welcomeBody', where: 'tour.welcomeWhere', doThis: 'tour.welcomeDo' },
  { key: 'forMe', title: 'titles.forMe', body: 'tour.forMeBody', where: 'tour.forMeWhere', doThis: 'tour.forMeDo', route: '/for-me' },
  { key: 'map', title: 'tabs.map', body: 'tour.mapBody', where: 'tour.mapWhere', doThis: 'tour.mapDo', route: '/map' },
  { key: 'resources', title: 'tabs.resources', body: 'tour.resourcesBody', where: 'tour.resourcesWhere', doThis: 'tour.resourcesDo', route: '/resources' },
  { key: 'chat', title: 'tabs.chat', body: 'tour.chatBody', where: 'tour.chatWhere', doThis: 'tour.chatDo', route: '/chat' },
  { key: 'report', title: 'titles.report', body: 'tour.reportBody', where: 'tour.reportWhere', doThis: 'tour.reportDo', route: '/report' },
];

type Rect = { x: number; y: number; width: number; height: number };

/** Space left around the highlighted part, and between it and the callout. */
const HOLE_PAD = spacing.sm;
const GAP = spacing.md;
const CALLOUT_MAX_WIDTH = 420;

/**
 * A short first-run tour of Home: each step spotlights a destination and explains where to go
 * and what to do. Opening a destination dismisses the tour so the resident can try that screen.
 * Settings can replay it after it has been completed or skipped.
 *
 * Like <Sheet> it is built on React Native's <Modal>, which on the web keeps keyboard focus
 * inside the tour and calls `onRequestClose` on Escape (and the Android back button), which
 * counts as Skip. A target that is missing, not yet laid out or off screen is not highlighted,
 * and its callout is shown in the middle of the screen instead.
 */
export function Tour({ targets, onFinish }: { targets?: TourTargets; onFinish?: () => void }) {
  const router = useRouter();
  const { t, isRTL } = useTranslation();
  const seen = tourSeenStore.use();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const titleId = useId();
  const bodyId = useId();
  const whereId = useId();
  const doId = useId();
  const dialog = useRef<View>(null);
  const textBlock = useRef<View>(null);
  const [index, setIndex] = useState(0);
  const [measured, setMeasured] = useState<{ key: TourStepKey; rect: Rect | null } | null>(null);
  const [calloutHeight, setCalloutHeight] = useState(0);
  const visible = !seen;
  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const target = step.key === 'welcome' ? undefined : targets?.[step.key];
  // A measurement only counts for the step it was taken on, so a step change never shows the old gap.
  const rect = target && measured?.key === step.key ? measured.rect : null;

  // Find where the highlighted part sits on screen, after the modal and the target have laid out.
  useEffect(() => {
    const node = target?.current;
    if (!visible || !node) return;
    let active = true;
    const frame = requestAnimationFrame(() => node.measureInWindow((x, y, w, h) => {
      const onScreen = w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= width && y + h <= height;
      if (active) setMeasured({ key: step.key, rect: onScreen ? { x, y, width: w, height: h } : null });
    }));
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [visible, step.key, target, width, height]);

  // Move the screen reader to the new step, so each Next or Back reads the step that is now showing.
  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      if (Platform.OS === 'web') (dialog.current as unknown as HTMLElement | null)?.focus?.();
      else {
        const tag = findNodeHandle(textBlock.current);
        if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, index]);

  // The same fix as in <Sheet>: drop React Native Web's stray aria-modal wrapper, which has no role.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const frame = requestAnimationFrame(() => {
      const node = dialog.current as unknown as HTMLElement | null;
      node?.parentElement?.closest('[aria-modal="true"]:not([role])')?.removeAttribute('aria-modal');
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  if (!visible) return null;

  const finish = () => {
    markTourSeen();
    onFinish?.();
  };

  const openCurrentScreen = () => {
    if (!step.route) return;
    finish();
    router.push(step.route as never);
  };

  const hole = rect && {
    x: Math.max(0, rect.x - HOLE_PAD),
    y: Math.max(0, rect.y - HOLE_PAD),
    width: Math.min(width, rect.width + HOLE_PAD * 2),
    height: Math.min(height, rect.height + HOLE_PAD * 2),
  };
  const calloutWidth = Math.min(width - SCREEN_PADDING * 2, CALLOUT_MAX_WIDTH);
  let placement: { top: number; left: number } | null = null;
  if (hole) {
    const below = hole.y + hole.height + GAP;
    const above = hole.y - GAP - calloutHeight;
    const top = below + calloutHeight <= height - SCREEN_PADDING ? below
      : above >= SCREEN_PADDING ? above
      : Math.max(SCREEN_PADDING, height - SCREEN_PADDING - calloutHeight);
    const centered = hole.x + hole.width / 2 - calloutWidth / 2;
    placement = { top, left: Math.min(Math.max(SCREEN_PADDING, centered), width - SCREEN_PADDING - calloutWidth) };
  }

  const progress = t('tour.progress', { step: index + 1, total: STEPS.length });
  const title = t(step.title);
  const body = t(step.body);
  const where = t(step.where);
  const doThis = t(step.doThis);
  // On phones the step's text is one stop for the screen reader, and the buttons follow it.
  // On the web the dialog itself takes focus and is read by its label and description.
  const groupText = Platform.OS === 'web' ? null : {
    accessible: true,
    accessibilityLabel: `${progress}. ${title}. ${body}. ${t('tour.whereLabel')}: ${where}. ${t('tour.doLabel')}: ${doThis}`,
  };

  return (
    <Modal visible transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={finish} statusBarTranslucent>
      <View style={[styles.root, !placement && styles.rootCentered, { direction: isRTL ? 'rtl' : 'ltr' }]}>
        {/* The dimmed page, with a gap over the part being shown. Taps on it do nothing, so a stray tap does not end the tour. */}
        <View style={StyleSheet.absoluteFill} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="box-only" testID="tour-backdrop">
          {hole ? (
            <>
              <View style={[styles.shade, { top: 0, left: 0, right: 0, height: hole.y }]} />
              <View style={[styles.shade, { top: hole.y + hole.height, left: 0, right: 0, bottom: 0 }]} />
              <View style={[styles.shade, { top: hole.y, height: hole.height, left: 0, width: hole.x }]} />
              <View style={[styles.shade, { top: hole.y, height: hole.height, left: hole.x + hole.width, right: 0 }]} />
              <View style={[styles.ring, { top: hole.y, left: hole.x, width: hole.width, height: hole.height }]} />
            </>
          ) : (
            <View style={[styles.shade, StyleSheet.absoluteFill]} />
          )}
        </View>
        <View
          ref={dialog}
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
          {...({ 'aria-describedby': `${bodyId} ${whereId} ${doId}` } as object)}
          accessibilityViewIsModal
          tabIndex={-1}
          testID="tour"
          onLayout={(event) => setCalloutHeight(event.nativeEvent.layout.height)}
          style={[styles.callout, { width: calloutWidth }, placement && { position: 'absolute', ...placement }]}
        >
          <Card style={styles.card}>
            <FadeIn key={step.key} style={styles.content}>
              <View style={styles.header}>
                <Eyebrow>{progress}</Eyebrow>
                <LinkText label={t('tour.skip')} variant="label" onPress={finish} testID="tour-skip" />
              </View>
              <View ref={textBlock} {...groupText} style={styles.text}>
                <AppText variant="h3" heading={2} nativeID={titleId}>{title}</AppText>
                <AppText nativeID={bodyId}>{body}</AppText>
              </View>
              <View style={styles.guide}>
                <View style={styles.guideRow}>
                  <AppText variant="label" color={colors.navy}>{t('tour.whereLabel')}</AppText>
                  <AppText variant="bodySmall" nativeID={whereId}>{where}</AppText>
                </View>
                <View style={styles.guideRow}>
                  <AppText variant="label" color={colors.navy}>{t('tour.doLabel')}</AppText>
                  <AppText variant="bodySmall" nativeID={doId}>{doThis}</AppText>
                </View>
              </View>
              {step.route && (
                <AppButton
                  label={t('tour.openScreen', { screen: title })}
                  variant="outline"
                  small
                  onPress={openCurrentScreen}
                  testID={`tour-open-${step.key}`}
                  style={styles.openAction}
                />
              )}
              <View style={styles.actions}>
                {index > 0 && (
                  <AppButton label={t('common.back')} variant="outline" small onPress={() => setIndex(index - 1)} testID="tour-back" style={styles.action} />
                )}
                <AppButton
                  label={last ? t('tour.done') : t('common.next')}
                  variant={last ? 'gold' : 'navy'}
                  small
                  onPress={() => (last ? finish() : setIndex(index + 1))}
                  testID={last ? 'tour-done' : 'tour-next'}
                  style={styles.action}
                />
              </View>
            </FadeIn>
          </Card>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootCentered: { justifyContent: 'center', alignItems: 'center', padding: SCREEN_PADDING },
  shade: { position: 'absolute', backgroundColor: colors.overlay },
  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.gold, borderRadius: radius.md },
  callout: { maxWidth: CALLOUT_MAX_WIDTH },
  card: { ...shadow },
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, minHeight: MIN_TOUCH },
  text: { gap: spacing.sm },
  guide: { gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  guideRow: { gap: 2 },
  openAction: { alignSelf: 'stretch' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.sm },
  action: { minWidth: 96 },
});
