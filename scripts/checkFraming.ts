/** Prints where the outline and wire land on screen for common phone/tablet aspects. Run: npx tsx scripts/checkFraming.ts */
import * as THREE from 'three';
import { generateLevel } from '../src/game/levels';
import { CAMERA_FOV, CAMERA_POS, CAMERA_TARGET, OBJECT_CENTER } from '../src/game/constants';
for (const aspect of [9 / 19.5, 9 / 16, 3 / 4]) {
  const cam = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 80);
  cam.position.set(...CAMERA_POS); cam.lookAt(...CAMERA_TARGET); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  let oy = [1, -1], ox = [1, -1], wy = [1, -1], wx = [1, -1];
  for (let i = 0; i < 22; i++) {
    const L = generateLevel(i);
    for (let k = 0; k < L.outlineDots.length / 2; k++) {
      const p = new THREE.Vector3(L.outlineDots[k * 2], L.outlineDots[k * 2 + 1], -3).project(cam);
      oy = [Math.min(oy[0], p.y), Math.max(oy[1], p.y)]; ox = [Math.min(ox[0], p.x), Math.max(ox[1], p.x)];
    }
    for (const q of [L.startQuat, L.targetQuat]) for (let k = 0; k < L.wireSamples.length / 3; k++) {
      const p = new THREE.Vector3(L.wireSamples[k * 3], L.wireSamples[k * 3 + 1], L.wireSamples[k * 3 + 2]).applyQuaternion(q).add(new THREE.Vector3(...OBJECT_CENTER)).project(cam);
      wy = [Math.min(wy[0], p.y), Math.max(wy[1], p.y)]; wx = [Math.min(wx[0], p.x), Math.max(wx[1], p.x)];
    }
  }
  // NDC y → screen % from top
  const pct = (y: number) => (((1 - y) / 2) * 100).toFixed(0) + '%';
  console.log(`aspect ${aspect.toFixed(2)}: outline top ${pct(oy[1])}..bottom ${pct(oy[0])}, x ${ox[0].toFixed(2)}..${ox[1].toFixed(2)} | wire top ${pct(wy[1])}..bottom ${pct(wy[0])}, x ${wx[0].toFixed(2)}..${wx[1].toFixed(2)}`);
}
