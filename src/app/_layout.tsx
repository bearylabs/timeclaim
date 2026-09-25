import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { AppStoreProvider } from '@/context/app-store';

export default function RootLayout() {
  const [loaded, error] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });

  useEffect(() => {
    if (error) console.error('App fonts could not be loaded; using system fonts instead.', error);
  }, [error]);

  // A font failure must not hide database startup errors (or the rest of the app).
  if (!loaded && !error) return null;
  return <SafeAreaProvider><AppStoreProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false }} /></AppStoreProvider></SafeAreaProvider>;
}
