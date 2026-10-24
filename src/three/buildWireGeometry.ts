import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WIRE_RADIAL_SEGMENTS, WIRE_RADIUS } from '../game/constants';
import type { WireStroke } from '../game/levels';

/**
 * Turns the level's wire strokes into ONE merged BufferGeometry of smooth
 * tubes (+ little solder beads on open ends). One geometry means one draw call
 * for the gold wire and one for its shadow — important on mid-range Android.
 */
export function buildWireGeometry(strokes: WireStroke[], radius = WIRE_RADIUS) {
  const parts: THREE.BufferGeometry[] = [];

  for (const stroke of strokes) {
    const n = stroke.points.length / 3;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      pts.push(new THREE.Vector3(stroke.points[i * 3], stroke.points[i * 3 + 1], stroke.points[i * 3 + 2]));
    }
    if (pts.length < 2) continue;

    const curve = new THREE.CatmullRomCurve3(pts, stroke.closed, 'centripetal');
    const segments = Math.max(16, n * 3);
    parts.push(new THREE.TubeGeometry(curve, segments, radius, WIRE_RADIAL_SEGMENTS, stroke.closed));

    if (!stroke.closed) {
      for (const p of [pts[0], pts[pts.length - 1]]) {
        const bead = new THREE.SphereGeometry(radius * 1.9, 10, 8);
        bead.translate(p.x, p.y, p.z);
        parts.push(bead);
      }
    }
  }

  // Tubes and spheres are both indexed with position/normal/uv, so they merge cleanly.
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}
