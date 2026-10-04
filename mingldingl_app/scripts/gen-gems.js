// scripts/gen-gems.js — paints the six tier stones (components/progression/GemTierBadge.tsx).
//
// The world is ink and stone; the gems are the only things in it that shine. Each tier is a real
// faceted solid, turned in 3D, lit from the upper left, and painted rather than rendered: every
// facet filled with its own lit colour, then brushed with short strokes along its grain, its edges
// caught in light, an inner glow welling up from the core. The stones get rarer and better cut as
// the ladder climbs, so the cut itself says how high:
//   Garnet   — rough, still in its skin, barely lit
//   Opal     — tumbled smooth, colour moving between its faces
//   Amethyst — a cluster of points growing from one root
//   Sapphire — one long shard with veins of light running through it
//   Ruby     — the first true cut, a ten-sided brilliant
//   Emerald  — the step cut named after it, the strongest glow
// (Prototype the user chose: https://claude.ai/artifact/8Wx31BySgwjCnSkwcvWNrL.)
//
// Two kinds of image per stone, both full colour on a transparent ground:
//   still — one pose, at 64/128/256px, for every badge in a row, a bar or a HUD
//   sway  — the stone rocking on its axis and breathing light, FRAMES poses in a COLS-wide sheet at
//           128/256px a cell, for the hero placements that are allowed to burn (`glow`)
//
// The portrait frames on Profile were pecked here too; they are brushed now, in `scripts/gen-brush.js`.
//
// Rerun with: node scripts/gen-gems.js   (writes assets/gems/*.png and components/progression/gemImages.ts)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'gems');
const MAP_FILE = path.join(ROOT, 'components', 'progression', 'gemImages.ts');
const STILL_SIZES = [64, 128, 256];
const SWAY_SIZES = [128, 256];
const FRAMES = 24;
const COLS = 6;
/** The drawing's own box. The prototype's strokes were tuned for a stone ~140 across. */
const REF = 180;
/** How much of the box the stone fills; the rest is its halo. */
const FILL = 0.8;
/** How far the sway rocks the stone either side of its pose, in radians. */
const SWAY = 0.38;

const TAU = Math.PI * 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function rot(v, yaw, pitch) {
  const [x, y, z] = v, c = Math.cos(yaw), s = Math.sin(yaw);
  const x2 = x * c + z * s, z2 = -x * s + z * c, cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [x2, y * cp - z2 * sp, y * sp + z2 * cp];
}
function rng(seed) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const h2 = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a) => `rgba(${Math.max(0, Math.min(255, c[0] | 0))},${Math.max(0, Math.min(255, c[1] | 0))},${Math.max(0, Math.min(255, c[2] | 0))},${a})`;
const WHITE = [255, 250, 240];

/** Where a line through (ox, oy) along (dx, dy) enters and leaves a convex polygon. */
function clipLine(poly, ox, oy, dx, dy) {
  let lo = Infinity, hi = -Infinity, hits = 0;
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length], ex = B[0] - A[0], ey = B[1] - A[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const ax = A[0] - ox, ay = A[1] - oy, t = (ax * ey - ay * ex) / den, u = (ax * dy - ay * dx) / den;
    if (u >= 0 && u <= 1) { hits++; if (t < lo) lo = t; if (t > hi) hi = t; }
  }
  return hits >= 2 ? [lo, hi] : null;
}

// ---------- the solids ----------

/** Faces wound outward, degenerate ones marked dead, and the edge list with each edge's faces. */
function finalize(m, center) {
  m.dead = [];
  m.f = m.f.map((f, i) => {
    const n = cross(sub(m.v[f[1]], m.v[f[0]]), sub(m.v[f[2]], m.v[f[0]]));
    if (Math.hypot(n[0], n[1], n[2]) < 1e-7) { m.dead[i] = true; return f; }
    let c = [0, 0, 0];
    f.forEach((k) => { c = add(c, m.v[k]); });
    c = mul(c, 1 / f.length);
    return dot(n, sub(c, center)) < 0 ? f.slice().reverse() : f;
  });
  const E = new Map();
  m.f.forEach((f, i) => {
    if (m.dead[i]) return;
    for (let j = 0; j < f.length; j++) {
      const a = f[j], b = f[(j + 1) % f.length], k = a < b ? `${a}_${b}` : `${b}_${a}`;
      let e = E.get(k);
      if (!e) { e = { a, b, f: [] }; E.set(k, e); }
      e.f.push(i);
    }
  });
  m.edges = Array.from(E.values());
  return m;
}
function ico(subdiv) {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nrm);
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < subdiv; s++) {
    const cache = {}, nf = [];
    const mid = (a, b) => {
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (cache[k] !== undefined) return cache[k];
      v.push(nrm(mul(add(v[a], v[b]), 0.5)));
      return (cache[k] = v.length - 1);
    };
    f.forEach(([a, b, c]) => { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); });
    f = nf;
  }
  return { v, f };
}
/** A sphere planed flat by random cuts: a rough or tumbled stone. */
function rockMesh(seed, sc, cuts) {
  const r = rng(seed), m = ico(2), planes = [];
  for (let i = 0; i < cuts; i++) planes.push([nrm([r() * 2 - 1, r() * 1.6 - 0.5, r() * 2 - 1]), 0.5 + r() * 0.32]);
  planes.push([[0, -1, 0], 0.45]);
  m.v = m.v.map((v) => {
    for (let pass = 0; pass < 2; pass++) planes.forEach(([n, d]) => { const k = dot(v, n) - d; if (k > 0) v = sub(v, mul(n, k)); });
    return [v[0] * sc[0], v[1] * sc[1], v[2] * sc[2]];
  });
  return finalize(m, [0, 0, 0]);
}
/** A six-sided crystal point growing from `p` along `axis`. */
function crystal(p, axis, rad, len, tip, tw) {
  const u = nrm(axis), v = nrm(cross(u, Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), w = cross(u, v), V = [];
  for (let i = 0; i < 6; i++) { const th = tw + (i * Math.PI) / 3; V.push(add(p, add(mul(v, Math.cos(th) * rad), mul(w, Math.sin(th) * rad)))); }
  for (let i = 0; i < 6; i++) { const th = tw + (i * Math.PI) / 3; V.push(add(add(p, mul(u, len)), add(mul(v, Math.cos(th) * rad * 0.96), mul(w, Math.sin(th) * rad * 0.96)))); }
  V.push(add(p, mul(u, len + tip)));
  const F = [];
  for (let i = 0; i < 6; i++) { const j = (i + 1) % 6; F.push([i, j, 6 + j, 6 + i]); F.push([6 + i, 6 + j, 12]); }
  F.push([5, 4, 3, 2, 1, 0]);
  return finalize({ v: V, f: F }, add(p, mul(u, len * 0.5)));
}
function loft(rings, n) {
  const V = [], F = [];
  rings.forEach((rg) => rg.forEach((p) => V.push(p)));
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) {
    const a = i * n + j, b = i * n + ((j + 1) % n);
    F.push([a, b, b + n, a + n]);
  }
  const top = [], bot = [];
  for (let j = 0; j < n; j++) { top.push(j); bot.push((rings.length - 1) * n + j); }
  F.push(top); F.push(bot.reverse());
  return finalize({ v: V, f: F }, [0, 0, 0]);
}
function emeraldCut() {
  const c = 0.24, base = [[1 - c, 0.58], [1, 0.58 - c], [1, -0.58 + c], [1 - c, -0.58], [-1 + c, -0.58], [-1, -0.58 + c], [-1, 0.58 - c], [-1 + c, 0.58]];
  const ring = (y, sx, sz) => base.map((p) => [p[0] * sx, y, p[1] * sz]);
  return loft([ring(0.34, 0.62, 0.62), ring(0.2, 0.84, 0.84), ring(0, 1, 1), ring(-0.28, 0.76, 0.76), ring(-0.5, 0.5, 0.46), ring(-0.64, 0.36, 0.06)], 8);
}
function brilliant(N) {
  const V = [], F = [], st = TAU / N;
  for (let i = 0; i < N; i++) V.push([Math.cos(i * st), 0, Math.sin(i * st)]);
  for (let i = 0; i < N; i++) V.push([Math.cos((i + 0.5) * st) * 0.58, 0.38, Math.sin((i + 0.5) * st) * 0.58]);
  V.push([0, -0.95, 0]);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    F.push([i, j, N + i]); F.push([N + i, j, N + j]); F.push([i, j, 2 * N]);
  }
  const tab = [];
  for (let i = 0; i < N; i++) tab.push(N + i);
  F.push(tab);
  return finalize({ v: V, f: F }, [0, 0, 0]);
}

/** Colours are `GEM_COLORS` / `GEM_SHADES` in lib/theme.ts; glow climbs the ladder like `TIER_PRESENCE`. */
const TIERS = [
  { name: 'Garnet', jewel: '#B06B78', shade: '#4C282F', glow: 0.22, yaw: 0.3, pitch: 0.3, brush: 0.5, sparks: 0,
    meshes: () => [rockMesh(11, [1, 0.86, 0.92], 9)] },
  { name: 'Opal', jewel: '#10C0AC', shade: '#053934', glow: 0.36, yaw: 1.36, pitch: 0.35, opal: true, sparks: 1,
    meshes: () => [rockMesh(23, [1.15, 0.72, 0.92], 20)] },
  { name: 'Amethyst', jewel: '#A855F7', shade: '#480687', glow: 0.46, yaw: 2.42, pitch: 0.3, sparks: 1,
    meshes: () => [
      crystal([0, -0.95, 0], [0, 1, 0], 0.32, 1.2, 0.45, 0), crystal([-0.32, -0.95, 0.1], [-0.5, 1, 0.1], 0.24, 0.9, 0.35, 0.5),
      crystal([0.34, -0.95, -0.05], [0.55, 1, 0], 0.25, 0.95, 0.35, 0.2), crystal([0.05, -0.95, 0.32], [0.1, 1, 0.6], 0.18, 0.7, 0.28, 0.8),
      crystal([-0.05, -0.95, -0.32], [-0.1, 1, -0.6], 0.17, 0.62, 0.26, 0.4),
    ] },
  { name: 'Sapphire', jewel: '#427BE2', shade: '#10306A', glow: 0.56, yaw: 3.48, pitch: 0.25, veins: true, sparks: 2,
    meshes: () => [crystal([0, -1.05, 0], [0.12, 1, 0.05], 0.46, 1.35, 0.6, 0.3)] },
  { name: 'Ruby', jewel: '#EE2B75', shade: '#68082C', glow: 0.68, yaw: 4.54, pitch: 0.62, sparks: 2,
    meshes: () => [brilliant(10)] },
  { name: 'Emerald', jewel: '#2CC46C', shade: '#0D3A20', glow: 0.8, yaw: 5.48, pitch: 0.7, sparks: 3,
    meshes: () => [emeraldCut()] },
];
const OPAL_FIRE = ['#10C0AC', '#ff7ab0', '#ffd36a', '#9c8cff', '#6af0c8'].map(hex);
const LIGHT = nrm([-0.4, 0.72, 0.58]);

/** The stone's projected extent over every pose it will be drawn in, so the sway never jitters. */
function fit(T, meshes) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let f = 0; f < FRAMES; f++) {
    const yaw = T.yaw + SWAY * Math.sin((TAU * f) / FRAMES);
    meshes.forEach((m) => m.v.forEach((v) => {
      const p = rot(v, yaw, T.pitch);
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, -p[1]); y1 = Math.max(y1, -p[1]);
    }));
  }
  const s = (REF * FILL) / Math.max(x1 - x0, y1 - y0);
  return { s, cx: REF / 2 - ((x0 + x1) / 2) * s, cy: REF / 2 - ((y0 + y1) / 2) * s };
}

/**
 * One pose of a stone, painted into a `px` box whose corner is (ox, oy). Everything is placed in
 * device pixels by hand — CanvasKit's 2D emulation does not carry the transform into gradients, so
 * a scaled context paints the halo and the inner light in the wrong place. `phase` runs 0..1 round
 * the loop; every animated term is a whole number of cycles of it, so the last frame meets the first.
 */
function paintGem(c, T, meshes, F, yaw, phase, sparks, px, ox = 0, oy = 0) {
  const k = px / REF;
  const jewel = hex(T.jewel), shade = hex(T.shade), light = mixc(jewel, WHITE, 0.62);
  const wave = TAU * phase;
  const pulse = 0.85 + 0.15 * Math.sin(wave);
  const P = { cx: ox + F.cx * k, cy: oy + F.cy * k, s: F.s * k, yaw, pitch: T.pitch };
  const faces = [], allSv = [], normals = {};
  meshes.forEach((m, mi) => {
    const tv = m.v.map((v) => rot(v, P.yaw, P.pitch));
    const sv = tv.map((v) => [P.cx + v[0] * P.s, P.cy - v[1] * P.s]);
    allSv.push(sv);
    m.f.forEach((f, i) => {
      if (m.dead[i]) return;
      const n = nrm(cross(sub(tv[f[1]], tv[f[0]]), sub(tv[f[2]], tv[f[0]])));
      let z = 0;
      f.forEach((k) => { z += tv[k][2]; });
      faces.push({ poly: f.map((k) => sv[k]), n, z: z / f.length, id: mi * 997 + i });
      normals[`${mi}:${i}`] = n;
    });
  });
  faces.sort((a, b) => a.z - b.z);

  // The halo, small enough to fade out inside the box.
  const mid = px / 2;
  const halo = c.createRadialGradient(ox + mid, oy + mid, 0, ox + mid, oy + mid, mid);
  halo.addColorStop(0, css(jewel, T.glow * 0.5 * pulse));
  halo.addColorStop(0.5, css(jewel, T.glow * 0.16 * pulse));
  halo.addColorStop(1, css(jewel, 0));
  c.fillStyle = halo;
  c.fillRect(ox, oy, px, px);

  const trace = (poly) => { c.beginPath(); c.moveTo(poly[0][0], poly[0][1]); for (let j = 1; j < poly.length; j++) c.lineTo(poly[j][0], poly[j][1]); c.closePath(); };
  faces.forEach((Fc) => {
    const front = Fc.n[2] > 0, lit = Math.max(0, dot(Fc.n, LIGHT));
    let base = jewel;
    if (T.opal) base = mixc(OPAL_FIRE[Fc.id % OPAL_FIRE.length], jewel, 0.35 + 0.3 * Math.sin(wave + Fc.id));
    if (!front) {
      trace(Fc.poly);
      c.fillStyle = css(mixc(shade, base, 0.3 + 0.25 * Math.max(0, -dot(Fc.n, LIGHT))), 0.95);
      c.fill();
      return;
    }
    const R = sub(mul(Fc.n, 2 * dot(Fc.n, LIGHT)), LIGHT), spec = Math.pow(Math.max(0, R[2]), 14);
    const col = mixc(mixc(shade, base, 0.28 + 0.72 * lit), WHITE, spec * 0.85);
    trace(Fc.poly);
    c.fillStyle = css(col, 0.84);
    c.fill();
    // Brush strokes along the facet's grain.
    const p0 = Fc.poly[0], p1 = Fc.poly[1], a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) + (h2(Fc.id, 3) - 0.5) * 0.5;
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, sp = 2.3 * k;
    let mn = 1e9, mx = -1e9;
    Fc.poly.forEach((p) => { const q = (p[0] - p0[0]) * nx + (p[1] - p0[1]) * ny; if (q < mn) mn = q; if (q > mx) mx = q; });
    c.lineCap = 'round';
    for (let j = Math.ceil(mn / sp); j <= Math.floor(mx / sp); j++) {
      const sx = p0[0] + nx * j * sp, sy = p0[1] + ny * j * sp, tt = clipLine(Fc.poly, sx, sy, dx, dy);
      if (!tt) continue;
      const u = h2(Fc.id, j), v2 = h2(j, Fc.id + 7), len = tt[1] - tt[0];
      const s0 = tt[0] + len * u * 0.3, s1 = tt[1] - len * v2 * 0.3;
      if (s1 - s0 < 2 * k) continue;
      const tone = u < 0.5 ? mixc(col, shade, 0.25 + v2 * 0.25) : mixc(col, light, 0.2 + v2 * 0.4);
      c.strokeStyle = css(tone, (T.brush || 0.38) * (0.5 + u * 0.5));
      c.lineWidth = (1.4 + v2 * 1.6) * k;
      c.beginPath(); c.moveTo(sx + dx * s0, sy + dy * s0); c.lineTo(sx + dx * s1, sy + dy * s1); c.stroke();
    }
  });
  // Edges caught in light, brighter the more the facet faces it.
  c.lineWidth = 0.9 * k;
  meshes.forEach((m, mi) => {
    const sv = allSv[mi];
    m.edges.forEach((e) => {
      if (e.f.length < 2) return;
      const n1 = normals[`${mi}:${e.f[0]}`], n2 = normals[`${mi}:${e.f[1]}`];
      if (!n1 || !n2 || (n1[2] <= 0 && n2[2] <= 0) || dot(n1, n2) > 0.95) return;
      const lit = Math.max(0, dot(n1[2] > 0 ? n1 : n2, LIGHT));
      c.strokeStyle = css(light, 0.2 + 0.55 * lit);
      c.beginPath(); c.moveTo(sv[e.a][0], sv[e.a][1]); c.lineTo(sv[e.b][0], sv[e.b][1]); c.stroke();
    });
  });

  c.save();
  c.globalCompositeOperation = 'lighter';
  // The light inside, welling up from the core.
  const core = c.createRadialGradient(P.cx, P.cy + P.s * 0.1, 0, P.cx, P.cy, P.s * 0.9);
  core.addColorStop(0, css(light, 0.32 * pulse * (T.glow + 0.3)));
  core.addColorStop(1, css(jewel, 0));
  c.fillStyle = core;
  c.fillRect(P.cx - P.s, P.cy - P.s, P.s * 2, P.s * 2);
  if (T.veins) {
    c.shadowColor = css(light, 1);
    c.shadowBlur = 8 * k;
    c.lineWidth = 1.3 * k;
    [[0, -0.7, 0.05, 0.15, -0.3, 0.1, -0.05, 0.1, 0.2, 0.3, 0.6, 0.1], [0.1, -0.4, 0.2, -0.15, 0.1, -0.2, 0.2, 0.5, 0]].forEach((vein, vi) => {
      c.strokeStyle = css(light, (0.5 + 0.4 * Math.sin(wave * 2 + vi * 2)) * pulse);
      c.beginPath();
      for (let q = 0; q + 2 < vein.length; q += 3) {
        const w = rot([vein[q], vein[q + 1], vein[q + 2]], P.yaw, P.pitch), X = P.cx + w[0] * P.s, Y = P.cy - w[1] * P.s;
        if (q === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
      }
      c.stroke();
    });
    c.shadowBlur = 0;
  }
  // Sparks that catch on the stone's corners as it turns: only in the sway, where the badge's own
  // glint is switched off.
  if (sparks) {
    const sv0 = allSv[0];
    for (let si = 0; si < T.sparks; si++) {
      const ph = (phase + si / T.sparks) % 1, amp = Math.sin(ph * Math.PI), sz = amp * (5 + T.glow * 7) * k;
      if (sz < 0.5 * k) continue;
      const [X, Y] = sv0[Math.floor(h2(si, T.glow * 10) * sv0.length)];
      c.fillStyle = css(WHITE, 0.9 * amp);
      c.beginPath();
      c.moveTo(X, Y - sz);
      c.quadraticCurveTo(X, Y, X + sz * 0.9, Y);
      c.quadraticCurveTo(X, Y, X, Y + sz);
      c.quadraticCurveTo(X, Y, X - sz * 0.9, Y);
      c.quadraticCurveTo(X, Y, X, Y - sz);
      c.fill();
    }
  }
  c.restore();
}

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));

  const save = (canvas, name) => {
    const b64 = canvas.toDataURL('image/png').split(',')[1];
    fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(b64, 'base64'));
    canvas.dispose();
  };

  const entries = [];
  for (const T of TIERS) {
    const meshes = T.meshes();
    const F = fit(T, meshes);
    const id = T.name.toLowerCase();
    for (const px of STILL_SIZES) {
      const cv = CK.MakeCanvas(px, px);
      const c = cv.getContext('2d');
      paintGem(c, T, meshes, F, T.yaw, 0.25, false, px);
      save(cv, `${id}-still-${px}.png`);
    }
    const rows = Math.ceil(FRAMES / COLS);
    for (const px of SWAY_SIZES) {
      const cv = CK.MakeCanvas(px * COLS, px * rows);
      const c = cv.getContext('2d');
      for (let f = 0; f < FRAMES; f++) {
        const phase = f / FRAMES;
        const ox = (f % COLS) * px, oy = Math.floor(f / COLS) * px;
        c.save();
        c.beginPath();
        c.rect(ox, oy, px, px);
        c.clip();
        paintGem(c, T, meshes, F, T.yaw + SWAY * Math.sin(TAU * phase), phase, true, px, ox, oy);
        c.restore();
      }
      save(cv, `${id}-sway-${px}.png`);
    }
    const req = (kind, px) => `${px}: require('../../assets/gems/${id}-${kind}-${px}.png')`;
    entries.push(`  ${T.name}: {\n    still: { ${STILL_SIZES.map((px) => req('still', px)).join(', ')} },\n    sway: { ${SWAY_SIZES.map((px) => req('sway', px)).join(', ')} },\n  },`);
  }

  fs.writeFileSync(MAP_FILE, [
    '// Generated by scripts/gen-gems.js — rerun it, never edit this.',
    "import type { ImageSourcePropType } from 'react-native';",
    "import type { GemTier } from '../../models/user';",
    '',
    '/** The pixel sizes each stone\'s still is baked at; the badge picks the smallest that covers its size. */',
    `export const GEM_STILL_PIXELS = [${STILL_SIZES.join(', ')}] as const;`,
    '/** The cell sizes of the sway sheets. */',
    `export const GEM_SWAY_PIXELS = [${SWAY_SIZES.join(', ')}] as const;`,
    '/** A sway sheet holds this many poses, left to right then down, this many to a row. */',
    `export const GEM_SWAY_FRAMES = ${FRAMES};`,
    `export const GEM_SWAY_COLS = ${COLS};`,
    '',
    'export const GEM_IMAGES: Record<GemTier, {',
    '  still: Record<(typeof GEM_STILL_PIXELS)[number], ImageSourcePropType>;',
    '  sway: Record<(typeof GEM_SWAY_PIXELS)[number], ImageSourcePropType>;',
    '}> = {',
    ...entries,
    '};',
    '',
  ].join('\n'));
  console.log(`${TIERS.length} stones: stills at ${STILL_SIZES.join('/')}px, ${FRAMES}-pose sways at ${SWAY_SIZES.join('/')}px`);
}

main().catch((e) => { console.error(e); process.exit(1); });
