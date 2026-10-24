import { useSyncExternalStore } from 'react';
import type { GameEngine, UISnapshot } from '../game/GameEngine';

/** Subscribe a React component to the engine's throttled UI snapshot. */
export function useGameUI(engine: GameEngine): UISnapshot {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}
