import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * Remote ad configuration, fetched once per launch from a JSON file on GitHub
 * (raw URL in app.json → expo.extra.adsConfigUrl). Ads stay OFF until a valid
 * config says otherwise, so a failed, slow or offline fetch can never show
 * ads with bad IDs or crash the app.
 *
 * Remote JSON (every key optional; ads need an app key, and a format is on only when its unit ID is set):
 * {
 *   "show_ads": true,
 *   "app_key": "…",
 *   "banner_ad_unit_id": "…",
 *   "interstitial_ad_unit_id": "…",
 *   "rewarded_ad_unit_id": "…",
 *   "interstitial_taps_min": 6,
 *   "interstitial_taps_max": 12,
 *   "interstitial_every_n_levels": 0,
 *   "interstitial_start_after_level": 0,
 *   "interstitial_min_interval_seconds": 0,
 *   "return_interstitial_cooldown_minutes": 240,
 *   "android": { "app_key": …, …unit IDs… },
 *   "ios": { "app_key": …, …unit IDs… }
 * }
 * Per-platform blocks override the top-level values (each platform is its own app in Unity LevelPlay).
 */

export interface AdConfig {
  showAds: boolean;
  /** Unity LevelPlay app key for this platform. */
  appKey: string;
  bannerUnitId: string;
  interstitialUnitId: string;
  rewardedUnitId: string;
  /** Interstitial after a random number of taps (between min and max) anywhere outside the game screen; 0 = never. */
  interstitialTapsMin: number;
  interstitialTapsMax: number;
  /** Interstitial after every N solved levels (0 = never). */
  interstitialEveryNLevels: number;
  /** No interstitials until the player has solved this many levels. */
  interstitialStartAfterLevel: number;
  /** Minimum gap between two interstitials. */
  interstitialMinIntervalSec: number;
  /** Minimum gap between two interstitials shown on returning to the app (0 = never). */
  returnInterstitialCooldownMin: number;
}

/** Safe fallback: no ads, no IDs. */
export const ADS_OFF: AdConfig = {
  showAds: false,
  appKey: '',
  bannerUnitId: '',
  interstitialUnitId: '',
  rewardedUnitId: '',
  interstitialTapsMin: 6,
  interstitialTapsMax: 12,
  interstitialEveryNLevels: 0,
  interstitialStartAfterLevel: 0,
  interstitialMinIntervalSec: 0,
  returnInterstitialCooldownMin: 240,
};

const FETCH_TIMEOUT_MS = 6000;
/** LevelPlay app keys and ad unit IDs are short alphanumeric strings. */
const ID_RE = /^[A-Za-z0-9]{4,64}$/;

const CONFIG_URL: string | undefined = (Constants.expoConfig?.extra as { adsConfigUrl?: string } | undefined)
  ?.adsConfigUrl;

/** Accept only well-formed values; anything odd falls back to the safe default. */
function parse(raw: unknown): AdConfig {
  if (!raw || typeof raw !== 'object') return ADS_OFF;
  const root = raw as Record<string, unknown>;
  const platform = (root[Platform.OS] ?? {}) as Record<string, unknown>;
  const id = (key: string) => {
    const v = platform[key] ?? root[key];
    return typeof v === 'string' && ID_RE.test(v.trim()) ? v.trim() : '';
  };
  const count = (key: string, fallback: number) => {
    const n = Number(root[key]);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
  };

  const config: AdConfig = {
    showAds: root.show_ads === true,
    appKey: id('app_key'),
    bannerUnitId: id('banner_ad_unit_id'),
    interstitialUnitId: id('interstitial_ad_unit_id'),
    rewardedUnitId: id('rewarded_ad_unit_id'),
    interstitialTapsMin: 0,
    interstitialTapsMax: 0,
    interstitialEveryNLevels: count('interstitial_every_n_levels', ADS_OFF.interstitialEveryNLevels),
    interstitialStartAfterLevel: count('interstitial_start_after_level', ADS_OFF.interstitialStartAfterLevel),
    interstitialMinIntervalSec: count('interstitial_min_interval_seconds', ADS_OFF.interstitialMinIntervalSec),
    returnInterstitialCooldownMin: count('return_interstitial_cooldown_minutes', ADS_OFF.returnInterstitialCooldownMin),
  };
  // Tap range: older configs may still send a single interstitial_every_n_clicks.
  const legacyTaps = count('interstitial_every_n_clicks', -1);
  const tapsMin = count('interstitial_taps_min', legacyTaps >= 0 ? legacyTaps : ADS_OFF.interstitialTapsMin);
  config.interstitialTapsMin = tapsMin;
  config.interstitialTapsMax = Math.max(tapsMin, count('interstitial_taps_max', legacyTaps >= 0 ? legacyTaps : ADS_OFF.interstitialTapsMax));

  const anyUnit = config.bannerUnitId || config.interstitialUnitId || config.rewardedUnitId;
  // "On" without an app key or any usable unit ID is the same as off.
  if (!config.appKey || !anyUnit) config.showAds = false;
  return config;
}

let current: AdConfig = ADS_OFF;
const listeners = new Set<() => void>();

export async function fetchAdConfig(): Promise<AdConfig> {
  if (!CONFIG_URL) return ADS_OFF;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // Cache-buster: raw.githubusercontent.com is CDN-cached for a few minutes.
    const sep = CONFIG_URL.includes('?') ? '&' : '?';
    const res = await fetch(`${CONFIG_URL}${sep}t=${Date.now()}`, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return ADS_OFF;
    return parse(await res.json());
  } catch {
    return ADS_OFF; // offline, timeout, bad JSON
  } finally {
    clearTimeout(timer);
  }
}

export const adConfig = {
  get: () => current,
  set(next: AdConfig) {
    current = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useAdConfig(): AdConfig {
  return useSyncExternalStore(adConfig.subscribe, adConfig.get, adConfig.get);
}
