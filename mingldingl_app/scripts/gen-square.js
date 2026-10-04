// scripts/gen-square.js — paints the shut gate of the quiet Town Square (components/townsquare/SessionStatusCard.tsx).
//
// Most days no gathering is called, and that empty state is what the tab shows. It was a door
// glyph; it is still the door, painted the way the Satchel's objects and the armoury are: a
// double gate of planks under a stone arch, iron-strapped, the bar dropped across it — the square
// is shut until the horn sounds. Flat planes, firelight on the lit face from the upper left, cool
// shadow on the other, a soft cast shadow, brush texture rubbed in.
// (Art style the user chose: https://claude.ai/artifact/2xenH48rqeMrQsCJCPxh9b.)
//
// Drawn with canvaskit-wasm's Canvas2D shim. Its gradients ignore the canvas transform, so nothing
// here is transformed: every coordinate is written in the drawing's 200-unit box and multiplied
// out to pixels by `K` inside the helpers.
//
// Rerun with: node scripts/gen-square.js   (writes assets/square/gate.png)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'square');
/** Pixels per drawing unit: a 200-unit box baked at 480px, shown at about 160pt. */
const K = 2.4;
const PX = Math.round(200 * K);

const M = {
  stone:   ['#9d968a', '#6a645b', '#3a3632', '#1a1816'],
  iron:    ['#a39a8e', '#5f5c58', '#34343a', '#16171b'],
  bronze:  ['#f3c27a', '#b9772f', '#6b3d17', '#2e1808'],
  wood:    ['#b07d4c', '#7a5130', '#462c18', '#1f130a'],
};
const OCHRE = '#d08a3a';

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  const asImage = (cv) => cv.decodeImage(Buffer.from(cv.toDataURL().split(',')[1], 'base64'));

  const brushCv = CK.MakeCanvas(PX, PX);
  {
    const b = brushCv.getContext('2d');
    const r = rng(7);
    b.fillStyle = '#808080';
    b.fillRect(0, 0, PX, PX);
    for (let i = 0; i < 4200; i++) {
      const x = r() * PX, y = r() * PX, len = (6 + r() * 22) * K * 0.6, a = -0.7 + (r() - 0.5) * 0.7;
      b.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.12})` : `rgba(0,0,0,${0.05 + r() * 0.14})`;
      b.lineWidth = (1 + r() * 3) * K * 0.5;
      b.lineCap = 'round';
      b.beginPath();
      b.moveTo(x, y);
      b.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      b.stroke();
    }
  }
  const BRUSH = asImage(brushCv);

  const cv = CK.MakeCanvas(PX, PX);
  const c = cv.getContext('2d');
  const k = (v) => v * K;
  const lin = (x0, y0, x1, y1, cols) => {
    const g = c.createLinearGradient(k(x0), k(y0), k(x1), k(y1));
    cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
    return g;
  };
  const radial = (x, y, r0, r1, cols) => {
    const g = c.createRadialGradient(k(x), k(y), k(r0), k(x), k(y), k(r1));
    cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
    return g;
  };
  const poly = (pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(k(x), k(y)) : c.moveTo(k(x), k(y)))); c.closePath(); };
  const rect = (x, y, w, h) => { c.beginPath(); c.rect(k(x), k(y), k(w), k(h)); };
  const circle = (x, y, r) => { c.beginPath(); c.arc(k(x), k(y), k(r), 0, Math.PI * 2); };
  const fill = (style, tex = 0.55) => {
    c.fillStyle = style;
    c.fill();
    if (!tex) return;
    c.save();
    c.clip();
    c.globalAlpha = tex;
    c.globalCompositeOperation = 'overlay';
    c.fillStyle = '#000';
    c.drawImage(BRUSH, 0, 0, PX, PX);
    c.restore();
  };
  const line = (pts, col, w, a = 1) => {
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = col;
    c.lineWidth = k(w);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(k(x), k(y)) : c.moveTo(k(x), k(y))));
    c.stroke();
    c.restore();
  };
  const ground = (x, y, rx, ry, a) => {
    for (let i = 0; i < 10; i++) {
      const s = 1 - i / 10;
      c.beginPath();
      c.ellipse(k(x), k(y), k(rx * s), k(ry * s), 0, 0, Math.PI * 2);
      c.fillStyle = `rgba(0,0,0,${(a / 10) * 1.4})`;
      c.fill();
    }
  };
  const rivet = (x, y, r, metal = 'iron') => {
    circle(x, y, r);
    c.fillStyle = radial(x - r * 0.35, y - r * 0.35, 0, r * 1.2, [M[metal][0], M[metal][1], M[metal][3]]);
    c.fill();
  };
  /** The arch's opening, as a path: straight jambs and a round head. */
  const opening = (inset) => {
    c.beginPath();
    c.moveTo(k(52 + inset), k(184));
    c.lineTo(k(52 + inset), k(92));
    c.arc(k(100), k(92), k(48 - inset), Math.PI, 0);
    c.lineTo(k(148 - inset), k(184));
    c.closePath();
  };

  ground(100, 186, 86, 9, 0.6);

  // ---- the stone arch: hewn blocks round the opening, each with a lit face and a shadow face ----
  const r = rng(31);
  const block = (pts, lit) => {
    poly(pts);
    fill(lit ? lin(pts[0][0], pts[0][1], pts[2][0], pts[2][1], [M.stone[0], M.stone[1], M.stone[2]])
      : lin(pts[0][0], pts[0][1], pts[2][0], pts[2][1], [M.stone[1], M.stone[2], M.stone[3]]), 0.6);
    line([pts[0], pts[1]], '#efe3cc', 0.9, lit ? 0.55 : 0.2);
    line([pts[1], pts[2], pts[3], pts[0]], '#141210', 0.8, 0.6);
  };
  // jambs: three courses a side
  [[150, 184], [118, 150], [88, 118]].forEach(([y0, y1]) => {
    const j = (r() - 0.5) * 3;
    block([[30 + j, y1], [52, y1], [52, y0], [30 - j, y0]], true);
    block([[148, y1], [170 - j, y1], [170 + j, y0], [148, y0]], false);
  });
  // the head: voussoirs fanned round the arc
  const VOUSSOIRS = 7;
  for (let i = 0; i < VOUSSOIRS; i++) {
    const a0 = Math.PI + (i / VOUSSOIRS) * Math.PI, a1 = Math.PI + ((i + 1) / VOUSSOIRS) * Math.PI;
    const ri = 48, ro = 70 + (i === 3 ? 6 : 0);
    const P = (a, rad) => [100 + Math.cos(a) * rad, 92 + Math.sin(a) * rad];
    block([P(a0, ro), P(a1, ro), P(a1, ri), P(a0, ri)], i < 4);
  }
  // the keystone's knot, painted in ochre
  c.save();
  c.lineWidth = k(2.2);
  c.strokeStyle = OCHRE;
  poly([[100, 23], [106, 29], [100, 35], [94, 29]]);
  c.stroke();
  c.restore();

  // ---- the doors: planks, darkest in the arch's shadow at the top ----
  c.save();
  opening(0);
  c.fillStyle = '#0d0907';
  c.fill();
  c.clip();
  for (let i = 0; i < 6; i++) {
    const x = 52 + i * 16;
    rect(x, 40, 16, 146);
    fill(lin(x, 0, x + 16, 0, i < 3 ? [M.wood[0], M.wood[1], M.wood[2]] : [M.wood[1], M.wood[2], M.wood[3]]), 0.8);
    line([[x + 0.6, 40], [x + 0.6, 186]], '#120a05', 1.4, 0.85);
    // grain
    line([[x + 6, 60 + r() * 30], [x + 6.6, 120 + r() * 50]], '#2a170a', 0.6, 0.5);
    line([[x + 11, 50 + r() * 30], [x + 10.4, 140 + r() * 40]], i < 3 ? '#e0b07c' : '#7a5130', 0.6, 0.35);
  }
  // the seam where the two leaves meet
  line([[100, 40], [100, 186]], '#060403', 2.2);
  // the arch's shadow falling over the top of the doors
  c.fillStyle = lin(0, 44, 0, 120, ['rgba(0,0,0,0.85)', 'rgba(0,0,0,0)']);
  c.fillRect(0, 0, PX, k(120));
  // and the right leaf a shade further from the fire
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.fillRect(k(100), 0, k(48), PX);
  // iron straps across each leaf, with hinge-scrolls on the outer edges
  [78, 128, 168].forEach((y) => {
    rect(52, y, 96, 7);
    fill(lin(0, y, 0, y + 7, [M.iron[0], M.iron[1], M.iron[3]]), 0.5);
    line([[52, y + 0.5], [148, y + 0.5]], '#d8c9ad', 0.8, 0.55);
    [58, 72, 86, 114, 128, 142].forEach((x) => rivet(x, y + 3.5, 1.7));
  });
  c.restore();

  // the bar dropped across both leaves, held in iron brackets: shut
  rect(46, 108, 108, 11);
  fill(lin(0, 108, 0, 119, [M.wood[0], M.wood[1], M.wood[3]]), 0.7);
  line([[47, 108.6], [153, 108.6]], '#f0c88e', 1, 0.6);
  line([[46, 119], [154, 119]], '#0d0907', 1.2, 0.7);
  [62, 130].forEach((x) => {
    rect(x, 105.5, 8, 16);
    fill(lin(x, 105, x + 8, 121, [M.iron[0], M.iron[1], M.iron[3]]), 0.4);
    rivet(x + 4, 109, 1.5); rivet(x + 4, 118, 1.5);
  });
  // ring pulls in bronze, one on each leaf, below the bar
  [[90, 142], [110, 142]].forEach(([x, y]) => {
    rivet(x, y - 6, 3, 'bronze');
    c.save();
    c.lineWidth = k(2.6);
    c.strokeStyle = M.bronze[1];
    c.beginPath(); c.arc(k(x), k(y + 2), k(7), 0, Math.PI * 2); c.stroke();
    c.lineWidth = k(0.9);
    c.strokeStyle = M.bronze[0];
    c.beginPath(); c.arc(k(x), k(y + 2), k(7), Math.PI * 1.05, Math.PI * 1.6); c.stroke();
    c.restore();
  });
  // the threshold stone
  poly([[24, 184], [176, 184], [182, 192], [18, 192]]);
  fill(lin(24, 184, 176, 192, [M.stone[1], M.stone[2], M.stone[3]]), 0.6);
  line([[24, 184.4], [176, 184.4]], '#efe3cc', 0.9, 0.45);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'gate.png'), Buffer.from(cv.toDataURL().split(',')[1], 'base64'));
  console.log(`wrote assets/square/gate.png (${PX}px)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
