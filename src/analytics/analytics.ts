import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Google Analytics for Firebase (via React Native Firebase). The native module
 * is loaded lazily: Expo Go doesn't contain it, so events there are no-ops.
 * Every call is fire-and-forget and never throws.
 *
 * Realtime users, retention and these game events show up in the Firebase
 * console under Analytics (realtime within a minute; reports within a day).
 */

type AnalyticsModule = typeof import('@react-native-firebase/analytics');
type Params = Record<string, string | number | boolean>;

let mod: AnalyticsModule | null | undefined;
function analytics(): AnalyticsModule | null {
  if (mod !== undefined) return mod;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (mod = null);
  try {
    mod = require('@react-native-firebase/analytics') as AnalyticsModule;
  } catch {
    mod = null;
  }
  return mod;
}

function send(fn: (m: AnalyticsModule) => unknown) {
  const m = analytics();
  if (!m) return;
  try {
    Promise.resolve(fn(m)).catch(() => {});
  } catch {
    // Native module present but not ready: drop the event.
  }
}

/** Log a custom event (names: lowercase_with_underscores, ≤ 40 chars). */
export function track(name: string, params?: Params) {
  send((m) => m.logEvent(m.getAnalytics(), name, params));
}

/** Log a screen view (called on every route change). */
export function trackScreen(screen: string) {
  send((m) => m.logScreenView(m.getAnalytics(), { screen_name: screen, screen_class: screen }));
}
