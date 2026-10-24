/**
 * Sanity checks for the puzzle math. Run: npx tsx scripts/verifyMath.ts
 *  - shadow at the target quaternion reproduces the silhouette (100%)
 *  - accuracy falls off smoothly with angular error (calibration table)
 *  - every generated level starts scrambled (< 30%)
 *  - the rendered shadow matrix agrees with the scoring projection
 */
import * as THREE from 'three';
import { generateLevel } from '../src/game/levels';
import { computeAccuracy, makeShadowMatrix, projectWire } from '../src/game/shadowMath';
import { LIGHT_POS, OBJECT_CENTER, SNAP_THRESHOLD, WALL_Z } from '../src/game/constants';
import { SHAPES } from '../src/game/shapes';

let failures = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { failures++; console.log('FAIL', msg); } };

// 1. exact solution
for (let i = 0; i < 30; i++) {
  const L = generateLevel(i);
  const out = new Float32Array(L.targetSamples.length);
  projectWire(L.wireSamples, L.targetQuat, out);
  let maxErr = 0;
  for (let k = 0; k < out.length; k++) maxErr = Math.max(maxErr, Math.abs(out[k] - L.targetSamples[k]));
  check(maxErr < 1e-4, `level ${i + 1} target projection err ${maxErr}`);
  check(computeAccuracy(out, L.targetSamples) > 0.999, `level ${i + 1} target accuracy`);
}

// 2. calibration table: accuracy vs angular error, averaged over random axes & levels
const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
console.log('angle°  mean%   min%   max%');
for (const deg of [0, 2, 4, 5, 6, 8, 10, 15, 20, 30, 45, 90]) {
  const accs: number[] = [];
  for (let i = 0; i < SHAPES.length * 2; i++) {
    const L = generateLevel(i);
    const out = new Float32Array(L.targetSamples.length);
    for (let r = 0; r < 12; r++) {
      const axis = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(deg)).multiply(L.targetQuat);
      projectWire(L.wireSamples, q, out);
      accs.push(computeAccuracy(out, L.targetSamples) * 100);
    }
  }
  const mean = accs.reduce((a, b) => a + b, 0) / accs.length;
  console.log(String(deg).padStart(5), mean.toFixed(1).padStart(7), Math.min(...accs).toFixed(1).padStart(6), Math.max(...accs).toFixed(1).padStart(6));
}

// 3. scrambled starts
let worstStart = 0;
for (let i = 0; i < 60; i++) {
  const L = generateLevel(i);
  const out = new Float32Array(L.targetSamples.length);
  projectWire(L.wireSamples, L.startQuat, out);
  const a = computeAccuracy(out, L.targetSamples);
  worstStart = Math.max(worstStart, a);
  check(a < SNAP_THRESHOLD - 0.3, `level ${i + 1} start too easy: ${(a * 100).toFixed(1)}%`);
}
console.log('highest start accuracy over 60 levels:', (worstStart * 100).toFixed(1) + '%');

// 4. shadow matrix == scoring projection
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -WALL_Z);
const M = makeShadowMatrix(plane, new THREE.Vector4(...LIGHT_POS, 1));
const L = generateLevel(3);
const out = new Float32Array(L.targetSamples.length);
const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, -0.7, 0.2)).multiply(L.targetQuat);
projectWire(L.wireSamples, q, out);
const world = new THREE.Matrix4().compose(new THREE.Vector3(...OBJECT_CENTER), q, new THREE.Vector3(1, 1, 1));
const full = M.clone().multiply(world);
let mErr = 0;
for (let i = 0; i < L.wireSamples.length / 3; i++) {
  const p = new THREE.Vector4(L.wireSamples[i * 3], L.wireSamples[i * 3 + 1], L.wireSamples[i * 3 + 2], 1).applyMatrix4(full);
  mErr = Math.max(mErr, Math.abs(p.x / p.w - out[i * 2]), Math.abs(p.y / p.w - out[i * 2 + 1]), Math.abs(p.z / p.w - WALL_Z));
}
check(mErr < 1e-4, `shadow matrix mismatch ${mErr}`);
console.log('shadow-matrix vs scoring max error:', mErr.toExponential(2));
console.log('wire vertices per level:', L.wireSamples.length / 3, '| outline dots:', L.outlineDots.length / 2);
console.log(failures ? `${failures} FAILURES` : 'ALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
