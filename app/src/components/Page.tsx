import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { PropsWithChildren, ReactNode, useCallback, useEffect, useRef } from 'react';
import { Platform, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { APP_NAME, PROJECT } from '../../../shared/constants';
import { useTranslation } from '../lib/i18n';
import { colors, MAX_CONTENT_WIDTH, SCREEN_PADDING, spacing } from '../theme';
import { cookieSettingsStore } from './CookieBanner';
import { AppText, LinkText } from './ui';

/** Sets the browser tab title while a screen is focused, e.g. "Resources | ReSource". */
export function useDocumentTitle(title: string | undefined) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web' && typeof document !== 'undefined' && title) {
        document.title = title === APP_NAME ? `${APP_NAME}: Fremont budget and services` : `${title} | ${APP_NAME}`;
      }
    }, [title]),
  );
}

/** Shown at the bottom of every screen: who made this, the legal pages and the storage settings. */
export function Footer() {
  const { t } = useTranslation();
  const router = useRouter();
  const go = (path: string) => () => router.push(path as never);
  return (
    <View style={styles.footer} role="contentinfo" testID="footer">
      <AppText variant="caption" center>{t('footer.disclaimer')}</AppText>
      <View style={styles.footerLinks}>
        <LinkText variant="caption" label={t('titles.about')} onPress={go('/about')} testID="footer-about" />
        <LinkText variant="caption" label={t('titles.privacy')} onPress={go('/privacy')} testID="footer-privacy" />
        <LinkText variant="caption" label={t('titles.terms')} onPress={go('/terms')} testID="footer-terms" />
        <LinkText variant="caption" label={t('titles.cookies')} onPress={go('/cookies')} testID="footer-cookies" />
        <LinkText variant="caption" label={t('footer.storageSettings')} onPress={() => cookieSettingsStore.set(true)} testID="footer-storage-settings" />
        <LinkText variant="caption" label={t('titles.credits')} onPress={go('/credits')} testID="footer-credits" />
      </View>
      <AppText variant="caption" center>{t('footer.madeBy', { name: PROJECT.creator, place: PROJECT.location })}</AppText>
    </View>
  );
}

type ScreenProps = PropsWithChildren<{
  /** Browser tab title for this route. */
  title?: string;
  /** False for screens that manage their own scrolling (a list or the map). */
  scroll?: boolean;
  footer?: boolean;
  /** Fixed content below the scroll area, e.g. the chat composer. */
  below?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}>;

/** Every route renders inside a Screen: page background, a centered readable column, and the footer. */
export function Screen({ title, scroll = true, footer = true, below, contentStyle, testID, children }: ScreenProps) {
  useDocumentTitle(title);
  // The tab navigator keeps screens you have visited in the page so they keep their state. On
  // the web that would let the Tab key wander into a screen you cannot see, so a screen that
  // is not the current one is made inert: no focus, no clicks, hidden from screen readers.
  const focused = useIsFocused();
  const outer = useRef<View>(null);
  const main = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    (outer.current as unknown as HTMLElement | null)?.toggleAttribute('inert', !focused);
    // Only the screen in view carries id="main", so the skip link's #main has exactly one target.
    const region = main.current as unknown as HTMLElement | null;
    if (region) { if (focused) region.id = 'main'; else region.removeAttribute('id'); }
  }, [focused]);
  return (
    <View ref={outer} style={styles.outer} testID={testID}>
      {/* role="main" is what the "Skip to main content" link in the root layout focuses. */}
      <View ref={main} style={styles.inner} role="main" tabIndex={-1}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
            {children}
            {footer && <Footer />}
          </ScrollView>
        ) : (
          <View style={[styles.fill, contentStyle]}>{children}</View>
        )}
        {below}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  fill: { flex: 1 },
  content: { padding: SCREEN_PADDING, gap: spacing.lg, paddingBottom: spacing.xxl },
  footer: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.md, alignItems: 'center' },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: spacing.lg, rowGap: spacing.sm },
});
