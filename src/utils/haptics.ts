import * as Haptics from 'expo-haptics';

/**
 * Haptic vocabulary for the game. expo-haptics maps these onto the iPhone
 * Taptic Engine and Android's vibrator / haptic constants. All calls are
 * fire-and-forget and swallow errors (e.g. simulators, devices without a motor).
 */
let enabled = true;
/** Mirrors the Settings toggle (see progress.ts). */
export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

const safe = (run: () => Promise<void>) => {
  if (enabled) run().catch(() => {});
};

export const haptics = {
  /** UI buttons: undo / reset. */
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Crossing 70% / 85% accuracy while rotating. */
  warmer: () => safe(() => Haptics.selectionAsync()),
  /** Hint used. */
  hint: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Shadow snaps into the outline. */
  snap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Level solved. */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
