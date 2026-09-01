// scripts/gen-ornaments.js — generates the Ulzii Design Language assets.
//
// Мөнгөлог өлзий хээ (endless-knot interlace) and алхан хээ (walking fret), rendered
// from geometry: knots are billiard paths traced inside an integer rectangle, woven
// over/under by crossing parity; frets are lattice meanders. Pure Node — capsule-stroke
// rasterizer with analytic AA and a zlib PNG encoder (same pattern as gen-parchment.js).
// Crossing punch-outs are alpha ERASES, so every asset sits on any background.
//
// Rerun with: node scripts/gen-ornaments.js   (writes assets/ornaments/*.png)

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ---------- palette (mirrors lib/theme.ts) ----------
const METALS = {
  gold:  { dark: '#5C4720', main: '#D97F1F', bright: '#F5A83C' },
  ember: { dark: '#5E2E17', main: '#C1461E', bright: '#D77951' },
  brass: { dark: '#4A3A17', main: '#B8923F', bright: '#E8C97A' },
  dim:   { dark: '#2B3140', main: '#4A5A6B', bright: '#6B7C8F' },
};
const SHADOW = [0, 0, 0, 0.55];

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1];
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

function polylineSegs(pts) {
  const segs = [];
  for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
  return segs;
}

// ---------- rasterizer: sequential capsule ops over an RGBA buffer ----------
function makeBuf(w, h) {
  return { w, h, d: new Float32Array(w * h * 4) };
}

function applyOp(buf, op) {
  const { w, h, d } = buf;
  const hw = op.hw, aa = 0.9;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x1, y1, x2, y2] of op.segs) {
    minX = Math.min(minX, x1, x2); maxX = Math.max(maxX, x1, x2);
    minY = Math.min(minY, y1, y2); maxY = Math.max(maxY, y1, y2);
  }
  const x0 = Math.max(0, Math.floor(minX - hw - 1)), x9 = Math.min(w - 1, Math.ceil(maxX + hw + 1));
  const y0 = Math.max(0, Math.floor(minY - hw - 1)), y9 = Math.min(h - 1, Math.ceil(maxY + hw + 1));
  for (let y = y0; y <= y9; y++) {
    for (let x = x0; x <= x9; x++) {
      let dist = Infinity;
      for (const [ax, ay, bx, by] of op.segs) {
        const vx = bx - ax, vy = by - ay;
        const len2 = vx * vx + vy * vy;
        let t = len2 === 0 ? 0 : ((x - ax) * vx + (y - ay) * vy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ddx = x - (ax + t * vx), ddy = y - (ay + t * vy);
        const dd = ddx * ddx + ddy * ddy;
        if (dd < dist) dist = dd;
      }
      const cov = Math.max(0, Math.min(1, (hw + aa / 2 - Math.sqrt(dist)) / aa));
      if (cov <= 0) continue;
      const i = (y * w + x) * 4;
      if (op.erase) {
        d[i + 3] *= 1 - cov;
      } else {
        const [r, g, b, ca] = op.color;
        const a = cov * ca;
        const da = d[i + 3];
        const outA = a + da * (1 - a);
        if (outA > 0) {
          d[i] = (r * a + d[i] * da * (1 - a)) / outA;
          d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / outA;
          d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / outA;
        }
        d[i + 3] = outA;
      }
    }
  }
}

// The five-layer "gild" from the design probe: shadow, dark edge, metal, highlight.
function gildOps(segs, W, metal) {
  return [
    { segs, hw: (W + 4.5) / 2, color: SHADOW },
    { segs, hw: (W + 2.5) / 2, color: hex(metal.dark) },
    { segs, hw: W / 2, color: hex(metal.main) },
    { segs, hw: Math.max(1.2, W * 0.3) / 2, color: hex(metal.bright) },
  ];
}

function renderKnot(m, n, s, W, metalName) {
  const metal = METALS[metalName];
  const pad = 0.62 * s;
  const w = Math.ceil(m * s + 2 * pad), h = Math.ceil(n * s + 2 * pad);
  const buf = makeBuf(w, h);
  const ops = [];
  for (const pts of traceStrands(m, n)) {
    ops.push(...gildOps(polylineSegs(strandPolyline(pts, m, n, s, pad)), W, metal));
  }
  // weave: punch out then re-lay the "over" diagonal at every cell crossing
  const seg = 0.42 * s;
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
    const cx = pad + (i + 0.5) * s, cy = pad + (j + 0.5) * s;
    const dy = (i + j) % 2 === 0 ? 1 : -1;
    const cross = [[cx - seg, cy - dy * seg, cx + seg, cy + dy * seg]];
    ops.push({ segs: cross, hw: (W + 9) / 2, erase: true });
    ops.push(...gildOps(cross, W, metal));
  }
  for (const op of ops) applyOp(buf, op);
  return buf;
}

// ---------- walking fret (алхан хээ) ----------
function renderMeander(units, g, W, metalName, darkOnly) {
  const metal = METALS[metalName];
  const uw = 4 * g;
  const w = Math.ceil(units * uw + g), h = Math.ceil(5 * g);
  const buf = makeBuf(w, h);
  const segs = [[0, 4 * g, w, 4 * g]];
  for (let k = 0; k < units; k++) {
    const x = k * uw + g;
    const hook = [
      [x, 4 * g, x, g],
      [x, g, x + 3 * g, g],
      [x + 3 * g, g, x + 3 * g, 3 * g],
      [x + 3 * g, 3 * g, x + 1.5 * g, 3 * g],
      [x + 1.5 * g, 3 * g, x + 1.5 * g, 2 * g + W],
    ];
    segs.push(...hook);
  }
  const ops = darkOnly
    ? [{ segs, hw: W / 2, color: [0, 0, 0, 0.6] }]
    : [
        { segs, hw: (W + 2) / 2, color: hex(metal.dark) },
        { segs, hw: W / 2, color: hex(metal.main) },
      ];
  for (const op of ops) applyOp(buf, op);
  return buf;
}

// ---------- PNG encode (RGBA, 8-bit) ----------
const crcTable = [...Array(256)].map((_, nn) => {
  let c = nn;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b) {
  let c = 0xffffffff;
  for (const v of b) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePng(buf, file) {
  const { w, h, d } = buf;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, o = row + 1 + x * 4;
      raw[o] = Math.round(d[i]);
      raw[o + 1] = Math.round(d[i + 1]);
      raw[o + 2] = Math.round(d[i + 2]);
      raw[o + 3] = Math.round(d[i + 3] * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  console.log('wrote', path.basename(file), `${w}x${h}`, png.length, 'bytes');
}

// ---------- the asset set (sizes are 3x display points) ----------
const outDir = path.join(__dirname, '..', 'assets', 'ornaments');
fs.mkdirSync(outDir, { recursive: true });
const out = f => path.join(outDir, f);

writePng(renderKnot(2, 2, 39, 7.8, 'gold'), out('knot_gold.png'));       // 44pt corner/medallion knot
writePng(renderKnot(2, 2, 39, 7.8, 'dim'), out('knot_dim.png'));         // sealed rooms, empty states
writePng(renderKnot(2, 2, 39, 7.8, 'ember'), out('knot_ember.png'));     // stakes at small size
writePng(renderKnot(5, 5, 27, 4.8, 'ember'), out('knot_boss_ember.png')); // the one grand knot per screen
writePng(renderKnot(3, 3, 22, 5.2, 'gold'), out('sigil_bond.png'));
writePng(renderKnot(3, 4, 20, 4.8, 'ember'), out('sigil_fate.png'));
writePng(renderKnot(4, 3, 20, 4.8, 'brass'), out('sigil_kinship.png'));
writePng(renderMeander(40, 10, 4.5, 'gold'), out('fret_gold.png'));      // dividers, XP track
writePng(renderMeander(40, 10, 4.5, null, true), out('fret_dark.png'));  // engraving overlay on fills
