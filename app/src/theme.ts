/**
 * ReSource design system: the single source of colors, type, spacing, radii and shadows.
 * Screens import from here; app/src/constants/theme.ts re-exports the same tokens.
 */
import { configureFonts, MD3LightTheme } from 'react-native-paper';

export const colors = {
  // Brand
  navy: '#1B3A6B',
  navyDark: '#12284B',
  navyLight: '#EAF0F8',
  gold: '#F5A623',
  goldLight: '#FEF3DC',
  goldDark: '#8A5A00',
  // Status: green = open, amber = reduced, red = closed. The *Dark shades are for text.
  success: '#22C55E',
  successLight: '#DCFCE7',
  successDark: '#15803D',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#B45309',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  dangerDark: '#B91C1C',
  // Surfaces and text
  background: '#F8F9FC',
  surface: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  white: '#FFFFFF',
};

/** Spacing scale: 4, 8, 12, 16, 20, 24, 32, 48. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** Every screen uses the same horizontal padding. */
export const SCREEN_PADDING = spacing.xl;
export const MAX_CONTENT_WIDTH = 820;

/** Inter, loaded in app/src/app/_layout.tsx. Pick the weight by family, not by fontWeight. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Type scale: headings 32/24/20/18, body 16/14, caption 12. */
export const type = {
  h1: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: colors.text },
  h2: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: colors.text },
  h3: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2, color: colors.text },
  h4: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.text },
  bodySmall: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.muted },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.muted },
} as const;

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

export type StatusTone = { label: string; color: string; bg: string; text: string };

/** Service status colors. Anything that is not open or reduced is shown as closed. */
export function statusTone(status: string): StatusTone {
  if (status === 'open') return { label: 'Open', color: colors.success, bg: colors.successLight, text: colors.successDark };
  if (status === 'reduced') return { label: 'Reduced', color: colors.warning, bg: colors.warningLight, text: colors.warningDark };
  const label = status === 'suspended' ? 'Suspended' : status === 'cancelled' ? 'Cancelled' : 'Closed';
  return { label, color: colors.danger, bg: colors.dangerLight, text: colors.dangerDark };
}

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 3,
  fonts: configureFonts({ config: { fontFamily: fonts.medium } }),
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.navy,
    onPrimary: colors.white,
    primaryContainer: colors.navyLight,
    onPrimaryContainer: colors.navyDark,
    secondary: colors.gold,
    onSecondary: colors.navyDark,
    secondaryContainer: colors.goldLight,
    onSecondaryContainer: colors.navyDark,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.background,
    onSurface: colors.text,
    onSurfaceVariant: colors.muted,
    outline: colors.border,
    error: colors.danger,
    elevation: { ...MD3LightTheme.colors.elevation, level2: colors.surface, level3: colors.surface },
  },
};
