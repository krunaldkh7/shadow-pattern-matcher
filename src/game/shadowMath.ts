import * as THREE from 'three';
import { LIGHT_POS, OBJECT_CENTER, SILHOUETTE_SCALE, WALL_Z } from './constants';

/**
 * Shadow + accuracy math. Pure functions over plain Float32Arrays so the hot
 * path (run every frame) allocates nothing.
 *
 * The spotlight is treated as a point light at LIGHT_POS. A world point P casts
 * its shadow where the ray L→P meets the wall plane z = WALL_Z:
 *
 *     S = L + (P - L) · (WALL_Z - Lz) / (Pz - Lz)
 *
 * The same projection drives the rendered planar shadow (makeShadowMatrix),
 * so what the player sees and what we score are identical.
 */

const [LX, LY, LZ] = LIGHT_POS;
const [CX, CY, CZ] = OBJECT_CENTER;

/** Project a world point onto the wall. Writes x, y into `out` at `offset`. */
export function projectToWall(px: number, py: number, pz: number, out: Float32Array, offset: number) {
  const t = (WALL_Z - LZ) / (pz - LZ);
  out[offset] = LX + (px - LX) * t;
  out[offset + 1] = LY + (py - LY) * t;
}

const _v = new THREE.Vector3();

/**
 * Project every local-space wire vertex (rotated by `q`, then translated to the
 * pivot) onto the wall. `local` is xyz-packed, `out` is xy-packed.
 */
export function projectWire(local: Float32Array, q: THREE.Quaternion, out: Float32Array) {
  const n = local.length / 3;
  for (let i = 0; i < n; i++) {
    _v.set(local[i * 3], local[i * 3 + 1], local[i * 3 + 2]).applyQuaternion(q);
    projectToWall(_v.x + CX, _v.y + CY, _v.z + CZ, out, i * 2);
  }
}

/** Mean nearest-neighbour distance from every point of A to the set B (xy-packed). */
function meanNearest(a: Float32Array, b: Float32Array): number {
  const na = a.length / 2;
  const nb = b.length / 2;
  let sum = 0;
  for (let i = 0; i < na; i++) {
    const ax = a[i * 2];
    const ay = a[i * 2 + 1];
    let best = Infinity;
    for (let j = 0; j < nb; j++) {
      const dx = ax - b[j * 2];
      const dy = ay - b[j * 2 + 1];
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    sum += Math.sqrt(best);
  }
  return sum / na;
}

/**
 * Accuracy score in 0..1.
 *
 * We compare the *shapes*, not vertex IDs: a symmetric chamfer distance between
 * the cast shadow samples and the target outline samples. That means a
 * symmetric silhouette (heart, star, tree) counts as solved from ANY
 * orientation whose shadow genuinely matches — exactly what the player sees.
 *
 * The error is normalised by the silhouette size and mapped through a Gaussian
 * falloff, calibrated with scripts/verifyMath.ts so that on average:
 *   0° off → 100%   ~5° off → ~94% (snap zone)   ~20° off → ~60%   90° off → ~12%
 * The curve is flat near the solution (fine-tuning feels rewarding) and steep
 * in the middle (the % reacts clearly while you search).
 */
export const ACCURACY_FALLOFF = 0.125;

export function computeAccuracy(shadow: Float32Array, target: Float32Array): number {
  const err = 0.5 * (meanNearest(shadow, target) + meanNearest(target, shadow));
  const normalised = err / SILHOUETTE_SCALE;
  const x = normalised / ACCURACY_FALLOFF;
  return Math.exp(-x * x);
}

/**
 * Classic planar-shadow matrix: flattens geometry onto `plane` as seen from a
 * point light. Rendered with a flat material it gives a crisp, hard-edged
 * spotlight shadow that costs one extra draw call and works on every mobile
 * GPU (no shadow-map / depth-texture support required).
 */
export function makeShadowMatrix(plane: THREE.Plane, light: THREE.Vector4, out = new THREE.Matrix4()) {
  const n = plane.normal;
  const pl = [n.x, n.y, n.z, plane.constant];
  const lt = [light.x, light.y, light.z, light.w];
  const dot = pl[0] * lt[0] + pl[1] * lt[1] + pl[2] * lt[2] + pl[3] * lt[3];
  const e = out.elements; // column-major
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      e[col * 4 + row] = (row === col ? dot : 0) - lt[row] * pl[col];
    }
  }
  return out;
}

/** Angle (radians) between two orientations. */
export function quaternionAngle(a: THREE.Quaternion, b: THREE.Quaternion): number {
  const d = Math.min(1, Math.abs(a.dot(b)));
  return 2 * Math.acos(d);
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
