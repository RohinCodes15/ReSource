import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { Sheet } from './Sheet';
import { Icon, a11yState, AppText } from './ui';

/** The list of languages, each named in its own language. Used here and on the Settings screen. */
export function LanguageList({ onPicked }: { onPicked?: () => void }) {
  const { language, setLanguage, languages } = useTranslation();
  return (
    <View role="radiogroup" style={styles.list}>
      {languages.map((option) => {
        const active = option.code === language;
        return (
          <Pressable
            key={option.code}
            onPress={() => { setLanguage(option.code); onPicked?.(); }}
            role="radio"
            aria-checked={active}
            accessibilityState={a11yState({ selected: active })}
            accessibilityLabel={`${option.label} (${option.english})`}
            testID={`language-${option.code}`}
            style={[styles.option, active && styles.optionOn]}
          >
            <Icon name={active ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={active ? colors.navy : colors.borderStrong} />
            <View style={styles.flex}>
              {/* `lang` lets a screen reader pronounce each name in its own language. */}
              <AppText variant="label" {...({ lang: option.code } as object)}>{option.label}</AppText>
              <AppText variant="caption">{option.english}</AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Button showing the current language; opens the list. `light` is for dark backgrounds. */
export function LanguageSelector({ light = false }: { light?: boolean }) {
  const { t, language, languages } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = languages.find((option) => option.code === language) ?? languages[0];
  const color = light ? colors.white : colors.navy;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('language.select')}: ${current.label}`}
        testID="language-button"
        style={[styles.button, light ? styles.buttonLight : styles.buttonDark]}
      >
        <Icon name="translate" size={18} color={color} />
        <AppText variant="label" color={color}>{current.label}</AppText>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('language.select')} testID="language-sheet">
        <LanguageList onPicked={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  optionOn: { borderColor: colors.navy, backgroundColor: colors.navyLight },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  buttonLight: { backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  buttonDark: { backgroundColor: colors.navyLight },
});
