// scripts/gen-banner.js — the wax seal a stranger arrives under in Seek
// (`components/cards/CandidateCard.tsx`), and the sun the chat's Unsealing breaks it in.
//
// The Seek card was a herald's banner baked here (cloth, rod, embroidered herd and band). The user
// asked for a simple card again, so only the two marks the thesis needs are left: `seal.png` (oxblood
// wax on two ribbons; its pressed face is translucent over the blurred likeness) and `ring.png` (a
// white mask of a sun, tinted by the Unsealing).
//
// Rerun with: node scripts/gen-banner.js
//   (writes assets/banner/*.png and components/cards/bannerImages.ts)

const fs = require('fs');
const path = require('path');
const { rng, chisel, peck } = require('./gen-carvings');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'banner');
const MAP_FILE = path.join(ROOT, 'components', 'cards', 'bannerImages.ts');

const SEAL_PX = 380;
const WAX_R = 0.3;
const PRESS_R = 0.205;
const RING = 480;


async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  // Clear old bakes file by file: removing the folder itself loses it from a running Metro.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));
  const color = (hex, a = 1) => {
    const c = CK.parseColorString(hex);
    c[3] = a;
    return c;
  };
  const pathOf = (pts) => {
    const p = new CK.Path();
    p.moveTo(...pts[0]);
    for (const q of pts.slice(1)) p.lineTo(...q);
    p.close();
    return p;
  };
  const save = (surface, name) => {
    const image = surface.makeImageSnapshot();
    fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(image.encodeToBytes()));
    image.delete();
  };
  const strokePaint = (w) => {
    const p = new CK.Paint();
    p.setAntiAlias(true);
    p.setStyle(CK.PaintStyle.Stroke);
    p.setStrokeCap(CK.StrokeCap.Round);
    p.setStrokeJoin(CK.StrokeJoin.Round);
    p.setStrokeWidth(w);
    return p;
  };

  /** Draw `figure` as a clean silhouette, then fill it in a fresh w×h canvas with `fill`. */
  const masked = (name, w, h, seed, figure, fill) => {
    const r = rng(seed);
    const mask = CK.MakeSurface(w, h);
    const m = mask.getCanvas();
    m.clear(CK.TRANSPARENT);
    figure(m, r);
    const maskImage = mask.makeImageSnapshot();
    const px = maskImage.readPixels(0, 0, {
      width: w, height: h, colorType: CK.ColorType.RGBA_8888,
      alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB,
    });
    const inside = (x, y) => {
      const xi = x | 0, yi = y | 0;
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 0;
      return px[(yi * w + xi) * 4 + 3] / 255;
    };
    const surface = CK.MakeSurface(w, h);
    fill(surface.getCanvas(), inside, r);
    save(surface, name);
    maskImage.delete();
    mask.delete();
    surface.delete();
  };

  // ── The seal ─────────────────────────────────────────────────────────────────────────────────
  // Oxblood wax on two short ribbons, pressed onto the cloth: a soft shadow on the wool, the blob
  // lit on top, a lip squeezed out round the stamp, the knot struck in. The pressed face is a
  // little translucent, so the blurred likeness under it shows only as a ghost of colour.
  {
    const S = SEAL_PX, o = S / 2;
    const surface = CK.MakeSurface(S, S);
    const c = surface.getCanvas();
    c.clear(CK.TRANSPARENT);
    const paint = new CK.Paint();
    paint.setAntiAlias(true);
    const blob = (radius, wobble, seed) => {
      const rr = rng(seed);
      const ph = [rr() * 6.28, rr() * 6.28, rr() * 6.28];
      const pts = [];
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        const k = 1 + wobble * (0.5 * Math.sin(3 * a + ph[0]) + 0.3 * Math.sin(5 * a + ph[1]) + 0.2 * Math.sin(9 * a + ph[2]));
        pts.push([o + Math.cos(a) * radius * k, o + Math.sin(a) * radius * k]);
      }
      return pathOf(pts);
    };
    // The ribbons, behind the wax, falling to either side with a V cut in their ends.
    for (const dir of [-1, 1]) {
      const rib = pathOf([
        [o + dir * S * 0.04, o], [o + dir * S * 0.16, o],
        [o + dir * S * 0.3, o + S * 0.44], [o + dir * S * 0.22, o + S * 0.4], [o + dir * S * 0.17, o + S * 0.47],
      ]);
      paint.setColor(color('#000000', 0.45));
      paint.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 5, true));
      c.save();
      c.translate(4, 6);
      c.drawPath(rib, paint);
      c.restore();
      paint.setMaskFilter(null);
      paint.setShader(CK.Shader.MakeLinearGradient([o, o], [o + dir * S * 0.3, o + S * 0.44],
        [color('#7E2A1E'), color('#4A120C')], null, CK.TileMode.Clamp));
      c.drawPath(rib, paint);
      paint.setShader(null);
      rib.delete();
    }
    const wax = blob(S * WAX_R, 0.06, 0x7a3);
    paint.setColor(color('#000000', 0.55));
    paint.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, S * 0.018, true));
    c.save();
    c.translate(S * 0.015, S * 0.025);
    c.drawPath(wax, paint);
    c.restore();
    paint.setMaskFilter(null);
    paint.setShader(CK.Shader.MakeRadialGradient([o - S * 0.07, o - S * 0.08], S * WAX_R * 1.25,
      [color('#A3382A'), color('#6A1C13'), color('#3A0D09')], [0, 0.55, 1], CK.TileMode.Clamp));
    c.drawPath(wax, paint);
    paint.setShader(null);
    const ridge = strokePaint(S * 0.026);
    ridge.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, S * 0.005, true));
    ridge.setShader(CK.Shader.MakeLinearGradient([o - S * 0.2, o - S * 0.2], [o + S * 0.2, o + S * 0.2],
      [color('#D0705A', 0.55), color('#2A0806', 0.6)], null, CK.TileMode.Clamp));
    c.drawCircle(o, o, S * PRESS_R + S * 0.022, ridge);
    paint.setShader(CK.Shader.MakeRadialGradient([o, o], S * PRESS_R,
      [color('#5A160F', 0.72), color('#4A120C', 0.86)], null, CK.TileMode.Clamp));
    c.drawCircle(o, o, S * PRESS_R, paint);
    paint.setShader(null);
    const wall = strokePaint(S * 0.012);
    wall.setShader(CK.Shader.MakeLinearGradient([o - S * 0.15, o - S * 0.15], [o + S * 0.15, o + S * 0.15],
      [color('#1A0403', 0.9), color('#E08A70', 0), color('#E08A70', 0.6)], [0, 0.55, 1], CK.TileMode.Clamp));
    c.drawCircle(o, o, S * PRESS_R, wall);
    const knot = CK.MakeImageFromEncoded(fs.readFileSync(path.join(ROOT, 'assets', 'ornaments', 'knot_gold.png')));
    const k = S * PRESS_R * 1.5;
    const knotAt = (dx, dy, hex, a) => {
      const kp = new CK.Paint();
      kp.setAntiAlias(true);
      kp.setColorFilter(CK.ColorFilter.MakeBlend(color(hex, a), CK.BlendMode.SrcIn));
      c.drawImageRect(knot, CK.XYWHRect(0, 0, knot.width(), knot.height()),
        CK.XYWHRect(o - k / 2 + dx, o - k / 2 + dy, k, k), kp, true);
      kp.delete();
    };
    knotAt(S * 0.006, S * 0.006, '#E89A7E', 0.7);
    knotAt(0, 0, '#220604', 0.85);
    knot.delete();
    paint.setColor(color('#FFE2D0', 0.22));
    paint.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, S * 0.018, true));
    c.save();
    c.clipPath(wax, CK.ClipOp.Intersect, true);
    c.drawOval(CK.XYWHRect(o - S * 0.2, o - S * 0.27, S * 0.24, S * 0.08), paint);
    c.restore();
    paint.setMaskFilter(null);
    save(surface, 'seal');
    wax.delete();
    [paint, ridge, wall].forEach((p) => p.delete());
    surface.delete();
  }

  // The sun round the seal: a ring of knots with short rays — French knots read as the pecked
  // ring did on the stone, so the chat's Unsealing still finds the same sun.
  masked('ring', RING, RING, 0x5a17, (m, r) => {
    const d = chisel(CK, m);
    const o = RING / 2;
    d.ring(o, o, RING * 0.36, 16);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + (r() - 0.5) * 0.05;
      const r0 = RING * 0.415, r1 = RING * (0.46 + r() * 0.025);
      d.line([[o + Math.cos(a) * r0, o + Math.sin(a) * r0], [o + Math.cos(a) * r1, o + Math.sin(a) * r1]], 11);
    }
  }, (c, inside, r) => peck(CK, c, inside, RING, RING, r, 1.2));

  const req = (n) => `require('../../assets/banner/${n}.png')`;
  const lines = [
    '// Generated by scripts/gen-banner.js — do not edit; rerun the script instead.',
    '',
    'import type { ImageSourcePropType } from \'react-native\';',
    '',
    '/** The wax seal on its ribbons. The pressed face is this share of its width. */',
    `export const BANNER_SEAL: ImageSourcePropType = ${req('seal')};`,
    `export const SEAL_PRESS_SHARE = ${PRESS_R * 2};`,
    `export const SEAL_WAX_SHARE = ${WAX_R * 2};`,
    '',
    '/** The sun round the seal: a white mask, tinted by the chat\'s Unsealing. */',
    `export const BANNER_RING: ImageSourcePropType = ${req('ring')};`,
    '',
  ];
  fs.writeFileSync(MAP_FILE, lines.join('\n'));
  console.log('wrote seal, ring and components/cards/bannerImages.ts');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
