import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { COLORS, OBJECT_CENTER } from '../game/constants';
import type { GameEngine } from '../game/GameEngine';
import { createRadialGlowTexture } from './textures';

const RING_RADIUS = 1.22;
/** Dull brass hairlines rather than neon: they read as a gimbal, not a sci-fi HUD. */
const RING_BRASS = '#8a5f22';

/**
 * Fine brass gimbal rings around the wire. They trail the object's
 * orientation with a soft lag (so rotation feels physical) and darken into
 * view while the player is dragging.
 */
export function RotationRings({ engine }: { engine: GameEngine }) {
  const gyro = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const materials = useRef<THREE.MeshBasicMaterial[]>([]);
  const glow = useRef(0);
  const haloTexture = useMemo(() => createRadialGlowTexture(128), []);

  const rings = useMemo(
    () => [
      { rotation: [Math.PI / 2, 0, 0] as const, radius: RING_RADIUS },
      { rotation: [0, Math.PI / 2, 0] as const, radius: RING_RADIUS * 1.04 },
      { rotation: [Math.PI / 3, Math.PI / 5, 0] as const, radius: RING_RADIUS * 1.08 },
    ],
    [],
  );

  useFrame(({ clock }, dt) => {
    if (!gyro.current || !spin.current) return;
    // Lagged follow of the wire orientation.
    gyro.current.quaternion.slerp(engine.quat, 1 - Math.exp(-dt * 5));
    // Slow idle precession.
    spin.current.rotation.y = clock.elapsedTime * 0.25;
    spin.current.rotation.z = Math.sin(clock.elapsedTime * 0.4) * 0.15;

    const want = engine.interacting ? 1 : engine.status === 'playing' ? 0.25 : 0;
    glow.current += (want - glow.current) * Math.min(1, dt * 6);
    const pulse = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 3);
    materials.current.forEach((m, i) => {
      m.opacity = (0.18 + glow.current * 0.4) * pulse * (i === 2 ? 0.7 : 1);
    });
    if (halo.current) halo.current.opacity = 0.1 + glow.current * 0.14;
  });

  return (
    <group position={OBJECT_CENTER}>
      {/* soft light pool behind the sculpture */}
      <mesh position={[0, 0, -1.3]} scale={[3.6, 3.6, 1]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={halo}
          map={haloTexture}
          color={COLORS.ring}
          transparent
          opacity={0.1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <group ref={gyro}>
        <group ref={spin}>
          {rings.map((r, i) => (
            <mesh key={i} rotation={r.rotation} renderOrder={7}>
              <torusGeometry args={[r.radius, 0.0055, 6, 120]} />
              <meshBasicMaterial
                ref={(m) => {
                  if (m) materials.current[i] = m;
                }}
                color={RING_BRASS}
                transparent
                opacity={0.2}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
