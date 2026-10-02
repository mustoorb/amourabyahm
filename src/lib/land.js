// Dots on land, for the globe. Computed once at build time from Natural Earth's
// 1:50m land outline (npm: world-atlas) — no map images in the repo or on the page.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);

/** Land as a list of polygons (outer ring + holes), each with a bounding box for quick rejects. */
function landPolygons() {
  const topo = JSON.parse(readFileSync(require.resolve('world-atlas/land-50m.json'), 'utf8'));
  const geo = feature(topo, topo.objects.land);
  const polys = [];
  for (const f of geo.features ?? [geo]) {
    const g = f.geometry;
    const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const rings of list) {
      let minX = 180, minY = 90, maxX = -180, maxY = -90;
      for (const [x, y] of rings[0]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      polys.push({ rings, minX, minY, maxX, maxY });
    }
  }
  return polys;
}

// Even–odd ray casting on lng/lat (Natural Earth rings are already split at ±180°).
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function onLand(polys, x, y) {
  for (const p of polys) {
    if (x < p.minX || x > p.maxX || y < p.minY || y > p.maxY) continue;
    if (!inRing(x, y, p.rings[0])) continue;
    let hole = false;
    for (let k = 1; k < p.rings.length && !hole; k++) hole = inRing(x, y, p.rings[k]);
    if (!hole) return true;
  }
  return false;
}

let cached;
/**
 * Evenly spread points over the sphere (Fibonacci lattice), keeping those on land.
 * Returns a flat array [lat*100, lng*100, …] of integers — compact to ship.
 */
export function landDots(samples = 26000) {
  if (cached) return cached;
  const polys = landPolygons();
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2; // 1 → -1
    const lat = (Math.asin(y) * 180) / Math.PI;
    if (lat < -60) continue; // skip Antarctica: it clutters the bottom of the globe
    const lng = (((((i * golden * 180) / Math.PI) % 360) + 360) % 360) - 180;
    if (onLand(polys, lng, lat)) out.push(Math.round(lat * 100), Math.round(lng * 100));
  }
  cached = out;
  return out;
}
