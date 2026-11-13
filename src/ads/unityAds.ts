import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { progress } from '../game/progress';
import { adConfig, fetchAdConfig, type AdConfig } from './adConfig';

/**
 * Unity Ads through Unity LevelPlay, for every format the game uses: banner
 * (bottom strip, and a card inside the gallery list), interstitial (also on returning to the
 * app) and rewarded. The native module is loaded lazily: Expo Go
 * doesn't contain it (requiring it there throws), so ads only exist in
 * real/dev builds. Nothing here is called — not even init — unless the remote
 * config says show_ads: true.
 */

type AdsModule = typeof import('unity-levelplay-mediation');

/** Ad diagnostics in development only (Metro console). */
const log = (...args: unknown[]) => {
  if (__DEV__) console.log('[ads]', ...args);
};

let mod: AdsModule | null | undefined;
function ads(): AdsModule | null {
  if (mod !== undefined) return mod;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (mod = null);
  try {
    mod = require('unity-levelplay-mediation') as AdsModule;
  } catch {
    mod = null;
  }
  return mod;
}

// ─────────────────────────── full-screen bookkeeping ───────────────────────────

/** True while any full-screen ad is up (and briefly after), so two never stack. */
let fullscreenShowing = false;
function onFullscreenOpened() {
  fullscreenShowing = true;
}
function onFullscreenClosed() {
  // Android reports the app as backgrounded while an ad activity is open;
  // keep the flag a moment so a return from it isn't mistaken for anything else.
  setTimeout(() => {
    fullscreenShowing = false;
  }, 1500);
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

let interstitial: import('unity-levelplay-mediation').LevelPlayInterstitialAd | null = null;
let interstitialReady = false;
let interstitialLoading = false;
let interstitialFailures = 0;
let solvedSinceLast = 0;
let lastInterstitialAt = 0;

function requestInterstitial() {
  if (!interstitial || interstitialReady || interstitialLoading) return;
  interstitialLoading = true;
  interstitial.loadAd().catch((e) => {
    interstitialLoading = false;
    log('interstitial load call failed', e);
  });
}

function loadInterstitial(m: AdsModule, config: AdConfig) {
  // Always loaded when configured: menu taps, solves and returns to the app all use it.
  if (!config.interstitialUnitId) return;
  const ad = new m.LevelPlayInterstitialAd(config.interstitialUnitId);
  ad.setListener({
    onAdLoaded: () => {
      interstitialReady = true;
      interstitialLoading = false;
      interstitialFailures = 0;
      log('interstitial loaded');
    },
    onAdLoadFailed: (e) => {
      interstitialLoading = false;
      interstitialFailures++;
      const wait = retryDelay(interstitialFailures);
      log('interstitial failed to load', e, `retry in ${wait / 1000}s`);
      setTimeout(requestInterstitial, wait);
    },
    onAdDisplayed: onFullscreenOpened,
    // A click leaves the app (store page, browser); don't greet the return with another ad.
    onAdClicked: skipNextReturnAd,
    onAdDisplayFailed: (e) => {
      log('interstitial failed to show', e);
      interstitialReady = false;
      onFullscreenClosed();
      requestInterstitial();
    },
    onAdClosed: () => {
      interstitialReady = false;
      onFullscreenClosed();
      // Preload the next one as soon as this one is dismissed.
      requestInterstitial();
    },
  });
  interstitial = ad;
  requestInterstitial();
}

function showInterstitial() {
  interstitial?.showAd().catch((e) => log('interstitial failed to show', e));
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

/**
 * Interstitial when the player comes back to the app — never on the very
 * first launch, which already has the intro, never over a level in play, and
 * never right after another full-screen ad.
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
    const cooldownMin = adConfig.get().returnInterstitialCooldownMin;
    if (cooldownMin === 0 || inGame || fullscreenShowing || !interstitialReady) return;
    if (Date.now() - lastReturnAdAt < cooldownMin * 60_000) return;
    lastReturnAdAt = Date.now();
    lastInterstitialAt = Date.now();
    showInterstitial();
  });
}

// ──────────────────────────────── rewarded ────────────────────────────────

let rewarded: import('unity-levelplay-mediation').LevelPlayRewardedAd | null = null;
let rewardedReady = false;
let rewardedLoading = false;
let rewardedFailures = 0;
/** Called once when the rewarded ad on screen is closed, with whether the reward was earned. */
let onRewardedClosed: ((earned: boolean) => void) | null = null;
let rewardEarned = false;
const rewardedListeners = new Set<() => void>();
function setRewardedReady(ready: boolean) {
  rewardedReady = ready;
  rewardedListeners.forEach((l) => l());
}

function requestRewarded() {
  if (!rewarded || rewardedReady || rewardedLoading) return;
  rewardedLoading = true;
  rewarded.loadAd().catch((e) => {
    rewardedLoading = false;
    log('rewarded load call failed', e);
  });
}

function finishRewarded() {
  setRewardedReady(false);
  onFullscreenClosed();
  onRewardedClosed?.(rewardEarned);
  onRewardedClosed = null;
  requestRewarded();
}

function loadRewarded(m: AdsModule, config: AdConfig) {
  if (!config.rewardedUnitId) return;
  const ad = new m.LevelPlayRewardedAd(config.rewardedUnitId);
  ad.setListener({
    onAdLoaded: () => {
      rewardedLoading = false;
      rewardedFailures = 0;
      setRewardedReady(true);
      log('rewarded loaded');
    },
    onAdLoadFailed: (e) => {
      rewardedLoading = false;
      rewardedFailures++;
      const wait = retryDelay(rewardedFailures);
      log('rewarded failed to load', e, `retry in ${wait / 1000}s`);
      setTimeout(requestRewarded, wait);
    },
    onAdDisplayed: onFullscreenOpened,
    onAdClicked: skipNextReturnAd,
    onAdDisplayFailed: (e) => {
      log('rewarded failed to show', e);
      rewardEarned = false;
      finishRewarded();
    },
    onAdRewarded: () => {
      rewardEarned = true;
    },
    onAdClosed: finishRewarded,
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
  const ad = rewarded;
  if (!ad || fullscreenShowing) return 'unavailable';
  requestRewarded();
  if (!(await waitUntil(() => rewardedReady))) return 'unavailable';
  return new Promise((resolve) => {
    rewardEarned = false;
    onRewardedClosed = (earned) => resolve(earned ? 'earned' : 'skipped');
    ad.showAd().catch((e) => {
      log('rewarded failed to show', e);
      onRewardedClosed = null;
      resolve('unavailable');
    });
  });
}

// ──────────────────────────────── banner ────────────────────────────────

/** Banner unit for <AdBanner/>, or '' when banners are off. */
export function bannerUnitId(config: AdConfig) {
  return config.showAds ? config.bannerUnitId : '';
}

/** Bottom strip, or the same banner set in a card inside a list. */
export type BannerPlacement = 'strip' | 'card';

/**
 * The banner view and size, when the native module exists. Always the
 * standard 320×50: Unity Ads doesn't fill 300×250 medium rectangles here.
 */
export function bannerComponent() {
  const m = ads();
  return m ? { BannerAd: m.LevelPlayBannerAdView, size: m.LevelPlayAdSize.BANNER } : null;
}

// ──────────────────────────────── privacy ────────────────────────────────

/**
 * GDPR / UK privacy consent. Players whose device is set to a European time
 * zone (EEA, UK, Switzerland and neighbours) are asked once whether ads may be
 * personalised; everyone else gets the network's default. The answer is kept
 * on the device and can be changed later in Settings → Ad privacy choices.
 */
const CONSENT_KEY = 'ads.gdprConsent';

function inConsentRegion() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    return zone.startsWith('Europe/') || /^Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)$/.test(zone);
  } catch {
    return false;
  }
}

function askConsent(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Personalised ads?',
      'This game is free thanks to ads from Unity Ads. May Unity use data from this device to show ads that suit you? Either way you will see ads, and the game works the same. You can change this any time in Settings.',
      [
        { text: 'Don’t allow', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Allow', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

async function applyConsent(m: AdsModule, consent: boolean) {
  try {
    await AsyncStorage.setItem(CONSENT_KEY, consent ? '1' : '0');
  } catch {
    // Not saved: the player is simply asked again next launch.
  }
  try {
    await m.LevelPlayPrivacySettings.setGDPRConsent(consent);
  } catch (e) {
    log('consent: could not pass to LevelPlay', e);
  }
}

/** Ask once in consent regions (or reuse the saved answer) and pass it to LevelPlay before init. */
async function gatherConsent(m: AdsModule) {
  if (!inConsentRegion()) return;
  setPrivacyOptionsRequired(true);
  let saved: string | null = null;
  try {
    saved = await AsyncStorage.getItem(CONSENT_KEY);
  } catch {
    // Treated as unanswered.
  }
  await applyConsent(m, saved === null ? await askConsent() : saved === '1');
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

/** Ask again so the player can change their choice. */
export async function showPrivacyOptions() {
  const m = ads();
  if (!m) return;
  await applyConsent(m, await askConsent());
}

/**
 * iOS App Tracking Transparency: ask once, before the first ad request, so
 * Unity Ads can personalise ads when the player allows it. Declining (or any
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

/** Development builds only: open LevelPlay's test suite after init, to check each network on a device. */
const LAUNCH_TEST_SUITE = false;

/** Start LevelPlay and wait for it; false if it failed. */
function initLevelPlay(m: AdsModule, appKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = m.LevelPlayInitRequest.builder(appKey).build();
    m.LevelPlay.init(request, {
      onInitSuccess: () => resolve(true),
      onInitFailed: (e) => {
        log('SDK failed to initialize', e);
        resolve(false);
      },
    }).catch((e) => {
      log('SDK init call failed', e);
      resolve(false);
    });
  });
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
  // The game is not directed at children under 13 (COPPA); tell LevelPlay before init.
  await m.LevelPlayPrivacySettings.setCOPPA(false).catch(() => {});
  // Privacy consent (GDPR) first, then Apple's tracking prompt, then ads.
  await gatherConsent(m);
  await askTrackingPermission();
  // Development builds only: adapter debug logs and an integration check in the native log
  // (look for "UnityAds" / "Adapter" lines); optionally LevelPlay's on-device test suite.
  if (__DEV__) {
    await m.LevelPlay.setAdaptersDebug(true).catch(() => {});
    if (LAUNCH_TEST_SUITE) await m.LevelPlay.setMetaData('is_test_suite', ['enable']).catch(() => {});
  }
  if (!(await initLevelPlay(m, config.appKey))) {
    adConfig.set({ ...config, showAds: false });
    return;
  }
  log('SDK initialized');
  if (__DEV__) {
    m.LevelPlay.validateIntegration().catch(() => {});
    if (LAUNCH_TEST_SUITE) m.LevelPlay.launchTestSuite().catch(() => {});
  }
  adConfig.set(config);
  loadInterstitial(m, config);
  loadRewarded(m, config);
  if (interstitial) watchAppReturn();
}
