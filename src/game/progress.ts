import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { LEVEL_COUNT } from './levels';

/**
 * Saved player progress + settings, persisted as one small JSON file in the
 * app's document directory. Reads once at startup (sync), writes on change.
 */

export interface LevelRecord {
  stars: number; // best 1..3
  bestSeconds: number;
}

export interface ProgressState {
  /** Highest 0-based level index the player may open. */
  unlocked: number;
  levels: Record<number, LevelRecord>;
  hapticsEnabled: boolean;
  seenTutorial: boolean;
}

const DEFAULT: ProgressState = { unlocked: 0, levels: {}, hapticsEnabled: true, seenTutorial: false };

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
      bestSeconds: prev ? Math.min(prev.bestSeconds, seconds) : seconds,
    };
    commit({
      ...state,
      levels: { ...state.levels, [index]: record },
      unlocked: Math.min(LEVEL_COUNT - 1, Math.max(state.unlocked, index + 1)),
    });
  },

  setHaptics(enabled: boolean) {
    commit({ ...state, hapticsEnabled: enabled });
  },

  markTutorialSeen() {
    if (!state.seenTutorial) commit({ ...state, seenTutorial: true });
  },

  reset() {
    commit({ ...DEFAULT, hapticsEnabled: state.hapticsEnabled, seenTutorial: true });
  },
};

export function totalStars(s: ProgressState) {
  return Object.values(s.levels).reduce((sum, l) => sum + l.stars, 0);
}

/** Index of the level "Continue" should open: the first unsolved unlocked one. */
export function continueIndex(s: ProgressState) {
  for (let i = 0; i <= s.unlocked; i++) if (!s.levels[i]) return i;
  return s.unlocked;
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(progress.subscribe, progress.get, progress.get);
}
