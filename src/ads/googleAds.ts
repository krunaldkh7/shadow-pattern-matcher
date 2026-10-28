import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { progress } from '../game/progress';
import { adConfig, fetchAdConfig, type AdConfig } from './adConfig';

/**
 * AdMob wiring for every format: banner, interstitial, rewarded, rewarded
 * interstitial, app open and native. The native module is loaded lazily: Expo Go doesn't contain it
 * (requiring it there throws), so ads only exist in real/dev builds. Nothing
 * here is called — not even initialize() — unless the remote config says
 * show_ads: true.
 */

type AdsModule = typeof import('react-native-google-mobile-ads');

/** Ad diagnostics in development only (Metro console). */
const log = (...args: unknown[]) => {
  if (__DEV__) console.log('[ads]', ...args);
};
type Kind = 'banner' | 'interstitial' | 'rewarded' | 'rewardedInterstitial' | 'appOpen' | 'native';

let mod: AdsModule | null | undefined;
function ads(): AdsModule | null {
  if (mod !== undefined) return mod;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (mod = null);
  try {
    mod = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    mod = null;
  }
  return mod;
}

/** Development builds always use Google's test units, so real ads are never clicked while testing. */
function unit(kind: Kind, configured: string) {
  const m = ads();
  if (!m || !configured) return '';
  if (!__DEV__) return configured;
  const test = {
    banner: m.TestIds.ADAPTIVE_BANNER,
    interstitial: m.TestIds.INTERSTITIAL,
    rewarded: m.TestIds.REWARDED,
    rewardedInterstitial: m.TestIds.REWARDED_INTERSTITIAL,
    appOpen: m.TestIds.APP_OPEN,
    native: m.TestIds.NATIVE,
  };
  return test[kind];
}

// ─────────────────────────── full-screen bookkeeping ───────────────────────────

/** True while any full-screen ad is up (and briefly after), so two never stack. */
let fullscreenShowing = false;
function trackFullscreen(ad: { addAdEventListener: AdsModule['InterstitialAd']['prototype']['addAdEventListener'] }) {
  const m = ads()!;
  ad.addAdEventListener(m.AdEventType.OPENED, () => {
    fullscreenShowing = true;
  });
  // A click on the ad leaves the app (store page, browser); don't greet the return with an app-open ad.
  ad.addAdEventListener(m.AdEventType.CLICKED, skipNextAppOpen);
  ad.addAdEventListener(m.AdEventType.CLOSED, () => {
    // Android reports the app as backgrounded while an ad activity is open;
    // keep the flag a moment so returning from it doesn't trigger an app-open ad.
    setTimeout(() => {
      fullscreenShowing = false;
    }, 1500);
  });
}

/** How long a paid hint or skip waits for its ad to finish loading. */
const LOAD_WAIT_MS = 8000;

// ─────────────────────────────── interstitial ───────────────────────────────

let interstitial: import('react-native-google-mobile-ads').InterstitialAd | null = null;
let solvedSinceLast = 0;
let lastInterstitialAt = 0;

function loadInterstitial(config: AdConfig) {
  const m = ads();
  const id = unit('interstitial', config.interstitialUnitId);
  // Always loaded when configured: menu taps, solves and paid hints all use it.
  if (!m || !id) return;
  const ad = m.InterstitialAd.createForAdRequest(id);
  trackFullscreen(ad);
  ad.addAdEventListener(m.AdEventType.LOADED, () => {
    interstitialLoading = false;
  });
  // Preload the next one as soon as this one is dismissed.
  ad.addAdEventListener(m.AdEventType.CLOSED, () => requestInterstitial());
  ad.addAdEventListener(m.AdEventType.ERROR, (e) => {
    interstitialLoading = false;
    log('interstitial failed to load', e);
  });
  interstitial = ad;
  interstitialListeners.forEach((l) => l());
  requestInterstitial();
}

let interstitialLoading = false;
const interstitialListeners = new Set<() => void>();

function requestInterstitial() {
  if (!interstitial || interstitial.loaded || interstitialLoading) return;
  interstitialLoading = true;
  interstitial.load();
}

/** Whether interstitials are switched on, so a hint button can offer one (it may still be loading). */
export function useInterstitialAvailable() {
  return useSyncExternalStore(
    (l) => {
      interstitialListeners.add(l);
      return () => interstitialListeners.delete(l);
    },
    () => interstitial !== null && adConfig.get().showAds,
    () => interstitial !== null && adConfig.get().showAds,
  );
}

/**
 * Paid hint: show the interstitial (loading one first if needed, up to a few
 * seconds) and resolve 'earned' once it has been closed.
 */
export async function showInterstitialForHint(): Promise<RewardResult> {
  const m = ads();
  const ad = interstitial;
  if (!m || !ad || fullscreenShowing) return 'unavailable';
  if (!ad.loaded) {
    requestInterstitial();
    const started = Date.now();
    while (!ad.loaded && Date.now() - started < LOAD_WAIT_MS) {
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!ad.loaded) return 'unavailable';
  }
  return new Promise((resolve) => {
    const offClose = ad.addAdEventListener(m.AdEventType.CLOSED, () => {
      offClose();
      resolve('earned');
    });
    ad.show().catch((e) => {
      log('interstitial failed to show', e);
      offClose();
      resolve('unavailable');
    });
  });
}

let tapsSinceLast = 0;
let tapsTarget = 0;
/** True while the game screen is focused: its taps never count and no interstitial opens over it. */
let inGame = false;

export function setInGame(value: boolean) {
  inGame = value;
}

function pickTapsTarget(config: AdConfig) {
  const { interstitialTapsMin: lo, interstitialTapsMax: hi } = config;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// "Loading ad…" veil shown for a moment before the interstitial opens.
let veil = false;
const veilListeners = new Set<() => void>();
function setVeil(on: boolean) {
  veil = on;
  veilListeners.forEach((l) => l());
}
export function useAdLoadingVeil() {
  return useSyncExternalStore(
    (l) => {
      veilListeners.add(l);
      return () => veilListeners.delete(l);
    },
    () => veil,
    () => veil,
  );
}

const VEIL_MS = 700;
/** Grace period after a tap, so a tap that opens a level has switched to the game before we decide. */
const SETTLE_MS = 350;

/**
 * Count one tap anywhere outside the game screen. After a random number of
 * taps (interstitial_taps_min…max) the interstitial opens behind a short
 * "Loading ad…" veil. If that tap took the player into a level, the ad waits
 * for the next tap outside the game instead of covering it.
 */
export function onScreenTap() {
  const config = adConfig.get();
  if (inGame || !config.showAds || !interstitial || config.interstitialTapsMax === 0) return;
  if (tapsTarget === 0) tapsTarget = pickTapsTarget(config);
  tapsSinceLast++;
  if (tapsSinceLast < tapsTarget) return;
  setTimeout(() => {
    if (inGame || veil || fullscreenShowing || !interstitial?.loaded) return;
    if (Date.now() - lastInterstitialAt < config.interstitialMinIntervalSec * 1000) return;
    tapsSinceLast = 0;
    tapsTarget = pickTapsTarget(config);
    lastInterstitialAt = Date.now();
    setVeil(true);
    setTimeout(() => {
      setVeil(false);
      if (!inGame) interstitial?.show().catch(() => {});
    }, VEIL_MS);
  }, SETTLE_MS);
}

/**
 * After a solve, on the way to the next level. Shows the interstitial only when
 * all rules pass: enough levels solved overall, every N solves, a minimum gap
 * since the last one, and an ad is ready. Otherwise returns immediately.
 */
export function onLevelSolvedNavigate() {
  const config = adConfig.get();
  if (!config.showAds || !interstitial || config.interstitialEveryNLevels === 0) return;
  const solvedTotal = Object.keys(progress.get().levels).length;
  if (solvedTotal <= config.interstitialStartAfterLevel) return;
  solvedSinceLast++;
  if (solvedSinceLast < config.interstitialEveryNLevels) return;
  if (Date.now() - lastInterstitialAt < config.interstitialMinIntervalSec * 1000) return;
  if (!interstitial.loaded || fullscreenShowing) return;
  solvedSinceLast = 0;
  lastInterstitialAt = Date.now();
  interstitial.show().catch(() => {});
}

// ──────────────────────────────── rewarded ────────────────────────────────

let rewarded: import('react-native-google-mobile-ads').RewardedAd | null = null;
let rewardedReady = false;
let rewardedLoading = false;
const rewardedListeners = new Set<() => void>();
function notifyRewarded() {
  rewardedListeners.forEach((l) => l());
}

function requestRewarded() {
  if (!rewarded || rewardedReady || rewardedLoading) return;
  rewardedLoading = true;
  rewarded.load();
}

function loadRewarded(config: AdConfig) {
  const m = ads();
  const id = unit('rewarded', config.rewardedUnitId);
  if (!m || !id) return;
  const ad = m.RewardedAd.createForAdRequest(id);
  trackFullscreen(ad);
  ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => {
    rewardedReady = true;
    rewardedLoading = false;
    log('rewarded loaded');
  });
  ad.addAdEventListener(m.AdEventType.CLOSED, () => {
    rewardedReady = false;
    requestRewarded();
  });
  ad.addAdEventListener(m.AdEventType.ERROR, (e) => {
    rewardedReady = false;
    rewardedLoading = false;
    log('rewarded failed to load', e);
  });
  rewarded = ad;
  notifyRewarded();
  requestRewarded();
}

/** Whether rewarded ads are switched on, so a hint button can offer one (it may still be loading). */
export function useRewardedAvailable() {
  return useSyncExternalStore(
    (l) => {
      rewardedListeners.add(l);
      return () => rewardedListeners.delete(l);
    },
    () => rewarded !== null && adConfig.get().showAds,
    () => rewarded !== null && adConfig.get().showAds,
  );
}

/** Wait until the rewarded ad has loaded (starting a load if needed), or give up after a few seconds. */
function waitForRewarded(): Promise<boolean> {
  if (rewardedReady) return Promise.resolve(true);
  requestRewarded();
  return new Promise((resolve) => {
    const started = Date.now();
    const poll = setInterval(() => {
      if (rewardedReady || Date.now() - started > LOAD_WAIT_MS) {
        clearInterval(poll);
        resolve(rewardedReady);
      }
    }, 250);
  });
}

export type RewardResult = 'earned' | 'skipped' | 'unavailable';

/**
 * Show the rewarded ad, loading one first if none is ready. Resolves
 * 'earned' only if the viewer watched long enough for the reward.
 */
export async function showRewarded(): Promise<RewardResult> {
  const m = ads();
  if (!m || !rewarded || fullscreenShowing) return 'unavailable';
  if (!(await waitForRewarded())) return 'unavailable';
  const ad = rewarded;
  return new Promise((resolve) => {
    let earned = false;
    const offEarn = ad.addAdEventListener(m.RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    const offClose = ad.addAdEventListener(m.AdEventType.CLOSED, () => {
      offEarn();
      offClose();
      resolve(earned ? 'earned' : 'skipped');
    });
    ad.show().catch((e) => {
      log('rewarded failed to show', e);
      offEarn();
      offClose();
      resolve('unavailable');
    });
  });
}

// ─────────────────────────── rewarded interstitial ───────────────────────────

let rewardedInterstitial: import('react-native-google-mobile-ads').RewardedInterstitialAd | null = null;
let rewardedInterstitialReady = false;
const rewardedInterstitialListeners = new Set<() => void>();
function setRewardedInterstitialReady(ready: boolean) {
  rewardedInterstitialReady = ready;
  rewardedInterstitialListeners.forEach((l) => l());
}

function loadRewardedInterstitial(config: AdConfig) {
  const m = ads();
  const id = unit('rewardedInterstitial', config.rewardedInterstitialUnitId);
  if (!m || !id) return;
  const ad = m.RewardedInterstitialAd.createForAdRequest(id);
  trackFullscreen(ad);
  ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => {
    setRewardedInterstitialReady(true);
    log('rewarded interstitial loaded');
  });
  ad.addAdEventListener(m.AdEventType.CLOSED, () => {
    setRewardedInterstitialReady(false);
    ad.load();
  });
  ad.addAdEventListener(m.AdEventType.ERROR, (e) => {
    setRewardedInterstitialReady(false);
    log('rewarded interstitial failed to load', e);
    setTimeout(() => ad.load(), 30_000);
  });
  ad.load();
  rewardedInterstitial = ad;
}

/**
 * Whether a rewarded interstitial is loaded. It's only ever offered when
 * ready, because its intro screen counts down and then plays immediately.
 */
export function useRewardedInterstitialReady() {
  return useSyncExternalStore(
    (l) => {
      rewardedInterstitialListeners.add(l);
      return () => rewardedInterstitialListeners.delete(l);
    },
    () => rewardedInterstitialReady && adConfig.get().showAds,
    () => rewardedInterstitialReady && adConfig.get().showAds,
  );
}

/** Play the rewarded interstitial; resolves 'earned' only if the reward was earned. */
export function showRewardedInterstitial(): Promise<RewardResult> {
  const m = ads();
  const ad = rewardedInterstitial;
  if (!m || !ad || !rewardedInterstitialReady || fullscreenShowing) return Promise.resolve('unavailable');
  return new Promise((resolve) => {
    let earned = false;
    const offEarn = ad.addAdEventListener(m.RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    const offClose = ad.addAdEventListener(m.AdEventType.CLOSED, () => {
      offEarn();
      offClose();
      resolve(earned ? 'earned' : 'skipped');
    });
    ad.show().catch((e) => {
      log('rewarded interstitial failed to show', e);
      offEarn();
      offClose();
      resolve('unavailable');
    });
  });
}

// ──────────────────────────────── app open ────────────────────────────────

let appOpen: import('react-native-google-mobile-ads').AppOpenAd | null = null;
let lastAppOpenAt = 0;
let appOpenLoadedAt = 0;
/** Google discards app-open ads older than 4 hours; showing one then silently fails. */
const APP_OPEN_MAX_AGE_MS = 4 * 60 * 60 * 1000;
let skipAppOpenOnce = false;

/**
 * The app itself is about to send the player out (an ad click, an external
 * link): the next return to the app is not a "came back" moment, so skip the
 * app-open ad once.
 */
export function skipNextAppOpen() {
  skipAppOpenOnce = true;
}

function loadAppOpen(config: AdConfig) {
  const m = ads();
  const id = unit('appOpen', config.appOpenUnitId);
  if (!m || !id) return;
  const ad = m.AppOpenAd.createForAdRequest(id);
  trackFullscreen(ad);
  ad.addAdEventListener(m.AdEventType.LOADED, () => {
    appOpenLoadedAt = Date.now();
    log('app open loaded');
  });
  ad.addAdEventListener(m.AdEventType.CLOSED, () => ad.load());
  ad.addAdEventListener(m.AdEventType.ERROR, (e) => log('app open failed to load', e));
  ad.load();
  appOpen = ad;

  // Shown when the player comes back to the app — never on the very first launch,
  // which already has the intro, and never right after another full-screen ad.
  let wasBackground = false;
  AppState.addEventListener('change', (state) => {
    if (state === 'background') wasBackground = true;
    if (state !== 'active' || !wasBackground) return;
    wasBackground = false;
    if (skipAppOpenOnce) {
      skipAppOpenOnce = false;
      return;
    }
    // A stale ad won't show; fetch a fresh one for the next return instead.
    if (ad.loaded && Date.now() - appOpenLoadedAt > APP_OPEN_MAX_AGE_MS) {
      ad.load();
      return;
    }
    const cooldown = adConfig.get().appOpenCooldownMin * 60_000;
    if (fullscreenShowing || !ad.loaded || Date.now() - lastAppOpenAt < cooldown) return;
    lastAppOpenAt = Date.now();
    ad.show().catch(() => ad.load());
  });
}

// ────────────────────────────── banner / native ──────────────────────────────

/** Banner unit for <AdBanner/>, or '' when banners are off. */
export function bannerUnitId(config: AdConfig) {
  return config.showAds ? unit('banner', config.bannerUnitId) : '';
}

/** The BannerAd component and size, when the native module exists. */
export function bannerComponent() {
  const m = ads();
  return m ? { BannerAd: m.BannerAd, size: m.BannerAdSize.ANCHORED_ADAPTIVE_BANNER } : null;
}

/** Native unit for <AdNativeCard/>, or '' when native ads are off. */
export function nativeUnitId(config: AdConfig) {
  return config.showAds ? unit('native', config.nativeUnitId) : '';
}

/** The native-ad building blocks, when the native module exists. Cached so it's a stable effect dependency. */
let nativeParts: {
  NativeAd: AdsModule['NativeAd'];
  NativeAdView: AdsModule['NativeAdView'];
  NativeAsset: AdsModule['NativeAsset'];
  NativeAssetType: AdsModule['NativeAssetType'];
  NativeAdEventType: AdsModule['NativeAdEventType'];
} | null = null;
export function nativeModule() {
  const m = ads();
  if (!m) return null;
  nativeParts ??= {
    NativeAd: m.NativeAd,
    NativeAdView: m.NativeAdView,
    NativeAsset: m.NativeAsset,
    NativeAssetType: m.NativeAssetType,
    NativeAdEventType: m.NativeAdEventType,
  };
  return nativeParts;
}

// ──────────────────────────────── startup ────────────────────────────────

/**
 * GDPR / UK privacy consent through Google's User Messaging Platform. Shows
 * the consent form configured in AdMob → Privacy & messaging when the player
 * is in a region that needs it (EEA, UK, Switzerland); elsewhere it returns at
 * once. Ads are requested only when UMP says so; if the check can't complete
 * (offline), the last known answer stands, which for a new player means no ads.
 */
async function gatherConsent(m: AdsModule): Promise<boolean> {
  try {
    const info = await m.AdsConsent.gatherConsent();
    setPrivacyOptionsRequired(info.privacyOptionsRequirementStatus === m.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
    return info.canRequestAds;
  } catch (e) {
    log('consent: gather failed', e);
    try {
      return (await m.AdsConsent.getConsentInfo()).canRequestAds;
    } catch {
      return false;
    }
  }
}

// Players in consent regions must be able to change their choice later (Settings → Ad privacy choices).
let privacyOptionsRequired = false;
const privacyListeners = new Set<() => void>();
function setPrivacyOptionsRequired(required: boolean) {
  privacyOptionsRequired = required;
  privacyListeners.forEach((l) => l());
}

export function usePrivacyOptionsRequired() {
  return useSyncExternalStore(
    (l) => {
      privacyListeners.add(l);
      return () => privacyListeners.delete(l);
    },
    () => privacyOptionsRequired,
    () => privacyOptionsRequired,
  );
}

/** Re-open the consent form so the player can change their choice. */
export async function showPrivacyOptions() {
  const m = ads();
  if (!m) return;
  try {
    await m.AdsConsent.showPrivacyOptionsForm();
  } catch (e) {
    log('consent: privacy options failed', e);
  }
}

/**
 * iOS App Tracking Transparency: ask once, before the first ad request, so
 * AdMob can personalise ads when the player allows it. Declining (or any
 * failure) just means non-personalised ads.
 */
async function askTrackingPermission() {
  if (Platform.OS !== 'ios') return;
  try {
    const att = await import('expo-tracking-transparency');
    if (!att.isAvailable()) return;
    const current = await att.getTrackingPermissionsAsync();
    if (current.status === 'undetermined') await att.requestTrackingPermissionsAsync();
  } catch {
    // Not available in this build: carry on without the prompt.
  }
}

/**
 * Call once at app start. Fetches the remote config; if ads are on, starts the
 * SDK and preloads the full-screen formats. Never throws.
 */
export async function startAds() {
  // Store screenshots are built with EXPO_PUBLIC_SCREENSHOTS=1: no ads, no tracking prompt.
  if (process.env.EXPO_PUBLIC_SCREENSHOTS === '1') return;
  const config = await fetchAdConfig();
  const m = ads();
  log('config', config.showAds ? 'ads on' : 'ads off', m ? '' : '(no native ads module — Expo Go?)');
  if (!config.showAds || !m) {
    adConfig.set({ ...config, showAds: false });
    return;
  }
  // Google's order: privacy consent (GDPR/UMP) first, then Apple's tracking prompt, then ads.
  if (!(await gatherConsent(m))) {
    log('consent: ads not allowed for now');
    adConfig.set({ ...config, showAds: false });
    return;
  }
  await askTrackingPermission();
  try {
    await m.default().initialize();
    log('SDK initialized');
  } catch (e) {
    log('SDK failed to initialize', e);
    adConfig.set({ ...config, showAds: false });
    return;
  }
  adConfig.set(config);
  loadInterstitial(config);
  loadRewarded(config);
  loadRewardedInterstitial(config);
  loadAppOpen(config);
}
