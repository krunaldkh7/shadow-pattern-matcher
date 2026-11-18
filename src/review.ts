import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { track } from './analytics/analytics';
import { progress } from './game/progress';

/**
 * Ask for an App Store / Play rating at a happy moment: tapping "Next level"
 * after a solve, once the player has finished enough levels to know they like
 * the game. Asked at most once every ASK_EVERY_DAYS (Apple also caps the
 * system prompt at 3 a year and may silently skip it).
 */
const MIN_SOLVED = 8;
const ASK_EVERY_DAYS = 120;
const KEY = 'review.lastAskedAt';

/** Loaded at startup; null until known, so we never ask before we know. */
let lastAskedAt: number | null = null;
AsyncStorage.getItem(KEY)
  .then((v) => {
    lastAskedAt = v ? Number(v) || 0 : 0;
  })
  .catch(() => {
    lastAskedAt = null;
  });

/**
 * Call on "Next level". Returns true when the rating prompt is being shown,
 * so the caller can skip a full-screen ad on the same tap.
 */
export function maybeAskForReview(): boolean {
  if (process.env.EXPO_PUBLIC_SCREENSHOTS === '1' || lastAskedAt === null) return false;
  if (Object.keys(progress.get().levels).length < MIN_SOLVED) return false;
  if (Date.now() - lastAskedAt < ASK_EVERY_DAYS * 86_400_000) return false;
  lastAskedAt = Date.now();
  AsyncStorage.setItem(KEY, String(lastAskedAt)).catch(() => {});
  StoreReview.isAvailableAsync()
    .then((ok) => {
      if (!ok) return;
      track('review_prompt');
      return StoreReview.requestReview();
    })
    .catch(() => {});
  return true;
}
