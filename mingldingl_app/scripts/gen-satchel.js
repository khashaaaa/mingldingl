// scripts/gen-satchel.js — paints the nine objects the Satchel holds (components/satchel/SatchelRow.tsx).
//
// Ink stays the app's voice everywhere else; the Satchel is the one screen that lists things you
// carry, so its rows show the things themselves, painted the way the rocks and gems are: flat
// planes, firelight on the lit face from the upper left, cool shadow on the other, a soft cast
// shadow, brush texture rubbed in. Drawn small on purpose — each object keeps one silhouette and
// one lit face so it still reads at row size, and nothing in the drawing counts anything.
// (Prototype the user chose: https://claude.ai/artifact/2xenH48rqeMrQsCJCPxh9b.)
//
// Drawn with canvaskit-wasm's Canvas2D shim, so the drawing code is the prototype's own. Two of the
// shim's limits shape this file: it cannot draw one canvas into another, only a decoded image
// (`asImage`), and its gradients ignore the canvas transform. So every part is painted unrotated at
// the drawing's own size, and only finished images are turned and shrunk (`stamp`, and the last
// `drawImage` into the bake), which the shim does honour.
//
// Rerun with: node scripts/gen-satchel.js   (writes assets/satchel/*.png and components/satchel/satchelImages.ts)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'satchel');
const MAP_FILE = path.join(ROOT, 'components', 'satchel', 'satchelImages.ts');
/** One bake per object: the row shows it at 32pt, so this covers a 4x screen without upscaling. */
const PX = 128;
/** The drawing's own box. */
const BOX = 200;

// lit face (fire, warm) → mid → shadow face (cool)
const M = {
  steel:   ['#efe6d2', '#a8a9a8', '#58606b', '#262c36'],
  iron:    ['#a39a8e', '#5f5c58', '#34343a', '#16171b'],
  bronze:  ['#f3c27a', '#b9772f', '#6b3d17', '#2e1808'],
  gold:    ['#fbe39a', '#d39b34', '#7a4f14', '#33200a'],
  leather: ['#a8693e', '#6e3f22', '#3e2213', '#1c0f08'],
  wood:    ['#b07d4c', '#7a5130', '#462c18', '#1f130a'],
  wax:     ['#fbf0d4', '#d9bf8c', '#8d7046', '#3a2c18'],
  hair:    ['#f4efe6', '#c9c2b6', '#7c766d', '#3a3631'],
  red:     ['#e2533a', '#a42c1c', '#5c140b', '#260604'],
  vellum:  ['#f3e6c4', '#cdb486', '#86704a', '#3a2e1c'],
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

  // One brush texture, reused: short angled strokes, light and dark, on mid grey (so `overlay`
  // leaves the colour under it alone except where a stroke lands).
  const brushCv = CK.MakeCanvas(400, 400);
  {
    const b = brushCv.getContext('2d');
    const r = rng(7);
    b.fillStyle = '#808080';
    b.fillRect(0, 0, 400, 400);
    for (let i = 0; i < 2600; i++) {
      const x = r() * 400, y = r() * 400, len = 6 + r() * 22, a = -0.7 + (r() - 0.5) * 0.7;
      b.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.12})` : `rgba(0,0,0,${0.05 + r() * 0.14})`;
      b.lineWidth = 1 + r() * 3;
      b.lineCap = 'round';
      b.beginPath();
      b.moveTo(x, y);
      b.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      b.stroke();
    }
  }
  const BRUSH = asImage(brushCv);

  // ---- painting helpers (all in a 200×200 box, light from the upper left) ----
  const lin = (c, x0, y0, x1, y1, cols) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    cols.forEach((col, i) => g.addColorStop(Array.isArray(col) ? col[0] : i / (cols.length - 1), Array.isArray(col) ? col[1] : col));
    return g;
  };
  const radial = (c, x, y, r0, r1, cols) => {
    const g = c.createRadialGradient(x, y, r0, x, y, r1);
    cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
    return g;
  };
  const poly = (c, pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
  const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
  /** Fill the current path, then rub the brush texture into it. */
  const fill = (c, style, tex = 0.55) => {
    c.fillStyle = style;
    c.fill();
    if (!tex) return;
    c.save();
    c.clip();
    c.globalAlpha = tex;
    c.globalCompositeOperation = 'overlay';
    c.drawImage(BRUSH, 0, 0, BOX, BOX);
    c.restore();
  };
  const mat = (c, name, x0, y0, x1, y1) => {
    const m = M[name];
    return lin(c, x0, y0, x1, y1, [[0, m[0]], [0.35, m[1]], [0.75, m[2]], [1, m[3]]]);
  };
  /** Two faces split along a ridge: the lit face and the shadow face. */
  const faces = (c, name, left, right, bx) => {
    const m = M[name];
    poly(c, left);
    fill(c, lin(c, bx[0], bx[1], bx[2], bx[3], [m[0], m[1]]));
    poly(c, right);
    fill(c, lin(c, bx[0], bx[1], bx[2], bx[3], [m[2], m[3]]));
  };
  const line = (c, pts, col, w, a = 1) => {
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.stroke();
    c.restore();
  };
  /** The soft cast shadow: stacked ellipses, each a little smaller and darker. */
  const ground = (c, x, y, rx, ry, a = 0.55) => {
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const k = 1 - i / steps;
      c.beginPath();
      c.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2);
      c.fillStyle = `rgba(0,0,0,${(a / steps) * 1.4})`;
      c.fill();
    }
  };
  const layer = (draw) => {
    const cv = CK.MakeCanvas(BOX, BOX);
    draw(cv.getContext('2d'));
    return asImage(cv);
  };
  /** Paint a part upright on its own layer, then lay it down turned by `deg` about (cx, cy). */
  const stamp = (c, draw, deg, cx = 100, cy = 100) => {
    const img = layer(draw);
    c.save();
    c.translate(cx, cy);
    c.rotate((deg * Math.PI) / 180);
    c.translate(-cx, -cy);
    // The shim draws an image with the alpha of the current fill colour, so set an opaque one
    // first or a faint shadow's colour turns the whole part to a ghost.
    c.fillStyle = '#000';
    c.drawImage(img, 0, 0, BOX, BOX);
    c.restore();
  };
  const glow = (c, x, y, r, rgb, a) => {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = radial(c, x, y, 0, r, [`rgba(${rgb},${a})`, `rgba(${rgb},${a * 0.35})`, `rgba(${rgb},0)`]);
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  };
  const bez = (p0, p1, p2, p3, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
    return out;
  };
  const flame = (c, x, y, h, w) => {
    glow(c, x, y - h * 0.3, h * 2.2, '255,150,60', 0.32);
    c.beginPath();
    c.moveTo(x, y - h);
    c.bezierCurveTo(x + w * 0.3, y - h * 0.55, x + w, y - h * 0.25, x + w * 0.55, y);
    c.quadraticCurveTo(x, y + w * 0.45, x - w * 0.55, y);
    c.bezierCurveTo(x - w, y - h * 0.25, x - w * 0.2, y - h * 0.5, x, y - h);
    c.fillStyle = lin(c, x, y - h, x, y + w * 0.3, ['rgba(255,190,90,0.15)', 'rgba(255,170,70,0.95)', '#fff1c4']);
    c.fill();
    c.beginPath();
    c.ellipse(x, y - h * 0.18, w * 0.28, h * 0.3, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,248,220,0.9)';
    c.fill();
  };
  /** A blob of wax pressed flat, a ring stamped into it: the seal, as the app already means it. */
  const waxSeal = (c, x, y, r, seed) => {
    const rr = rng(seed);
    c.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2, d = r * (0.9 + rr() * 0.16);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath();
    fill(c, radial(c, x - r * 0.4, y - r * 0.45, 0, r * 1.5, [M.red[0], M.red[1], M.red[2], M.red[3]]), 0.4);
    circle(c, x, y, r * 0.62);
    c.lineWidth = r * 0.12;
    c.strokeStyle = 'rgba(40,6,2,0.6)';
    c.stroke();
    c.beginPath();
    c.arc(x, y, r * 0.62, Math.PI * 1.05, Math.PI * 1.55);
    c.strokeStyle = 'rgba(255,190,160,0.55)';
    c.lineWidth = r * 0.06;
    c.stroke();
    poly(c, [[x, y - r * 0.32], [x + r * 0.32, y], [x, y + r * 0.32], [x - r * 0.32, y]]);
    c.fillStyle = 'rgba(40,6,2,0.55)';
    c.fill();
  };

  // ---- the nine objects, keyed as `app/satchel.tsx` keys its rows ----
  const ITEMS = {
    candles(c) {
      ground(c, 100, 178, 70, 10, 0.6);
      c.beginPath(); c.ellipse(100, 172, 66, 13, 0, 0, Math.PI * 2);
      fill(c, mat(c, 'iron', 40, 160, 160, 185), 0.5);
      c.beginPath(); c.ellipse(100, 169, 60, 10, 0, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
      const one = (x, top, w) => {
        c.beginPath();
        c.moveTo(x - w, 168); c.lineTo(x - w, top + 4); c.quadraticCurveTo(x, top - 3, x + w, top + 4); c.lineTo(x + w, 168); c.closePath();
        fill(c, lin(c, x - w, 0, x + w, 0, [M.wax[0], M.wax[1], M.wax[2], M.wax[3]]), 0.5);
        c.beginPath();
        c.moveTo(x - w * 0.9, top + 4); c.quadraticCurveTo(x - w * 0.8, top + 22, x - w * 0.55, top + 26); c.quadraticCurveTo(x - w * 0.4, top + 14, x - w * 0.2, top + 4); c.closePath();
        fill(c, M.wax[0], 0.3);
        line(c, [[x, top], [x + 0.8, top - 7]], '#1a120a', 2);
        flame(c, x + 0.8, top - 7, 22, 7);
      };
      one(74, 92, 15);
      one(126, 70, 16);
      one(100, 116, 14);
    },

    arrows(c) {
      ground(c, 100, 188, 50, 7);
      [[-14, M.red[1]], [14, M.red[1]], [0, '#efe4cc']].forEach(([deg, col]) => stamp(c, (c) => {
        c.beginPath(); c.rect(97.5, 42, 5, 140);
        fill(c, lin(c, 97, 0, 103, 0, M.wood), 0.4);
        faces(c, 'steel', [[100, 12], [91, 34], [95, 46], [100, 46]], [[100, 12], [109, 34], [105, 46], [100, 46]], [91, 12, 109, 46]);
        line(c, [[100, 13], [91.5, 34]], '#fff1d6', 1.4, 0.85);
        [-1, 1].forEach((s) => {
          c.beginPath();
          c.moveTo(100, 144); c.quadraticCurveTo(100 + s * 13, 150, 100 + s * 13, 172); c.lineTo(100, 179); c.closePath();
          fill(c, s < 0 ? col : M.hair[1], 0.6);
        });
      }, deg, 100, 130));
      c.beginPath(); c.rect(78, 126, 44, 9);
      fill(c, lin(c, 0, 126, 0, 135, [OCHRE, '#6a3e14']), 0.5);
    },

    lantern(c) {
      ground(c, 100, 186, 52, 8);
      glow(c, 100, 112, 80, '255,160,70', 0.28);
      c.save();
      c.lineWidth = 5; c.strokeStyle = M.bronze[1];
      c.beginPath(); c.arc(100, 30, 11, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
      c.restore();
      poly(c, [[84, 36], [116, 36], [134, 62], [66, 62]]);
      fill(c, mat(c, 'bronze', 66, 36, 134, 62), 0.6);
      c.beginPath(); c.rect(70, 62, 60, 92);
      c.fillStyle = radial(c, 100, 112, 4, 54, ['#fff1c4', '#f6a04a', '#7a3a12']);
      c.fill();
      flame(c, 100, 122, 22, 8);
      [[64, 10], [95, 10], [126, 10]].forEach(([x, w]) => { c.beginPath(); c.rect(x, 60, w, 96); fill(c, lin(c, x, 0, x + w, 0, M.bronze), 0.5); });
      c.beginPath(); c.rect(66, 103, 68, 6); fill(c, lin(c, 0, 103, 0, 109, M.bronze), 0.4);
      poly(c, [[62, 154], [138, 154], [144, 172], [56, 172]]);
      fill(c, mat(c, 'bronze', 56, 154, 144, 172), 0.6);
      line(c, [[67, 61], [133, 61]], '#ffe2a8', 1.4, 0.7);
    },

    /** The vow worn on a thong: a bronze disc with the knot struck into it. */
    oath(c) {
      ground(c, 100, 186, 56, 8);
      line(c, bez([70, 64], [64, 10], [136, 10], [130, 64], 20), M.leather[1], 5);
      line(c, bez([70, 62], [65, 14], [134, 14], [129, 62], 20), M.leather[0], 1.4, 0.6);
      circle(c, 100, 112, 62);
      fill(c, mat(c, 'bronze', 40, 50, 160, 174), 0.6);
      circle(c, 100, 112, 50);
      fill(c, lin(c, 50, 62, 150, 162, [M.bronze[2], M.bronze[1], M.bronze[0]]), 0.5);
      c.save();
      c.lineWidth = 7;
      c.lineCap = 'round';
      const knot = (dx, dy) => {
        [[0, -24], [24, 0], [0, 24], [-24, 0]].forEach(([x, y]) => { circle(c, 100 + x + dx, 112 + y + dy, 9); c.stroke(); });
        poly(c, [[100 + dx, 88 + dy], [124 + dx, 112 + dy], [100 + dx, 136 + dy], [76 + dx, 112 + dy]]);
        c.stroke();
      };
      c.strokeStyle = 'rgba(30,14,4,0.75)';
      knot(1.5, 2);
      c.strokeStyle = M.bronze[0];
      knot(0, 0);
      c.restore();
      c.save();
      c.strokeStyle = '#fff0c8'; c.globalAlpha = 0.75; c.lineWidth = 2.2;
      c.beginPath(); c.arc(100, 112, 61, Math.PI * 1.02, Math.PI * 1.6); c.stroke();
      c.restore();
    },

    /** The Hall's key: iron, a knot in its eye, a gold collar. */
    key(c) {
      ground(c, 100, 176, 56, 8);
      stamp(c, keyUpright, -38);
    },
  };
  function keyUpright(c) {
      c.beginPath(); c.arc(100, 50, 32, 0, Math.PI * 2); c.arc(100, 50, 15, 0, Math.PI * 2, true);
      fill(c, mat(c, 'iron', 68, 18, 132, 82), 0.6);
      c.save();
      c.strokeStyle = '#e7d6b6'; c.globalAlpha = 0.7; c.lineWidth = 1.8;
      c.beginPath(); c.arc(100, 50, 31, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
      c.restore();
      c.save();
      c.strokeStyle = M.gold[1]; c.lineWidth = 4;
      poly(c, [[100, 39], [111, 50], [100, 61], [89, 50]]); c.stroke();
      c.restore();
      c.beginPath(); c.rect(94, 80, 12, 94);
      fill(c, lin(c, 94, 0, 106, 0, M.iron), 0.6);
      line(c, [[94.8, 82], [94.8, 172]], '#d8c9ad', 1.2, 0.6);
      [84, 95].forEach((y) => { c.beginPath(); c.rect(89, y, 22, 7); fill(c, lin(c, 0, y, 0, y + 7, M.gold), 0.4); });
      c.beginPath();
      c.moveTo(106, 138); c.lineTo(134, 138); c.lineTo(134, 148); c.lineTo(124, 148); c.lineTo(124, 155); c.lineTo(134, 155);
      c.lineTo(134, 174); c.lineTo(116, 174); c.lineTo(116, 165); c.lineTo(106, 165); c.closePath();
      fill(c, mat(c, 'iron', 106, 138, 134, 174), 0.6);
  }
  Object.assign(ITEMS, {

    /** An ally's word: a letter rolled and tied, a wax seal on the cord. */
    word(c) {
      ground(c, 100, 176, 72, 9);
      stamp(c, (c) => {
      c.beginPath(); c.rect(40, 84, 120, 40);
      fill(c, lin(c, 0, 84, 0, 124, [M.vellum[0], M.vellum[1], M.vellum[2], M.vellum[3]]), 0.6);
      [40, 160].forEach((x, i) => {
        c.beginPath(); c.ellipse(x, 104, 9, 20, 0, 0, Math.PI * 2);
        fill(c, lin(c, x - 9, 84, x + 9, 124, i ? [M.vellum[2], M.vellum[3]] : [M.vellum[0], M.vellum[2]]), 0.4);
        c.beginPath(); c.ellipse(x, 104, 4, 10, 0, 0, Math.PI * 2);
        c.fillStyle = 'rgba(40,28,14,0.7)'; c.fill();
      });
      line(c, [[44, 87], [156, 87]], '#fff6dc', 1.6, 0.7);
      c.beginPath(); c.rect(94, 82, 12, 44);
      fill(c, lin(c, 94, 0, 106, 0, M.red), 0.4);
      }, -24, 100, 104);
      line(c, bez([108, 122], [118, 150], [132, 150], [140, 170], 16), M.red[1], 4);
      line(c, bez([104, 124], [100, 150], [88, 156], [80, 174], 16), M.red[1], 4);
      waxSeal(c, 104, 122, 20, 41);
    },

    /** The worn honour: a gold medal on a red ribbon, a flame struck in it. */
    honour(c) {
      ground(c, 100, 186, 50, 7);
      poly(c, [[66, 14], [96, 14], [112, 96], [88, 104]]);
      fill(c, lin(c, 66, 14, 100, 104, [M.red[0], M.red[1], M.red[2]]), 0.5);
      poly(c, [[104, 14], [134, 14], [112, 104], [88, 96]]);
      fill(c, lin(c, 104, 14, 134, 104, [M.red[1], M.red[2], M.red[3]]), 0.5);
      line(c, [[68, 16], [90, 102]], '#ffb49a', 1.4, 0.5);
      circle(c, 100, 128, 48);
      fill(c, mat(c, 'gold', 52, 80, 148, 176), 0.5);
      circle(c, 100, 128, 38);
      fill(c, lin(c, 62, 90, 138, 166, [M.gold[2], M.gold[1], M.gold[0]]), 0.4);
      // the flame, struck: a shadow-side cut and a lit-side edge
      const cut = (dx, dy) => {
        c.beginPath();
        c.moveTo(100 + dx, 100 + dy);
        c.bezierCurveTo(108 + dx, 116 + dy, 122 + dx, 124 + dy, 114 + dx, 146 + dy);
        c.quadraticCurveTo(100 + dx, 156 + dy, 86 + dx, 146 + dy);
        c.bezierCurveTo(80 + dx, 130 + dy, 96 + dx, 122 + dy, 100 + dx, 100 + dy);
        c.closePath();
      };
      cut(1.5, 1.5); c.fillStyle = 'rgba(50,28,6,0.8)'; c.fill();
      cut(0, 0); fill(c, lin(c, 86, 100, 116, 156, [M.gold[0], M.gold[1]]), 0.3);
      c.save();
      c.strokeStyle = '#fff6d0'; c.globalAlpha = 0.8; c.lineWidth = 2;
      c.beginPath(); c.arc(100, 128, 47, Math.PI * 1.02, Math.PI * 1.6); c.stroke();
      c.restore();
      glow(c, 82, 106, 12, '255,240,200', 0.35);
    },

    /** The seals held on you: three pressed in red wax. */
    seals(c) {
      ground(c, 100, 176, 76, 10);
      waxSeal(c, 62, 118, 34, 3);
      waxSeal(c, 138, 118, 34, 9);
      waxSeal(c, 100, 92, 38, 17);
    },

    /** Your card: a vellum leaf with a red stone set at its head. */
    card(c) {
      ground(c, 104, 182, 58, 8);
      stamp(c, (c) => {
      poly(c, [[58, 24], [142, 24], [142, 176], [58, 176]]);
      fill(c, mat(c, 'vellum', 58, 24, 142, 176), 0.7);
      line(c, [[64, 30], [136, 30], [136, 170], [64, 170], [64, 30]], '#6a4e2a', 2, 0.6);
      line(c, [[59, 25], [141, 25]], '#fff6dc', 1.6, 0.7);
      [124, 138, 152].forEach((y, i) => line(c, [[74, y], [126 - i * 12, y]], '#6a4e2a', 2.4, 0.55));
      // the stone: a cut with a lit top-left face, a shadow lower-right
      const g = [100, 74];
      poly(c, [[g[0], g[1] - 30], [g[0] + 26, g[1] - 8], [g[0] + 16, g[1] + 26], [g[0] - 16, g[1] + 26], [g[0] - 26, g[1] - 8]]);
      fill(c, M.red[2], 0);
      poly(c, [[g[0], g[1] - 30], [g[0] - 26, g[1] - 8], [g[0] - 10, g[1] + 2]]); fill(c, M.red[0], 0.2);
      poly(c, [[g[0], g[1] - 30], [g[0] + 26, g[1] - 8], [g[0] + 10, g[1] + 2]]); fill(c, M.red[1], 0.2);
      poly(c, [[g[0] - 10, g[1] + 2], [g[0] + 10, g[1] + 2], [g[0], g[1] - 30]]); fill(c, '#f07a5c', 0.2);
      poly(c, [[g[0] - 10, g[1] + 2], [g[0] + 10, g[1] + 2], [g[0] + 16, g[1] + 26], [g[0] - 16, g[1] + 26]]); fill(c, M.red[1], 0.2);
      }, 8);
      glow(c, 92, 52, 16, '255,200,180', 0.4);
    },
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const entries = [];
  for (const [name, draw] of Object.entries(ITEMS)) {
    const art = layer(draw);
    const cv = CK.MakeCanvas(PX, PX);
    // A touch inside the box, so a cast shadow or a flame's glow is never cut at the edge.
    const inset = PX * 0.03;
    cv.getContext('2d').drawImage(art, inset, inset, PX - inset * 2, PX - inset * 2);
    fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(cv.toDataURL().split(',')[1], 'base64'));
    entries.push(`  ${name}: require('../../assets/satchel/${name}.png'),`);
  }

  fs.writeFileSync(MAP_FILE, `// Generated by scripts/gen-satchel.js — rerun it, never edit this.
import type { ImageSourcePropType } from 'react-native';

export type SatchelObject = ${Object.keys(ITEMS).map((k) => `'${k}'`).join(' | ')};

/** Each object the Satchel holds, painted (${PX}px, shown at 32pt). */
export const SATCHEL_IMAGES: Record<SatchelObject, ImageSourcePropType> = {
${entries.join('\n')}
};
`);
  console.log(`wrote ${entries.length} objects to ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
