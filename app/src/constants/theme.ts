/** Design tokens live in app/src/theme.ts. This file keeps the older `theme` import working. */
import { colors, fonts, radius, shadow, spacing, type } from '../theme';

export const theme = { colors, fonts, type, spacing, borderRadius: radius, shadow } as const;

export default theme;
