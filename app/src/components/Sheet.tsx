import { PropsWithChildren, useEffect, useId, useRef } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { Icon, AppText, useReducedMotion } from './ui';

/**
 * The app's one modal: a bottom sheet on phones, a centered dialog on wide screens.
 *
 * Built on React Native's <Modal>, which on the web keeps keyboard focus inside the dialog,
 * returns focus to the control that opened it, and closes on Escape (`onRequestClose`).
 */
export function Sheet({ visible, onClose, title, children, testID }: PropsWithChildren<{ visible: boolean; onClose: () => void; title: string; testID?: string }>) {
  const { t, isRTL } = useTranslation();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const titleId = useId();
  const wide = width >= 700;
  const dialog = useRef<View>(null);
  // React Native Web wraps a modal in a <div aria-modal="true"> with no role, which is invalid
  // ARIA. Our own view below is the real dialog (role, label, aria-modal), so drop the stray one.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const frame = requestAnimationFrame(() => {
      const node = dialog.current as unknown as HTMLElement | null;
      node?.parentElement?.closest('[aria-modal="true"]:not([role])')?.removeAttribute('aria-modal');
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, wide && styles.backdropWide, { direction: isRTL ? 'rtl' : 'ltr' }]}>
        {/* Tapping outside closes the sheet. It is hidden from screen readers, which use the Close button. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} aria-hidden accessible={false} tabIndex={-1} testID="sheet-backdrop" />
        <View
          ref={dialog}
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
          accessibilityViewIsModal
          testID={testID ?? 'sheet'}
          style={[styles.sheet, wide ? styles.sheetWide : styles.sheetNarrow, { maxHeight: height * 0.9 }]}
        >
          <View style={styles.header}>
            <AppText variant="h3" heading={2} nativeID={titleId} style={styles.title}>{title}</AppText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} testID="sheet-close" style={styles.close}>
              <Icon name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  backdropWide: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  sheet: { backgroundColor: colors.surface, overflow: 'hidden' },
  sheetNarrow: { borderTopLeftRadius: 24, borderTopRightRadius: 24, width: '100%' },
  sheetWide: { borderRadius: radius.xl, width: '100%', maxWidth: 560 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { flex: 1 },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
});
