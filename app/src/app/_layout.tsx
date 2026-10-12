import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createElement, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CookieBanner } from '../components/CookieBanner';
import { AppText, LinkText } from '../components/ui';
import { getConfig } from '../lib/api';
import { applyDocumentLanguage, languageStore, useTranslation } from '../lib/i18n';
import { hydrateStores, offlineStore } from '../state/stores';
import { colors, spacing } from '../theme';

/**
 * Web-only page styles that React Native styles cannot express:
 *  - a two-color focus ring (dark navy inside, gold outside) that is visible on light and dark surfaces;
 *  - no animation for people who asked their system to reduce motion.
 */
const WEB_CSS = `
html, body, #root { height: 100%; }
body { background: ${colors.background}; }
:focus { outline: none; }
:focus-visible { outline: 3px solid ${colors.gold} !important; outline-offset: 2px !important; box-shadow: 0 0 0 2px ${colors.navyDark} !important; }
input:focus-visible, textarea:focus-visible { outline-offset: 0 !important; }
.leaflet-container { font-family: inherit; }
.leaflet-container a { color: ${colors.navy}; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }
`;

function useWebPageStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.setAttribute('data-resource', 'page');
    style.textContent = WEB_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
}

/** First stop for keyboard users on the web: jumps past the header straight to the page content. */
function SkipLink() {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  if (Platform.OS !== 'web') return null;
  const skip = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    // Screens in other tabs stay mounted but inert, so pick the main region of the current one.
    const regions = Array.from(document.querySelectorAll<HTMLElement>('[role="main"]'));
    (regions.find((region) => !region.closest('[inert]')) ?? regions[0])?.focus();
  };
  // A plain <a>, so the browser gives it link behavior (Enter activates it) with no extra code.
  return createElement('a', {
    href: '#main',
    onClick: skip,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    'data-testid': 'skip-link',
    style: {
      position: 'absolute', top: focused ? spacing.md : -100, left: spacing.md, zIndex: 3000, backgroundColor: colors.navyDark, color: colors.white,
      padding: `${spacing.md}px ${spacing.lg}px`, borderRadius: 8, fontFamily: 'Inter_600SemiBold, system-ui, sans-serif', fontSize: 14, textDecoration: 'none',
    },
  }, t('common.skipToContent'));
}

/** Thin bar shown while the API cannot be reached. Screens keep working from the bundled data. */
function OfflineBanner() {
  const { t } = useTranslation();
  const offline = offlineStore.use();
  if (!offline) return null;
  return (
    <View style={styles.offline} role="status" aria-live="polite" testID="offline-banner">
      <AppText variant="caption" color={colors.warningDark} style={styles.offlineText}>{t('offline.banner')}</AppText>
      <LinkText variant="caption" color={colors.warningDark} label={t('common.retry')} onPress={() => { void getConfig().catch(() => undefined); }} testID="offline-retry" />
    </View>
  );
}

export default function RootLayout() {
  // Inter ships inside the app bundle (see `fonts` in theme.ts); nothing is fetched from a font service.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [hydrated, setHydrated] = useState(false);
  const { isRTL } = useTranslation();
  useWebPageStyles();

  useEffect(() => {
    let active = true;
    Promise.all([hydrateStores(), languageStore.hydrate()])
      .catch(() => undefined)
      .then(() => {
        applyDocumentLanguage(languageStore.get());
        if (active) setHydrated(true);
      });
    return () => { active = false; };
  }, []);

  // Hold a plain background until the font and saved settings are ready, so nothing flashes in
  // the wrong language or typeface. If the font fails to load, carry on with the system font.
  if ((!fontsLoaded && !fontError) || !hydrated) return <View style={styles.blank} />;

  return (
    <SafeAreaProvider>
      {/* `direction` mirrors every row, margin and alignment in the app for right-to-left languages. */}
      <View style={[styles.root, { direction: isRTL ? 'rtl' : 'ltr' }]}>
        <StatusBar style="dark" />
        <SkipLink />
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        <CookieBanner />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.background },
  root: { flex: 1, backgroundColor: colors.background },
  offline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.warningLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  offlineText: { flexShrink: 1 },
});
