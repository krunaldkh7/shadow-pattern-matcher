import { useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import type { Point2, Stroke } from '../../game/shapes';
import { INK } from '../theme';

/** Pixels between kept points while drawing; finer than this is just jitter. */
const MIN_STEP = 6;
/** A stroke that ends this close to its start (fraction of the pad) is closed into a loop. */
const CLOSE_GAP = 0.07;
/** Drawn shapes are fitted inside this much of the [-1, 1] box, like the gallery shapes. */
const FIT = 0.92;

type Pt = { x: number; y: number };

interface Props {
  size: number;
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
}

/** Pad coordinates (px, y down) → shape coordinates ([-1, 1], y up). */
function toShape(p: Pt, size: number): Point2 {
  return [((p.x / size) * 2 - 1) * FIT, -((p.y / size) * 2 - 1) * FIT];
}
function toPad([x, y]: Point2, size: number): Pt {
  return { x: ((x / FIT + 1) / 2) * size, y: ((-y / FIT + 1) / 2) * size };
}

/**
 * A square on the wall to draw a level on with one finger. Each finger-down
 * starts a new stroke; strokes are kept in the same normalised coordinates
 * the game's built-in shapes use.
 */
export function DrawingPad({ size, strokes, onStrokesChange }: Props) {
  // The stroke in progress: a ref for the gesture callbacks, state for rendering.
  const live = useRef<Pt[]>([]);
  const [current, setCurrent] = useState<Pt[]>([]);
  // Latest props for the gesture callbacks, which may hold an older render's closure.
  const latest = useRef({ strokes, onStrokesChange });
  useLayoutEffect(() => {
    latest.current = { strokes, onStrokesChange };
  });

  const finish = (pts: Pt[]) => {
    setCurrent([]);
    if (pts.length < 3) return;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const closed = pts.length > 6 && Math.hypot(first.x - last.x, first.y - last.y) < CLOSE_GAP * size;
    const points = (closed ? pts.slice(0, -1) : pts).map((p) => toShape(p, size));
    latest.current.onStrokesChange([...latest.current.strokes, { points, closed }]);
  };

  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 1,
    onBegin: (e) => {
      live.current = [{ x: e.x, y: e.y }];
      setCurrent(live.current);
    },
    onUpdate: (e) => {
      const x = Math.max(0, Math.min(size, e.x));
      const y = Math.max(0, Math.min(size, e.y));
      const last = live.current[live.current.length - 1];
      if (last && Math.hypot(x - last.x, y - last.y) < MIN_STEP) return;
      live.current = [...live.current, { x, y }];
      setCurrent(live.current);
    },
    onFinalize: () => {
      const pts = live.current;
      live.current = [];
      finish(pts);
    },
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.pad, { width: size, height: size }]} collapsable={false}>
        {/* Centre guides, like the tiles on the wall. */}
        <View style={[styles.guideH, { top: size / 2 }]} />
        <View style={[styles.guideV, { left: size / 2 }]} />
        {strokes.map((s, i) => (
          <Polyline key={i} points={s.points.map((p) => toPad(p, size))} closed={s.closed} color={INK.ink} />
        ))}
        <Polyline points={current} closed={false} color={INK.brass} />
      </View>
    </GestureDetector>
  );
}

const THICKNESS = 4;

/** A polyline drawn as rotated thin views — no SVG dependency needed. */
function Polyline({ points, closed, color }: { points: Pt[]; closed: boolean; color: string }) {
  const segs: [Pt, Pt][] = [];
  for (let i = 1; i < points.length; i++) segs.push([points[i - 1], points[i]]);
  if (closed && points.length > 2) segs.push([points[points.length - 1], points[0]]);
  return (
    <>
      {segs.map(([a, b], i) => {
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: (a.x + b.x) / 2 - len / 2,
              top: (a.y + b.y) / 2 - THICKNESS / 2,
              width: len + THICKNESS * 0.5,
              height: THICKNESS,
              borderRadius: THICKNESS / 2,
              backgroundColor: color,
              transform: [{ rotate: `${angle}rad` }],
            }}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  pad: {
    alignSelf: 'center',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: INK.ink,
    backgroundColor: 'rgba(239,228,204,0.55)',
    overflow: 'hidden',
  },
  guideH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: INK.inkFaint },
  guideV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: INK.inkFaint },
});
