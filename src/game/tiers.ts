import { SHAPES, type ShapeDef } from './shapes';

/**
 * Levels are grouped into five tiers of rising difficulty. Shapes are sorted
 * by how hard their shadow is to line up, then cut into equal-sized tiers;
 * level generation also scrambles harder levels further (see levels.ts).
 */

export interface Tier {
  id: string;
  name: string;
  blurb: string;
  /** Accent used for the tier badge. */
  color: string;
  /** First and last 0-based level index in this tier (inclusive). */
  start: number;
  end: number;
}

/**
 * Rough "how hard to read" score: every extra stroke is another piece that
 * must line up at once, long outlines have more detail, and open strokes
 * (lines, letters) give fewer visual anchors than closed outlines.
 */
function complexity(shape: ShapeDef) {
  let length = 0;
  let open = 0;
  for (const s of shape.strokes) {
    const pts = s.closed ? [...s.points, s.points[0]] : s.points;
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (!s.closed) open++;
  }
  return shape.strokes.length * 1.0 + length * 0.2 + open * 0.25;
}

/** Shapes in play order: easiest first. Ties keep catalogue order. */
export const LEVEL_SHAPES: ShapeDef[] = SHAPES.map((shape, i) => ({ shape, i, score: complexity(shape) }))
  .sort((a, b) => a.score - b.score || a.i - b.i)
  .map((x) => x.shape);

const TIER_DEFS = [
  { id: 'easy', name: 'Easy', blurb: 'Simple outlines to learn the light', color: '#7a9a5a' },
  { id: 'medium', name: 'Medium', blurb: 'More detail, gentler hints needed', color: '#c08a2e' },
  { id: 'hard', name: 'Hard', blurb: 'Several parts that must line up together', color: '#b5652b' },
  { id: 'expert', name: 'Expert', blurb: 'Busy pieces, deeply tangled wire', color: '#9a3f2a' },
  { id: 'master', name: 'Master', blurb: 'The gallery’s most intricate works', color: '#5a2e4a' },
];

export const TIERS: Tier[] = (() => {
  const n = LEVEL_SHAPES.length;
  const base = Math.floor(n / TIER_DEFS.length);
  const extra = n % TIER_DEFS.length; // first tiers get one more level
  let start = 0;
  return TIER_DEFS.map((def, i) => {
    const size = base + (i < extra ? 1 : 0);
    const tier = { ...def, start, end: start + size - 1 };
    start += size;
    return tier;
  });
})();

export function tierOf(index: number): Tier {
  return TIERS.find((t) => index >= t.start && index <= t.end) ?? TIERS[TIERS.length - 1];
}
