import { useState } from 'react';
import { Alert } from 'react-native';
import { showRewarded, useRewardedAvailable } from '../ads/googleAds';
import type { GameEngine, UISnapshot } from '../game/GameEngine';

/**
 * How the next hint from a button is paid for. Each button has 3 free uses
 * per level — the top lightbulb uses its 3 bulbs, the bottom Hint has 3
 * ghost looks — and only once they're gone does a tap play a rewarded video:
 *  • 'free' — a free use is left; no ad is ever shown;
 *  • 'ad'   — free uses are gone; a tap plays a rewarded video (loading one if needed);
 *  • 'none' — free uses are gone and rewarded ads are switched off.
 */
export type HintMode = 'free' | 'ad' | 'none';

export function useHintAccess(engine: GameEngine, ui: UISnapshot) {
  const adsAvailable = useRewardedAvailable();
  const [busy, setBusy] = useState(false);
  const modeFor = (left: number): HintMode => (left > 0 ? 'free' : adsAvailable ? 'ad' : 'none');
  const bulbMode = modeFor(ui.bulbsLeft);
  const ghostMode = modeFor(ui.ghostsLeft);

  const request = async (mode: HintMode, use: (paidWithAd: boolean) => void) => {
    if (ui.status !== 'playing' || mode === 'none' || busy) return;
    if (mode === 'free') return use(false);
    setBusy(true);
    engine.pause();
    const result = await showRewarded();
    engine.resume();
    setBusy(false);
    if (result === 'earned') use(true);
    else if (result === 'unavailable') {
      Alert.alert('No video right now', 'A reward video couldn’t be loaded. Check your connection and try again in a moment.');
    }
  };

  return {
    bulbMode,
    ghostMode,
    /** True while a reward video is loading or playing. */
    busy,
    lightbulb: () => request(bulbMode, (paid) => engine.autoRotateHint(paid)),
    ghost: () => request(ghostMode, (paid) => engine.showGhost(paid)),
  };
}
