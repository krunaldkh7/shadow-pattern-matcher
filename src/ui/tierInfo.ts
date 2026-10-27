import type { Ionicons } from '@expo/vector-icons';
import { isLevelUnlocked, type ProgressState } from '../game/progress';
import type { Tier } from '../game/tiers';

/** Icon per tier: the light gets harsher as the gallery gets harder. */
export const TIER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  easy: 'sunny-outline',
  medium: 'partly-sunny-outline',
  hard: 'flash-outline',
  expert: 'flame-outline',
  master: 'diamond-outline',
};

export function tierStats(tier: Tier, state: ProgressState) {
  const total = tier.end - tier.start + 1;
  let solved = 0;
  let bulbs = 0;
  for (let i = tier.start; i <= tier.end; i++) {
    const r = state.levels[i];
    if (r) {
      solved++;
      bulbs += r.stars;
    }
  }
  return { total, solved, bulbs, locked: !isLevelUnlocked(state, tier.start) };
}
