import { useMemo } from 'react';
import * as THREE from 'three';
import { WALL_Z } from '../game/constants';
import { createTileTexture } from './textures';

const WALL_SIZE = 32;
const TILE_WORLD_SIZE = 0.95; // world units per tile

/** Clean, warm-toned tiled wall that receives the shadow. */
export function TiledWall() {
  const texture = useMemo(() => {
    const t = createTileTexture(512, 4);
    const repeats = WALL_SIZE / (TILE_WORLD_SIZE * 4);
    t.repeat.set(repeats, repeats);
    t.anisotropy = 4;
    return t;
  }, []);

  return (
    <mesh position={[0, 0, WALL_Z]} renderOrder={0}>
      <planeGeometry args={[WALL_SIZE, WALL_SIZE]} />
      <meshStandardMaterial map={texture} roughness={0.82} metalness={0} side={THREE.FrontSide} />
    </mesh>
  );
}
