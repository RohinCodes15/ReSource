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
  // Brand. Navy carries the app; gold is kept for the one main action on a screen and small accents.
  navy: '#1B3A6B',
  navyDark: '#12284B',
  navyLight: '#E8EDF4',
  gold: '#F5A623',
  goldLight: '#FBEFD5',
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
  // Surfaces and text: warm paper, ink, and hairline rules in place of shadows.
  background: '#F6F2E9',
  surface: '#FFFDF8',
  text: '#1A2233',
  muted: '#575C66',
  border: '#DCD3C1',
  /** A slightly darker hairline for rules that separate sections. Decorative, so no contrast minimum. */
  rule: '#C9BFAB',
  borderStrong: '#857C6C',
  white: '#FFFFFF',
  onNavyMuted: '#C9D6EA',
  overlay: 'rgba(26, 34, 51, 0.55)',
} as const;

/** Spacing scale: 4, 8, 12, 16, 20, 24, 32, 48, 64. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48, giant: 64 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

/** Every screen uses the same horizontal padding. */
export const SCREEN_PADDING = spacing.lg;
export const MAX_CONTENT_WIDTH = 820;
/** Smallest comfortable tap target (WCAG 2.5.5 / platform guidelines). */
export const MIN_TOUCH = 44;

/**
 * Two families, three files. Fraunces (one weight) sets headlines and big figures; Inter (regular
 * and semibold) sets everything else. On the web the files are declared in public/index.html;
 * on phones they are loaded in app/src/app/_layout.tsx. See docs/LICENSES.md.
 */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
} as const;

/**
 * Type scale. `fontWeight` repeats what the family name says: neither family has Persian or
 * Chinese glyphs, so those scripts fall back to a system font, which only knows the weight.
 * Sizes are multiplied by the person's text-size setting inside <AppText>.
 */
export const type = {
  /** The one big figure on a screen. */
  display: { fontFamily: fonts.display, fontWeight: '600', fontSize: 52, lineHeight: 58, letterSpacing: -1.2, color: colors.navy },
  h1: { fontFamily: fonts.display, fontWeight: '600', fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: colors.text },
  h2: { fontFamily: fonts.display, fontWeight: '600', fontSize: 24, lineHeight: 30, letterSpacing: -0.3, color: colors.text },
  h3: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 18, lineHeight: 24, color: colors.text },
  h4: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 16, lineHeight: 22, color: colors.text },
  body: { fontFamily: fonts.regular, fontWeight: '400', fontSize: 16, lineHeight: 24, color: colors.text },
  bodySmall: { fontFamily: fonts.regular, fontWeight: '400', fontSize: 14, lineHeight: 21, color: colors.muted },
  label: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 14, lineHeight: 20, color: colors.text },
  caption: { fontFamily: fonts.regular, fontWeight: '400', fontSize: 12, lineHeight: 17, color: colors.muted },
  /** Small capitals-style label above a section, like a ledger column head. */
  eyebrow: { fontFamily: fonts.semibold, fontWeight: '600', fontSize: 12, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.muted },
} as const;
export type TextVariant = keyof typeof type;

/** Only for things that float above the page (sheets, the storage banner). Cards have no shadow. */
export const shadow = {
  shadowColor: '#1A2233',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 18,
  elevation: 6,
} as const;

/** A quiet panel: a shade lighter than the paper, with a hairline edge. Used sparingly. */
export const cardSurface = {
  backgroundColor: colors.surface,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
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
  { name: 'navy figure on background', fg: colors.navy, bg: colors.background },
  { name: 'navy text on navy tint', fg: colors.navy, bg: colors.navyLight },
  { name: 'white text on navy', fg: colors.white, bg: colors.navy },
  { name: 'white text on dark navy', fg: colors.white, bg: colors.navyDark },
  { name: 'soft text on navy', fg: colors.onNavyMuted, bg: colors.navy },
  { name: 'gold accent text on navy', fg: colors.gold, bg: colors.navy },
  { name: 'dark navy text on gold button', fg: colors.navyDark, bg: colors.gold },
  { name: 'dark gold text on card', fg: colors.goldDark, bg: colors.surface },
  { name: 'dark gold text on gold tint', fg: colors.goldDark, bg: colors.goldLight },
  { name: 'dark gold text on background', fg: colors.goldDark, bg: colors.background },
  { name: 'error text on background', fg: colors.dangerDark, bg: colors.background },
  { name: 'open status text', fg: colors.successDark, bg: colors.successLight },
  { name: 'reduced status text', fg: colors.warningDark, bg: colors.warningLight },
  { name: 'closed status text', fg: colors.dangerDark, bg: colors.dangerLight },
  { name: 'error text on card', fg: colors.dangerDark, bg: colors.surface },
  { name: 'input border on card', fg: colors.borderStrong, bg: colors.surface, kind: 'ui' },
  { name: 'input border on background', fg: colors.borderStrong, bg: colors.background, kind: 'ui' },
  { name: 'navy control on background', fg: colors.navy, bg: colors.background, kind: 'ui' },
  { name: 'focus ring on background', fg: colors.navyDark, bg: colors.background, kind: 'ui' },
];
