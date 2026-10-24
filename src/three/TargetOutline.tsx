import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { COLORS, LIGHTING, OUTLINE_Z_OFFSET, SHADOW_CENTER, SILHOUETTE_SCALE, WALL_Z } from '../game/constants';
import type { GameEngine } from '../game/GameEngine';
import { createRadialGlowTexture } from './textures';

interface Props {
  engine: GameEngine;
  levelKey: number;
}

const DOT_RADIUS = 0.034;

/**
 * Dotted target silhouette painted on the wall (one InstancedMesh draw call).
 * The dots warm up as accuracy rises, and flash gold on success.
 */
export function TargetOutline({ engine, levelKey }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const dots = engine.level.outlineDots;
  const count = dots.length / 2;

  const colors = useMemo(
    () => ({ base: new THREE.Color(COLORS.outline), hot: new THREE.Color(COLORS.outlineSuccess) }),
    [],
  );

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m.makeTranslation(dots[i * 2], dots[i * 2 + 1], WALL_Z + OUTLINE_Z_OFFSET);
      mesh.current.setMatrixAt(i, m);
    }
    mesh.current.count = count;
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [levelKey, count, dots]);

  useFrame(({ clock }) => {
    if (!material.current) return;
    const s = engine.successProgress();
    const warmth = s > 0 ? 1 : Math.max(0, (engine.accuracy - 0.5) / 0.45);
    material.current.color.copy(colors.base).lerp(colors.hot, warmth);
    const breathe = 0.72 + 0.18 * Math.sin(clock.elapsedTime * 2.2);
    material.current.opacity = s > 0 ? Math.max(0.15, 1 - s) : breathe;
  });

  return (
    // key forces a fresh InstancedMesh (with the right capacity) per level
    <instancedMesh key={levelKey} ref={mesh} args={[undefined, undefined, count]} renderOrder={3} frustumCulled={false}>
      <circleGeometry args={[DOT_RADIUS, 10]} />
      <meshBasicMaterial ref={material} color={COLORS.outline} transparent depthWrite={false} />
    </instancedMesh>
  );
}

/** Soft golden bloom behind the silhouette that blooms on success. */
export function WallGlow({ engine }: { engine: GameEngine }) {
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => createRadialGlowTexture(128), []);

  useFrame(() => {
    if (!material.current || !mesh.current) return;
    const s = engine.successProgress();
    const glow = s > 0 ? Math.sin(Math.min(1, s * 1.4) * Math.PI * 0.5) : engine.accuracy > 0.8 ? (engine.accuracy - 0.8) * 0.6 : 0;
    material.current.opacity = glow * LIGHTING.wallGlow;
    const scale = SILHOUETTE_SCALE * (2.6 + glow * 0.5);
    mesh.current.scale.set(scale, scale, 1);
    mesh.current.visible = glow > 0.005;
  });

  return (
    <mesh ref={mesh} position={[SHADOW_CENTER[0], SHADOW_CENTER[1], WALL_Z + 0.002]} renderOrder={1} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={material}
        map={texture}
        color={COLORS.shadowSuccess}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
