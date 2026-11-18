import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { progress } from '../../game/progress';
import { adConfig, fetchAdConfig, type AdConfig } from '../adConfig';

/**
 * Google AdMob for every format the game uses: banner (bottom strip), native
 * (a card inside the gallery list), interstitial, rewarded, rewarded
 * interstitial (bonus bulbs after a solve) and app open (on returning to the
 * app). The core API matches ../unity/unityAds.ts; the rewarded-interstitial,
 * app-open and native parts are AdMob-only. The native module is loaded lazily: Expo Go doesn't
 * contain it (requiring it there throws), so ads only exist in real/dev
 * builds. Nothing here is called — not even initialize() — unless the remote
 * config says show_ads: true.
 */

type AdsModule = typeof import('react-native-google-mobile-ads');
/** Interstitial and rewarded ads share these events; typed as the interstitial's so one helper fits both. */
type Kind = 'banner' | 'interstitial' | 'rewarded' | 'rewardedInterstitial' | 'appOpen' | 'native';
type FullscreenAd = Pick<import('react-native-google-mobile-ads').InterstitialAd, 'addAdEventListener'>;

/** Ad diagnostics in development only (Metro console). */
const log = (...args: unknown[]) => {
  if (__DEV__) console.log('[ads]', ...args);
};

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
  return {
    banner: m.TestIds.BANNER,
    interstitial: m.TestIds.INTERSTITIAL,
    rewarded: m.TestIds.REWARDED,
    rewardedInterstitial: m.TestIds.REWARDED_INTERSTITIAL,
    appOpen: m.TestIds.APP_OPEN,
    native: m.TestIds.NATIVE,
  }[kind];
}

// ─────────────────────────── full-screen bookkeeping ───────────────────────────

/** True while any full-screen ad is up (and briefly after), so two never stack. */
let fullscreenShowing = false;
function trackFullscreen(m: AdsModule, ad: FullscreenAd) {
  ad.addAdEventListener(m.AdEventType.OPENED, () => {
    fullscreenShowing = true;
  });
  // A click leaves the app (store page, browser); don't greet the return with another ad.
  ad.addAdEventListener(m.AdEventType.CLICKED, skipNextReturnAd);
  ad.addAdEventListener(m.AdEventType.CLOSED, () => {
    // Android reports the app as backgrounded while an ad activity is open;
    // keep the flag a moment so a return from it isn't mistaken for anything else.
    setTimeout(() => {
      fullscreenShowing = false;
    }, 1500);
  });
}

/** How long a paid hint or skip waits for its video to finish loading. */
const LOAD_WAIT_MS = 8000;
/** After a failed load, wait this long before retrying, doubling each time (5 s, 10 s, 20 s, 40 s, then 60 s). */
const RETRY_FIRST_MS = 5000;
const RETRY_MAX_MS = 60_000;
const retryDelay = (failures: number) => Math.min(RETRY_FIRST_MS * 2 ** (failures - 1), RETRY_MAX_MS);

/** Wait until ready() is true (or give up after a few seconds). */
function waitUntil(ready: () => boolean): Promise<boolean> {
  if (ready()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const started = Date.now();
    const poll = setInterval(() => {
      if (ready() || Date.now() - started > LOAD_WAIT_MS) {
        clearInterval(poll);
        resolve(ready());
      }
    }, 250);
  });
}

export type RewardResult = 'earned' | 'skipped' | 'unavailable';

// ─────────────────────────────── interstitial ───────────────────────────────

let interstitial: import('react-native-google-mobile-ads').InterstitialAd | null = null;
let interstitialReady = false;
let interstitialLoading = false;
let interstitialFailures = 0;
let solvedSinceLast = 0;
let lastInterstitialAt = 0;

function requestInterstitial() {
  if (!interstitial || interstitialReady || interstitialLoading) return;
  interstitialLoading = true;
  interstitial.load();
}

function loadInterstitial(m: AdsModule, config: AdConfig) {
  // Always loaded when configured: menu taps, solves and returns to the app all use it.
  const id = unit('interstitial', config.interstitialUnitId);
  if (!id) return;
  const ad = m.InterstitialAd.createForAdRequest(id);
  trackFullscreen(m, ad);
  ad.addAdEventListener(m.AdEventType.LOADED, () => {
    interstitialReady = true;
    interstitialLoading = false;
    interstitialFailures = 0;
    log('interstitial loaded');
  });
  ad.addAdEventListener(m.AdEventType.ERROR, (e) => {
    interstitialReady = false;
    interstitialLoading = false;
    interstitialFailures++;
    const wait = retryDelay(interstitialFailures);
    log('interstitial failed to load', e, `retry in ${wait / 1000}s`);
    setTimeout(requestInterstitial, wait);
  });
  ad.addAdEventListener(m.AdEventType.CLOSED, () => {
    interstitialReady = false;
    // Preload the next one as soon as this one is dismissed.
    requestInterstitial();
  });
  interstitial = ad;
  requestInterstitial();
}

function showInterstitial() {
  interstitial?.show().catch((e) => {
    log('interstitial failed to show', e);
    interstitialReady = false;
    requestInterstitial();
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
    if (inGame || veil || fullscreenShowing || !interstitialReady) return;
    if (Date.now() - lastInterstitialAt < config.interstitialMinIntervalSec * 1000) return;
    tapsSinceLast = 0;
    tapsTarget = pickTapsTarget(config);
    lastInterstitialAt = Date.now();
    setVeil(true);
    setTimeout(() => {
      setVeil(false);
      if (!inGame) showInterstitial();
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
  if (!interstitialReady || fullscreenShowing) return;
  solvedSinceLast = 0;
  lastInterstitialAt = Date.now();
  showInterstitial();
}

// ──────────────────────────── return to the app ────────────────────────────

let lastReturnAdAt = 0;
let skipReturnAdOnce = false;

/**
 * The app itself is about to send the player out (an ad click, an external
 * link): the next return to the app is not a "came back" moment, so skip the
 * return interstitial once.
 */
export function skipNextReturnAd() {
  skipReturnAdOnce = true;
}

/** Same as skipNextReturnAd; the name v1 used. */
export const skipNextAppOpen = skipNextReturnAd;

/**
 * A full-screen ad when the player comes back to the app: the app-open ad
 * when one is configured, otherwise the interstitial. Never on the very first
 * launch, which already has the intro, never over a level in play, and never
 * right after another full-screen ad.
 */
function watchAppReturn() {
  let wasBackground = false;
  AppState.addEventListener('change', (state) => {
    if (state === 'background') wasBackground = true;
    if (state !== 'active' || !wasBackground) return;
    wasBackground = false;
    if (skipReturnAdOnce) {
      skipReturnAdOnce = false;
      return;
    }
    if (appOpen) {
      showAppOpenOnReturn();
      return;
    }
    const cooldownMin = adConfig.get().returnInterstitialCooldownMin;
    if (cooldownMin === 0 || inGame || fullscreenShowing || !interstitialReady) return;
    if (Date.now() - lastReturnAdAt < cooldownMin * 60_000) return;
    lastReturnAdAt = Date.now();
    lastInterstitialAt = Date.now();
    showInterstitial();
  });
}

// ──────────────────────────────── rewarded ────────────────────────────────

let rewarded: import('react-native-google-mobile-ads').RewardedAd | null = null;
let rewardedReady = false;
let rewardedLoading = false;
let rewardedFailures = 0;
const rewardedListeners = new Set<() => void>();
function setRewardedReady(ready: boolean) {
  rewardedReady = ready;
  rewardedListeners.forEach((l) => l());
}

function requestRewarded() {
  if (!rewarded || rewardedReady || rewardedLoading) return;
  rewardedLoading = true;
  rewarded.load();
}

function loadRewarded(m: AdsModule, config: AdConfig) {
  const id = unit('rewarded', config.rewardedUnitId);
  if (!id) return;
  const ad = m.RewardedAd.createForAdRequest(id);
  trackFullscreen(m, ad);
  ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => {
    rewardedLoading = false;
    rewardedFailures = 0;
    setRewardedReady(true);
    log('rewarded loaded');
  });
  ad.addAdEventListener(m.AdEventType.ERROR, (e) => {
    rewardedLoading = false;
    setRewardedReady(false);
    rewardedFailures++;
    const wait = retryDelay(rewardedFailures);
    log('rewarded failed to load', e, `retry in ${wait / 1000}s`);
    setTimeout(requestRewarded, wait);
  });
  ad.addAdEventListener(m.AdEventType.CLOSED, () => {
    setRewardedReady(false);
    requestRewarded();
  });
  rewarded = ad;
  rewardedListeners.forEach((l) => l());
  requestRewarded();
}

/** Whether rewarded ads are switched on, so hint and skip buttons can offer one (it may still be loading). */
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

/**
 * Whether a rewarded ad is loaded right now. The bonus offer is only made
 * when one is ready, because its intro counts down and then plays at once.
 */
export function useRewardedReady() {
  return useSyncExternalStore(
    (l) => {
      rewardedListeners.add(l);
      return () => rewardedListeners.delete(l);
    },
    () => rewardedReady && adConfig.get().showAds,
    () => rewardedReady && adConfig.get().showAds,
  );
}

/**
 * Show the rewarded ad, loading one first if none is ready. Resolves
 * 'earned' only if the viewer watched long enough for the reward.
 */
export async function showRewarded(): Promise<RewardResult> {
  const m = ads();
  const ad = rewarded;
  if (!m || !ad || fullscreenShowing) return 'unavailable';
  requestRewarded();
  if (!(await waitUntil(() => rewardedReady))) return 'unavailable';
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
      setRewardedReady(false);
      requestRewarded();
      resolve('unavailable');
    });
  });
}

// ─────────────────────────── rewarded interstitial ───────────────────────────

let rewardedInterstitial: import('react-native-google-mobile-ads').RewardedInterstitialAd | null = null;
let rewardedInterstitialReady = false;
let rewardedInterstitialLoading = false;
let rewardedInterstitialFailures = 0;
const rewardedInterstitialListeners = new Set<() => void>();
function setRewardedInterstitialReady(ready: boolean) {
  rewardedInterstitialReady = ready;
  rewardedInterstitialListeners.forEach((l) => l());
}

function requestRewardedInterstitial() {
  if (!rewardedInterstitial || rewardedInterstitialReady || rewardedInterstitialLoading) return;
  rewardedInterstitialLoading = true;
  rewardedInterstitial.load();
}

function loadRewardedInterstitial(m: AdsModule, config: AdConfig) {
  const id = unit('rewardedInterstitial', config.rewardedInterstitialUnitId);
  if (!id) return;
  const ad = m.RewardedInterstitialAd.createForAdRequest(id);
  trackFullscreen(m, ad);
  ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => {
    rewardedInterstitialLoading = false;
    rewardedInterstitialFailures = 0;
    setRewardedInterstitialReady(true);
    log('rewarded interstitial loaded');
  });
  ad.addAdEventListener(m.AdEventType.ERROR, (e) => {
    rewardedInterstitialLoading = false;
    setRewardedInterstitialReady(false);
    rewardedInterstitialFailures++;
    const wait = retryDelay(rewardedInterstitialFailures);
    log('rewarded interstitial failed to load', e, `retry in ${wait / 1000}s`);
    setTimeout(requestRewardedInterstitial, wait);
  });
  ad.addAdEventListener(m.AdEventType.CLOSED, () => {
    setRewardedInterstitialReady(false);
    requestRewardedInterstitial();
  });
  rewardedInterstitial = ad;
  requestRewardedInterstitial();
}

/**
 * Whether a bonus video is ready right now: the rewarded interstitial when
 * configured, else the rewarded ad. It's only ever offered when ready,
 * because its intro counts down and then plays at once.
 */
export function useBonusAdReady() {
  const rewardedOk = useRewardedReady();
  const ri = useSyncExternalStore(
    (l) => {
      rewardedInterstitialListeners.add(l);
      return () => rewardedInterstitialListeners.delete(l);
    },
    () => rewardedInterstitialReady && adConfig.get().showAds,
    () => rewardedInterstitialReady && adConfig.get().showAds,
  );
  return rewardedInterstitial ? ri : rewardedOk;
}

/**
 * Play the bonus video (after BonusOffer's countdown intro, which AdMob
 * requires before a rewarded interstitial). Resolves 'earned' only if the
 * reward was earned. Falls back to the rewarded ad when no rewarded
 * interstitial is configured.
 */
export function showBonusAd(): Promise<RewardResult> {
  const m = ads();
  const ad = rewardedInterstitial;
  if (!ad) return showRewarded();
  if (!m || !rewardedInterstitialReady || fullscreenShowing) return Promise.resolve('unavailable');
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
      setRewardedInterstitialReady(false);
      requestRewardedInterstitial();
      resolve('unavailable');
    });
  });
}

// ──────────────────────────────── app open ────────────────────────────────

let appOpen: import('react-native-google-mobile-ads').AppOpenAd | null = null;
let appOpenReady = false;
let appOpenLoading = false;
let appOpenFailures = 0;
let appOpenLoadedAt = 0;
let lastAppOpenAt = 0;
/** Google discards app-open ads older than 4 hours; showing one then silently fails. */
const APP_OPEN_MAX_AGE_MS = 4 * 60 * 60 * 1000;

function requestAppOpen() {
  if (!appOpen || appOpenReady || appOpenLoading) return;
  appOpenLoading = true;
  appOpen.load();
}

function loadAppOpen(m: AdsModule, config: AdConfig) {
  const id = unit('appOpen', config.appOpenUnitId);
  if (!id) return;
  const ad = m.AppOpenAd.createForAdRequest(id);
  trackFullscreen(m, ad);
  ad.addAdEventListener(m.AdEventType.LOADED, () => {
    appOpenReady = true;
    appOpenLoading = false;
    appOpenFailures = 0;
    appOpenLoadedAt = Date.now();
    log('app open loaded');
  });
  ad.addAdEventListener(m.AdEventType.ERROR, (e) => {
    appOpenReady = false;
    appOpenLoading = false;
    appOpenFailures++;
    const wait = retryDelay(appOpenFailures);
    log('app open failed to load', e, `retry in ${wait / 1000}s`);
    setTimeout(requestAppOpen, wait);
  });
  ad.addAdEventListener(m.AdEventType.CLOSED, () => {
    appOpenReady = false;
    requestAppOpen();
  });
  appOpen = ad;
  requestAppOpen();
}

function showAppOpenOnReturn() {
  const ad = appOpen;
  if (!ad) return;
  // A stale ad won't show; fetch a fresh one for the next return instead.
  if (appOpenReady && Date.now() - appOpenLoadedAt > APP_OPEN_MAX_AGE_MS) {
    appOpenReady = false;
    requestAppOpen();
    return;
  }
  const cooldownMin = adConfig.get().appOpenCooldownMin;
  if (cooldownMin === 0 || inGame || fullscreenShowing || !appOpenReady) return;
  if (Date.now() - lastAppOpenAt < cooldownMin * 60_000) return;
  lastAppOpenAt = Date.now();
  lastInterstitialAt = Date.now();
  ad.show().catch((e) => {
    log('app open failed to show', e);
    appOpenReady = false;
    requestAppOpen();
  });
}

// ──────────────────────────────── native ────────────────────────────────

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

// ──────────────────────────────── banner ────────────────────────────────

/** Banner unit for <AdBanner/>, or '' when banners are off. */
export function bannerUnitId(config: AdConfig) {
  return config.showAds ? unit('banner', config.bannerUnitId) : '';
}

/** Bottom strip, or the same banner set in a card inside a list. */
export type BannerPlacement = 'strip' | 'card';

/**
 * The banner view and its size for a placement, when the native module exists:
 * an anchored adaptive banner (full width) for the strip, a standard 320×50
 * for the card so it sits inside the list's paper card.
 */
export function bannerComponent(placement: BannerPlacement = 'strip') {
  const m = ads();
  if (!m) return null;
  return {
    BannerAd: m.BannerAd,
    size: placement === 'card' ? m.BannerAdSize.BANNER : m.BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
  };
}

// ──────────────────────────────── privacy ────────────────────────────────

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
    setPrivacyOptionsRequired(
      info.privacyOptionsRequirementStatus === m.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
    );
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

// ──────────────────────────────── startup ────────────────────────────────

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
    // The game is not directed at children (COPPA) and has no under-age-of-consent audience.
    await m.default().setRequestConfiguration({
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await m.default().initialize();
    log('SDK initialized');
  } catch (e) {
    log('SDK failed to initialize', e);
    adConfig.set({ ...config, showAds: false });
    return;
  }
  adConfig.set(config);
  loadInterstitial(m, config);
  loadRewarded(m, config);
  loadRewardedInterstitial(m, config);
  loadAppOpen(m, config);
  if (interstitial || appOpen) watchAppReturn();
}
