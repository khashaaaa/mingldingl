// scripts/gen-ice.js — the app's frost, inked: the rim every silent edge wears (`FrostEdge`) and
// the ice that closes over a thread left to freeze (`components/chat/FrozenOver.tsx`).
//
// The frost used to be three zigzag polylines in SVG, which read as curly lines rather than ice.
// Now it is drawn with the same brush as the glyphs and the carvings and baked to PNG:
//
// - **rim**: a crust of rime along the edge with icicles hanging off it — long and short, each a
//   tapered brush stroke with a shine down one side and a drop at the tip. A tile that repeats
//   along any edge (the crust's wave is periodic, no icicle crosses the seam). Baked once for a
//   top edge (`rim-*`) and once transposed for a left edge (`rim-v-*`); bottom and right are flips.
// - **frozen**: a field of ice for the foot of a frozen thread — crystal shards up out of a ledge,
//   tall at the sides and low through the middle where the last letters sit, frost ferns creeping
//   between them, a few six-armed crystals in the air.
//
// Each drawing is three white alpha masks the component tints from `TEMPERATURE`: `fill` (the ice
// body, ice-blue and translucent so whatever is under it reads as frozen in), `ink` (the brushed
// edges and facets, glacier) and `shine` (rime highlights). Seeded throughout.
//
// Rerun with: node scripts/gen-ice.js   (writes assets/ice/*.png)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'ice');

const RIM_W = 720;
const RIM_H = 240;
const FROZEN_W = 1080;
const FROZEN_H = 360;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Three surfaces — fill, ink, shine — drawn in step, and a brush for each. */
function layers(CK, w, h) {
  const make = () => {
    const s = CK.MakeSurface(w, h);
    s.getCanvas().clear(CK.TRANSPARENT);
    return s;
  };
  const surfaces = { fill: make(), ink: make(), shine: make() };
  const paint = (a = 1) => {
    const p = new CK.Paint();
    p.setAntiAlias(true);
    p.setColor(CK.Color4f(1, 1, 1, a));
    return p;
  };
  const strokePaint = (wd, a = 1) => {
    const p = paint(a);
    p.setStyle(CK.PaintStyle.Stroke);
    p.setStrokeWidth(wd);
    p.setStrokeCap(CK.StrokeCap.Round);
    p.setStrokeJoin(CK.StrokeJoin.Round);
    return p;
  };
  const poly = (pts) => {
    const p = new CK.Path();
    p.moveTo(...pts[0]);
    for (const q of pts.slice(1)) p.lineTo(...q);
    p.close();
    return p;
  };
  /**
   * A brush stroke that swells and tapers: a polygon built either side of a centre line, widest at
   * `peak` of the way along — the stroke the glyphs are inked with.
   */
  const brush = (layer, pts, width, a = 1, peak = 0.3) => {
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      const [x, y] = pts[i];
      const [nx0, ny0] = pts[Math.max(0, i - 1)], [nx1, ny1] = pts[Math.min(pts.length - 1, i + 1)];
      let dx = nx1 - nx0, dy = ny1 - ny0;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const swell = t < peak ? 0.35 + 0.65 * (t / peak) : 1 - 0.92 * ((t - peak) / (1 - peak));
      const half = (width / 2) * swell;
      left.push([x - dy * half, y + dx * half]);
      right.push([x + dy * half, y - dx * half]);
    }
    const p = poly([...left, ...right.reverse()]);
    const pt = paint(a);
    surfaces[layer].getCanvas().drawPath(p, pt);
    p.delete(); pt.delete();
  };
  const fillPoly = (layer, pts, a = 1) => {
    const p = poly(pts), pt = paint(a);
    surfaces[layer].getCanvas().drawPath(p, pt);
    p.delete(); pt.delete();
  };
  const line = (layer, pts, wd, a = 1) => {
    const p = new CK.Path();
    p.moveTo(...pts[0]);
    for (const q of pts.slice(1)) p.lineTo(...q);
    const pt = strokePaint(wd, a);
    surfaces[layer].getCanvas().drawPath(p, pt);
    p.delete(); pt.delete();
  };
  const dot = (layer, x, y, r, a = 1) => {
    const pt = paint(a);
    surfaces[layer].getCanvas().drawCircle(x, y, r, pt);
    pt.delete();
  };
  return { surfaces, brush, fillPoly, line, dot };
}

function save(CK, surface, name, transpose = false) {
  let image = surface.makeImageSnapshot();
  if (transpose) {
    const w = image.width(), h = image.height();
    const t = CK.MakeSurface(h, w);
    const c = t.getCanvas();
    c.clear(CK.TRANSPARENT);
    // Reflect across the diagonal: a top edge becomes a left edge, icicles pointing right.
    c.concat([0, 1, 0, 1, 0, 0, 0, 0, 1]);
    c.drawImage(image, 0, 0, null);
    image.delete();
    image = t.makeImageSnapshot();
    t.delete();
  }
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(image.encodeToBytes()));
  image.delete();
  console.log(`wrote ice/${name}.png`);
}

/* ── The rim ──────────────────────────────────────────────────────────────────────────────── */

/** One icicle hanging from (x, top): a tapered body, an inked edge down its shadow side, a shine
 *  down its lit side, and a drop gathering at the tip. */
function icicle(L, r, x, top, len, wd) {
  const lean = (r() - 0.5) * len * 0.12;
  const steps = 8;
  const spine = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    // A little ripple: icicles thicken in rings where they refroze.
    return [x + lean * t * t + Math.sin(t * 9 + x) * wd * 0.04, top + len * t];
  });
  L.brush('fill', spine, wd, 0.95, 0.12);
  L.brush('ink', spine.map(([sx, sy], i) => [sx + wd * 0.32 * (1 - i / steps), sy]), wd * 0.32, 1, 0.15);
  L.brush('shine', spine.slice(1, steps - 1).map(([sx, sy], i) => [sx - wd * 0.2 * (1 - i / steps), sy]), wd * 0.18, 0.9, 0.3);
  const [tx, ty] = spine[steps];
  if (r() < 0.6) {
    L.dot('ink', tx, ty + 2.5, 2.4, 0.9);
    L.dot('shine', tx - 0.6, ty + 2, 0.9, 0.8);
  }
}

function bakeRim(CK) {
  const L = layers(CK, RIM_W, RIM_H);
  const r = rng(0x1ce);
  // The crust: a periodic wave so the tile meets itself at the seam.
  const crustDepth = (x) => 26 + 9 * Math.sin((x / RIM_W) * Math.PI * 2 * 3) + 6 * Math.sin((x / RIM_W) * Math.PI * 2 * 7 + 1);
  const crust = [[0, 0]];
  for (let x = 0; x <= RIM_W; x += 12) crust.push([x, crustDepth(x) + (x > 0 && x < RIM_W ? (r() - 0.5) * 6 : 0)]);
  crust.push([RIM_W, 0]);
  L.fillPoly('fill', crust, 0.95);
  // The crust's lower edge, brushed in ink, and a rime sparkle along its top.
  L.line('ink', crust.slice(1, -1), 4, 1);
  for (let x = 8; x < RIM_W; x += 10 + r() * 16) L.dot('shine', x, 5 + r() * 12, 1 + r() * 2, 0.8);
  // Icicles: a long one now and then, a run of short ones between.
  let x = 14;
  while (x < RIM_W - 14) {
    const long = r() < 0.28;
    const len = long ? 130 + r() * 95 : 34 + r() * 70;
    const wd = long ? 20 + r() * 10 : 10 + r() * 9;
    icicle(L, r, x, crustDepth(x) - 6, len, wd);
    x += wd * 0.9 + 6 + r() * 22;
  }
  save(CK, L.surfaces.fill, 'rim-fill');
  save(CK, L.surfaces.ink, 'rim-ink');
  save(CK, L.surfaces.shine, 'rim-shine');
  save(CK, L.surfaces.fill, 'rim-v-fill', true);
  save(CK, L.surfaces.ink, 'rim-v-ink', true);
  save(CK, L.surfaces.shine, 'rim-v-shine', true);
}

/* ── The frozen field ─────────────────────────────────────────────────────────────────────── */

/** A crystal shard standing up out of the ledge: a long hexagonal prism with a pointed end, its
 *  front facet inked down the middle and a shine along the lit face. */
function shard(L, r, x, base, h, w, tilt) {
  const ux = Math.sin(tilt), uy = -Math.cos(tilt);
  const px = -uy, py = ux;
  const at = (along, across) => [x + ux * along + px * across, base + uy * along + py * across];
  const shoulder = h * 0.82;
  const outline = [at(0, -w / 2), at(shoulder, -w / 2), at(h, 0), at(shoulder, w / 2), at(0, w / 2)];
  L.fillPoly('fill', outline, 0.55 + r() * 0.2);
  L.line('ink', [at(0, -w / 2), at(shoulder, -w / 2), at(h, 0), at(shoulder, w / 2), at(0, w / 2)], 3.2, 1);
  L.line('ink', [at(0, w * 0.08), at(shoulder, w * 0.08), at(h, 0)], 2, 0.75);
  L.brush('shine', [at(h * 0.12, -w * 0.28), at(h * 0.45, -w * 0.28), at(shoulder * 0.9, -w * 0.26)], w * 0.1, 0.55, 0.4);
  // A crack, sometimes.
  if (r() < 0.4) {
    const a = h * (0.25 + r() * 0.4);
    L.line('ink', [at(a, -w / 2), at(a + w * 0.3, -w * 0.1), at(a + w * 0.2, w * 0.2)], 1.6, 0.7);
  }
}

/** A frost fern: a stem that branches as it climbs, each branch feathered with short barbs. */
function fern(L, r, x, y, len, angle, depth = 0) {
  const pts = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = angle + Math.sin(t * 3 + x) * 0.15;
    pts.push([x + Math.sin(a) * len * t, y - Math.cos(a) * len * t]);
  }
  L.brush('ink', pts, 4.5 - depth * 1.2, 0.9, 0.1);
  for (let i = 1; i < steps; i++) {
    const [bx, by] = pts[i];
    const b = len * 0.18 * (1 - i / steps);
    for (const s of [-1, 1]) L.line('ink', [[bx, by], [bx + Math.sin(angle + s * 0.9) * b, by - Math.cos(angle + s * 0.9) * b]], 1.4, 0.7);
  }
  if (depth < 2) {
    const i = 2 + Math.floor(r() * 3);
    const [bx, by] = pts[i];
    fern(L, r, bx, by, len * 0.55, angle + (r() < 0.5 ? -0.7 : 0.7), depth + 1);
  }
}

/** A six-armed crystal, each arm barbed twice. */
function flake(L, x, y, rad) {
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const ex = x + Math.cos(a) * rad, ey = y + Math.sin(a) * rad;
    L.line('ink', [[x, y], [ex, ey]], 2.2, 0.95);
    for (const f of [0.45, 0.72]) {
      const mx = x + Math.cos(a) * rad * f, my = y + Math.sin(a) * rad * f;
      const b = rad * 0.28 * (1.1 - f);
      for (const s of [-1, 1]) L.line('ink', [[mx, my], [mx + Math.cos(a + s * 0.9) * b, my + Math.sin(a + s * 0.9) * b]], 1.6, 0.9);
    }
  }
  L.dot('shine', x, y, rad * 0.12, 0.9);
}

function bakeFrozen(CK) {
  const L = layers(CK, FROZEN_W, FROZEN_H);
  const r = rng(0xf20);
  const ledgeTop = (x) => FROZEN_H - 30 - 6 * Math.sin(x / 70) - 4 * Math.sin(x / 23 + 2);
  /** How tall the ice may stand here: high against the sides, low through the middle. */
  const reach = (x) => {
    const edge = Math.min(x, FROZEN_W - x) / (FROZEN_W / 2);
    return 60 + 250 * Math.pow(1 - edge, 2.2);
  };

  // Ferns first, behind the shards.
  for (let x = 30; x < FROZEN_W; x += 70 + r() * 60) {
    fern(L, r, x, ledgeTop(x) + 4, Math.min(reach(x) * 0.7, 140) * (0.6 + r() * 0.4), (r() - 0.5) * 0.9);
  }
  // Shards, in clusters, leaning out from each cluster's heart.
  for (let x = 10; x < FROZEN_W - 10; x += 34 + r() * 40) {
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const h = reach(x) * (0.45 + r() * 0.55);
      const w = 14 + h * 0.12 + r() * 8;
      const tilt = (k - (n - 1) / 2) * 0.32 + (r() - 0.5) * 0.2;
      shard(L, r, x + k * 8, ledgeTop(x) + 8, h, w, tilt);
    }
  }
  // The ledge they stand in: a slab along the bottom, inked along its top.
  const ledge = [[0, FROZEN_H]];
  for (let x = 0; x <= FROZEN_W; x += 12) ledge.push([x, ledgeTop(x)]);
  ledge.push([FROZEN_W, FROZEN_H]);
  L.fillPoly('fill', ledge, 0.85);
  L.line('ink', ledge.slice(1, -1), 3.5, 1);
  for (let x = 6; x < FROZEN_W; x += 8 + r() * 14) L.dot('shine', x, ledgeTop(x) + 6 + r() * 14, 1 + r() * 1.8, 0.75);
  // Crystals in the air, kept off the low middle where the letters are.
  for (const [x, y, rad] of [[70, 70, 22], [190, 30, 14], [905, 46, 18], [1010, 110, 24], [300, 120, 11], [790, 150, 12]]) flake(L, x, y, rad);

  save(CK, L.surfaces.fill, 'frozen-fill');
  save(CK, L.surfaces.ink, 'frozen-ink');
  save(CK, L.surfaces.shine, 'frozen-shine');
}

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  bakeRim(CK);
  bakeFrozen(CK);
}

main().catch((e) => { console.error(e); process.exit(1); });
