import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MIN_TOUCH, radius, spacing } from '../theme';

/** Google's four-colour "G", drawn to Google's sign-in branding spec. Decorative: the label says what it does. */
function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </Svg>
    </View>
  );
}

/**
 * "Continue with Google", in Google's own light-theme button style (white fill, grey edge, the
 * full-colour mark), so people recognise it. Google asks that this button not be restyled in the
 * app's brand colours.
 */
export function GoogleButton({ label, onPress, loading, testID }: { label: string; onPress: () => void; loading?: boolean; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!loading, busy: !!loading }}
      testID={testID}
      style={(state) => [styles.button, (state as { hovered?: boolean }).hovered && styles.hovered, state.pressed && styles.pressed, loading && styles.busy]}
    >
      {loading ? <ActivityIndicator size="small" color="#1F1F1F" /> : <GoogleMark />}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#747775',
    backgroundColor: '#FFFFFF',
  },
  hovered: { backgroundColor: '#F8F9FA', borderColor: '#5F6368' },
  pressed: { backgroundColor: '#EEF0F2' },
  busy: { opacity: 0.7 },
  // Google's spec names Roboto Medium; Inter stands in where Roboto is not installed.
  label: { fontFamily: 'Roboto, Inter_600SemiBold, system-ui, sans-serif', fontWeight: '500', fontSize: 15, lineHeight: 20, color: '#1F1F1F', letterSpacing: 0.25 },
});
