import * as THREE from 'three';
import {
  DRAG_SENSITIVITY,
  GHOST_DURATION,
  HINT_ROTATE_DURATION,
  INERTIA_DAMPING,
  MAX_INERTIA,
  SNAP_DURATION,
  SNAP_THRESHOLD,
  SUCCESS_GLOW_DURATION,
  UNDO_DURATION,
  WARM_TICKS,
} from './constants';
import { generateLevel, LEVEL_COUNT, type LevelData } from './levels';
import { computeAccuracy, easeInOutCubic, easeOutCubic, projectWire } from './shadowMath';
import { haptics } from '../utils/haptics';

/**
 * GameEngine — the single mutable source of truth for a play session.
 *
 * Hot state (the quaternion, inertia, animations) lives on plain fields and is
 * mutated from gesture callbacks + the R3F frame loop, so dragging never causes
 * a React re-render. React UI subscribes to a small, throttled `UISnapshot`
 * through useSyncExternalStore (see useGameUI).
 */

export type GameStatus = 'playing' | 'snapping' | 'success' | 'complete';

export interface UISnapshot {
  levelNumber: number;
  shapeName: string;
  accuracy: number; // integer percent 0..100
  status: GameStatus;
  canUndo: boolean;
  ghostVisible: boolean;
  interacted: boolean;
  hintsUsed: number;
  stars: number; // 1..3 after completion
  /** Bulbs left out of 3 (each hint switches one off). */
  bulbsLeft: number;
  /** Seconds from level start to the snap (0 while playing). */
  solveSeconds: number;
}

type AnimKind = 'snap' | 'hint' | 'undo' | 'reset';

interface RotationAnim {
  kind: AnimKind;
  from: THREE.Quaternion;
  to: THREE.Quaternion;
  start: number;
  duration: number;
}

const MAX_HISTORY = 40;
const UI_INTERVAL_MS = 66; // ~15 Hz is plenty for a % readout

const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

export class GameEngine {
  level!: LevelData;
  /** Current orientation of the wire mesh. Read every frame by <WireMesh/>. */
  readonly quat = new THREE.Quaternion();
  accuracy = 0;
  status: GameStatus = 'playing';

  private history: THREE.Quaternion[] = [];
  private anim: RotationAnim | null = null;
  private inertia = { x: 0, y: 0 };
  private dragging = false;
  private projected = new Float32Array(0);
  private hintsUsed = 0;
  private interacted = false;
  private ghostUntil = 0;
  private successAt = 0;
  private startedAt = 0;
  private pausedAt = 0;
  private solvedAt = 0;
  private warmTick = 0;
  private lastUIEmit = 0;

  private snapshot: UISnapshot;
  private listeners = new Set<() => void>();

  constructor(startLevel = 0) {
    this.loadLevel(startLevel);
    this.snapshot = this.buildSnapshot();
  }

  // ───────────────────────────── level flow ─────────────────────────────

  loadLevel(index: number) {
    this.level = generateLevel(index);
    this.quat.copy(this.level.startQuat);
    this.projected = new Float32Array(this.level.targetSamples.length);
    this.history = [];
    this.anim = null;
    this.inertia.x = this.inertia.y = 0;
    this.hintsUsed = 0;
    this.interacted = false;
    this.ghostUntil = 0;
    this.successAt = 0;
    this.startedAt = Date.now();
    this.pausedAt = 0;
    this.solvedAt = 0;
    this.warmTick = 0;
    this.status = 'playing';
    this.updateAccuracy();
    this.emit(true);
  }

  get isLastLevel() {
    return this.level.index >= LEVEL_COUNT - 1;
  }

  nextLevel() {
    if (!this.isLastLevel) this.loadLevel(this.level.index + 1);
  }

  /** Pause menu open: stop the solve clock (resume shifts the start forward). */
  pause() {
    if (!this.pausedAt) this.pausedAt = Date.now();
  }

  resume() {
    if (!this.pausedAt) return;
    this.startedAt += Date.now() - this.pausedAt;
    this.pausedAt = 0;
  }

  replayLevel() {
    this.loadLevel(this.level.index);
  }

  // ───────────────────────────── gestures ─────────────────────────────

  beginGesture() {
    if (this.status !== 'playing') return;
    this.cancelAnim();
    this.inertia.x = this.inertia.y = 0;
    // Pan + twist can both begin for one touch sequence: record history once.
    if (!this.dragging) this.pushHistory();
    this.dragging = true;
    if (!this.interacted) {
      this.interacted = true;
      this.emit(true);
    }
  }

  /** Pan: screen dx/dy (points) → rotation about world Y / X. */
  dragBy(dx: number, dy: number) {
    if (this.status !== 'playing') return;
    this.rotateWorld(dy * DRAG_SENSITIVITY, dx * DRAG_SENSITIVITY, 0);
  }

  /** Two-finger twist (radians, clockwise-positive on screen) → world Z. */
  twistBy(radians: number) {
    if (this.status !== 'playing') return;
    this.rotateWorld(0, 0, -radians);
  }

  /** Release after an active drag: carry the fling velocity (points/s) as decaying spin. */
  endGesture(velocityX = 0, velocityY = 0) {
    this.dragging = false;
    if (this.status !== 'playing') return;
    const clamp = (v: number) => Math.max(-MAX_INERTIA, Math.min(MAX_INERTIA, v));
    this.inertia.x = clamp(velocityY * DRAG_SENSITIVITY);
    this.inertia.y = clamp(velocityX * DRAG_SENSITIVITY);
  }

  /** Touch sequence finished (also fires for taps that never activated). */
  releaseGesture() {
    this.dragging = false;
  }

  // ───────────────────────────── controls ─────────────────────────────

  undo() {
    if (this.status !== 'playing' || this.history.length === 0) return;
    const prev = this.history.pop()!;
    this.inertia.x = this.inertia.y = 0;
    this.startAnim('undo', prev, UNDO_DURATION);
    haptics.tap();
  }

  reset() {
    if (this.status !== 'playing') return;
    this.pushHistory();
    this.inertia.x = this.inertia.y = 0;
    this.startAnim('reset', this.level.startQuat, HINT_ROTATE_DURATION);
    haptics.tap();
  }

  /** Lightbulb: auto-rotate 50% of the remaining way to the solution. */
  autoRotateHint() {
    if (this.status !== 'playing') return;
    this.pushHistory();
    this.inertia.x = this.inertia.y = 0;
    const halfway = this.quat.clone().slerp(this.closestTarget(), 0.5);
    this.startAnim('hint', halfway, HINT_ROTATE_DURATION);
    this.hintsUsed++;
    this.interacted = true;
    haptics.hint();
    this.emit(true);
  }

  /** Hint button: show a translucent "ghost" of the solved wire for a few seconds. */
  showGhost() {
    if (this.status !== 'playing' || this.isGhostVisible()) return;
    this.ghostUntil = Date.now() + GHOST_DURATION;
    this.hintsUsed++;
    haptics.hint();
    this.emit(true);
  }

  /** 0..1 progress of the success glow (0 when not celebrating). */
  successProgress(now = Date.now()) {
    if (this.status !== 'success' && this.status !== 'complete') return 0;
    return Math.min(1, (now - this.successAt) / SUCCESS_GLOW_DURATION);
  }

  /** True while a finger is down or the mesh is still coasting. */
  get interacting() {
    return this.dragging || Math.abs(this.inertia.x) + Math.abs(this.inertia.y) > 0.05;
  }

  isGhostVisible(now = Date.now()) {
    return now < this.ghostUntil;
  }

  // ───────────────────────────── frame loop ─────────────────────────────

  /** Called from useFrame. `dt` in seconds. */
  tick(dt: number) {
    const now = Date.now();

    if (this.anim) {
      const t = Math.min(1, (now - this.anim.start) / this.anim.duration);
      const e = this.anim.kind === 'snap' ? easeOutCubic(t) : easeInOutCubic(t);
      this.quat.slerpQuaternions(this.anim.from, this.anim.to, e);
      if (t >= 1) this.finishAnim();
    } else if (!this.dragging && this.status === 'playing') {
      const speed = Math.abs(this.inertia.x) + Math.abs(this.inertia.y);
      if (speed > 0.002) {
        this.rotateWorld(this.inertia.x * dt, this.inertia.y * dt, 0);
        const decay = Math.exp(-INERTIA_DAMPING * dt);
        this.inertia.x *= decay;
        this.inertia.y *= decay;
      }
    }

    this.updateAccuracy();

    if (this.status === 'playing' && this.accuracy >= SNAP_THRESHOLD) {
      this.beginSnap();
    }

    if (this.status === 'success' && now - this.successAt >= SUCCESS_GLOW_DURATION) {
      this.status = 'complete';
      this.emit(true);
    }

    if (this.snapshot.ghostVisible && !this.isGhostVisible(now)) this.emit(true);
    this.emit(false);
  }

  // ───────────────────────────── internals ─────────────────────────────

  private rotateWorld(ax: number, ay: number, az: number) {
    if (ay) this.quat.premultiply(_qa.setFromAxisAngle(AXIS_Y, ay));
    if (ax) this.quat.premultiply(_qb.setFromAxisAngle(AXIS_X, ax));
    if (az) this.quat.premultiply(_qa.setFromAxisAngle(AXIS_Z, az));
    this.quat.normalize();
  }

  private updateAccuracy() {
    projectWire(this.level.wireSamples, this.quat, this.projected);
    this.accuracy = computeAccuracy(this.projected, this.level.targetSamples);

    // "Getting warmer" haptic ticks on rising edges.
    const tier = WARM_TICKS.filter((t) => this.accuracy >= t).length;
    if (tier > this.warmTick && this.status === 'playing') haptics.warmer();
    this.warmTick = tier;
  }

  /**
   * The orientation to snap to. For symmetric silhouettes several orientations
   * produce a matching shadow; we snap to whichever equivalent pose is nearest
   * (the target or its q/-q twin), which keeps the snap motion tiny.
   */
  private closestTarget() {
    const t = this.level.targetQuat.clone();
    if (this.quat.dot(t) < 0) t.set(-t.x, -t.y, -t.z, -t.w);
    return t;
  }

  private beginSnap() {
    this.status = 'snapping';
    this.solvedAt = Date.now();
    this.dragging = false;
    this.inertia.x = this.inertia.y = 0;
    // If the shadow already matches (symmetric shape from another pose), keep
    // the pose and just settle; otherwise glide into the exact solution.
    const target = this.closestTarget();
    const angleToTarget = 2 * Math.acos(Math.min(1, Math.abs(this.quat.dot(target))));
    const to = angleToTarget < THREE.MathUtils.degToRad(25) ? target : this.quat.clone();
    this.startAnim('snap', to, SNAP_DURATION);
    haptics.snap();
    this.emit(true);
  }

  private startAnim(kind: AnimKind, to: THREE.Quaternion, duration: number) {
    this.anim = { kind, from: this.quat.clone(), to: to.clone(), start: Date.now(), duration };
  }

  private cancelAnim() {
    if (this.anim && this.anim.kind !== 'snap') this.anim = null;
  }

  private finishAnim() {
    const kind = this.anim?.kind;
    this.anim = null;
    if (kind === 'snap') {
      this.status = 'success';
      this.successAt = Date.now();
      this.accuracy = 1;
      haptics.success();
      this.emit(true);
    }
  }

  private pushHistory() {
    this.history.push(this.quat.clone());
    if (this.history.length > MAX_HISTORY) this.history.shift();
  }

  // ───────────────────────────── UI store ─────────────────────────────

  private buildSnapshot(): UISnapshot {
    const accuracy = this.status === 'playing' || this.status === 'snapping'
      ? Math.round(this.accuracy * 100)
      : 100;
    return {
      levelNumber: this.level.number,
      shapeName: this.level.shape.name,
      accuracy,
      status: this.status,
      canUndo: this.history.length > 0,
      ghostVisible: this.isGhostVisible(),
      interacted: this.interacted,
      hintsUsed: this.hintsUsed,
      stars: this.hintsUsed === 0 ? 3 : this.hintsUsed === 1 ? 2 : 1,
      bulbsLeft: Math.max(0, 3 - this.hintsUsed),
      solveSeconds: this.solvedAt ? Math.max(1, Math.round((this.solvedAt - this.startedAt) / 1000)) : 0,
    };
  }

  private emit(force: boolean) {
    const now = Date.now();
    if (!force && now - this.lastUIEmit < UI_INTERVAL_MS) return;
    const next = this.buildSnapshot();
    const prev = this.snapshot;
    if (
      prev &&
      prev.accuracy === next.accuracy &&
      prev.status === next.status &&
      prev.canUndo === next.canUndo &&
      prev.ghostVisible === next.ghostVisible &&
      prev.interacted === next.interacted &&
      prev.levelNumber === next.levelNumber &&
      prev.hintsUsed === next.hintsUsed
    ) {
      return;
    }
    this.lastUIEmit = now;
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;
}
