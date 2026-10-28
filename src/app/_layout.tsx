import {
  Urbanist_500Medium,
  Urbanist_500Medium_Italic,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  useFonts,
} from '@expo-google-fonts/urbanist';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdLoadingVeil } from '../ads/AdLoadingVeil';
import { startAds } from '../ads/googleAds';
import { progress } from '../game/progress';
import { CrashGuard } from '../ui/CrashGuard';
import { WALL } from '../ui/components/MenuKit';
import { setHapticsEnabled } from '../utils/haptics';

// Keep the native splash up until the fonts are ready, so there's no blank frame.
SplashScreen.preventAutoHideAsync().catch(() => {});

setHapticsEnabled(progress.get().hapticsEnabled);
progress.subscribe(() => setHapticsEnabled(progress.get().hapticsEnabled));

// Remote ad config: fetched in the background, never blocks startup; ads stay off until it says otherwise.
startAds();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Urbanist_500Medium,
    Urbanist_500Medium_Italic,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {/* Dark status bar text: every screen sits on the light tiled wall. */}
        <StatusBar style="dark" />
        <CrashGuard>
          {ready ? (
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: WALL }, animation: 'fade' }}>
              <Stack.Screen name="intro" options={{ gestureEnabled: false }} />
              <Stack.Screen name="play/[level]" options={{ gestureEnabled: false }} />
              <Stack.Screen name="play/custom/[id]" options={{ gestureEnabled: false }} />
              <Stack.Screen name="how-to-play" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            </Stack>
          ) : null}
          <AdLoadingVeil />
        </CrashGuard>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WALL },
});
