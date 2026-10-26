import * as THREE from 'three';
import { LIGHT_POS, OBJECT_CENTER, SHADOW_CENTER, SILHOUETTE_SCALE, WALL_Z } from './constants';
import { resampleStroke, type ShapeDef } from './shapes';
import { LEVEL_SHAPES } from './tiers';
import { computeAccuracy, projectWire } from './shadowMath';

/**
 * Procedural level generation.
 *
 * For every sample point s of the 2D silhouette we cast a ray from the light
 * to where s should appear on the wall, then place the wire vertex somewhere
 * along that ray at a pseudo-random depth. Seen from the light (i.e. in the
 * shadow) the wire therefore draws the silhouette perfectly — from any other
 * angle it is a tangled golden sculpture. Finally the whole wire is expressed
 * in the local frame of a per-level target quaternion, so the solution
 * orientation is a real, arbitrary quaternion rather than "identity".
 */

export interface WireStroke {
  /** Local-space vertices, xyz-packed. */
  points: Float32Array;
  closed: boolean;
}

export interface LevelData {
  index: number; // 0-based
  number: number; // 1-based, shown in UI
  shape: ShapeDef;
  strokes: WireStroke[];
  /** All wire vertices, local space, xyz-packed (used for scoring). */
  wireSamples: Float32Array;
  /** Target silhouette samples on the wall, xy-packed (same order as wireSamples). */
  targetSamples: Float32Array;
  /** Coarser wall points for the dotted outline, xy-packed. */
  outlineDots: Float32Array;
  targetQuat: THREE.Quaternion;
  startQuat: THREE.Quaternion;
  difficulty: number; // 0..1
}

const SAMPLE_SPACING = 0.055; // in normalised shape units
const DOT_SPACING = 0.11;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomUnitVector(rand: () => number) {
  const u = rand() * 2 - 1;
  const th = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(th), s * Math.sin(th), u);
}

/** One level per shape — no repeats. */
export const LEVEL_COUNT = LEVEL_SHAPES.length;

export function generateLevel(index: number): LevelData {
  const shape = LEVEL_SHAPES[Math.min(index, LEVEL_COUNT - 1)];
  const rand = mulberry32(0x5eed + index * 7919);
  const difficulty = Math.min(1, index / (LEVEL_COUNT - 1));

  // Depth amplitude grows with difficulty → the wire looks more scrambled.
  const depthAmp = 0.32 + 0.3 * difficulty;

  const targetQuat = new THREE.Quaternion().setFromAxisAngle(
    randomUnitVector(rand),
    rand() * Math.PI * 2,
  );
  const invTarget = targetQuat.clone().invert();

  const [lx, ly, lz] = LIGHT_POS;
  const [cx, cy, cz] = OBJECT_CENTER;
  const [sx, sy] = SHADOW_CENTER;

  const strokes: WireStroke[] = [];
  const wire: number[] = [];
  const target: number[] = [];
  const dots: number[] = [];
  const v = new THREE.Vector3();

  shape.strokes.forEach((stroke, si) => {
    const samples = resampleStroke(stroke, SAMPLE_SPACING);
    const n = samples.length;
    // Smooth, loop-periodic depth profile: sum of low integer harmonics.
    const harmonics = [1, 2, 3].map((k) => ({
      k,
      amp: (rand() * 0.8 + 0.2) / k,
      phase: rand() * Math.PI * 2,
    }));
    const norm = harmonics.reduce((s, h) => s + h.amp, 0);
    const strokeOffset = (rand() - 0.5) * 0.35 * depthAmp * (si === 0 ? 0 : 1);

    const local = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = i / (stroke.closed ? n : Math.max(1, n - 1));
      let depth = 0;
      for (const h of harmonics) depth += h.amp * Math.sin(Math.PI * 2 * h.k * u + h.phase);
      depth = (depth / norm) * depthAmp + strokeOffset;

      const wx = sx + samples[i][0] * SILHOUETTE_SCALE;
      const wy = sy + samples[i][1] * SILHOUETTE_SCALE;
      // Point on ray L→W at world z = cz + depth.
      const t = (cz + depth - lz) / (WALL_Z - lz);
      v.set(lx + (wx - lx) * t - cx, ly + (wy - ly) * t - cy, lz + (WALL_Z - lz) * t - cz);
      v.applyQuaternion(invTarget);
      local[i * 3] = v.x;
      local[i * 3 + 1] = v.y;
      local[i * 3 + 2] = v.z;
      wire.push(v.x, v.y, v.z);
      target.push(wx, wy);
    }
    strokes.push({ points: local, closed: stroke.closed });

    for (const [px, py] of resampleStroke(stroke, DOT_SPACING)) {
      dots.push(sx + px * SILHOUETTE_SCALE, sy + py * SILHOUETTE_SCALE);
    }
  });

  const wireSamples = new Float32Array(wire);
  const targetSamples = new Float32Array(target);

  // Scrambled start: far enough from the solution that the shadow reads as noise.
  const minAngle = THREE.MathUtils.degToRad(70 + 40 * difficulty);
  const maxAngle = THREE.MathUtils.degToRad(115 + 50 * difficulty);
  const scratch = new Float32Array(targetSamples.length);
  let startQuat = new THREE.Quaternion();
  for (let attempt = 0; attempt < 24; attempt++) {
    const angle = minAngle + rand() * (maxAngle - minAngle);
    const offset = new THREE.Quaternion().setFromAxisAngle(randomUnitVector(rand), angle);
    startQuat = offset.multiply(targetQuat);
    projectWire(wireSamples, startQuat, scratch);
    if (computeAccuracy(scratch, targetSamples) < 0.3) break;
  }

  return {
    index,
    number: index + 1,
    shape,
    strokes,
    wireSamples,
    targetSamples,
    outlineDots: new Float32Array(dots),
    targetQuat,
    startQuat,
    difficulty,
  };
}
