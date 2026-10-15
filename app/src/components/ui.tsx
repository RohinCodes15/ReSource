/** Shared building blocks used by every screen, so text, cards, buttons and fields look and behave the same. */
import { PropsWithChildren, ReactNode, useEffect, useId, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle,
} from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { formatDate, useTranslation } from '../lib/i18n';
import { openUrl } from '../lib/platform';
import { textScaleStore } from '../state/stores';
import { cardSurface, colors, fonts, MIN_TOUCH, radius, spacing, statusTone, type, type TextVariant } from '../theme';
import { ICONS, type IconName, type IconNode } from './icons';
import { Illustration, type SceneName } from './illustrations';

export type { IconName };

const ICON_PARTS: Record<IconNode[0], React.ComponentType<object>> = {
  path: Path, circle: Circle, rect: Rect, line: Line, polyline: Polyline, polygon: Polygon, ellipse: Ellipse,
} as never;

/**
 * An icon from the app's one line set (Lucide, see icons.ts), drawn as SVG. Icons are always
 * decorative here: the label or text beside them carries the meaning, so they are hidden from
 * screen readers.
 */
export function Icon({ name, size = 24, color = colors.text, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const icon = ICONS[name] as { n: IconNode[]; b?: 1; f?: 1 };
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={icon.f ? color : 'none'} stroke={color} strokeWidth={icon.b ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {icon.n.map(([tag, attrs], i) => {
          const Part = ICON_PARTS[tag];
          return <Part key={i} {...attrs} />;
        })}
      </Svg>
    </View>
  );
}

/** Animations run on the native thread on phones; the web has no native driver. */
export const NATIVE_DRIVER = Platform.OS !== 'web';
const isWeb = Platform.OS === 'web';

/**
 * accessibilityState for phones. On the web React Native turns `selected` into aria-selected,
 * which is not allowed on buttons, radios or switches, so there the role-specific attribute
 * (aria-pressed, aria-checked) carries the state instead.
 */
export function a11yState(state: { selected?: boolean; checked?: boolean; disabled?: boolean; busy?: boolean }) {
  if (!isWeb) return state;
  const { disabled, busy } = state;
  return disabled === undefined && busy === undefined ? undefined : { disabled, busy };
}

/** True when the person asked their device to reduce motion. Animations are skipped. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

type AppTextProps = PropsWithChildren<{
  variant?: TextVariant;
  color?: string;
  /** Marks the text as a heading of this level for screen readers. */
  heading?: 1 | 2 | 3 | 4;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  nativeID?: string;
  testID?: string;
  /** Announce changes to this text to screen readers (status and error messages). */
  live?: 'polite' | 'assertive';
  selectable?: boolean;
  accessibilityLabel?: string;
  'aria-hidden'?: boolean;
}>;

/** All text goes through here: it applies the type scale, the text-size setting and text direction. */
export function AppText({ variant = 'body', color, heading, center, style, live, children, ...rest }: AppTextProps) {
  const scale = textScaleStore.use();
  const { isRTL } = useTranslation();
  const base = type[variant];
  const a11y = {
    ...(heading ? { role: 'heading' as const, 'aria-level': heading } : null),
    ...(live ? { 'aria-live': live, accessibilityLiveRegion: live, role: live === 'assertive' ? ('alert' as const) : ('status' as const) } : null),
  };
  return (
    <Text
      {...rest}
      {...a11y}
      style={[
        base,
        { fontSize: base.fontSize * scale, lineHeight: base.lineHeight * scale, writingDirection: isRTL ? 'rtl' : 'ltr' },
        // Tracking pulls Persian letters apart and breaks their joins, so right-to-left text has none.
        isRTL ? styles.noTracking : null,
        color ? { color } : null,
        center ? styles.center : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** A quiet panel a shade lighter than the page, with a hairline edge and no shadow. Use it for
 *  things a person fills in or that must read as one unit; elsewhere prefer whitespace and <Rule>. */
export function Card({ children, style, testID }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; testID?: string }>) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

/** A thin horizontal line between sections, in place of a box around each one. */
export function Rule({ strong, style }: { strong?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View aria-hidden style={[styles.rule, strong && styles.ruleStrong, style]} />;
}

/**
 * A titled part of a screen: a strong rule, then the heading, then the content. Used instead of
 * a box around each part, so screens read like a well-set page rather than a stack of cards.
 */
export function Section({ title, subtitle, level = 2, children, style, testID }: PropsWithChildren<{ title: string; subtitle?: string; level?: 2 | 3; style?: StyleProp<ViewStyle>; testID?: string }>) {
  return (
    <View style={[styles.sectionBlock, style]} testID={testID}>
      <Rule strong />
      <AppText variant={level === 2 ? 'h2' : 'h3'} heading={level}>{title}</AppText>
      {!!subtitle && <AppText variant="bodySmall" color={colors.text}>{subtitle}</AppText>}
      {children}
    </View>
  );
}

/** The small spaced label above a section, like the head of a ledger column. */
export function Eyebrow({ children, color, testID }: PropsWithChildren<{ color?: string; testID?: string }>) {
  return <AppText variant="eyebrow" color={color} testID={testID}>{children}</AppText>;
}

/** Fades and slides its children in when the screen first shows (skipped with reduced motion). */
export function FadeIn({ children, delay = 0, style, testID }: PropsWithChildren<{ delay?: number; style?: StyleProp<ViewStyle>; testID?: string }>) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    Animated.timing(progress, { toValue: 1, duration: 320, delay, useNativeDriver: NATIVE_DRIVER }).start();
  }, [progress, delay, reduced]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return <Animated.View testID={testID} style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** Grey placeholder shown while data loads. It pulses unless motion is reduced. */
export function Skeleton({ width = '100%', height = 16, round = radius.sm, style }: {
  width?: number | `${number}%`; height?: number; round?: number; style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(pulse, { toValue: 0.5, duration: 800, useNativeDriver: NATIVE_DRIVER }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return (
    <Animated.View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: round, backgroundColor: colors.border, opacity: pulse }, style]}
    />
  );
}

/** A list of card-shaped skeletons with a spoken "Loading" for screen readers. */
export function LoadingList({ count = 3 }: { count?: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.stack} accessible accessibilityLabel={t('common.loading')} role="status" testID="loading">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} style={styles.stackSmall}>
          <Skeleton width="55%" height={18} />
          <Skeleton width="90%" />
          <Skeleton width="70%" />
        </Card>
      ))}
    </View>
  );
}

/** Small rounded label. */
export function Pill({ label, color, bg, icon, style }: { label: string; color: string; bg: string; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {icon && <Icon name={icon} size={14} color={color} />}
      <AppText variant="caption" color={color} style={styles.pillText}>{label}</AppText>
    </View>
  );
}

/** Service status as an icon plus a word, never color alone. */
export function StatusBadge({ status, style }: { status: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const tone = statusTone(status);
  return <Pill label={t(`status.${tone.key}`)} icon={tone.icon} color={tone.text} bg={tone.bg} style={style} />;
}

/** On the web a link is a real <a> so it can be opened in a new tab, copied and announced as a link. */
function linkProps(href: string | undefined) {
  if (!href || !isWeb) return null;
  const external = /^https?:/.test(href);
  return { href, hrefAttrs: external ? { target: '_blank', rel: 'noopener noreferrer' } : undefined, accessibilityRole: 'link' as const };
}

type ButtonVariant = 'gold' | 'navy' | 'outline' | 'danger';
type AppButtonProps = {
  label: string;
  onPress?: () => void;
  /** Opens this address instead of running `onPress` (https:, tel:, mailto:). */
  href?: string;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  small?: boolean;
};

/** The app's button: gold for the main action, navy for secondary, outline for the rest. */
export function AppButton({ label, onPress, href, variant = 'navy', icon, disabled, loading, style, accessibilityLabel, testID, small }: AppButtonProps) {
  const foreground = variant === 'gold' ? colors.navyDark : variant === 'navy' ? colors.white : variant === 'danger' ? colors.dangerDark : colors.navy;
  const blocked = !!(disabled || loading);
  const link = blocked ? null : linkProps(href);
  return (
    <Pressable
      {...(link as object)}
      onPress={() => { if (href && !link) void openUrl(href); else onPress?.(); }}
      disabled={blocked}
      accessibilityRole={link ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: !!loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        variant === 'gold' && styles.buttonGold,
        variant === 'navy' && styles.buttonNavy,
        variant === 'outline' && styles.buttonOutline,
        variant === 'danger' && styles.buttonDanger,
        pressed && styles.pressed,
        blocked && styles.disabled,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={foreground} /> : icon && <Icon name={icon} size={18} color={foreground} />}
      <AppText variant="label" color={foreground} style={styles.buttonText}>{label}</AppText>
    </Pressable>
  );
}

/** Square icon-only button, e.g. call or directions. `label` is what a screen reader says. */
export function IconAction({ icon, label, onPress, href, tone = 'navy', active, testID }: {
  icon: IconName; label: string; onPress?: () => void; href?: string; tone?: 'navy' | 'gold'; active?: boolean; testID?: string;
}) {
  const link = linkProps(href);
  return (
    <Pressable
      {...(link as object)}
      onPress={() => { if (href && !link) void openUrl(href); else onPress?.(); }}
      accessibilityRole={link ? 'link' : 'button'}
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : a11yState({ selected: active })}
      testID={testID}
      style={({ pressed }) => [styles.iconAction, tone === 'gold' && styles.iconActionGold, pressed && styles.pressed]}
    >
      <Icon name={icon} size={22} color={tone === 'gold' ? colors.goldDark : colors.navy} />
    </Pressable>
  );
}

/** Text link. External links open in a new tab on the web with rel="noopener noreferrer". */
// A long web address has no spaces to break at, so on the web it may break anywhere to stay inside its card.
const WRAP_ANYWHERE = { overflowWrap: 'anywhere' } as unknown as TextStyle;

export function LinkText({ label, href, onPress, variant = 'bodySmall', icon, testID, color = colors.navy }: {
  label: string; href?: string; onPress?: () => void; variant?: TextVariant; icon?: IconName; testID?: string; color?: string;
}) {
  const link = linkProps(href);
  return (
    <Pressable
      {...(link as object)}
      onPress={() => { if (href && !link) void openUrl(href); else onPress?.(); }}
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={label}
      hitSlop={8}
      testID={testID}
      style={styles.link}
    >
      {icon && <Icon name={icon} size={16} color={color} />}
      <AppText variant={variant} color={color} style={[styles.linkText, isWeb && WRAP_ANYWHERE]}>{label}</AppText>
    </Pressable>
  );
}

/** Rounded choice chip. Used for filters (pressed state) and single-choice groups. */
export function Chip({ label, selected, onPress, icon, testID, role = 'button' }: {
  label: string; selected?: boolean; onPress: () => void; icon?: IconName; testID?: string; role?: 'button' | 'radio';
}) {
  return (
    <Pressable
      onPress={onPress}
      role={role}
      aria-pressed={role === 'button' ? !!selected : undefined}
      aria-checked={role === 'radio' ? !!selected : undefined}
      accessibilityState={a11yState({ selected: !!selected })}
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
    >
      {icon && <Icon name={icon} size={16} color={selected ? colors.white : colors.navy} />}
      <AppText variant="label" color={selected ? colors.white : colors.text} numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  required?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'email-address';
  autoComplete?: 'postal-code' | 'email' | 'off';
  onSubmitEditing?: () => void;
  secure?: boolean;
  testID?: string;
};

/** Labeled text input. The label is always visible and the error is tied to the input for screen readers. */
export function Field({ label, value, onChangeText, error, hint, placeholder, multiline, maxLength, required, keyboardType, autoComplete, onSubmitEditing, secure, testID }: FieldProps) {
  const id = useId();
  const scale = textScaleStore.use();
  const { isRTL } = useTranslation();
  const [focused, setFocused] = useState(false);
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <View style={styles.field}>
      <AppText variant="label" nativeID={`${id}-label`}>{label}{required ? ' *' : ''}</AppText>
      {!!hint && <AppText variant="caption" nativeID={`${id}-hint`}>{hint}</AppText>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : undefined}
        secureTextEntry={secure}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        aria-describedby={described}
        aria-invalid={!!error}
        aria-required={required}
        testID={testID}
        style={[
          styles.input,
          { fontSize: 16 * scale, textAlign: isRTL ? 'right' : 'left' },
          multiline && styles.inputMultiline,
          focused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      />
      <View style={styles.fieldFooter}>
        <View style={styles.flex}>
          {!!error && (
            <View style={styles.errorRow}>
              <Icon name="alert-circle" size={16} color={colors.dangerDark} />
              <AppText variant="caption" color={colors.dangerDark} nativeID={`${id}-error`} live="polite" style={styles.flex} testID={testID ? `${testID}-error` : undefined}>{error}</AppText>
            </View>
          )}
        </View>
        {!!maxLength && multiline && <AppText variant="caption" aria-hidden>{value.length}/{maxLength}</AppText>}
      </View>
    </View>
  );
}

/** Checkbox with its label. Starts unchecked wherever it is used: consent is never pre-ticked. */
export function Checkbox({ checked, onChange, label, error, testID }: { checked: boolean; onChange: (next: boolean) => void; label: string; error?: string | null; testID?: string }) {
  return (
    <View style={styles.stackSmall}>
      <Pressable
        onPress={() => onChange(!checked)}
        role="checkbox"
        aria-checked={checked}
        accessibilityState={a11yState({ checked })}
        accessibilityLabel={label}
        testID={testID}
        style={styles.checkRow}
      >
        <View style={[styles.checkBox, checked && styles.checkBoxOn, !!error && styles.inputError]}>
          {checked && <Icon name="check-bold" size={16} color={colors.white} />}
        </View>
        <AppText variant="bodySmall" color={colors.text} style={styles.flex}>{label}</AppText>
      </Pressable>
      {!!error && <AppText variant="caption" color={colors.dangerDark} live="polite">{error}</AppText>}
    </View>
  );
}

/** On/off switch with a visible label. The state is shown by position and a word, not color. */
export function Toggle({ value, onChange, label, description, testID }: { value: boolean; onChange: (next: boolean) => void; label: string; description?: string; testID?: string }) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={() => onChange(!value)} role="switch" aria-checked={value} accessibilityState={a11yState({ checked: value })} accessibilityLabel={label} testID={testID} style={styles.toggleRow}>
      <View style={styles.flex}>
        <AppText variant="label">{label}</AppText>
        {!!description && <AppText variant="caption">{description}</AppText>}
      </View>
      <AppText variant="caption" color={colors.text}>{t(value ? 'common.on' : 'common.off')}</AppText>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </Pressable>
  );
}

type BannerTone = 'info' | 'warning' | 'danger' | 'success';
const BANNER: Record<BannerTone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: colors.navyLight, fg: colors.navy, icon: 'information' },
  warning: { bg: colors.warningLight, fg: colors.warningDark, icon: 'alert' },
  danger: { bg: colors.dangerLight, fg: colors.dangerDark, icon: 'alert-octagon' },
  success: { bg: colors.successLight, fg: colors.successDark, icon: 'check-circle' },
};

/** Inline notice. `live` makes screen readers announce it when it appears. */
export function Banner({ tone = 'info', title, body, children, live, icon, testID, style }: PropsWithChildren<{
  tone?: BannerTone; title?: string; body?: string; live?: boolean; icon?: IconName; testID?: string; style?: StyleProp<ViewStyle>;
}>) {
  const look = BANNER[tone];
  return (
    <View testID={testID} style={[styles.banner, { backgroundColor: look.bg }, style]} {...(live ? { role: 'status' as const, 'aria-live': 'polite' as const, accessibilityLiveRegion: 'polite' as const } : null)}>
      <Icon name={icon ?? look.icon} size={20} color={look.fg} />
      <View style={styles.bannerBody}>
        {!!title && <AppText variant="label" color={look.fg}>{title}</AppText>}
        {!!body && <AppText variant="bodySmall" color={colors.text}>{body}</AppText>}
        {children}
      </View>
    </View>
  );
}

/** Message for an empty list, with an optional action. `art` shows a drawing of a Fremont place instead of the icon. */
export function EmptyState({ icon, art, title, body, action }: { icon: IconName; art?: SceneName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty} testID="empty-state">
      {art ? <Illustration name={art} width={216} height={126} /> : <View style={styles.emptyIcon}><Icon name={icon} size={32} color={colors.navy} /></View>}
      <AppText variant="h2" center>{title}</AppText>
      {!!body && <AppText variant="bodySmall" center style={styles.emptyBody}>{body}</AppText>}
      {!!action && <View style={styles.emptyAction}>{action}</View>}
    </View>
  );
}

/** Shown when a request failed and there is nothing bundled to fall back on. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.empty} testID="error-state" role="alert">
      <View style={[styles.emptyIcon, { backgroundColor: colors.dangerLight }]}><Icon name="cloud-off-outline" size={32} color={colors.dangerDark} /></View>
      <AppText variant="h4" center>{t('errors.loadTitle')}</AppText>
      <AppText variant="bodySmall" center style={styles.emptyBody}>{message ?? t('errors.loadBody')}</AppText>
      {onRetry && <AppButton variant="outline" icon="refresh" label={t('common.retry')} onPress={onRetry} testID="retry" />}
    </View>
  );
}

/** Section heading with an optional line of supporting text. */
export function SectionHeader({ title, subtitle, level = 2, style }: { title: string; subtitle?: string; level?: 2 | 3; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      <AppText variant={level === 2 ? 'h2' : 'h3'} heading={level}>{title}</AppText>
      {!!subtitle && <AppText variant="bodySmall">{subtitle}</AppText>}
    </View>
  );
}

/** "Source: ... · Checked: date", with the source as a link. Every figure in the app carries one. */
export function SourceLine({ title, url, retrieved, sample }: { title?: string | null; url?: string | null; retrieved?: string | null; sample?: boolean }) {
  const { t, locale } = useTranslation();
  if (sample) return <Pill label={t('common.sampleData')} icon="flask-outline" color={colors.warningDark} bg={colors.warningLight} />;
  return (
    <View style={styles.source}>
      {!!title && (url
        ? <LinkText variant="caption" icon="open-in-new" label={t('common.source', { title })} href={url} />
        : <AppText variant="caption">{t('common.source', { title })}</AppText>)}
      {!!retrieved && <AppText variant="caption">{t('common.checked', { date: formatDate(retrieved, locale) })}</AppText>}
    </View>
  );
}

/** Two or three exclusive options shown side by side. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (next: T) => void; label: string }) {
  return (
    <View style={styles.segmented} role="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            role="radio"
            aria-checked={active}
            accessibilityState={a11yState({ selected: active })}
            accessibilityLabel={option.label}
            testID={`segment-${option.value}`}
            style={[styles.segment, active && styles.segmentOn]}
          >
            <AppText variant="label" color={active ? colors.white : colors.text} numberOfLines={1}>{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  noTracking: { letterSpacing: 0 },
  rule: { height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border },
  ruleStrong: { height: 2, backgroundColor: colors.text },
  stack: { gap: spacing.md },
  stackSmall: { gap: spacing.sm },
  card: { ...cardSurface, padding: spacing.lg },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.semibold },
  button: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  buttonSmall: { minHeight: MIN_TOUCH, paddingHorizontal: spacing.md },
  buttonGold: { backgroundColor: colors.gold },
  buttonNavy: { backgroundColor: colors.navy },
  buttonOutline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.navy },
  buttonDanger: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.dangerDark },
  buttonText: { fontSize: 15, flexShrink: 1, textAlign: 'center' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  iconAction: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.md, backgroundColor: colors.navyLight, alignItems: 'center', justifyContent: 'center' },
  iconActionGold: { backgroundColor: colors.goldLight },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 24, maxWidth: '100%' },
  linkText: { textDecorationLine: 'underline', flexShrink: 1 },
  chip: { minHeight: MIN_TOUCH, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  field: { gap: 6 },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.regular, color: colors.text },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top' },
  inputFocused: { borderColor: colors.navy, borderWidth: 2 },
  inputError: { borderColor: colors.dangerDark, borderWidth: 2 },
  fieldFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, minHeight: MIN_TOUCH, paddingVertical: spacing.sm },
  checkBox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH, paddingVertical: spacing.sm },
  track: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.borderStrong, justifyContent: 'center', paddingHorizontal: 2 },
  trackOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.borderStrong, alignSelf: 'flex-start' },
  thumbOn: { backgroundColor: colors.white, alignSelf: 'flex-end' },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
  bannerBody: { flex: 1, gap: spacing.xs },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.navyLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyBody: { maxWidth: 320, marginBottom: spacing.sm },
  emptyAction: { alignSelf: 'center' },
  section: { gap: spacing.xs },
  sectionBlock: { gap: spacing.md },
  source: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: 2 },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderStrong, padding: 3, alignSelf: 'flex-start' },
  segment: { minHeight: 38, paddingHorizontal: spacing.lg, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.navy },
});
