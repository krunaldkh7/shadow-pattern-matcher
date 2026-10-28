import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import type { ShapeDef, Stroke } from './shapes';

/**
 * Levels the player draws themselves. Each is a shape (strokes in the same
 * normalised [-1, 1] box as the gallery shapes) plus the best result, saved
 * as one JSON file next to progress.json.
 */

export interface CustomLevel {
  id: string;
  name: string;
  strokes: Stroke[];
  createdAt: number;
  /** Best result so far, if solved. */
  best?: { stars: number; seconds: number };
}

const file = new File(Paths.document, 'custom-levels.json');

function load(): CustomLevel[] {
  try {
    if (!file.exists) return [];
    const parsed = JSON.parse(file.textSync());
    return Array.isArray(parsed) ? (parsed as CustomLevel[]) : [];
  } catch {
    return [];
  }
}

let levels = load();
const listeners = new Set<() => void>();

function commit(next: CustomLevel[]) {
  levels = next;
  try {
    file.writeSync(JSON.stringify(levels));
  } catch {
    // Storage unavailable: keep the levels for this session.
  }
  listeners.forEach((l) => l());
}

export const customLevels = {
  get: () => levels,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  find: (id: string) => levels.find((l) => l.id === id),

  add(name: string, strokes: Stroke[]): CustomLevel {
    const level: CustomLevel = {
      id: `custom-${Date.now().toString(36)}`,
      name: name.trim() || 'My shape',
      strokes,
      createdAt: Date.now(),
    };
    commit([level, ...levels]);
    return level;
  },

  remove(id: string) {
    commit(levels.filter((l) => l.id !== id));
  },

  recordWin(id: string, stars: number, seconds: number) {
    commit(
      levels.map((l) =>
        l.id !== id
          ? l
          : {
              ...l,
              best: {
                stars: Math.max(l.best?.stars ?? 0, stars),
                seconds: l.best ? Math.min(l.best.seconds, seconds) : seconds,
              },
            },
      ),
    );
  },
};

export function toShape(level: CustomLevel): ShapeDef {
  return { id: level.id, name: level.name, strokes: level.strokes };
}

export function useCustomLevels(): CustomLevel[] {
  return useSyncExternalStore(customLevels.subscribe, customLevels.get, customLevels.get);
}
