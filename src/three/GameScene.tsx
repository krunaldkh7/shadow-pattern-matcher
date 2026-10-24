import { useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import {
  CAMERA_FOV,
  CAMERA_POS,
  CAMERA_TARGET,
  COLORS,
  LIGHT_POS,
  LIGHTING,
  SHADOW_CENTER,
} from '../game/constants';
import type { GameEngine } from '../game/GameEngine';
import { useGameUI } from '../hooks/useGameUI';
import { buildWireGeometry } from './buildWireGeometry';
import { RotationRings } from './RotationRings';
import { ShadowCaster } from './ShadowCaster';
import { TargetOutline, WallGlow } from './TargetOutline';
import { TiledWall } from './TiledWall';
import { GhostWire, WireMesh } from './WireMesh';

/** Drives the engine from the render loop (negative priority = runs before readers). */
function EngineTicker({ engine }: { engine: GameEngine }) {
  useFrame((_, dt) => engine.tick(Math.min(dt, 1 / 20)), -1);
  return null;
}

function CameraRig() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(...CAMERA_TARGET);
  }, [camera]);
  return null;
}

function Lights() {
  const spotTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...SHADOW_CENTER);
    return o;
  }, []);

  return (
    <>
      <primitive object={spotTarget} />
      <ambientLight color={LIGHTING.ambient.color} intensity={LIGHTING.ambient.intensity} />
      <hemisphereLight
        args={[LIGHTING.hemisphere.sky, LIGHTING.hemisphere.ground, LIGHTING.hemisphere.intensity]}
      />
      {/* The shadow-casting spotlight (warm, low, in front). */}
      <spotLight
        position={LIGHT_POS}
        target={spotTarget}
        color={COLORS.light}
        intensity={LIGHTING.spot.intensity}
        angle={LIGHTING.spot.angle}
        penumbra={LIGHTING.spot.penumbra}
        decay={0}
        distance={0}
      />
      {/* Key light to give the gold specular sparkle. */}
      <directionalLight position={LIGHTING.key.position} color={LIGHTING.key.color} intensity={LIGHTING.key.intensity} />
      <pointLight
        position={LIGHTING.rim.position}
        color={LIGHTING.rim.color}
        intensity={LIGHTING.rim.intensity}
        decay={0}
        distance={0}
      />
    </>
  );
}

function SceneContents({ engine }: { engine: GameEngine }) {
  const { levelNumber } = useGameUI(engine);

  // Rebuild the wire only when the level changes (pure function of the level).
  const geometry = useMemo(
    () => buildWireGeometry(engine.level.strokes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelNumber, engine.level],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <>
      <color attach="background" args={[COLORS.background]} />
      <CameraRig />
      <EngineTicker engine={engine} />
      <Lights />
      <TiledWall />
      <WallGlow engine={engine} />
      <ShadowCaster engine={engine} geometry={geometry} />
      <TargetOutline engine={engine} levelKey={levelNumber} />
      <RotationRings engine={engine} />
      <WireMesh engine={engine} geometry={geometry} />
      <GhostWire engine={engine} geometry={geometry} />
    </>
  );
}

/**
 * The 3D viewport. `@react-three/fiber/native` renders through expo-gl's
 * GLView, which sits on OpenGL ES on Android and on Apple's GL→Metal layer
 * on iOS. `flat` disables tone mapping so the warm palette renders exactly
 * as specified.
 */
export function GameScene({ engine }: { engine: GameEngine }) {
  return (
    <Canvas
      flat
      camera={{ position: CAMERA_POS, fov: CAMERA_FOV, near: 0.1, far: 80 }}
      gl={{ antialias: true }}
      style={{ flex: 1 }}
    >
      <SceneContents engine={engine} />
    </Canvas>
  );
}
