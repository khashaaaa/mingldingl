// scripts/gen-metal.js — riveted, worn metal, for the few objects built to hold.
//
// Sealed Fire forges one thing per screen and leaves the rest hairline, and `METAL` already means
// "a thing made of this". Rivets carry the same meaning one step further: this object binds, locks
// or guards. So they go only where that is true — the forged button, the Gate's leaves, the
// plaque a vow or a rite is struck onto, the "you are here" plate in the Guild House, the strongbox
// a drop arrives in — and never on cards, rows, chat or headers, where they would stop meaning
// anything and the app would read as a generic RPG skin.
//
// The Mongol thread is lamellar: armour of small riveted iron plates laced together. A lamellar
// strip stands in for a hairline at the one place that earns it, above the Oath, which makes the
// metal ancestral rather than steampunk beside the Bronze Age carvings.
//
// Nothing here carries a colour. A plate's metal is the fill of the view under it (a token from
// `lib/theme.ts`); what is baked is only the light on it, as black and white at low alpha — rubbed
// edges bright, recesses dark, rivets domed, scratches — so the same wear sits on gold, silver or
// iron. Shapes that are not rectangles (lamellae, the strongbox, the seal) bake a white silhouette
// mask the component tints, plus the same black-and-white detail over it.
//
//   plate-{worn,fine}   a nine-slice frame: four corner rivets, edges rubbed bright where a hand
//                       goes (the bottom edge most), a dark recess just inside. `PLATE_CAP` px of
//                       each corner stays fixed; the edges stretch along their length only.
//   grain-{0,1,2}       scratches and pitting for a plate's face, three seeds so no two plates match
//   strap               an iron strap with studs, for the Gate
//   lamellar-{body,detail}  laced plates in a row, the strip above the Oath
//   box-{body,lid}-{wood,iron,detail}  an iron-bound strongbox in two halves, so the lid can open
//   seal-{body,detail}  a wax seal, pressed over a plaque's rivet
//
// Every drawing is at 3× the size it is shown at. Seeded throughout.
//
// Rerun with: node scripts/gen-metal.js   (writes assets/metal/*.png)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'metal');

// Keep in step with `components/ui/metal.ts`.
const PLATE_W = 480;
const PLATE_H = 144;
const PLATE_CAP = 42;
const GRAIN_W = 1320;
const GRAIN_H = 600;
const STRAP_W = 720;
const STRAP_H = 54;
const LAMELLAR_W = 1200;
const LAMELLAR_H = 54;
const BOX = 144;
/** The box is drawn on a 144 grid and baked 1.5× larger: shown at `ICON_SIZES.splash` (72pt). */
const BOX_SCALE = 1.5;
const SEAL = 96;

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

/** A canvas and a small kit of marks in white (light) or black (shadow), at any alpha. */
function sheet(CK, w, h) {
  const surface = CK.MakeSurface(w, h);
  const c = surface.getCanvas();
  c.clear(CK.TRANSPARENT);
  const paint = (white, a, blur = 0) => {
    const p = new CK.Paint();
    p.setAntiAlias(true);
    p.setColor(white ? CK.Color4f(1, 1, 1, a) : CK.Color4f(0, 0, 0, a));
    if (blur > 0) p.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, blur, true));
    return p;
  };
  const stroke = (white, a, wd, blur = 0) => {
    const p = paint(white, a, blur);
    p.setStyle(CK.PaintStyle.Stroke);
    p.setStrokeWidth(wd);
    p.setStrokeCap(CK.StrokeCap.Round);
    p.setStrokeJoin(CK.StrokeJoin.Round);
    return p;
  };
  const pathOf = (pts, close) => {
    const p = new CK.Path();
    p.moveTo(...pts[0]);
    for (const q of pts.slice(1)) p.lineTo(...q);
    if (close) p.close();
    return p;
  };
  const kit = {
    surface, c,
    line(pts, white, a, wd, blur = 0) {
      const p = pathOf(pts, false), pt = stroke(white, a, wd, blur);
      c.drawPath(p, pt); p.delete(); pt.delete();
    },
    poly(pts, white, a, blur = 0) {
      const p = pathOf(pts, true), pt = paint(white, a, blur);
      c.drawPath(p, pt); p.delete(); pt.delete();
    },
    dot(x, y, r, white, a, blur = 0) {
      const pt = paint(white, a, blur);
      c.drawCircle(x, y, r, pt); pt.delete();
    },
    ring(x, y, r, white, a, wd, blur = 0) {
      const pt = stroke(white, a, wd, blur);
      c.drawCircle(x, y, r, pt); pt.delete();
    },
    rect(x, y, w2, h2, white, a, blur = 0) {
      const pt = paint(white, a, blur);
      c.drawRect(CK.XYWHRect(x, y, w2, h2), pt); pt.delete();
    },
    rrect(x, y, w2, h2, r, white, a, blur = 0) {
      const pt = paint(white, a, blur);
      c.drawRRect(CK.RRectXY(CK.XYWHRect(x, y, w2, h2), r, r), pt); pt.delete();
    },
    /** Erase: punch a shape back to transparent (a lamella's rounded top, a seal's ragged rim). */
    clear(fn) {
      const pt = new CK.Paint();
      pt.setAntiAlias(true);
      pt.setBlendMode(CK.BlendMode.Clear);
      fn(pt); pt.delete();
    },
  };
  return kit;
}

function save(CK, kit, name) {
  const image = kit.surface.makeImageSnapshot();
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(image.encodeToBytes()));
  image.delete();
  kit.surface.delete();
  console.log(`wrote metal/${name}.png`);
}

/**
 * A domed rivet head at (x, y): the shadow it casts down-right, the dark seat it is driven into,
 * then the dome — dark on its lower-right shoulder, a hot spot upper-left where the light catches.
 */
function rivet(K, x, y, r, wear = 1) {
  K.dot(x + r * 0.35, y + r * 0.45, r * 1.15, false, 0.5, r * 0.35);
  K.ring(x, y, r * 1.1, false, 0.35, r * 0.35);
  K.dot(x + r * 0.18, y + r * 0.22, r * 0.9, false, 0.32, r * 0.18);
  K.dot(x - r * 0.25, y - r * 0.3, r * 0.55, true, 0.35 * wear, r * 0.3);
  K.dot(x - r * 0.32, y - r * 0.36, r * 0.2, true, 0.75 * wear);
  K.ring(x, y, r * 0.95, false, 0.55, Math.max(1, r * 0.12));
}

/** A rubbed band: many short bright strokes along a line, thicker where `weight(t)` is high. */
function rubbed(K, r, from, to, depth, weight, inward) {
  const [x0, y0] = from, [x1, y1] = to;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  const [ix, iy] = inward;
  for (let s = 0; s < len; s += 2.2) {
    const t = s / len;
    const w = weight(t);
    if (r() > 0.35 + w * 0.6) continue;
    const d = r() * depth * (0.4 + w);
    const run = 6 + r() * 26 * (0.5 + w);
    const bx = x0 + ux * s + ix * d, by = y0 + uy * s + iy * d;
    K.line([[bx, by], [bx + ux * run, by + uy * run]], true, 0.06 + 0.16 * w * r(), 1 + r() * 1.4);
  }
}

/* ── Plates ───────────────────────────────────────────────────────────────────────────────── */

function bakePlate(CK, name, seed, { rivetR, wear, recess }) {
  const K = sheet(CK, PLATE_W, PLATE_H);
  const r = rng(seed);
  const W = PLATE_W, H = PLATE_H;

  // The recess: a soft dark band just inside the rim, where grime gathers and no hand reaches.
  for (const [x, y, w2, h2] of [[0, 0, W, 8], [0, H - 8, W, 8], [0, 0, 8, H], [W - 8, 0, 8, H]]) {
    K.rect(x + (x ? -6 : 6), y + (y ? -6 : 6), w2, h2, false, 0.2 * recess, 7);
  }
  // The rim's bevel: lit along the top and left, falling to shadow along the bottom and right.
  K.line([[1.5, H - 3], [1.5, 1.5], [W - 3, 1.5]], true, 0.42, 3);
  K.line([[W - 1.5, 3], [W - 1.5, H - 1.5], [3, H - 1.5]], false, 0.55, 3);
  // Rubbed bright where hands go: the bottom edge most, gathering at its middle under the thumb;
  // the top and sides lightly. Weights fall to nothing in the corners so the fixed caps stay clean.
  const mid = (t) => Math.pow(Math.sin(Math.PI * t), 1.6);
  rubbed(K, r, [PLATE_CAP * 0.6, H - 4], [W - PLATE_CAP * 0.6, H - 4], 12, (t) => wear * (0.35 + 0.65 * mid(t)), [0, -1]);
  rubbed(K, r, [PLATE_CAP * 0.6, 4], [W - PLATE_CAP * 0.6, 4], 7, (t) => wear * 0.45 * mid(t), [0, 1]);
  rubbed(K, r, [4, PLATE_CAP * 0.8], [4, H - PLATE_CAP * 0.8], 6, (t) => wear * 0.35 * mid(t), [1, 0]);
  rubbed(K, r, [W - 4, PLATE_CAP * 0.8], [W - 4, H - PLATE_CAP * 0.8], 6, (t) => wear * 0.35 * mid(t), [-1, 0]);
  // The thumb's own patch, a soft polish at the bottom centre, wider than tall.
  if (wear > 0.5) K.rrect(W * 0.3, H - 30, W * 0.4, 22, 11, true, 0.08 * wear, 10);
  // A few nicks along the rim, dark with a bright lip.
  for (let k = 0; k < Math.round(6 * wear); k++) {
    const onTop = r() < 0.5;
    const x = PLATE_CAP + r() * (W - PLATE_CAP * 2);
    const y = onTop ? 3 : H - 3;
    K.line([[x, y], [x + 3 + r() * 5, y + (onTop ? 4 : -4)]], false, 0.5, 1.6);
    K.line([[x + 1.5, y], [x + 4 + r() * 5, y + (onTop ? 3 : -3)]], true, 0.3, 1);
  }
  const inset = PLATE_CAP / 2;
  for (const [x, y] of [[inset, inset], [W - inset, inset], [inset, H - inset], [W - inset, H - inset]]) {
    rivet(K, x, y, rivetR, wear > 0.5 ? 0.85 : 1);
  }
  save(CK, K, name);
}

/** Scratches and pitting across a plate's face. Seamless isn't needed — it is shown clipped. */
function bakeGrain(CK, n, seed) {
  const K = sheet(CK, GRAIN_W, GRAIN_H);
  const r = rng(seed);
  // Long fine scratches, mostly running one way (the way the plate was worked), a few across it.
  const grainAngle = (r() - 0.5) * 0.5;
  for (let k = 0; k < 140; k++) {
    const x = r() * GRAIN_W, y = r() * GRAIN_H;
    const a = r() < 0.8 ? grainAngle + (r() - 0.5) * 0.25 : grainAngle + Math.PI / 2 + (r() - 0.5) * 0.8;
    const len = 18 + r() * 120;
    const bend = (r() - 0.5) * 8;
    const pts = [0, 0.5, 1].map((t) => [x + Math.cos(a) * len * t - Math.sin(a) * bend * Math.sin(Math.PI * t), y + Math.sin(a) * len * t + Math.cos(a) * bend * Math.sin(Math.PI * t)]);
    // A scratch is a dark groove with a bright lip beside it.
    K.line(pts, false, 0.1 + r() * 0.12, 1 + r() * 0.8);
    K.line(pts.map(([px, py]) => [px + 1, py - 1]), true, 0.06 + r() * 0.1, 0.8);
  }
  // Pits and hammer marks.
  for (let k = 0; k < 220; k++) {
    const x = r() * GRAIN_W, y = r() * GRAIN_H, rad = 0.8 + r() * 2.4;
    K.dot(x, y, rad, false, 0.1 + r() * 0.14);
    if (rad > 2) K.dot(x - rad * 0.4, y - rad * 0.4, rad * 0.4, true, 0.12);
  }
  // Broad uneven patina, so the face is never one flat value.
  for (let k = 0; k < 26; k++) {
    K.dot(r() * GRAIN_W, r() * GRAIN_H, 30 + r() * 70, r() < 0.45, 0.035 + r() * 0.03, 24);
  }
  save(CK, K, `grain-${n}`);
}

/* ── The Gate's strap ─────────────────────────────────────────────────────────────────────── */

function bakeStrap(CK) {
  const K = sheet(CK, STRAP_W, STRAP_H);
  const r = rng(0x57a9);
  K.line([[0, 2], [STRAP_W, 2]], true, 0.35, 3);
  K.line([[0, STRAP_H - 2], [STRAP_W, STRAP_H - 2]], false, 0.6, 4);
  // Hammered: shallow dents along the length.
  for (let x = 0; x < STRAP_W; x += 6 + r() * 14) {
    K.dot(x, 10 + r() * (STRAP_H - 20), 4 + r() * 8, r() < 0.5, 0.06 + r() * 0.05, 5);
  }
  rubbed(K, r, [0, 5], [STRAP_W, 5], 6, () => 0.5, [0, 1]);
  for (let x = 30; x < STRAP_W; x += 120) rivet(K, x, STRAP_H / 2, 9, 0.9);
  save(CK, K, 'strap');
}

/* ── Lamellar ─────────────────────────────────────────────────────────────────────────────── */

function bakeLamellar(CK) {
  const body = sheet(CK, LAMELLAR_W, LAMELLAR_H);
  const det = sheet(CK, LAMELLAR_W, LAMELLAR_H);
  const r = rng(0x1a3e);
  const PW = 36, STEP = 30; // each lamella overlaps the last by 6px
  const top = 4, bottom = LAMELLAR_H - 3;
  for (let x = -PW; x < LAMELLAR_W + PW; x += STEP) {
    const jitter = (r() - 0.5) * 2;
    const y0 = top + jitter;
    // Silhouette: a narrow plate with a rounded top and a squarer foot.
    body.rrect(x, y0, PW, bottom - y0, 10, true, 1);
    body.rect(x, y0 + 12, PW, bottom - y0 - 12, true, 1);
    // The plate under this one shows a shadow down this one's left edge.
    det.rect(x - 1, y0 + 2, 5, bottom - y0 - 2, false, 0.5, 2);
    // A ridge down the middle, lit on its left.
    det.line([[x + PW / 2 - 1, y0 + 8], [x + PW / 2 - 1, bottom - 6]], true, 0.22, 2);
    det.line([[x + PW / 2 + 2, y0 + 8], [x + PW / 2 + 2, bottom - 6]], false, 0.25, 2);
    // Rim: lit top, dark foot.
    det.line([[x + 6, y0 + 1.5], [x + PW - 6, y0 + 1.5]], true, 0.4, 2);
    det.line([[x + 2, bottom - 1.5], [x + PW - 2, bottom - 1.5]], false, 0.55, 3);
    // Wear: a few bright scuffs.
    for (let k = 0; k < 3; k++) {
      const sx = x + 6 + r() * (PW - 12), sy = y0 + 10 + r() * (bottom - y0 - 20);
      det.line([[sx, sy], [sx + 3 + r() * 6, sy + (r() - 0.5) * 3]], true, 0.18, 1);
    }
    // Two rivets up top, and the lace holes the cord runs through.
    rivet(det, x + 10, y0 + 9, 3.2, 0.9);
    rivet(det, x + PW - 10, y0 + 9, 3.2, 0.9);
  }
  // The lacing: a dark cord across the middle, stitched over each seam.
  const cy = LAMELLAR_H * 0.62;
  det.line([[0, cy], [LAMELLAR_W, cy]], false, 0.55, 5);
  det.line([[0, cy - 1.6], [LAMELLAR_W, cy - 1.6]], true, 0.12, 1);
  for (let x = -PW; x < LAMELLAR_W + PW; x += STEP) {
    det.line([[x - 4, cy - 6], [x + 4, cy + 6]], false, 0.6, 3.2);
    det.line([[x - 3, cy - 6.5], [x + 4.5, cy + 5]], true, 0.14, 1);
  }
  save(CK, body, 'lamellar-body');
  save(CK, det, 'lamellar-detail');
}

/* ── The strongbox ────────────────────────────────────────────────────────────────────────── */

// The box in front view: the body from LID_Y down, the lid's barrel above it. Left/right edges.
const BX0 = 16, BX1 = BOX - 16, LID_TOP = 34, LID_Y = 70, BODY_Y1 = BOX - 14;
const STRAPS = [BX0 + 20, BX1 - 20];

function boxPart(CK, part) {
  const [wood, iron, det] = [0, 1, 2].map(() => {
    const k = sheet(CK, BOX * BOX_SCALE, BOX * BOX_SCALE);
    k.c.scale(BOX_SCALE, BOX_SCALE);
    return k;
  });
  const r = rng(part === 'body' ? 0xb0d1 : 0x11d0);
  const y0 = part === 'body' ? LID_Y : LID_TOP;
  const y1 = part === 'body' ? BODY_Y1 : LID_Y;
  const W = BX1 - BX0;

  if (part === 'body') {
    wood.rect(BX0, y0, W, y1 - y0, true, 1);
    // Planks run across; the gaps between them dark.
    for (let y = y0 + 18; y < y1 - 4; y += 18) det.line([[BX0, y], [BX1, y]], false, 0.45, 2);
    for (let k = 0; k < 14; k++) {
      const gy = y0 + 4 + r() * (y1 - y0 - 8), gx = BX0 + r() * W;
      det.line([[gx, gy], [gx + 10 + r() * 20, gy + (r() - 0.5) * 2]], false, 0.18, 1);
    }
    // Iron: the rim bands top and foot, two upright straps, corner brackets, the lock plate.
    iron.rect(BX0 - 2, y0, W + 4, 9, true, 1);
    iron.rect(BX0 - 2, y1 - 10, W + 4, 10, true, 1);
    for (const sx of STRAPS) iron.rect(sx - 6, y0, 12, y1 - y0, true, 1);
    for (const [cx, flip] of [[BX0 - 2, 1], [BX1 + 2, -1]]) {
      iron.poly([[cx, y1], [cx, y1 - 26], [cx + flip * 14, y1 - 26], [cx + flip * 14, y1 - 10], [cx + flip * 26, y1 - 10], [cx + flip * 26, y1]], true, 1);
    }
    const lx = BOX / 2;
    iron.rrect(lx - 12, y0 + 6, 24, 30, 4, true, 1);
    // Keyhole.
    det.dot(lx, y0 + 18, 4, false, 0.85);
    det.poly([[lx - 2.2, y0 + 19], [lx + 2.2, y0 + 19], [lx + 3, y0 + 29], [lx - 3, y0 + 29]], false, 0.85);
    det.line([[lx - 11, y0 + 7], [lx + 11, y0 + 7]], true, 0.35, 1.6);
    // Studs.
    for (const sx of STRAPS) for (let y = y0 + 20; y < y1 - 14; y += 16) rivet(det, sx, y, 2.6, 0.9);
    for (let x = BX0 + 6; x < BX1; x += 14) rivet(det, x, y1 - 5, 2.2, 0.8);
    // Shadow under the lid's rim, light down the left edge, dark down the right.
    det.rect(BX0, y0 + 9, W, 4, false, 0.35, 2);
    det.line([[BX0 + 1, y0], [BX0 + 1, y1]], true, 0.25, 2);
    det.line([[BX1 - 1, y0], [BX1 - 1, y1]], false, 0.45, 3);
  } else {
    // The lid's barrel: a flattened arc over the body's width.
    const arc = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24;
      arc.push([BX0 + W * t, LID_Y - (LID_Y - LID_TOP) * Math.pow(Math.sin(Math.PI * t), 0.45)]);
    }
    const outline = [[BX0, LID_Y], ...arc, [BX1, LID_Y]];
    wood.poly(outline, true, 1);
    // Staves follow the curve.
    for (const f of [0.35, 0.65]) det.line(arc.map(([x, y]) => [x, y + (LID_Y - y) * f]), false, 0.4, 2);
    // Iron: the lid's rim band, the straps over the barrel, the hasp hanging over the lock.
    iron.rect(BX0 - 2, LID_Y - 9, W + 4, 9, true, 1);
    for (const sx of STRAPS) {
      const k = (sx - BX0) / W;
      const topY = LID_Y - (LID_Y - LID_TOP) * Math.pow(Math.sin(Math.PI * k), 0.45);
      iron.rect(sx - 6, topY - 1, 12, LID_Y - topY + 1, true, 1);
      for (let y = topY + 8; y < LID_Y - 10; y += 12) rivet(det, sx, y, 2.4, 0.9);
    }
    const lx = BOX / 2;
    iron.rrect(lx - 7, LID_Y - 12, 14, 22, 3, true, 1);
    rivet(det, lx, LID_Y - 5, 2.6, 1);
    // The barrel's light: a bright line along its crown, shading toward the rim.
    det.line(arc.slice(3, 22).map(([x, y]) => [x, y + 4]), true, 0.3, 3);
    det.rect(BX0, LID_Y - 18, W, 9, false, 0.18, 4);
    det.line([[BX1 - 1, LID_Y], ...arc.slice(18).reverse()], false, 0.4, 3);
  }
  // A worn bright edge on the iron, and a rim of shadow round the whole part.
  for (let k = 0; k < 18; k++) {
    const x = BX0 + r() * W, y = y0 + r() * (y1 - y0);
    det.line([[x, y], [x + 2 + r() * 4, y]], true, 0.14, 1);
  }
  save(CK, wood, `box-${part}-wood`);
  save(CK, iron, `box-${part}-iron`);
  save(CK, det, `box-${part}-detail`);
}

/* ── The wax seal ─────────────────────────────────────────────────────────────────────────── */

function bakeSeal(CK) {
  const body = sheet(CK, SEAL, SEAL);
  const det = sheet(CK, SEAL, SEAL);
  const r = rng(0x5ea1);
  const cx = SEAL / 2, cy = SEAL / 2;
  // Wax squeezed out from under the stamp: a ragged blob.
  const blob = [];
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const rad = 36 + (r() - 0.5) * 8 + (k % 7 === 0 ? 5 : 0);
    blob.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  body.poly(blob, true, 1);
  det.poly(blob, false, 0.2, 2);
  // The stamped disc: a raised ring, a sunken field, a knot pressed into it.
  det.ring(cx, cy, 25, false, 0.4, 4);
  det.ring(cx - 1, cy - 1, 25, true, 0.3, 2);
  det.dot(cx, cy, 21, false, 0.18);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    det.ring(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 6, false, 0.45, 2.2);
    det.ring(cx + Math.cos(a) * 7 - 0.8, cy + Math.sin(a) * 7 - 0.8, 6, true, 0.18, 1);
  }
  // A wet highlight upper-left.
  det.dot(cx - 18, cy - 20, 6, true, 0.35, 3);
  save(CK, body, 'seal-body');
  save(CK, det, 'seal-detail');
}

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  bakePlate(CK, 'plate-worn', 0x9a7e, { rivetR: 8, wear: 1, recess: 1 });
  bakePlate(CK, 'plate-fine', 0xf17e, { rivetR: 5.5, wear: 0.35, recess: 0.5 });
  [0x6a1, 0x6a2, 0x6a3].forEach((s, i) => bakeGrain(CK, i, s));
  bakeStrap(CK);
  bakeLamellar(CK);
  boxPart(CK, 'body');
  boxPart(CK, 'lid');
  bakeSeal(CK);
}

main().catch((e) => { console.error(e); process.exit(1); });
