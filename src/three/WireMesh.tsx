import { useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { COLORS, OBJECT_CENTER } from '../game/constants';
import type { GameEngine } from '../game/GameEngine';

interface Props {
  engine: GameEngine;
  geometry: THREE.BufferGeometry;
}

const BASE_EMISSIVE = 0.35;

/** The rotatable gold wire sculpture. Orientation is copied from the engine every frame. */
export function WireMesh({ engine, geometry }: Props) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (!group.current || !material.current) return;
    group.current.quaternion.copy(engine.quat);

    // Success: a warm emissive flare that eases back down.
    const s = engine.successProgress();
    const flare = s > 0 ? Math.sin(Math.min(1, s * 1.6) * Math.PI) : 0;
    material.current.emissiveIntensity = BASE_EMISSIVE + flare * 2.2;
  });

  return (
    <group ref={group} position={OBJECT_CENTER}>
      <mesh geometry={geometry} renderOrder={5}>
        <meshStandardMaterial
          ref={material}
          color={COLORS.gold}
          emissive={COLORS.goldEmissive}
          emissiveIntensity={BASE_EMISSIVE}
          metalness={0.78}
          roughness={0.26}
        />
      </mesh>
    </group>
  );
}

/** Translucent "ghost" of the solved pose — the visual alignment hint. */
export function GhostWire({ engine, geometry }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const opacity = useRef(0);

  useFrame((_, dt) => {
    if (!mesh.current || !material.current) return;
    const want = engine.isGhostVisible() ? 0.32 : 0;
    opacity.current += (want - opacity.current) * Math.min(1, dt * 6);
    material.current.opacity = opacity.current;
    mesh.current.visible = opacity.current > 0.01;
    mesh.current.quaternion.copy(engine.level.targetQuat);
  });

  return (
    <mesh ref={mesh} geometry={geometry} position={OBJECT_CENTER} visible={false} renderOrder={6}>
      <meshBasicMaterial
        ref={material}
        color={COLORS.ring}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
