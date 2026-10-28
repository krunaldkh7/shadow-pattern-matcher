import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * Remote ad configuration, fetched once per launch from a JSON file on GitHub
 * (raw URL in app.json → expo.extra.adsConfigUrl). Ads stay OFF until a valid
 * config says otherwise, so a failed, slow or offline fetch can never show
 * ads with bad IDs or crash the app.
 *
 * Remote JSON (every key optional; a format is on only when its unit ID is set):
 * {
 *   "show_ads": true,
 *   "banner_ad_unit_id": "ca-app-pub-…/…",
 *   "interstitial_ad_unit_id": "…",
 *   "rewarded_ad_unit_id": "…",
 *   "rewarded_interstitial_ad_unit_id": "…",
 *   "app_open_ad_unit_id": "…",
 *   "native_ad_unit_id": "…",
 *   "interstitial_taps_min": 6,
 *   "interstitial_taps_max": 12,
 *   "interstitial_every_n_levels": 0,
 *   "interstitial_start_after_level": 0,
 *   "interstitial_min_interval_seconds": 0,
 *   "app_open_cooldown_minutes": 240,
 *   "android": { …unit IDs… },
 *   "ios": { …unit IDs… }
 * }
 * Per-platform blocks override the top-level IDs (AdMob unit IDs differ per platform).
 */

export interface AdConfig {
  showAds: boolean;
  bannerUnitId: string;
  interstitialUnitId: string;
  rewardedUnitId: string;
  rewardedInterstitialUnitId: string;
  appOpenUnitId: string;
  nativeUnitId: string;
  /** Interstitial after a random number of taps (between min and max) anywhere outside the game screen; 0 = never. */
  interstitialTapsMin: number;
  interstitialTapsMax: number;
  /** Interstitial after every N solved levels (0 = never). */
  interstitialEveryNLevels: number;
  /** No interstitials until the player has solved this many levels. */
  interstitialStartAfterLevel: number;
  /** Minimum gap between two interstitials. */
  interstitialMinIntervalSec: number;
  /** Minimum gap between two app-open ads. */
  appOpenCooldownMin: number;
}

/** Safe fallback: no ads, no IDs. */
export const ADS_OFF: AdConfig = {
  showAds: false,
  bannerUnitId: '',
  interstitialUnitId: '',
  rewardedUnitId: '',
  rewardedInterstitialUnitId: '',
  appOpenUnitId: '',
  nativeUnitId: '',
  interstitialTapsMin: 6,
  interstitialTapsMax: 12,
  interstitialEveryNLevels: 0,
  interstitialStartAfterLevel: 0,
  interstitialMinIntervalSec: 0,
  appOpenCooldownMin: 240,
};

const FETCH_TIMEOUT_MS = 6000;
const AD_UNIT_RE = /^ca-app-pub-\d+\/\d+$/;

const CONFIG_URL: string | undefined = (Constants.expoConfig?.extra as { adsConfigUrl?: string } | undefined)
  ?.adsConfigUrl;

/** Accept only well-formed values; anything odd falls back to the safe default. */
function parse(raw: unknown): AdConfig {
  if (!raw || typeof raw !== 'object') return ADS_OFF;
  const root = raw as Record<string, unknown>;
  const platform = (root[Platform.OS] ?? {}) as Record<string, unknown>;
  const id = (key: string) => {
    const v = platform[key] ?? root[key];
    return typeof v === 'string' && AD_UNIT_RE.test(v.trim()) ? v.trim() : '';
  };
  const count = (key: string, fallback: number) => {
    const n = Number(root[key]);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
  };

  const config: AdConfig = {
    showAds: root.show_ads === true,
    bannerUnitId: id('banner_ad_unit_id'),
    interstitialUnitId: id('interstitial_ad_unit_id'),
    rewardedUnitId: id('rewarded_ad_unit_id'),
    rewardedInterstitialUnitId: id('rewarded_interstitial_ad_unit_id'),
    appOpenUnitId: id('app_open_ad_unit_id'),
    nativeUnitId: id('native_ad_unit_id'),
    interstitialTapsMin: 0,
    interstitialTapsMax: 0,
    interstitialEveryNLevels: count('interstitial_every_n_levels', ADS_OFF.interstitialEveryNLevels),
    interstitialStartAfterLevel: count('interstitial_start_after_level', ADS_OFF.interstitialStartAfterLevel),
    interstitialMinIntervalSec: count('interstitial_min_interval_seconds', ADS_OFF.interstitialMinIntervalSec),
    appOpenCooldownMin: count('app_open_cooldown_minutes', ADS_OFF.appOpenCooldownMin),
  };
  // Tap range: older configs may still send a single interstitial_every_n_clicks.
  const legacyTaps = count('interstitial_every_n_clicks', -1);
  const tapsMin = count('interstitial_taps_min', legacyTaps >= 0 ? legacyTaps : ADS_OFF.interstitialTapsMin);
  config.interstitialTapsMin = tapsMin;
  config.interstitialTapsMax = Math.max(tapsMin, count('interstitial_taps_max', legacyTaps >= 0 ? legacyTaps : ADS_OFF.interstitialTapsMax));

  const anyUnit =
    config.bannerUnitId ||
    config.interstitialUnitId ||
    config.rewardedUnitId ||
    config.rewardedInterstitialUnitId ||
    config.appOpenUnitId ||
    config.nativeUnitId;
  // "On" with no usable ID for any format is the same as off.
  if (!anyUnit) config.showAds = false;
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
