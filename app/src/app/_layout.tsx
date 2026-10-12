import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { colors, paperTheme } from '../theme';

export default function RootLayout() {
  // Inter is the app's typeface (see `fonts` in theme.ts).
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  // Hold a plain background for the moment the font takes to load, so text never flashes in
  // the system font. If loading fails, carry on with the system font.
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.background } }} />
    </PaperProvider>
  );
}
