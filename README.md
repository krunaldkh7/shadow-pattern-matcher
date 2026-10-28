# Shadow Pattern Matcher

A pure, ad-free 3D shadow puzzle for **iOS and Android**, built with Expo + React Three Fiber.
Rotate a floating gold wire sculpture until the spotlight casts its shadow exactly onto the dotted silhouette on the wall.

## Run it

```bash
npm install
npx expo start          # scan the QR code with Expo Go (iOS / Android)
```

Everything used here (expo-gl, gesture handler, reanimated, haptics) ships in Expo Go, so no native build is needed to play.
## Build an APK (Android)

Build in Expo's cloud (no Android SDK needed). Needs a free Expo account.

```bash
npm install
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

When it finishes, EAS shows a download link and a QR code for the `.apk`. For the Play Store, use `--profile production`, which makes an `.aab`.

Before publishing, change `com.yourstudio.shadowpatternmatcher` in `app.json` to your own package name. The local APK is signed with the debug key, which is fine for testing on phones but not for the Play Store.

```bash
npm run typecheck       # tsc --noEmit
npm run verify          # math + geometry self-tests (no device needed)
npx tsx scripts/checkFraming.ts   # where the outline / wire land on screen
```

## Stack (Expo SDK 58)

| Concern | Package |
|---|---|
| App framework | `expo` 58, React Native 0.88, React 19.3 |
| 3D | `three` 0.186 + `@react-three/fiber/native` 9 |
| GL context | `expo-gl` (R3F native creates the GLView for you) |
| Touch | `react-native-gesture-handler` 3 (hook API: `usePanGesture`, `useRotationGesture`) |
| Animation | `react-native-reanimated` 4 (+ `react-native-worklets`) |
| Haptics | `expo-haptics` |
| Type | `@expo-google-fonts/urbanist` (via `expo-font`) |

`expo-three` is intentionally **not** used: R3F native already handles the expo-gl context and asset loading, and expo-three pins its own `three` version, which causes duplicate-three bugs.

## Project structure

```
App.tsx                         GestureHandlerRootView + SafeAreaProvider + GameScreen
src/
  game/                         ── pure TypeScript, no React ──
    constants.ts                scene layout (light, pivot, wall), tolerance, palette, timings
    shapes.ts                   silhouettes as 2D polylines (cat, heart, fish, house, …) + resampler
    levels.ts                   procedural level builder: wire vertices on light rays, target/start quaternions
    shadowMath.ts               wall projection, accuracy score, planar shadow matrix
    GameEngine.ts               mutable game state: rotation, inertia, undo, hints, snap, success; UI store
  hooks/
    useRotationGestures.ts      pan → trackball X/Y, two-finger twist → Z, fling inertia
    useGameUI.ts                useSyncExternalStore binding to the engine's throttled snapshot
  three/                        ── R3F scene ──
    GameScene.tsx               <Canvas>, camera, lights, engine ticker
    WireMesh.tsx                gold wire + translucent "ghost" hint
    ShadowCaster.tsx            real-time planar shadow (+ success heat glow)
    TargetOutline.tsx           dotted silhouette (InstancedMesh) + wall bloom
    RotationRings.tsx           lagging gyroscope rings + halo
    TiledWall.tsx               warm ceramic tiled wall
    buildWireGeometry.ts        merged tube geometry (1 draw call)
    textures.ts                 procedural DataTextures (tiles, radial glow) — no image assets
  ui/
    screens/GameScreen.tsx      composition root
    components/Header.tsx       piece number, live match reading, lightbulb
    components/ControlBar.tsx   Undo · Reset · Hint
    components/DragHint.tsx     "Drag to Rotate" coach mark
    components/LevelCompleteOverlay.tsx   pinned museum placard
    components/IconButton.tsx   ink-ring button
    theme.ts                    ink palette + fonts
  utils/haptics.ts              haptic vocabulary (tap, warmer, hint, snap, success)
scripts/                        verifyMath.ts, verifyGeometry.ts, checkFraming.ts
```

## How the puzzle works

**Building a level.** Every silhouette point is mapped to the wall, then a ray is cast from the light to that wall point. The wire vertex is placed somewhere *along that ray* at a smooth pseudo-random depth. Seen from the light, the wire draws the silhouette perfectly; from anywhere else it's a tangled sculpture. The wire is then expressed in the frame of a random per-level **target quaternion**, and the level starts at a scrambled quaternion 70°–165° away (always below 30% accuracy).

**Shadow.** The spotlight is modelled as a point light. The shadow is the wire's own geometry flattened onto the wall by a planar projection matrix — pixel-sharp, one draw call, and works on every mobile GPU (no shadow maps or depth textures). The same projection is used for scoring, so what the player sees is exactly what is scored.

**Accuracy.** Each frame the wire's vertices are projected to the wall and compared with the target outline using a symmetric chamfer distance (mean nearest-neighbour both ways), normalised by silhouette size and passed through a Gaussian curve. Because it compares *shapes*, symmetric silhouettes (heart, star, tree) count as solved from any pose whose shadow genuinely matches. Calibrated results (`npm run verify`):

| Angular error | 0° | 2° | 5° | 10° | 20° | 45° | 90° |
|---|---|---|---|---|---|---|---|
| Mean accuracy | 100% | 98% | 94% | 83% | 60% | 23% | 14% |

**Snap.** At ≥ 93.5% (6.5% tolerance, inside the 5–8% spec) input locks, the mesh glides into the exact target quaternion (ease-out), the heavy haptic fires, the shadow and outline heat to gold with a wall bloom, the success haptic fires, and the completion card springs in.

## Visual identity

The game is presented as a piece hung in a small gallery rather than a generic game HUD:

- **Ink on the wall.** The header and controls have no panels or glass: they are written straight onto the tiles in the same warm brown as the cast shadow (`src/ui/theme.ts`). Buttons are thin ink rings.
- **Dotted meter.** The accuracy meter is a row of 20 dots, the same dots that draw the target outline, filling with ink as the shadow lines up.
- **The placard.** On a solve, nothing dims. The gold silhouette stays in view and a museum wall label is pinned up below it: card stock, a brass pin, a slight tilt, the piece's title, how long it took, and three bulbs (one switches off per hint used).
- **Type.** Urbanist throughout, using weight (500 / 600 / 700) for hierarchy, all in sentence case.

## Controls

- **Drag** – rotate about the screen's X/Y axes (full 360°), with fling inertia
- **Two-finger twist** – spin about the view axis (needed to rotate the silhouette in-plane)
- **Lightbulb** – auto-rotates 50% of the remaining way to the solution
- **Hint** – shows a translucent ghost of the solved pose for 3 s
- **Undo** – reverts the last gesture (40-step history); **Reset** – back to the level's start pose
- Bulbs on the placard: 3 with no hints, one switches off per hint. Levels are infinite and get harder (deeper wire scramble, larger start offset).

## Tuning

All knobs are in `src/game/constants.ts`: `SNAP_TOLERANCE`, `DRAG_SENSITIVITY`, `INERTIA_DAMPING`, light / wall / pivot positions, colours and animation timings. Add a silhouette by appending a `ShapeDef` to `SHAPES` in `shapes.ts` — the wire, outline and scoring are all generated from it.

## Ideas for next steps

- Persist the current level with `expo-sqlite/kv-store` or AsyncStorage
- Level-select screen and per-level best stars
- Sound effects with `expo-audio` on snap / success
