/**
 * Target silhouettes, authored as 2D polylines in a normalised box (~[-1, 1],
 * +Y up). A shape can have several strokes (body, tail, door, steam…).
 * `closed` strokes loop back to their first point.
 *
 * These polylines are the single source of truth: the dotted target outline on
 * the wall AND the 3D gold wire are both generated from them (see wireBuilder).
 */

import { buildExtendedShapes } from './shapeLibrary';

export type Point2 = [number, number];

export interface Stroke {
  points: Point2[];
  closed: boolean;
}

export interface ShapeDef {
  id: string;
  name: string;
  strokes: Stroke[];
}

const closed = (points: Point2[]): Stroke => ({ points, closed: true });
const open = (points: Point2[]): Stroke => ({ points, closed: false });

function ring(cx: number, cy: number, r: number, n = 10): Stroke {
  const pts: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return closed(pts);
}

function heartStroke(): Stroke {
  const pts: Point2[] = [];
  const n = 48;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([x / 17, y / 17 + 0.12]);
  }
  return closed(pts);
}

function starStroke(spikes = 5, outer = 1, inner = 0.42): Stroke {
  const pts: Point2[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / spikes;
    pts.push([Math.cos(a) * r, Math.sin(a) * r - 0.05]);
  }
  return closed(pts);
}

function umbrellaStrokes(): Stroke[] {
  const canopy: Point2[] = [];
  const top = 24;
  for (let i = 0; i <= top; i++) {
    const a = Math.PI - (i / top) * Math.PI; // left → right over the top
    canopy.push([Math.cos(a), 0.1 + Math.sin(a) * 0.78]);
  }
  const bumps = 4;
  const per = 6;
  for (let b = 0; b < bumps; b++) {
    const x0 = 1 - (b * 2) / bumps;
    const x1 = 1 - ((b + 1) * 2) / bumps;
    for (let j = 1; j <= per; j++) {
      const u = j / per;
      canopy.push([x0 + (x1 - x0) * u, 0.1 + Math.sin(u * Math.PI) * 0.13]);
    }
  }
  canopy.pop(); // last point equals the first one
  return [
    closed(canopy),
    open([
      [0, 0.1],
      [0, -0.74],
      [-0.04, -0.87],
      [-0.16, -0.93],
      [-0.27, -0.87],
      [-0.3, -0.76],
    ]),
  ];
}

const BASE_SHAPES: ShapeDef[] = [
  {
    id: 'cat',
    name: 'Cat',
    strokes: [
      closed([
        [-0.5, -0.95], [-0.66, -0.62], [-0.66, -0.2], [-0.53, 0.1], [-0.36, 0.3],
        [-0.42, 0.52], [-0.42, 0.72], [-0.36, 0.98], [-0.18, 0.8], [0.0, 0.83],
        [0.18, 0.98], [0.23, 0.72], [0.25, 0.5], [0.15, 0.3], [0.1, 0.12],
        [0.2, -0.22], [0.26, -0.62], [0.32, -0.95],
      ]),
      open([
        [-0.58, -0.9], [-0.84, -0.86], [-0.99, -0.62], [-0.96, -0.32], [-0.84, -0.18],
      ]),
    ],
  },
  { id: 'heart', name: 'Heart', strokes: [heartStroke()] },
  {
    id: 'fish',
    name: 'Fish',
    strokes: [
      closed([
        [-1, 0.5], [-0.6, 0.05], [-0.3, 0.35], [0.1, 0.5], [0.5, 0.4], [0.82, 0.12],
        [0.92, 0], [0.82, -0.12], [0.5, -0.4], [0.1, -0.5], [-0.3, -0.35], [-0.6, -0.05],
        [-1, -0.5],
      ]),
      ring(0.55, 0.12, 0.07, 8),
      open([[-0.05, 0.48], [0.06, 0.76], [0.32, 0.47]]),
    ],
  },
  {
    id: 'house',
    name: 'House',
    strokes: [
      closed([[-0.8, -0.9], [0.8, -0.9], [0.8, 0.2], [1.0, 0.2], [0, 1.0], [-1.0, 0.2], [-0.8, 0.2]]),
      open([[-0.48, -0.9], [-0.48, -0.32], [-0.12, -0.32], [-0.12, -0.9]]),
      closed([[0.25, -0.2], [0.55, -0.2], [0.55, 0.08], [0.25, 0.08]]),
      open([[0.45, 0.56], [0.45, 0.86], [0.66, 0.86], [0.66, 0.4]]),
    ],
  },
  { id: 'star', name: 'Star', strokes: [starStroke()] },
  {
    id: 'bird',
    name: 'Bird',
    strokes: [
      closed([
        [-0.92, 0.12], [-0.5, 0.05], [-0.3, 0.35], [0.1, 0.45], [0.35, 0.62], [0.55, 0.56],
        [0.63, 0.43], [0.96, 0.38], [0.6, 0.3], [0.5, 0.15], [0.45, -0.15], [0.2, -0.4],
        [-0.2, -0.45], [-0.5, -0.2], [-0.92, -0.1],
      ]),
      open([[-0.3, 0.15], [0.0, 0.05], [0.16, -0.16]]),
      open([[0.0, -0.44], [0.05, -0.82], [0.22, -0.86]]),
    ],
  },
  {
    id: 'teacup',
    name: 'Teacup',
    strokes: [
      closed([[-0.6, 0.45], [0.5, 0.45], [0.45, -0.1], [0.3, -0.45], [-0.4, -0.45], [-0.55, -0.1]]),
      open([[0.48, 0.28], [0.8, 0.28], [0.86, 0.04], [0.7, -0.16], [0.4, -0.22]]),
      closed([[-0.95, -0.55], [0.85, -0.55], [0.6, -0.72], [-0.7, -0.72]]),
      open([[-0.2, 0.6], [-0.08, 0.76], [-0.2, 0.94]]),
      open([[0.12, 0.6], [0.24, 0.76], [0.12, 0.94]]),
    ],
  },
  {
    id: 'rabbit',
    name: 'Rabbit',
    strokes: [
      closed([
        [-0.6, -0.95], [0.45, -0.95], [0.5, -0.7], [0.35, -0.45], [0.35, -0.1], [0.56, 0.05],
        [0.56, 0.2], [0.4, 0.38], [0.44, 0.95], [0.28, 0.98], [0.22, 0.42], [0.05, 0.9],
        [-0.08, 0.86], [0.04, 0.35], [-0.05, 0.15], [-0.45, 0.0], [-0.75, -0.35],
        [-0.92, -0.55], [-0.82, -0.76], [-0.7, -0.9],
      ]),
    ],
  },
  {
    id: 'tree',
    name: 'Pine Tree',
    strokes: [
      closed([
        [-0.12, -0.95], [0.12, -0.95], [0.12, -0.55], [0.7, -0.55], [0.3, -0.1], [0.55, -0.1],
        [0.2, 0.35], [0.4, 0.35], [0, 0.95], [-0.4, 0.35], [-0.2, 0.35], [-0.55, -0.1],
        [-0.3, -0.1], [-0.7, -0.55], [-0.12, -0.55],
      ]),
    ],
  },
  {
    id: 'duck',
    name: 'Duck',
    strokes: [
      closed([
        [-0.92, 0.02], [-0.6, -0.05], [-0.3, 0.05], [0.05, 0.12], [0.1, 0.36], [0.2, 0.6],
        [0.45, 0.66], [0.6, 0.5], [0.96, 0.42], [0.62, 0.34], [0.5, 0.24], [0.45, 0.05],
        [0.6, -0.2], [0.4, -0.5], [-0.2, -0.55], [-0.6, -0.4], [-0.86, -0.15],
      ]),
      open([[-0.45, -0.12], [-0.1, -0.06], [0.15, -0.26]]),
    ],
  },
  { id: 'umbrella', name: 'Umbrella', strokes: umbrellaStrokes() },
];

/** Every level has its own shape: the hand-tuned originals first, then the extended catalogue. */
export const SHAPES: ShapeDef[] = [...BASE_SHAPES, ...buildExtendedShapes()];

/** Resample a polyline at a fixed arc-length spacing so wire + dots are even. */
export function resampleStroke(stroke: Stroke, spacing: number): Point2[] {
  const pts = stroke.closed ? [...stroke.points, stroke.points[0]] : stroke.points;
  const out: Point2[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const segLen = Math.hypot(bx - ax, by - ay);
    let d = spacing - carry;
    while (d <= segLen) {
      const t = d / segLen;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      d += spacing;
    }
    carry = segLen - (d - spacing);
  }
  if (stroke.closed) {
    // Drop a trailing point that landed (almost) on the start.
    const [fx, fy] = out[0];
    const [lx, ly] = out[out.length - 1];
    if (Math.hypot(fx - lx, fy - ly) < spacing * 0.5) out.pop();
  } else {
    const last = stroke.points[stroke.points.length - 1];
    const [lx, ly] = out[out.length - 1];
    if (Math.hypot(last[0] - lx, last[1] - ly) > spacing * 0.25) out.push(last);
  }
  return out;
}
