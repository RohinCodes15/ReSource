/**
 * ReSource design system: the single source of colors, type, spacing, radii and shadows.
 *
 * Contrast rules (checked by scripts/check-contrast.mjs, WCAG 2.1 AA):
 *   - Brand gold is for fills and decoration only. Gold text on white fails, so text on a
 *     gold fill is navyDark, and gold-toned text uses goldDark.
 *   - The *Dark shades are the text colors for their *Light backgrounds.
 *   - `borderStrong` is for the edge of anything a person operates (inputs, checkboxes).
 */
export const colors = {
  // Brand
  navy: '#1B3A6B',
  navyDark: '#12284B',
  navyLight: '#EAF0F8',
  gold: '#F5A623',
  goldLight: '#FEF3DC',
  goldDark: '#7A4F00',
  // Status: the *Dark shades are for text and icons, the base shades for fills.
  success: '#22C55E',
  successLight: '#DCFCE7',
  successDark: '#166534',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#92400E',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  dangerDark: '#B91C1C',
  // Surfaces and text
  background: '#F8F9FC',
  surface: '#FFFFFF',
  text: '#0F172A',
  muted: '#55637A',
  border: '#E2E8F0',
  borderStrong: '#7B8AA0',
  white: '#FFFFFF',
  onNavyMuted: '#C9D6EA',
  overlay: 'rgba(15, 23, 42, 0.55)',
} as const;

/** Spacing scale: 4, 8, 12, 16, 20, 24, 32, 48. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** Every screen uses the same horizontal padding. */
export const SCREEN_PADDING = spacing.lg;
export const MAX_CONTENT_WIDTH = 820;
/** Smallest comfortable tap target (WCAG 2.5.5 / platform guidelines). */
export const MIN_TOUCH = 44;

/** Inter, bundled with the app and loaded in app/src/app/_layout.tsx. Pick the weight by family. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Type scale. Sizes are multiplied by the person's text-size setting inside <AppText>. */
export const type = {
  h1: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: colors.text },
  h2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: colors.text },
  h3: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.text },
  h4: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.text },
  bodySmall: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.muted },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.muted },
} as const;
export type TextVariant = keyof typeof type;

/** The one card shadow used everywhere. */
export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
} as const;

export const cardSurface = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  ...shadow,
} as const;

export type StatusTone = { key: string; icon: 'check-circle' | 'minus-circle' | 'close-circle'; glyph: string; color: string; bg: string; text: string };

/**
 * Service status look. Status is never shown by color alone: every use pairs the color with
 * this icon (or glyph on the map) and a translated label, `status.<key>`.
 */
export function statusTone(status: string): StatusTone {
  if (status === 'open') return { key: 'open', icon: 'check-circle', glyph: '✓', color: colors.success, bg: colors.successLight, text: colors.successDark };
  if (status === 'reduced') return { key: 'reduced', icon: 'minus-circle', glyph: '–', color: colors.warning, bg: colors.warningLight, text: colors.warningDark };
  return { key: 'closed', icon: 'close-circle', glyph: '✕', color: colors.danger, bg: colors.dangerLight, text: colors.dangerDark };
}

/**
 * Text/background pairs used in the app, checked for contrast in CI. `large` marks text that is
 * always 18.66px bold or larger (3:1), and `ui` marks non-text boundaries (3:1).
 */
export const CONTRAST_PAIRS: { name: string; fg: string; bg: string; kind?: 'large' | 'ui' }[] = [
  { name: 'body text on background', fg: colors.text, bg: colors.background },
  { name: 'body text on card', fg: colors.text, bg: colors.surface },
  { name: 'muted text on background', fg: colors.muted, bg: colors.background },
  { name: 'muted text on card', fg: colors.muted, bg: colors.surface },
  { name: 'muted text on navy tint', fg: colors.muted, bg: colors.navyLight },
  { name: 'navy text on card', fg: colors.navy, bg: colors.surface },
  { name: 'navy text on navy tint', fg: colors.navy, bg: colors.navyLight },
  { name: 'white text on navy', fg: colors.white, bg: colors.navy },
  { name: 'white text on dark navy', fg: colors.white, bg: colors.navyDark },
  { name: 'soft text on navy', fg: colors.onNavyMuted, bg: colors.navy },
  { name: 'gold accent text on navy', fg: colors.gold, bg: colors.navy },
  { name: 'dark navy text on gold button', fg: colors.navyDark, bg: colors.gold },
  { name: 'dark gold text on card', fg: colors.goldDark, bg: colors.surface },
  { name: 'dark gold text on gold tint', fg: colors.goldDark, bg: colors.goldLight },
  { name: 'open status text', fg: colors.successDark, bg: colors.successLight },
  { name: 'reduced status text', fg: colors.warningDark, bg: colors.warningLight },
  { name: 'closed status text', fg: colors.dangerDark, bg: colors.dangerLight },
  { name: 'error text on card', fg: colors.dangerDark, bg: colors.surface },
  { name: 'input border on card', fg: colors.borderStrong, bg: colors.surface, kind: 'ui' },
  { name: 'input border on background', fg: colors.borderStrong, bg: colors.background, kind: 'ui' },
  { name: 'navy control on background', fg: colors.navy, bg: colors.background, kind: 'ui' },
  { name: 'focus ring on background', fg: colors.navyDark, bg: colors.background, kind: 'ui' },
];
