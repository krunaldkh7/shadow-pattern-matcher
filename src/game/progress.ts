import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { LEVEL_COUNT } from './levels';
import { pointsFor } from './points';
import { TIERS } from './tiers';

/**
 * Saved player progress + settings, persisted as one small JSON file in the
 * app's document directory. Reads once at startup (sync), writes on change.
 */

export interface LevelRecord {
  stars: number; // best 1..3 (0 when only skipped)
  /** Skipped with a reward video rather than solved; solving it later clears this. */
  skipped?: boolean;
  bestSeconds: number;
  /** Best points earned on this level (see points.ts); absent in older saves. */
  points?: number;
}

export interface ProgressState {
  /** Highest 0-based level index the player may open. */
  unlocked: number;
  levels: Record<number, LevelRecord>;
  hapticsEnabled: boolean;
  seenTutorial: boolean;
  /** Name shown on the global leaderboard; empty until the player picks one. */
  playerName: string;
}

const DEFAULT: ProgressState = { unlocked: 0, levels: {}, hapticsEnabled: true, seenTutorial: false, playerName: '' };

const file = new File(Paths.document, 'progress.json');

function load(): ProgressState {
  try {
    if (!file.exists) return { ...DEFAULT };
    return { ...DEFAULT, ...(JSON.parse(file.textSync()) as Partial<ProgressState>) };
  } catch {
    return { ...DEFAULT };
  }
}

let state = load();
const listeners = new Set<() => void>();

function commit(next: ProgressState) {
  state = next;
  try {
    file.writeSync(JSON.stringify(state));
  } catch {
    // Storage full / unavailable: keep playing with in-memory progress.
  }
  listeners.forEach((l) => l());
}

export const progress = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  recordWin(index: number, stars: number, seconds: number) {
    const prev = state.levels[index];
    const record: LevelRecord = {
      stars: Math.max(prev?.stars ?? 0, stars),
      bestSeconds: prev && !prev.skipped ? Math.min(prev.bestSeconds, seconds) : seconds,
      points: Math.max(prev && !prev.skipped ? levelPoints(prev) : 0, pointsFor(stars, seconds)),
    };
    commit({
      ...state,
      levels: { ...state.levels, [index]: record },
      unlocked: Math.min(LEVEL_COUNT - 1, Math.max(state.unlocked, index + 1)),
    });
  },

  /** Skipped with a reward video: opens the next level; never overwrites a real solve. */
  recordSkip(index: number) {
    if (state.levels[index]) return;
    commit({
      ...state,
      levels: { ...state.levels, [index]: { stars: 0, bestSeconds: 0, skipped: true } },
      unlocked: Math.min(LEVEL_COUNT - 1, Math.max(state.unlocked, index + 1)),
    });
  },

  setPlayerName(name: string) {
    commit({ ...state, playerName: name.trim() });
  },

  setHaptics(enabled: boolean) {
    commit({ ...state, hapticsEnabled: enabled });
  },

  markTutorialSeen() {
    if (!state.seenTutorial) commit({ ...state, seenTutorial: true });
  },

  reset() {
    commit({ ...DEFAULT, hapticsEnabled: state.hapticsEnabled, seenTutorial: true, playerName: state.playerName });
  },
};

/** TESTING ONLY: opens every level without touching saved progress. Set back to false before release. */
export const UNLOCK_ALL_LEVELS = false;

/**
 * Every gallery's first level is always open; after that a level opens once
 * the one before it is solved. `unlocked` still covers progress saved before
 * this rule existed.
 */
export function isLevelUnlocked(s: ProgressState, index: number) {
  if (UNLOCK_ALL_LEVELS || index <= s.unlocked) return true;
  return TIERS.some((t) => t.start === index) || !!s.levels[index - 1];
}

/** Points a level is worth on the leaderboard (older saves are scored from their bulbs and time). */
export function levelPoints(r: LevelRecord) {
  if (r.skipped) return 0;
  return r.points ?? pointsFor(r.stars, r.bestSeconds);
}

export function totalPoints(s: ProgressState) {
  return Object.values(s.levels).reduce((sum, l) => sum + levelPoints(l), 0);
}

export function totalStars(s: ProgressState) {
  return Object.values(s.levels).reduce((sum, l) => sum + l.stars, 0);
}

/** Index of the level "Continue" should open: the first unsolved level that is open. */
export function continueIndex(s: ProgressState) {
  for (let i = 0; i < LEVEL_COUNT; i++) if (!s.levels[i] && isLevelUnlocked(s, i)) return i;
  return 0;
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(progress.subscribe, progress.get, progress.get);
}
