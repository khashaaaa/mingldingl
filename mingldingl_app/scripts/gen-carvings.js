// scripts/gen-carvings.js — the rock carvings along the foot of every room (`components/world/Carvings.tsx`).
//
// Each room has one frieze: a band of figures cut into the stone at the bottom of the screen, where
// the room's own light rises off the floor, so the fire is what finds them. They are drawn the way
// the Bronze Age carvers of the Altai drew — Tsagaan Salaa, Baga Oigor, the deer stones — as
// chunky silhouettes made of pecks, the stone knocked away dot by dot: ibex with their horns swept
// back over the body, riders, archers, dancers in a line. The Deep alone is not carved but
// *painted*, in the rust-red ochre of the Khoit Tsenkher cave, and it is where the monsters are.
//
// A frieze sits *behind* the UI and covers the full width, so it has to stay out of the way: no
// rock face, no fill, nothing but the marks themselves. The PNGs are white on transparent — an
// alpha mask — and the component tints them (stone for the carvings, ochre for the Deep) so the
// colour stays a theme token rather than being baked in.
//
// Seeded throughout: every peck lands where it did last time.
//
// Rerun with: node scripts/gen-carvings.js
//   (writes assets/carvings/{room}.png and components/world/carvingImages.ts)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'carvings');
const MAP_FILE = path.join(ROOT, 'components', 'world', 'carvingImages.ts');

/** Three times a 360pt-wide phone, and a third as tall: the band is 120pt on that phone. */
const W = 1080;
const H = 360;
/** Every figure is drawn this much larger than its scene entry says, about the band's centre. */
const ZOOM = 1.22;
/** Where the figures stand. A little off the bottom edge so the vignette does not eat their feet. */
const G = 336;

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

/* ── The carver's hand ────────────────────────────────────────────────────────────────────────
 * Figures are drawn in their own coordinates: origin at the feet, y up is negative, about 100
 * units tall. `d` is the chisel: strokes, filled bodies and dots, nothing finer — a carving has no
 * hairlines, so the thinnest mark is still a fat line. `bold` fattens every stroke, for figures
 * cut small enough that their lines would otherwise be thinner than a peck.
 */
function chisel(CK, c, bold = 1) {
  const stroke = new CK.Paint();
  stroke.setAntiAlias(true);
  stroke.setColor(CK.WHITE);
  stroke.setStyle(CK.PaintStyle.Stroke);
  stroke.setStrokeCap(CK.StrokeCap.Round);
  stroke.setStrokeJoin(CK.StrokeJoin.Round);
  const fill = new CK.Paint();
  fill.setAntiAlias(true);
  fill.setColor(CK.WHITE);

  const run = (build, w) => {
    const p = new CK.Path();
    build(p);
    stroke.setStrokeWidth(w * bold);
    c.drawPath(p, stroke);
    p.delete();
  };
  return {
    /** A polyline: [[x,y], …]. */
    line(pts, w = 7) {
      run((p) => { p.moveTo(...pts[0]); for (const q of pts.slice(1)) p.lineTo(...q); }, w);
    },
    /** A quadratic stroke. */
    bend(x0, y0, cx, cy, x1, y1, w = 7) {
      run((p) => { p.moveTo(x0, y0); p.quadTo(cx, cy, x1, y1); }, w);
    },
    /** A cubic stroke. */
    sweep(x0, y0, c1x, c1y, c2x, c2y, x1, y1, w = 7) {
      run((p) => { p.moveTo(x0, y0); p.cubicTo(c1x, c1y, c2x, c2y, x1, y1); }, w);
    },
    /** A filled body, an ellipse turned by `rot` degrees. */
    body(cx, cy, rx, ry, rot = 0) {
      c.save();
      c.translate(cx, cy);
      c.rotate(rot, 0, 0);
      c.drawOval(CK.LTRBRect(-rx, -ry, rx, ry), fill);
      c.restore();
    },
    /** A filled polygon. */
    slab(pts) {
      const p = new CK.Path();
      p.moveTo(...pts[0]);
      for (const q of pts.slice(1)) p.lineTo(...q);
      p.close();
      c.drawPath(p, fill);
      p.delete();
    },
    dot(x, y, r) { c.drawCircle(x, y, r, fill); },
    ring(x, y, r, w = 6) {
      stroke.setStrokeWidth(w * bold);
      c.drawCircle(x, y, r, stroke);
    },
  };
}

/** Pecked: the stone knocked out a dot at a time, wherever `inside(x, y)` says the drawing is.
 *  Dense inside it, with a few stray blows just past its edge, and gaps where a peck missed.
 *  `fine` below 1 is a smaller chisel, for carving cut small. */
function peck(CK, c, inside, w, h, r, fine = 1) {
  const dotPaint = new CK.Paint();
  dotPaint.setAntiAlias(true);
  const step = 3.6 * fine;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const jx = x + (r() - 0.5) * step * 1.2, jy = y + (r() - 0.5) * step * 1.2;
      const a = inside(jx, jy);
      let hit = a > 0.5 && r() < 0.86;
      if (!hit && a <= 0.5) {
        const near = inside(jx + 6, jy) + inside(jx - 6, jy) + inside(jx, jy + 6) + inside(jx, jy - 6);
        hit = near > 0.5 && r() < 0.07;
      }
      if (!hit) continue;
      dotPaint.setColor(CK.Color4f(1, 1, 1, 0.6 + r() * 0.4));
      c.drawCircle(jx, jy, (1.4 + r() * 1.3) * fine, dotPaint);
    }
  }
  dotPaint.delete();
}

/* ── The figures ──────────────────────────────────────────────────────────────────────────── */

/** A person, stick-built the way the carvers built them: round head, one line for a body, knees
 *  bent. `arms` are two hand positions, reached from the shoulder. */
function person(d, { arms = [[-16, -66], [16, -66]], legs = 'stand', h = 1 } = {}) {
  const hip = -46 * h, shoulder = -76 * h, head = -88 * h;
  d.dot(0, head, 7.5);
  d.line([[0, head + 6], [0, hip]], 7.5);
  for (const [x, y] of arms) d.line([[0, shoulder], [x * 0.55, (shoulder + y) / 2 + 4], [x, y]], 6);
  if (legs === 'stand') {
    d.line([[0, hip], [-9, -22 * h], [-12, 0]], 6.5);
    d.line([[0, hip], [9, -22 * h], [12, 0]], 6.5);
  } else if (legs === 'dance') {
    d.line([[0, hip], [-16, -26 * h], [-10, 0]], 6.5);
    d.line([[0, hip], [14, -28 * h], [22, -6]], 6.5);
  } else if (legs === 'stride') {
    d.line([[0, hip], [-14, -20 * h], [-22, 0]], 6.5);
    d.line([[0, hip], [10, -22 * h], [16, 0]], 6.5);
  }
}

/** An ibex: a stubby body on stick legs, and the horns — the whole animal is really the horns,
 *  swept back in a great arc over its own spine. */
function ibex(d, r) {
  const lift = (r() - 0.5) * 4;
  d.body(0, -44, 30, 11);
  d.line([[-20, -40], [-24 + lift, 0]], 6);
  d.line([[-10, -40], [-8, 0]], 6);
  d.line([[14, -40], [12 - lift, 0]], 6);
  d.line([[24, -40], [28, 0]], 6);
  d.line([[-28, -50], [-36, -60]], 5);
  d.line([[24, -50], [36, -66]], 9);
  d.body(41, -66, 9, 5.5, 25);
  d.line([[44, -62], [43, -54]], 4);
  d.sweep(36, -72, 34, -108, 6, -116, -18, -92, 6.5);
}

/** A horse: a heavy body, a thick neck reaching forward, the tail swinging. */
function horse(d, r) {
  const step = (r() - 0.5) * 8;
  d.body(0, -50, 34, 13);
  d.line([[-24, -44], [-30 + step, 0]], 7);
  d.line([[-14, -44], [-10, 0]], 7);
  d.line([[18, -44], [16 - step, 0]], 7);
  d.line([[28, -44], [32, 0]], 7);
  d.line([[28, -56], [42, -82]], 11);
  d.line([[42, -82], [58, -72]], 9);
  d.line([[40, -86], [38, -96]], 4);
  d.bend(-33, -56, -48, -50, -48, -26, 6);
}

/** A rider: a horse with a person astride, one arm out with the reins. */
function rider(d, r) {
  horse(d, r);
  d.dot(4, -104, 7.5);
  d.line([[4, -98], [2, -62]], 7.5);
  d.line([[3, -86], [22, -78], [36, -80]], 6);
  d.line([[2, -64], [10, -50], [8, -40]], 6);
}

/** A wolf: low and long, ears up, a tail hanging straight out behind. */
function wolf(d, r) {
  const step = (r() - 0.5) * 6;
  d.body(0, -32, 32, 8);
  d.line([[-22, -28], [-30 + step, 0]], 5.5);
  d.line([[-12, -28], [-6, 0]], 5.5);
  d.line([[16, -28], [10 - step, 0]], 5.5);
  d.line([[26, -28], [34, 0]], 5.5);
  d.slab([[26, -38], [52, -36], [30, -28]]);
  d.line([[32, -38], [34, -50]], 4.5);
  d.line([[38, -38], [42, -50]], 4.5);
  d.bend(-30, -34, -50, -34, -60, -20, 6);
}

/** An archer, drawing: the bow a bent arc held out front, the arrow nocked across it. */
function archer(d) {
  person(d, { arms: [[30, -76], [6, -76]], legs: 'stride' });
  d.bend(30, -104, 46, -76, 30, -48, 5.5);
  d.line([[2, -76], [52, -76]], 4);
  d.slab([[52, -82], [62, -76], [52, -70]]);
}

/** A stag: slim body, high head, and antlers branching up and back — the deer the hunters
 *  followed, and the deer the deer stones were raised for. */
function stag(d, r) {
  const step = (r() - 0.5) * 6;
  d.body(0, -50, 30, 10, -4);
  d.line([[-20, -44], [-24 + step, 0]], 5.5);
  d.line([[-10, -44], [-8, 0]], 5.5);
  d.line([[16, -48], [14 - step, 0]], 5.5);
  d.line([[24, -48], [30, 0]], 5.5);
  d.line([[-28, -54], [-34, -60]], 4.5);
  d.line([[24, -56], [34, -82]], 8);
  d.body(40, -84, 9, 5, 20);
  d.sweep(32, -88, 20, -110, 4, -118, -12, -126, 5);
  for (const [x, y, tx, ty] of [[24, -102, 30, -122], [12, -114, 14, -136], [0, -120, -2, -142]]) d.line([[x, y], [tx, ty]], 4.5);
}

/** A tethering post, the serge: a stone pillar with a notched top. */
function post(d) {
  d.slab([[-8, 0], [-7, -96], [0, -108], [7, -96], [8, 0]]);
  d.line([[-14, -80], [14, -80]], 6);
  d.line([[-12, -64], [12, -64]], 5);
}

/** The sun, as every rock in the steppe has it: a ring with rays. */
function sun(d) {
  d.ring(0, 0, 16, 6);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    d.line([[Math.cos(a) * 24, Math.sin(a) * 24], [Math.cos(a) * 34, Math.sin(a) * 34]], 5);
  }
}

/** A fire: crossed logs and three tongues of flame. */
function fire(d) {
  d.line([[-26, 0], [26, -6]], 7);
  d.line([[26, 0], [-26, -6]], 7);
  d.sweep(-14, -14, -30, -30, -10, -42, -24, -58, 6);
  d.sweep(0, -14, 12, -36, -10, -52, 2, -78, 7);
  d.sweep(14, -14, 30, -28, 12, -42, 26, -56, 6);
}

/** A ger: the wall, the dome, the door and the smoke ring at the crown. */
function ger(d) {
  d.line([[-44, 0], [-44, -30], [44, -30], [44, 0]], 7);
  d.sweep(-48, -30, -40, -72, 40, -72, 48, -30, 7);
  d.line([[-10, 0], [-10, -22], [10, -22], [10, 0]], 6);
  d.ring(0, -66, 6, 5);
  d.sweep(0, -76, -8, -92, 10, -100, 2, -118, 5);
}

/** The smith: braced, hammer raised over the anvil, sparks off the strike. */
function smith(d) {
  person(d, { arms: [[26, -112], [30, -44]], legs: 'stride' });
  d.line([[26, -112], [44, -126]], 5.5);
  d.slab([[36, -140], [48, -136], [52, -112], [40, -116]]);
  d.slab([[24, -40], [64, -40], [56, -30], [50, -30], [50, -10], [60, 0], [28, 0], [38, -10], [38, -30], [30, -30]]);
  for (const [x, y, s] of [[64, -58, 4], [74, -66, 3.5], [58, -72, 3.5], [80, -50, 3], [70, -82, 3]]) d.dot(x, y, s);
}

/** A fiddler with the horse-head fiddle, seated, bow across the strings. */
function fiddler(d) {
  d.dot(0, -78, 7.5);
  d.line([[0, -72], [0, -40]], 7.5);
  d.line([[0, -40], [18, -38], [20, 0]], 6.5);
  d.line([[0, -40], [-14, -30], [-6, 0]], 6.5);
  d.line([[16, -6], [18, -86]], 5);
  d.slab([[10, -34], [24, -34], [22, -12], [12, -12]]);
  d.slab([[14, -86], [24, -94], [28, -88], [18, -82]]);
  d.line([[0, -64], [14, -50]], 5.5);
  d.line([[0, -64], [-10, -54], [30, -20]], 5);
}

/* ── The Deep's monsters (painted, not carved) ─────────────────────────────────────────────── */

/** The mangus: a giant of the old epics, three heads on its shoulders and a club. */
function mangus(d) {
  d.body(0, -92, 26, 38);
  d.line([[-12, -58], [-24, -28], [-20, 0]], 13);
  d.line([[12, -58], [26, -28], [24, 0]], 13);
  d.line([[-22, -116], [-50, -92], [-60, -120]], 10);
  d.line([[22, -116], [52, -100], [66, -132]], 10);
  d.line([[66, -132], [84, -168]], 9);
  d.body(86, -172, 11, 15, 20);
  for (const [nx, hx, hy] of [[-14, -30, -168], [0, 0, -176], [14, 30, -168]]) {
    d.line([[nx, -124], [hx, hy + 10]], 9);
    d.body(hx, hy, 11, 12);
    d.line([[hx - 8, hy - 8], [hx - 13, hy - 20]], 4.5);
    d.line([[hx + 8, hy - 8], [hx + 13, hy - 20]], 4.5);
  }
}

/** The luu: the steppe's dragon, serpent-long, coiling, horned and with its jaw open. */
function luu(d) {
  const spine = [[-110, -30], [-80, -70], [-40, -24], [0, -62], [40, -26], [70, -64], [96, -84]];
  for (let i = 0; i < spine.length - 1; i++) {
    const [x0, y0] = spine[i], [x1, y1] = spine[i + 1];
    d.bend(x0, y0, (x0 + x1) / 2, i % 2 ? y0 - 30 : y0 + 30, x1, y1, 6 + i * 2.2);
  }
  d.slab([[90, -92], [128, -96], [112, -84], [130, -76], [96, -74]]);
  d.line([[96, -94], [86, -116], [72, -120]], 5);
  d.line([[104, -94], [102, -118], [90, -128]], 5);
  for (const [x, y] of [[-52, -32], [-14, -40], [28, -34], [56, -48]]) {
    d.line([[x, y], [x - 4, y + 22]], 5);
    d.line([[x - 4, y + 22], [x - 12, y + 26]], 3.5);
    d.line([[x - 4, y + 22], [x + 4, y + 27]], 3.5);
  }
}

/** The garuda: the bird-man, wings spread to the edges, beak and talons. */
function garuda(d) {
  d.body(0, -70, 13, 28);
  d.dot(0, -108, 10);
  d.slab([[6, -112], [26, -104], [6, -100]]);
  for (const s of [-1, 1]) {
    d.slab([[0, -86], [s * 70, -132], [s * 92, -112], [s * 72, -96], [s * 84, -82], [s * 60, -74], [s * 66, -60], [0, -66]]);
    d.line([[s * 6, -44], [s * 12, -16], [s * 4, 0]], 7);
    d.line([[s * 12, -16], [s * 22, -4]], 4);
  }
  d.line([[0, -44], [0, -30]], 9);
}

/** A handprint, the oldest mark there is. */
function hand(d, r) {
  const tilt = (r() - 0.5) * 30;
  d.body(0, -18, 13, 15, tilt);
  const fingers = [[-15, -30, -40, 6], [-7, -36, -10, 5.5], [1, -38, 0, 5.5], [9, -36, 10, 5.5], [16, -30, 22, 5]];
  for (const [x, y, a, w] of fingers) {
    const len = a === -40 ? 14 : 18;
    const rad = ((a + tilt - 90) * Math.PI) / 180;
    d.line([[x * 0.9, y + 6], [x * 0.9 + Math.cos(rad) * len, y + 6 + Math.sin(rad) * len]], w * 1.4);
  }
}

/* ── The rooms ────────────────────────────────────────────────────────────────────────────────
 * [figure, x, scale, facing (1 right, -1 left), lift above the ground line].
 */
const SCENES = {
  // Horses tied at the gate's post, a sun above: arriving, and staying.
  gate: { painted: false, figures: [
    [sun, 160, 1, 1, 210], [horse, 330, 1.15, 1, 0], [post, 540, 1.1, 1, 0],
    [horse, 740, 1.15, -1, 0], [horse, 930, 0.7, -1, 0],
  ] },
  // The road: riders ahead, ibex on the slope, a wolf running behind.
  road: { painted: false, figures: [
    [wolf, 110, 1.1, 1, 0], [rider, 300, 1.15, 1, 0], [ibex, 520, 1, 1, 30],
    [ibex, 650, 0.85, -1, 70], [rider, 830, 1.05, 1, 0], [sun, 990, 0.8, 1, 230],
  ] },
  // The feast: a fire with a line of dancers either side and the fiddle playing.
  tavern: { painted: false, figures: [
    [fiddler, 120, 1.15, 1, 0],
    [(d) => person(d, { arms: [[-24, -96], [24, -96]], legs: 'dance' }), 270, 1.1, 1, 0],
    [(d) => person(d, { arms: [[-24, -96], [24, -96]], legs: 'dance' }), 360, 1.1, -1, 0],
    [fire, 540, 1.3, 1, 0],
    [(d) => person(d, { arms: [[-24, -96], [24, -96]], legs: 'dance' }), 720, 1.1, 1, 0],
    [(d) => person(d, { arms: [[-24, -96], [24, -96]], legs: 'dance' }), 810, 1.1, -1, 0],
    [(d) => person(d, { arms: [[-24, -96], [24, -96]], legs: 'dance' }), 900, 1.1, 1, 0],
  ] },
  // Home: the ger, the fire, and the family round it.
  hearth: { painted: false, figures: [
    [ger, 200, 1.35, 1, 0], [sun, 420, 0.9, 1, 220],
    [(d) => person(d, { arms: [[-14, -52], [18, -60]] }), 470, 1.15, 1, 0],
    [fire, 590, 1.1, 1, 0],
    [(d) => person(d, { arms: [[-18, -60], [14, -52]] }), 710, 1.15, 1, 0],
    [(d) => person(d, { arms: [[-14, -48], [14, -48]], h: 0.62 }), 790, 1.15, 1, 0],
    [horse, 950, 0.95, -1, 0],
  ] },
  // The forge: the smith at the anvil, the fire behind, a blade cooling.
  forge: { painted: false, figures: [
    [fire, 170, 1.2, 1, 0], [smith, 380, 1.15, 1, 0],
    [(d) => { d.line([[-60, -6], [50, -6]], 7); d.slab([[50, -12], [70, -6], [50, 0]]); d.line([[-60, -18], [-60, 6]], 7); }, 700, 1.1, 1, 0],
    [horse, 900, 1.05, -1, 0],
  ] },
  // The hall: what is remembered — the deer of the stones, and the archers who hunted them.
  hall: { painted: false, figures: [
    [archer, 120, 1.1, 1, 0], [stag, 340, 1.1, 1, 0], [stag, 560, 0.95, 1, 40],
    [archer, 800, 1.05, -1, 0], [sun, 960, 0.9, 1, 200],
  ] },
  // The Deep: painted, not carved. The garuda, the mangus with small people under it, the luu,
  // and the hands of whoever came down here first.
  deep: { painted: true, figures: [
    [hand, 60, 1.3, 1, 150], [garuda, 180, 1.1, 1, 0],
    [(d) => person(d, { arms: [[-20, -96], [22, -96]], legs: 'stride' }), 360, 0.75, -1, 0],
    [mangus, 470, 1.05, 1, 0],
    [archer, 600, 0.75, -1, 0],
    [luu, 820, 1.15, -1, 0], [hand, 1030, 1.2, 1, 170], [hand, 975, 1.0, 1, 110],
  ] },
};

/* ── Bake ─────────────────────────────────────────────────────────────────────────────────── */

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const names = Object.keys(SCENES);
  for (const [i, name] of names.entries()) {
    const scene = SCENES[name];
    const r = rng(0xca7 + i * 977);

    // 1. The figures as clean silhouettes — the drawing the carver had in mind.
    const maskSurface = CK.MakeSurface(W, H);
    const m = maskSurface.getCanvas();
    m.clear(CK.TRANSPARENT);
    const d = chisel(CK, m);
    for (const [fig, x, s, facing, lift] of scene.figures) {
      m.save();
      m.translate(W / 2 + (x - W / 2) * 1.04, G - lift * ZOOM);
      m.scale(s * facing * ZOOM, s * ZOOM);
      fig(d, r);
      m.restore();
    }
    const maskImage = maskSurface.makeImageSnapshot();
    const px = maskImage.readPixels(0, 0, {
      width: W, height: H, colorType: CK.ColorType.RGBA_8888,
      alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB,
    });
    const inside = (x, y) => {
      const xi = x | 0, yi = y | 0;
      if (xi < 0 || yi < 0 || xi >= W || yi >= H) return 0;
      return px[(yi * W + xi) * 4 + 3] / 255;
    };

    // 2. What is actually on the rock.
    const surface = CK.MakeSurface(W, H);
    const c = surface.getCanvas();
    c.clear(CK.TRANSPARENT);
    const dotPaint = new CK.Paint();
    dotPaint.setAntiAlias(true);

    if (!scene.painted) {
      peck(CK, c, inside, W, H, r);
    } else {
      // Painted: ochre laid on with a finger and a pad, gone patchy with age. The silhouette,
      // softened; then weathered away in flakes and in broad faded patches.
      const soft = new CK.Paint();
      soft.setAntiAlias(true);
      soft.setImageFilter(CK.ImageFilter.MakeBlur(1.6, 1.6, CK.TileMode.Decal, null));
      soft.setAlphaf(0.92);
      c.drawImage(maskImage, 0, 0, soft);
      soft.delete();
      const erase = new CK.Paint();
      erase.setAntiAlias(true);
      erase.setBlendMode(CK.BlendMode.DstOut);
      for (let k = 0; k < 40; k++) {
        erase.setColor(CK.Color4f(0, 0, 0, 0.2 + r() * 0.3));
        erase.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 18, true));
        c.drawCircle(r() * W, r() * H, 20 + r() * 50, erase);
      }
      erase.setMaskFilter(null);
      for (let k = 0; k < 9000; k++) {
        erase.setColor(CK.Color4f(0, 0, 0, 0.4 + r() * 0.6));
        c.drawCircle(r() * W, r() * H, 0.6 + r() * 2.4, erase);
      }
      erase.delete();
      // Spatter where the pigment was blown or flicked past the figure.
      for (let k = 0; k < 14000; k++) {
        const x = r() * W, y = r() * H;
        const near = inside(x + 5, y) + inside(x - 5, y) + inside(x, y + 5) + inside(x, y - 5);
        if (near < 0.5 || inside(x, y) > 0.5 || r() > 0.35) continue;
        dotPaint.setColor(CK.Color4f(1, 1, 1, 0.3 + r() * 0.5));
        c.drawCircle(x, y, 0.6 + r() * 1.2, dotPaint);
      }
    }

    const image = surface.makeImageSnapshot();
    fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(image.encodeToBytes()));
    console.log(`wrote carvings/${name}.png`);
    dotPaint.delete();
    image.delete();
    maskImage.delete();
    surface.delete();
    maskSurface.delete();
  }

  const lines = [
    '// Generated by scripts/gen-carvings.js — do not edit; rerun the script instead.',
    '',
    'import type { ImageSourcePropType } from \'react-native\';',
    '',
    '/** One frieze per room: a white alpha mask, tinted by `Carvings`. */',
    'export const CARVING_IMAGES: Record<string, ImageSourcePropType> = {',
    ...names.map((n) => `  ${n}: require('../../assets/carvings/${n}.png'),`),
    '};',
    '',
    '/** The rooms whose frieze is painted in ochre rather than pecked into the stone. */',
    `export const PAINTED_ROOMS: readonly string[] = ${JSON.stringify(names.filter((n) => SCENES[n].painted)).replace(/"/g, '\'')};`,
    '',
    `/** Width over height of every frieze. */`,
    `export const CARVING_ASPECT = ${W / H};`,
    '',
  ];
  fs.writeFileSync(MAP_FILE, lines.join('\n'));
  console.log('wrote components/world/carvingImages.ts');
}

// The same hand cuts the portrait frames in `scripts/gen-gems.js`.
module.exports = { rng, chisel, peck, ibex, stag, horse, wolf, sun };

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
