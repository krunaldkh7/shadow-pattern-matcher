/** Builds the wire geometry for every shape to make sure merging succeeds. Run: npx tsx scripts/verifyGeometry.ts */
import { generateLevel } from '../src/game/levels';
import { buildWireGeometry } from '../src/three/buildWireGeometry';
import { SHAPES } from '../src/game/shapes';

let ok = true;
for (let i = 0; i < SHAPES.length; i++) {
  const L = generateLevel(i);
  const g = buildWireGeometry(L.strokes);
  const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
  const r = g.boundingSphere!.radius;
  if (!(tris > 0) || !(r > 0.3 && r < 1.6)) ok = false;
  console.log(`${String(L.number).padStart(2)} ${L.shape.name.padEnd(10)} tris=${tris} radius=${r.toFixed(2)}`);
}
console.log(ok ? 'GEOMETRY OK' : 'GEOMETRY PROBLEM');
process.exit(ok ? 0 : 1);
