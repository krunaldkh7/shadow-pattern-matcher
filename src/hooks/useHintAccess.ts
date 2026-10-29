import { useState } from 'react';
import { Alert } from 'react-native';
import { showInterstitialForHint, useInterstitialAvailable } from '../ads/googleAds';
import { track } from '../analytics/analytics';
import type { GameEngine, UISnapshot } from '../game/GameEngine';

/**
 * How the next hint from a button is paid for. Each button has 3 free uses
 * per level — the top lightbulb uses its 3 bulbs, the bottom Hint has 3
 * ghost looks — and only once they're gone does a tap play an interstitial ad:
 *  • 'free' — a free use is left; no ad is ever shown;
 *  • 'ad'   — free uses are gone; a tap plays an interstitial (loading one if needed), then gives the hint;
 *  • 'none' — free uses are gone and interstitials are switched off.
 */
export type HintMode = 'free' | 'ad' | 'none';

export function useHintAccess(engine: GameEngine, ui: UISnapshot) {
  const adsAvailable = useInterstitialAvailable();
  const [busy, setBusy] = useState(false);
  const modeFor = (left: number): HintMode => (left > 0 ? 'free' : adsAvailable ? 'ad' : 'none');
  const bulbMode = modeFor(ui.bulbsLeft);
  const ghostMode = modeFor(ui.ghostsLeft);

  const request = async (kind: 'bulb' | 'ghost', mode: HintMode, apply: (paidWithAd: boolean) => void) => {
    if (ui.status !== 'playing' || mode === 'none' || busy) return;
    if (mode === 'free') {
      track('hint_used', { kind, paid: false });
      return apply(false);
    }
    setBusy(true);
    engine.pause();
    const result = await showInterstitialForHint();
    engine.resume();
    setBusy(false);
    if (result === 'earned') {
      track('hint_used', { kind, paid: true });
      apply(true);
    }
    else if (result === 'unavailable') {
      Alert.alert('No ad right now', 'An ad couldn’t be loaded for this hint. Check your connection and try again in a moment.');
    }
  };

  return {
    bulbMode,
    ghostMode,
    /** True while the hint's ad is loading or playing. */
    busy,
    lightbulb: () => request('bulb', bulbMode, (paid) => engine.autoRotateHint(paid)),
    ghost: () => request('ghost', ghostMode, (paid) => engine.showGhost(paid)),
  };
}
