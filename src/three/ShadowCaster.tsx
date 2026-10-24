import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { COLORS, LIGHT_POS, OBJECT_CENTER, SHADOW_Z_OFFSET, WALL_Z } from '../game/constants';
import type { GameEngine } from '../game/GameEngine';
import { makeShadowMatrix } from '../game/shadowMath';

interface Props {
  engine: GameEngine;
  geometry: THREE.BufferGeometry;
}

const ONE = new THREE.Vector3(1, 1, 1);
const CENTER = new THREE.Vector3(...OBJECT_CENTER);

/**
 * Real-time hard shadow of the wire on the wall.
 *
 * Instead of a shadow map (blurry at this scale, and depth-texture support
 * varies across Android GPUs) we flatten the wire's own geometry onto the wall
 * with a planar projection matrix from the spotlight's position. It is pixel-
 * sharp, costs a single draw call, and is mathematically identical to the
 * projection used for accuracy scoring — so "what you see is what is scored".
 */
export function ShadowCaster({ engine, geometry }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);

  const { shadowMatrix, world, base, success } = useMemo(() => {
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(WALL_Z + SHADOW_Z_OFFSET));
    const light = new THREE.Vector4(LIGHT_POS[0], LIGHT_POS[1], LIGHT_POS[2], 1);
    return {
      shadowMatrix: makeShadowMatrix(plane, light),
      world: new THREE.Matrix4(),
      base: new THREE.Color(COLORS.shadow),
      success: new THREE.Color(COLORS.shadowSuccess),
    };
  }, []);

  useFrame(() => {
    if (!mesh.current || !material.current) return;
    world.compose(CENTER, engine.quat, ONE);
    mesh.current.matrix.multiplyMatrices(shadowMatrix, world);
    mesh.current.matrixWorldNeedsUpdate = true;

    // Success glow: the silhouette heats up to gold, then settles to a warm amber.
    const s = engine.successProgress();
    const heat = s > 0 ? Math.min(1, s * 3) * (0.75 + 0.25 * Math.cos(s * Math.PI * 4)) : 0;
    material.current.color.copy(base).lerp(success, heat);
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      matrixAutoUpdate={false}
      frustumCulled={false}
      renderOrder={2}
    >
      <meshBasicMaterial
        ref={material}
        color={COLORS.shadow}
        side={THREE.DoubleSide}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}
