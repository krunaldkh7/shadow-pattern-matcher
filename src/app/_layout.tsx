import {
  Urbanist_500Medium,
  Urbanist_500Medium_Italic,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  useFonts,
} from '@expo-google-fonts/urbanist';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdLoadingVeil } from '../ads/AdLoadingVeil';
import { trackScreen } from '../analytics/analytics';
import { startAds } from '../ads/googleAds';
import { progress } from '../game/progress';
import { startLeaderboardSync } from '../leaderboard/leaderboard';
import { CrashGuard } from '../ui/CrashGuard';
import { WALL } from '../ui/components/MenuKit';
import { setHapticsEnabled } from '../utils/haptics';

// Keep the native splash up until the fonts are ready, so there's no blank frame.
SplashScreen.preventAutoHideAsync().catch(() => {});

setHapticsEnabled(progress.get().hapticsEnabled);
progress.subscribe(() => setHapticsEnabled(progress.get().hapticsEnabled));

// Remote ad config: fetched in the background, never blocks startup; ads stay off until it says otherwise.
startAds();
// Publish the player's points to the global leaderboard whenever they change.
startLeaderboardSync();

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
          <ScreenTracker />
          {SCREENSHOT_MODE && <ScreenshotTour />}
        </CrashGuard>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Store-screenshot builds (EXPO_PUBLIC_SCREENSHOTS=1) walk through these screens on a timer. */
const SCREENSHOT_MODE = process.env.EXPO_PUBLIC_SCREENSHOTS === '1';
const TOUR = ['/intro', '/', '/tiers', '/tier/easy', '/create', '/how-to-play', '/leaderboard'] as const;
const TOUR_STEP_MS = 7000;

function ScreenshotTour() {
  useEffect(() => {
    // Start once the navigator has mounted, then step through the screens.
    let i = 0;
    let t: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      router.replace(TOUR[0]);
      t = setInterval(() => {
        i += 1;
        if (i >= TOUR.length) return clearInterval(t);
        router.replace(TOUR[i]);
      }, TOUR_STEP_MS);
    }, 1500);
    return () => {
      clearTimeout(start);
      clearInterval(t);
    };
  }, []);
  return null;
}

/** Logs a screen view to Analytics on every route change (/play/12 → "play"). */
function ScreenTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const screen = pathname === '/' ? 'home' : pathname.split('/').filter(Boolean)[0];
    trackScreen(screen);
  }, [pathname]);
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WALL },
});
