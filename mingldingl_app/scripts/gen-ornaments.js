// scripts/gen-ornaments.js — generates the Ulzii Design Language assets.
//
// Мөнгөлог өлзий хээ (endless-knot interlace) and алхан хээ (walking fret), drawn from geometry:
// knots are billiard paths traced inside an integer rectangle, woven over/under by crossing
// parity; frets are lattice meanders.
//
// Inked, not gilded (2026-10-03). They were capsule strokes shaded as metal tubes, a third hand
// beside the glyphs' brush and the hearth's painted sky, which is why every card's corners looked
// machined while its contents looked drawn. Now each strand is one brush stroke in its metal's
// colour, swelling and thinning along its length, with a warm-to-deep wash down the knot; at every
// crossing the ink is lifted around the strand that passes over, so the weave still reads.
// Rendered with canvaskit-wasm, like `gen-glyphs.js` and `gen-sky.js`.
//
// Rerun with: node scripts/gen-ornaments.js   (writes assets/ornaments/*.png)

const fs = require('fs');
const path = require('path');

// ---------- palette (mirrors lib/theme.ts) ----------
const METALS = {
  gold:  { dark: '#5C4720', main: '#D97F1F', bright: '#F5A83C' },
  ember: { dark: '#5E2E17', main: '#C1461E', bright: '#D77951' },
  brass: { dark: '#4A3A17', main: '#B8923F', bright: '#E8C97A' },
  dim:   { dark: '#2B3140', main: '#4A5A6B', bright: '#6B7C8F' },
};

function hex(c, a = 1) {
  return [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255, a];
}

// ---------- knot geometry: billiard trace ----------
function traceStrands(m, n) {
  const seen = new Set();
  const strands = [];
  const key = (x, y, dx, dy) => `${x},${y},${dx},${dy}`;
  for (let sx = 0; sx <= m; sx++) for (let sy = 0; sy <= n; sy++) {
    if (!(sx === 0 || sx === m || sy === 0 || sy === n)) continue;
    for (const sdx of [-1, 1]) for (const sdy of [-1, 1]) {
      if (sx + sdx < 0 || sx + sdx > m || sy + sdy < 0 || sy + sdy > n) continue;
      if (seen.has(key(sx, sy, sdx, sdy))) continue;
      const pts = [];
      let x = sx, y = sy, dx = sdx, dy = sdy;
      do {
        seen.add(key(x, y, dx, dy));
        pts.push({ x, y, dx, dy });
        x += dx; y += dy;
        seen.add(key(x, y, -dx, -dy)); // the same edge walked backwards
        if (x === 0 || x === m) dx = -dx;
        if (y === 0 || y === n) dy = -dy;
      } while (!(x === sx && y === sy && dx === sdx && dy === sdy));
      strands.push(pts);
    }
  }
  return strands;
}

// Polyline for one strand: straight through interior points, looped at the walls.
function strandPolyline(pts, m, n, s, pad) {
  const px = p => pad + p.x * s, py = p => pad + p.y * s;
  const t = 0.36 * s, bulge = 0.85 * s;
  const onB = p => p.x === 0 || p.x === m || p.y === 0 || p.y === n;
  const N = pts.length;
  let start = pts.findIndex(p => !onB(p));
  if (start < 0) start = 0;
  const out = [];
  for (let k = 0; k <= N; k++) {
    const i = (start + k) % N;
    const p = pts[i];
    const prev = pts[(i - 1 + N) % N];
    if (!onB(p)) {
      out.push([px(p), py(p)]);
    } else {
      let nx = p.x === 0 ? -1 : p.x === m ? 1 : 0;
      let ny = p.y === 0 ? -1 : p.y === n ? 1 : 0;
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const ax = px(p) - prev.dx * t, ay = py(p) - prev.dy * t;
      const bx = px(p) + p.dx * t, by = py(p) + p.dy * t;
      const cx = px(p) + nx * bulge, cy = py(p) + ny * bulge;
      out.push([ax, ay]);
      for (let q = 1; q <= 14; q++) {           // flatten the loop bezier
        const u = q / 14, v = 1 - u;
        out.push([v * v * ax + 2 * v * u * cx + u * u * bx, v * v * ay + 2 * v * u * cy + u * u * by]);
      }
    }
  }
  return out;
}

// ---------- the brush ----------
/** Discs along a polyline, unioned into one path: the glyphs' brush. `breath` > 0 swells and thins
 *  the line along its length; `taper` brings both ends to a point. */
function brush(CK, pts, width, { breath = 0.16, taper = false, phase = 0 } = {}) {
  const out = new CK.Path();
  const dense = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const k = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.6));
    for (let j = 0; j < k; j++) dense.push([x0 + ((x1 - x0) * j) / k, y0 + ((y1 - y0) * j) / k]);
  }
  dense.push(pts[pts.length - 1]);
  const n = dense.length - 1;
  dense.forEach(([x, y], i) => {
    const t = n ? i / n : 0;
    let r = (width / 2) * (1 - breath / 2 + (breath / 2) * Math.sin(2 * Math.PI * 3 * t + phase));
    if (taper) r *= 0.2 + 0.8 * Math.pow(Math.sin(Math.PI * t), 0.5);
    out.addCircle(x, y, r);
  });
  return out;
}

function inkPaint(CK, metal, h) {
  const p = new CK.Paint();
  p.setAntiAlias(true);
  p.setShader(CK.Shader.MakeLinearGradient([0, 0], [0, h],
    [CK.Color4f(...hex(metal.bright)), CK.Color4f(...hex(metal.main)), CK.Color4f(...hex(metal.main)), CK.Color4f(...hex(metal.dark))],
    [0, 0.35, 0.7, 1], CK.TileMode.Clamp));
  return p;
}

function lift(CK) {
  const p = new CK.Paint();
  p.setAntiAlias(true);
  p.setBlendMode(CK.BlendMode.Clear);
  return p;
}

function save(CK, surface, file) {
  const image = surface.makeImageSnapshot();
  const bytes = image.encodeToBytes();
  fs.writeFileSync(file, Buffer.from(bytes));
  console.log('wrote', path.basename(file), `${image.width()}x${image.height()}`, bytes.length, 'bytes');
  image.delete();
  surface.delete();
}

function renderKnot(CK, m, n, s, W, metalName, file) {
  const metal = METALS[metalName];
  const pad = 0.62 * s;
  const w = Math.ceil(m * s + 2 * pad), h = Math.ceil(n * s + 2 * pad);
  const surface = CK.MakeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);
  const ink = inkPaint(CK, metal, h);
  traceStrands(m, n).forEach((pts, i) => {
    const line = strandPolyline(pts, m, n, s, pad);
    const p = brush(CK, line, W, { phase: i * 1.7 });
    canvas.drawPath(p, ink);
    p.delete();
  });
  // The weave: at every crossing, lift the ink around the strand that passes over, then lay it.
  const seg = 0.42 * s;
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
    const cx = pad + (i + 0.5) * s, cy = pad + (j + 0.5) * s;
    const dy = (i + j) % 2 === 0 ? 1 : -1;
    const over = [[cx - seg, cy - dy * seg], [cx + seg, cy + dy * seg]];
    const gap = brush(CK, over, W + W * 0.9, { breath: 0 });
    canvas.drawPath(gap, lift(CK));
    gap.delete();
    const p = brush(CK, over, W, { breath: 0.1, phase: i + j });
    canvas.drawPath(p, ink);
    p.delete();
  }
  save(CK, surface, file);
}

// ---------- walking fret (алхан хээ) ----------
function renderMeander(CK, units, g, W, metalName, darkOnly, file) {
  const uw = 4 * g;
  const w = Math.ceil(units * uw + g), h = Math.ceil(5 * g);
  const surface = CK.MakeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);
  let paint;
  if (darkOnly) {
    paint = new CK.Paint();
    paint.setAntiAlias(true);
    paint.setColor(CK.Color4f(0, 0, 0, 0.6));
  } else {
    paint = inkPaint(CK, METALS[metalName], h);
  }
  const base = brush(CK, [[0, 4 * g], [w, 4 * g]], W, { breath: 0.12 });
  canvas.drawPath(base, paint);
  base.delete();
  for (let k = 0; k < units; k++) {
    const x = k * uw + g;
    // One hook, one stroke: up, across, down, back, and the little turn in.
    const hook = [[x, 4 * g], [x, g], [x + 3 * g, g], [x + 3 * g, 3 * g], [x + 1.5 * g, 3 * g], [x + 1.5 * g, 2 * g + W * 0.5]];
    const p = brush(CK, hook, W, { breath: 0.18, phase: k * 0.9 });
    canvas.drawPath(p, paint);
    p.delete();
  }
  save(CK, surface, file);
}

/** The divider's rule: a single brushed line, swelling from a hair at its far end to full at the
 *  knot. Baked white and tinted by `SectionDivider`, which mirrors it for the other side. */
function renderRule(CK, file) {
  const w = 600, h = 12;
  const surface = CK.MakeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);
  const p = new CK.Path();
  for (let x = 2; x <= w - 4; x += 0.8) {
    const t = x / w;
    const r = 0.3 + 3.2 * Math.pow(t, 1.6) * (0.9 + 0.1 * Math.sin(t * 40));
    p.addCircle(x, h / 2, r);
  }
  const ink = new CK.Paint();
  ink.setAntiAlias(true);
  ink.setColor(CK.WHITE);
  canvas.drawPath(p, ink);
  p.delete();
  save(CK, surface, file);
}

/** The campaign's path between caves: footsteps, left then right, as one tile that repeats down
 *  the column. Baked white; tinted gold where the pair has walked, dim ahead. 3x of 12×24pt. */
function renderTrail(CK, file) {
  const w = 36, h = 72;
  const surface = CK.MakeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);
  const ink = new CK.Paint();
  ink.setAntiAlias(true);
  ink.setColor(CK.WHITE);
  // A foot: the sole as a short brushed oval, the heel as a drop behind it.
  const foot = (x, y, lean) => {
    const sole = brush(CK, [[x - lean, y - 7], [x, y + 2]], 7.5, { breath: 0, taper: true });
    canvas.drawPath(sole, ink);
    sole.delete();
    canvas.drawCircle(x + lean * 0.4, y + 8, 3, ink);
  };
  foot(12, 14, 1.5);
  foot(24, 50, -1.5);
  save(CK, surface, file);
}

/** The Quest Log's cord: two strands twisted round each other, as one tile that repeats down the
 *  log through every portrait. Baked white; tinted the fire's temperature. 3x of 6×10pt; each
 *  strand meets its own end across the tile's seam. */
function renderCord(CK, file) {
  const w = 18, h = 30;
  const surface = CK.MakeSurface(w, h);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);
  const ink = new CK.Paint();
  ink.setAntiAlias(true);
  ink.setColor(CK.WHITE);
  const strand = (from, to) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      pts.push([from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * t)), -2 + t * (h + 4)]);
    }
    return brush(CK, pts, 4.2, { breath: 0 });
  };
  const back = strand(13, 5);
  const shade = new CK.Paint();
  shade.setAntiAlias(true);
  shade.setColor(CK.Color4f(1, 1, 1, 0.55));
  canvas.drawPath(back, shade);
  back.delete();
  const front = strand(5, 13);
  canvas.drawPath(front, ink);
  front.delete();
  save(CK, surface, file);
}

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  // ---------- the asset set (sizes are 3x display points) ----------
  const outDir = path.join(__dirname, '..', 'assets', 'ornaments');
  fs.mkdirSync(outDir, { recursive: true });
  const out = f => path.join(outDir, f);

  renderKnot(CK, 2, 2, 39, 7.8, 'gold', out('knot_gold.png'));        // 44pt corner/medallion knot
  renderKnot(CK, 2, 2, 39, 7.8, 'dim', out('knot_dim.png'));          // sealed rooms, empty states
  renderKnot(CK, 2, 2, 39, 7.8, 'ember', out('knot_ember.png'));      // stakes at small size
  renderKnot(CK, 5, 5, 27, 4.8, 'ember', out('knot_boss_ember.png')); // the one grand knot per screen
  renderKnot(CK, 3, 3, 22, 5.2, 'gold', out('sigil_bond.png'));
  renderKnot(CK, 3, 4, 20, 4.8, 'ember', out('sigil_fate.png'));
  renderKnot(CK, 4, 3, 20, 4.8, 'brass', out('sigil_kinship.png'));
  renderMeander(CK, 40, 10, 4.5, 'gold', false, out('fret_gold.png')); // dividers, XP track
  renderMeander(CK, 40, 10, 4.5, null, true, out('fret_dark.png'));    // engraving overlay on fills
  renderRule(CK, out('rule.png'));                                     // SectionDivider's two lines
  renderTrail(CK, out('trail.png'));                                   // the campaign's path between caves
  renderCord(CK, out('cord.png'));                                     // the Quest Log's thread
}

main().catch((e) => { console.error(e); process.exit(1); });
