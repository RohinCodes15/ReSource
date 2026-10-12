import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Menu } from 'react-native-paper';
import { useTranslation } from '../../lib/i18n';
import { colors, radius } from '../theme';

/**
 * Button showing the current language's flag; opens a menu of all five languages.
 * `light` is for dark backgrounds such as the Home hero.
 */
export function LanguageSelector({ light = false }: { light?: boolean }) {
  const { t, language, setLanguage, languages } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = languages.find((option) => option.code === language) ?? languages[0];

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchorPosition="bottom"
      anchor={
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${t('language.select')}: ${current.label}`}
          style={[styles.button, light ? styles.buttonLight : styles.buttonDark]}
        >
          <Text style={styles.flag}>{current.flag}</Text>
          <Text style={[styles.caret, { color: light ? colors.white : colors.navy }]}>▾</Text>
        </Pressable>
      }
    >
      {languages.map((option) => (
        <Menu.Item
          key={option.code}
          title={`${option.flag}  ${option.label}`}
          trailingIcon={option.code === language ? 'check' : undefined}
          onPress={() => {
            setLanguage(option.code);
            setOpen(false);
          }}
        />
      ))}
    </Menu>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  buttonLight: { backgroundColor: 'rgba(255,255,255,0.14)' },
  buttonDark: { backgroundColor: colors.navyLight },
  flag: { fontSize: 20 },
  caret: { fontSize: 13 },
});
