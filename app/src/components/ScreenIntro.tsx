import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = { title: string; description: string; icon: ComponentProps<typeof MaterialCommunityIcons>['name'] };

export function ScreenIntro({ title, description, icon }: Props) {
  return (
    <View style={styles.intro}>
      <View style={styles.icon}><MaterialCommunityIcons name={icon} size={24} color={colors.navy} /></View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { paddingTop: 4, paddingBottom: 16, gap: 10 },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.navyLight, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, color: colors.text },
  description: { fontSize: 14, lineHeight: 22, color: colors.muted, maxWidth: 540 },
});
