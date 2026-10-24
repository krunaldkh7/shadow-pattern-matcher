import * as THREE from 'three';
import { COLORS } from '../game/constants';

/**
 * Procedural textures built from raw pixel buffers (DataTexture).
 * There is no DOM <canvas> on React Native, and these avoid shipping image
 * assets — so they load instantly and look identical on iOS and Android.
 */

function rgbaTexture(size: number, data: Uint8Array, repeat = false) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** 4×4 warm ceramic tiles with soft grout and subtle per-tile tone variation. */
export function createTileTexture(size = 512, tilesPerSide = 4) {
  const data = new Uint8Array(size * size * 4);
  const tilePx = size / tilesPerSide;
  const grout = tilePx * 0.045;
  const [tr, tg, tb] = COLORS.wallTile;
  const [gr, gg, gb] = COLORS.wallGrout;

  // Deterministic per-tile tint.
  const tint: number[] = [];
  for (let i = 0; i < tilesPerSide * tilesPerSide; i++) {
    tint.push(Math.sin(i * 12.9898) * 43758.5453 % 1);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tx = Math.floor(x / tilePx);
      const ty = Math.floor(y / tilePx);
      const lx = x - tx * tilePx;
      const ly = y - ty * tilePx;
      const edge = Math.min(lx, ly, tilePx - lx, tilePx - ly);
      const v = tint[ty * tilesPerSide + tx] * 10; // ±10 tone variation
      // Smooth bevel from grout into the glaze.
      const k = Math.min(1, Math.max(0, (edge - grout) / (grout * 1.4)));
      const bevel = 1 - (1 - k) * 0.12;
      const grain = ((x * 7 + y * 13) % 5) - 2; // micro texture
      const i = (y * size + x) * 4;
      if (edge < grout) {
        data[i] = gr; data[i + 1] = gg; data[i + 2] = gb;
      } else {
        data[i] = Math.min(255, (tr + v + grain) * bevel);
        data[i + 1] = Math.min(255, (tg + v + grain) * bevel);
        data[i + 2] = Math.min(255, (tb + v * 0.6 + grain) * bevel);
      }
      data[i + 3] = 255;
    }
  }
  return rgbaTexture(size, data, true);
}

/** White radial falloff in alpha — tinted by material color for glows/halos. */
export function createRadialGlowTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / c;
      const a = Math.max(0, 1 - d);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * a * a);
    }
  }
  const tex = rgbaTexture(size, data);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
