import {
  usePanGesture,
  useRotationGesture,
  useSimultaneousGestures,
} from 'react-native-gesture-handler';
import type { GameEngine } from '../game/GameEngine';

/**
 * Touch → rotation mapping (react-native-gesture-handler v3 hook API).
 *
 *  • One-finger drag   → trackball rotation about world X / Y (360° freedom)
 *  • Two-finger twist  → rotation about the view axis (world Z)
 *  • Release with speed → inertial spin that decays smoothly
 *
 * Callbacks run on the JS thread (`runOnJS: true`) because they mutate the
 * three.js quaternion owned by GameEngine. They only touch plain fields — no
 * React state — so 60fps dragging never re-renders the tree.
 *
 * A pinch-free twist matters in a shadow puzzle: rotation about the light axis
 * spins the silhouette in-plane, which a single-finger trackball can't do
 * precisely.
 */
export function useRotationGestures(engine: GameEngine) {
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 2,
    onBegin: () => engine.beginGesture(),
    onUpdate: (e) => engine.dragBy(e.changeX, e.changeY),
    onDeactivate: (e) => engine.endGesture(e.velocityX, e.velocityY),
    onFinalize: () => engine.releaseGesture(),
  });

  const twist = useRotationGesture({
    runOnJS: true,
    onBegin: () => engine.beginGesture(),
    onUpdate: (e) => engine.twistBy(e.rotationChange),
    onFinalize: () => engine.releaseGesture(),
  });

  return useSimultaneousGestures(pan, twist);
}
