/** Shared building blocks used by every screen, so cards, badges and buttons look the same. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps, PropsWithChildren, useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { cardSurface, colors, fonts, radius, spacing, statusTone, type } from '../theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Animations run on the native thread on phones; the web has no native driver. */
export const NATIVE_DRIVER = Platform.OS !== 'web';

/** White rounded card with the standard shadow. */
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Fades and slides its children in when the screen first shows. */
export function FadeIn({ children, delay = 0, style }: PropsWithChildren<{ delay?: number; style?: StyleProp<ViewStyle> }>) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 420, delay, useNativeDriver: NATIVE_DRIVER }).start();
  }, [progress, delay]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** Grey pulsing placeholder shown while data loads. */
export function Skeleton({ width = '100%', height = 16, round = radius.sm, style }: {
  width?: number | `${number}%`;
  height?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: round, backgroundColor: colors.border, opacity: pulse }, style]}
    />
  );
}

/** A card-shaped skeleton: one title line and two body lines. */
export function SkeletonCard() {
  return (
    <Card style={styles.skeletonCard}>
      <Skeleton width="55%" height={18} />
      <Skeleton width="90%" />
      <Skeleton width="70%" />
    </Card>
  );
}

/** Small rounded label. */
export function Pill({ label, color, bg, icon, style }: {
  label: string;
  color: string;
  bg: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {icon && <MaterialCommunityIcons name={icon} size={13} color={color} />}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

/** Color-coded service status: green open, amber reduced, red closed. */
export function StatusBadge({ status, style }: { status: string; style?: StyleProp<ViewStyle> }) {
  const tone = statusTone(status);
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }, style]}>
      <View style={[styles.dot, { backgroundColor: tone.color }]} />
      <Text style={[styles.pillText, { color: tone.text }]}>{tone.label}</Text>
    </View>
  );
}

type ButtonVariant = 'gold' | 'navy' | 'outline';

/** The app's button: gold for the main action, navy for secondary, outline for tertiary. */
export function AppButton({ label, onPress, variant = 'navy', icon, disabled, loading, style, accessibilityLabel }: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const foreground = variant === 'gold' ? colors.navyDark : variant === 'navy' ? colors.white : colors.navy;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(disabled || loading) }}
      style={({ pressed }) => [
        styles.button,
        variant === 'gold' && styles.buttonGold,
        variant === 'navy' && styles.buttonNavy,
        variant === 'outline' && styles.buttonOutline,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        icon && <MaterialCommunityIcons name={icon} size={18} color={foreground} />
      )}
      <Text style={[styles.buttonText, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

/** Round icon-only button, e.g. call or directions. */
export function IconAction({ icon, label, onPress, tone = 'navy' }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'navy' | 'gold';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconAction, tone === 'gold' && styles.iconActionGold, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={tone === 'gold' ? colors.goldDark : colors.navy} />
    </Pressable>
  );
}

/** Illustration plus message for an empty list. */
export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyOuter}>
        <View style={styles.emptyInner}>
          <MaterialCommunityIcons name={icon} size={36} color={colors.navy} />
        </View>
        <View style={[styles.emptySpark, styles.emptySparkA]} />
        <View style={[styles.emptySpark, styles.emptySparkB]} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!body && <Text style={styles.emptyBody}>{body}</Text>}
    </View>
  );
}

/** Section heading with an optional line of supporting text. */
export function SectionHeader({ title, subtitle, style }: { title: string; subtitle?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      <Text accessibilityRole="header" style={type.h2}>{title}</Text>
      {!!subtitle && <Text style={type.bodySmall}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...cardSurface, padding: spacing.lg },
  skeletonCard: { gap: spacing.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonGold: { backgroundColor: colors.gold },
  buttonNavy: { backgroundColor: colors.navy },
  buttonOutline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.navy },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  iconAction: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionGold: { backgroundColor: colors.goldLight },
  empty: { alignItems: 'center', paddingVertical: spacing.huge, paddingHorizontal: spacing.xxl, gap: spacing.sm },
  emptyOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyInner: {
    ...cardSurface,
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySpark: { position: 'absolute', backgroundColor: colors.gold, borderRadius: radius.pill },
  emptySparkA: { width: 14, height: 14, top: 10, right: 14 },
  emptySparkB: { width: 8, height: 8, bottom: 18, left: 12 },
  emptyTitle: { ...type.h4, textAlign: 'center' },
  emptyBody: { ...type.bodySmall, textAlign: 'center', maxWidth: 300 },
  section: { gap: spacing.xs, marginBottom: spacing.lg },
});
