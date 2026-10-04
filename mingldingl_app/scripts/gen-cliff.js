// scripts/gen-cliff.js — the rock face The Ascent is climbed on (`components/progression/AscentSky.tsx`).
//
// The tiers used to be six coloured dots on a line through a night sky. They are stones, so they
// are now set in stone: a cliff of the same grey granite the Seek card's deer stone is hewn from,
// a path switchbacking up it along its ledges, and at every turn a socket chiselled into the rock
// where that tier's cut gem sits. The summit breaks against a strip of night — the sky beyond.
//
// The drawing is the rock and the sockets only. The gems are the real `GemTierBadge` stones laid
// into the sockets at runtime (so they glint, glow and carry the tier colour like every other gem
// in the app), and the path's lit and unlit pecks are drawn over it at runtime too, because how far
// up it is lit is the user's score.
//
// Where the sockets sit is decided here, once, and written into `cliffImages.ts` as fractions, so
// the gems land in their sockets on any card width.
//
// Rerun with: node scripts/gen-cliff.js
//   (writes assets/cliff/cliff.png and components/progression/cliffImages.ts)

const fs = require('fs');
const path = require('path');
const { rng, chisel, peck } = require('./gen-carvings');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'cliff');
const MAP_FILE = path.join(ROOT, 'components', 'progression', 'cliffImages.ts');

/** The drawing's height in points; the card is this tall at any width. */
const ASCENT_HEIGHT = 420;
/** Baked at twice a common card (380pt × 420pt) and stretched to the real width. */
const W = 760;
const H = 840;

/**
 * The six sockets, Garnet at the foot to Emerald under the summit, as [x / width, y / height]. The
 * path zigzags so it reads as a climb up a face rather than a line up a chart, and the labels can
 * sit on the open side of each turn.
 */
const STOPS = [
  [0.26, 372 / 420],
  [0.7, 316 / 420],
  [0.3, 258 / 420],
  [0.69, 199 / 420],
  [0.33, 141 / 420],
  [0.6, 86 / 420],
];
/** Where the summit's ridge runs, as a share of the height. Above it is sky. */
const RIDGE = 0.12;
/** A socket's radius in baked px: a little wider than the largest gem set in it. */
const SOCKET = 34;

const ROCK = {
  top: '#3B4149',
  bottom: '#1E2227',
  shade: '#121418',
  rim: '#7E8994',
  speck: ['#4D555F', '#191C21'],
  feldspar: '#9AA2AA',
  /** The night above the summit: `NIGHT.black` into `NIGHT.blue`, opaque. */
  sky: ['#04040A', '#0A0F1E'],
};

/** The same bowed leg `AscentSky` draws the path with, so the ledges run under the pecks. */
function legControl(a, b, i) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const bow = (i % 2 ? 1 : -1) * len * 0.12;
  return [mx - (dy / len) * bow, my + (dx / len) * bow];
}

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const color = (hex, a = 1) => {
    const c = CK.parseColorString(hex);
    c[3] = a;
    return c;
  };
  const r = rng(0xc11ff);
  const surface = CK.MakeSurface(W, H);
  const c = surface.getCanvas();
  const paint = new CK.Paint();
  paint.setAntiAlias(true);

  // The sky beyond, with a few stars, then the rock over it.
  paint.setShader(CK.Shader.MakeLinearGradient([0, 0], [0, H * RIDGE * 1.6], [color(ROCK.sky[0]), color(ROCK.sky[1])], null, CK.TileMode.Clamp));
  c.drawRect(CK.XYWHRect(0, 0, W, H), paint);
  paint.setShader(null);
  for (let k = 0; k < 40; k++) {
    paint.setColor(CK.Color4f(1, 1, 1, 0.25 + r() * 0.55));
    c.drawCircle(r() * W, r() * H * RIDGE, 0.6 + r() * 1.3, paint);
  }

  // The ridge: a broken skyline, highest toward the right where the path tops out.
  const ridge = new CK.Path();
  ridge.moveTo(0, H);
  const n = 34;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const peak = Math.exp(-((t - 0.62) ** 2) / 0.05);
    const y = H * RIDGE * (1.55 - 0.75 * peak) + (r() - 0.5) * 16 + (r() < 0.2 ? r() * 18 : 0);
    ridge.lineTo(W * t, y);
  }
  ridge.lineTo(W, H);
  ridge.close();
  paint.setShader(CK.Shader.MakeLinearGradient([0, H * RIDGE], [0, H], [color(ROCK.top), color(ROCK.bottom)], null, CK.TileMode.Clamp));
  c.drawPath(ridge, paint);
  paint.setShader(null);

  c.save();
  c.clipPath(ridge, CK.ClipOp.Intersect, true);
  // Mottle.
  const blot = new CK.Paint();
  blot.setAntiAlias(true);
  for (let k = 0; k < 70; k++) {
    blot.setColor(color(r() < 0.5 ? ROCK.speck[0] : ROCK.speck[1], 0.18 + r() * 0.16));
    blot.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 18 + r() * 26, true));
    c.drawOval(CK.XYWHRect(r() * W - 60, r() * H - 40, 60 + r() * 200, 40 + r() * 110), blot);
  }
  blot.setMaskFilter(null);
  // Bedding: the face splits into slabs along slanted joints, each lit on its upper edge.
  const joint = new CK.Paint();
  joint.setAntiAlias(true);
  joint.setStyle(CK.PaintStyle.Stroke);
  for (let k = 0; k < 9; k++) {
    const y0 = H * (RIDGE + 0.05 + r() * 0.85);
    const tilt = (r() - 0.5) * 0.3;
    const p = new CK.Path();
    p.moveTo(-10, y0);
    for (let x = 0; x <= W + 40; x += 40) p.lineTo(x, y0 + x * tilt + (r() - 0.5) * 8);
    joint.setStrokeWidth(2 + r() * 2);
    joint.setColor(color(ROCK.shade, 0.55));
    c.drawPath(p, joint);
    c.save();
    c.translate(0, -3);
    joint.setStrokeWidth(1.2);
    joint.setColor(color(ROCK.rim, 0.12));
    c.drawPath(p, joint);
    c.restore();
    p.delete();
  }
  // Cracks running down the face.
  for (let k = 0; k < 6; k++) {
    let x = r() * W, y = H * (RIDGE + r() * 0.5);
    const p = new CK.Path();
    p.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (r() - 0.5) * 30;
      y += 16 + r() * 26;
      p.lineTo(x, y);
    }
    joint.setStrokeWidth(1.6);
    joint.setColor(color(ROCK.shade, 0.7));
    c.drawPath(p, joint);
    p.delete();
  }
  // Grit.
  for (let k = 0; k < (W * H) / 80; k++) {
    const pale = r() < 0.06;
    paint.setColor(pale
      ? color(ROCK.feldspar, 0.08 + r() * 0.12)
      : color(r() < 0.5 ? ROCK.speck[0] : ROCK.speck[1], 0.3 + r() * 0.35));
    c.drawCircle(r() * W, r() * H, 0.6 + r() * 1.4, paint);
  }

  // The ledges the path walks on: a worn, lighter strip with a shadow under its lip.
  const at = STOPS.map(([x, y]) => [x * W, y * H]);
  const ledge = new CK.Paint();
  ledge.setAntiAlias(true);
  ledge.setStyle(CK.PaintStyle.Stroke);
  ledge.setStrokeCap(CK.StrokeCap.Round);
  for (let i = 0; i < at.length - 1; i++) {
    const [cx, cy] = legControl(at[i], at[i + 1], i);
    const p = new CK.Path();
    p.moveTo(...at[i]);
    p.quadTo(cx, cy, ...at[i + 1]);
    c.save();
    c.translate(0, 12);
    ledge.setStrokeWidth(16);
    ledge.setColor(color(ROCK.shade, 0.5));
    ledge.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 5, true));
    c.drawPath(p, ledge);
    c.restore();
    ledge.setStrokeWidth(18);
    ledge.setColor(color(ROCK.rim, 0.1));
    ledge.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 4, true));
    c.drawPath(p, ledge);
    p.delete();
  }

  // The sockets: a hollow cut into the face, dark at the back, its upper wall in shadow and its
  // lower lip catching the light, with the chisel's blows around the rim.
  const marks = CK.MakeSurface(W, H);
  const m = marks.getCanvas();
  m.clear(CK.TRANSPARENT);
  const d = chisel(CK, m);
  for (const [x, y] of at) {
    const hollow = new CK.Paint();
    hollow.setAntiAlias(true);
    hollow.setShader(CK.Shader.MakeRadialGradient([x, y - SOCKET * 0.25], SOCKET * 1.15,
      [color(ROCK.shade, 0.95), color(ROCK.shade, 0.75), color(ROCK.shade, 0)], [0, 0.7, 1], CK.TileMode.Clamp));
    c.drawCircle(x, y, SOCKET * 1.15, hollow);
    hollow.setShader(null);
    const lip = new CK.Paint();
    lip.setAntiAlias(true);
    lip.setStyle(CK.PaintStyle.Stroke);
    lip.setStrokeWidth(3);
    lip.setColor(color(ROCK.rim, 0.45));
    c.drawArc(CK.XYWHRect(x - SOCKET, y - SOCKET, SOCKET * 2, SOCKET * 2), 20, 140, false, lip);
    lip.setColor(color(ROCK.shade, 0.9));
    c.drawArc(CK.XYWHRect(x - SOCKET, y - SOCKET, SOCKET * 2, SOCKET * 2), 200, 140, false, lip);
    hollow.delete();
    lip.delete();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + r() * 0.4;
      const r0 = SOCKET * 1.1, r1 = SOCKET * (1.2 + r() * 0.1);
      d.line([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], 4);
    }
  }
  const markImage = marks.makeImageSnapshot();
  const px = markImage.readPixels(0, 0, {
    width: W, height: H, colorType: CK.ColorType.RGBA_8888,
    alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB,
  });
  const inside = (x, y) => {
    const xi = x | 0, yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return 0;
    return px[(yi * W + xi) * 4 + 3] / 255;
  };
  const pecks = CK.MakeSurface(W, H);
  peck(CK, pecks.getCanvas(), inside, W, H, r, 0.6);
  const peckImage = pecks.makeImageSnapshot();
  const tint = new CK.Paint();
  tint.setColorFilter(CK.ColorFilter.MakeBlend(CK.Color4f(0xc9 / 255, 0xbf / 255, 0xa8 / 255, 1), CK.BlendMode.SrcIn));
  tint.setAlphaf(0.28);
  c.drawImage(peckImage, 0, 0, tint);
  c.restore();

  // The summit's edge, lit against the sky.
  const rim = new CK.Paint();
  rim.setAntiAlias(true);
  rim.setStyle(CK.PaintStyle.Stroke);
  rim.setStrokeWidth(2.5);
  rim.setColor(color(ROCK.rim, 0.6));
  c.save();
  c.clipRect(CK.XYWHRect(0, 0, W, H * RIDGE * 1.8), CK.ClipOp.Intersect, true);
  c.drawPath(ridge, rim);
  c.restore();

  const image = surface.makeImageSnapshot();
  fs.writeFileSync(path.join(OUT_DIR, 'cliff.png'), Buffer.from(image.encodeToBytes()));

  const lines = [
    '// Generated by scripts/gen-cliff.js — do not edit; rerun the script instead.',
    '',
    'import type { ImageSourcePropType } from \'react-native\';',
    '',
    '/** The rock face The Ascent is climbed on, stretched to the card\'s width. */',
    'export const CLIFF_IMAGE: ImageSourcePropType = require(\'../../assets/cliff/cliff.png\');',
    '',
    '/** The drawing\'s height in points, at any width. */',
    `export const ASCENT_HEIGHT = ${ASCENT_HEIGHT};`,
    '',
    '/** Each tier\'s socket, Garnet first, as [x / width, y / height]. */',
    `export const ASCENT_STOPS: readonly (readonly [number, number])[] = ${JSON.stringify(STOPS.map(([x, y]) => [x, +y.toFixed(4)]))};`,
    '',
  ];
  fs.writeFileSync(MAP_FILE, lines.join('\n'));
  console.log('wrote assets/cliff/cliff.png and components/progression/cliffImages.ts');
}

module.exports = { legControl };

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
