/**
 * Scene layout + tuning constants.
 *
 * Coordinate system (three.js, right-handed, +Y up, +Z toward the camera):
 *
 *   camera (0, 0.2, 9)  ──►  looks at the wall
 *   light  (0,-3.2, 6)      warm spotlight, low & in front of the object
 *   object (0,-1.0, 1.5)    rotation pivot of the gold wire mesh
 *   wall   z = -3           tiled plane that receives the shadow
 *
 * Because the light sits below the object, the shadow is thrown UP onto the
 * wall, so on a portrait phone the object floats in the lower-centre and its
 * silhouette lands in the upper half of the screen — never occluded.
 */

export type Vec3Tuple = [number, number, number];

export const LIGHT_POS: Vec3Tuple = [0, -3.2, 6];
export const OBJECT_CENTER: Vec3Tuple = [0, -1.0, 1.5];
export const WALL_Z = -3;
export const CAMERA_POS: Vec3Tuple = [0, 0.2, 9];
export const CAMERA_TARGET: Vec3Tuple = [0, 0.15, 0];
export const CAMERA_FOV = 50;

/** Where the centre of the target silhouette sits on the wall (ray L→C hits wall here). */
export const SHADOW_CENTER: Vec3Tuple = (() => {
  const [lx, ly, lz] = LIGHT_POS;
  const [cx, cy, cz] = OBJECT_CENTER;
  const t = (WALL_Z - lz) / (cz - lz);
  return [lx + (cx - lx) * t, ly + (cy - ly) * t, WALL_Z];
})();

/** Half-size of the silhouette on the wall (normalised shapes span [-1, 1]). */
export const SILHOUETTE_SCALE = 1.45;

/** Small offsets that keep wall decals from z-fighting. */
export const SHADOW_Z_OFFSET = 0.004;
export const OUTLINE_Z_OFFSET = 0.009;

/** Wire look. */
export const WIRE_RADIUS = 0.02;
export const WIRE_RADIAL_SEGMENTS = 6;

/**
 * Snap tolerance. Accuracy is a 0..1 score of how well the cast shadow lines up
 * with the target outline (see shadowMath.computeAccuracy). The spec asks for a
 * 5–8% tolerance, so we snap at >= 93.5% (6.5% tolerance).
 */
export const SNAP_TOLERANCE = 0.065;
export const SNAP_THRESHOLD = 1 - SNAP_TOLERANCE;

/** Haptic "getting warmer" ticks (rising edge only). */
export const WARM_TICKS = [0.7, 0.85];

/** Gesture tuning. */
export const DRAG_SENSITIVITY = 0.0085; // radians per screen point
export const INERTIA_DAMPING = 5.5; // 1/s — higher = stops faster
export const MAX_INERTIA = 6; // rad/s clamp

/** Animation timings (ms). */
export const SNAP_DURATION = 380;
export const HINT_ROTATE_DURATION = 650;
export const UNDO_DURATION = 260;
export const SUCCESS_GLOW_DURATION = 1100;
export const GHOST_DURATION = 3200;

/** Palette. */
export const COLORS = {
  background: '#1b130d',
  wallTile: [214, 192, 164] as Vec3Tuple, // warm sand tile (RGB 0-255)
  wallGrout: [178, 156, 128] as Vec3Tuple,
  shadow: '#4a3a2c',
  shadowSuccess: '#e09a1e',
  outline: '#fff4e0',
  outlineSuccess: '#ffd36b',
  gold: '#d9a521',
  goldEmissive: '#3a2600',
  ring: '#ffcf6b',
  light: '#ffd9a0',
  uiText: '#fff6e8',
  uiMuted: 'rgba(255,246,232,0.62)',
  uiPanel: 'rgba(30,20,12,0.72)',
  uiAccent: '#f2b33d',
};

/**
 * Light rig (shared by the app scene and the screenshot preview).
 * Kept deliberately low on fill so the spotlight pool reads on the wall and the
 * gold success glow has contrast to work with.
 */
export const LIGHTING = {
  ambient: { color: '#ffe8cc', intensity: 0.16 },
  hemisphere: { sky: '#fff1d6', ground: '#2a1d12', intensity: 0.22 },
  spot: { intensity: 1.05, angle: 0.5, penumbra: 0.9 },
  key: { position: [3.5, 5, 7] as Vec3Tuple, color: '#fff0d0', intensity: 1.6 },
  rim: { position: [-3, -1, 4] as Vec3Tuple, color: '#ffb860', intensity: 0.7 },
  /** Peak opacity of the additive wall bloom on success. */
  wallGlow: 0.5,
};
