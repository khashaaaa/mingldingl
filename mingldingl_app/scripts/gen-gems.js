// scripts/gen-gems.js — cuts the six tier stones (components/progression/GemTierBadge.tsx).
//
// The gem was a square turned on its corner with a gradient in it, the same shape for every tier.
// Each stone now has its own cut, the way the real stones are cut: a round brilliant garnet, an
// opal cabochon with no facets at all, an amethyst still a raw crystal point, a cushion sapphire,
// a trillion ruby and an emerald in the step cut named after it. Shape says which stone at a
// glance; colour still does too; the setting says how high (see `layers`).
//
// Each stone is baked as four white layers the badge tints, so any caller's colour override (a
// dimmed or locked gem) still works:
//   body    — the stone's silhouette, tinted the tier colour
//   shade   — the deep facets and the ink outline, tinted the tier's shade
//   light   — facet edges and glints, drawn white over both
//   setting — the bezel around it, tinted ink and stronger the higher the tier
//
// The same script draws the portrait frames on Profile, one per tier, each a rung more ornate.
//
// Rerun with: node scripts/gen-gems.js   (writes assets/gems/*.png and components/progression/gemImages.ts)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'gems');
const MAP_FILE = path.join(ROOT, 'components', 'progression', 'gemImages.ts');
const SIZES = [64, 128, 256];
const LAYERS = ['body', 'shade', 'light', 'setting'];
const V = 100; // the drawing's own grid

/** A closed outline as `n` points around the centre, from a radius-at-angle function — or, for a
 *  stone cut with straight sides, its own corners, scaled about the centre. */
function ring(n, at, scale = 1, rot = -Math.PI / 2, points = null) {
  if (points) return points.map(([x, y]) => [50 + x * scale, 50 + y * scale]);
  return Array.from({ length: n }, (_, k) => {
    const a = rot + (k / n) * Math.PI * 2;
    const [x, y] = at(a);
    return [50 + x * scale, 50 + y * scale];
  });
}

const CUTS = {
  /** Round brilliant: sixteen facets around an octagonal table, a star between them. */
  Garnet: { n: 16, at: (a) => [36 * Math.cos(a), 36 * Math.sin(a)], table: 0.5, steps: [], star: true },
  /** Cabochon: polished dome, no facets; the light lies on it as a wide glare. */
  Opal: { n: 48, at: (a) => [38 * Math.cos(a), 30 * Math.sin(a)], table: 0, steps: [], cabochon: true },
  /** A raw crystal point: six faces running up to the tip. */
  Amethyst: {
    n: 6, points: [[0, -40], [24, -14], [24, 28], [0, 40], [-24, 28], [-24, -14]],
    table: 0.3, steps: [], ridge: true,
  },
  /** Cushion: a softened square, brilliant facets. */
  Sapphire: {
    n: 16,
    at: (a) => {
      const c = Math.cos(a), s = Math.sin(a);
      const r = 36 / Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), 0.25);
      return [r * c, r * s];
    },
    table: 0.5, steps: [], star: true,
  },
  /** Trillion: three gently bowed sides. */
  Ruby: {
    n: 18,
    at: (a) => {
      const r = 27 / (0.84 + 0.16 * Math.cos(3 * (a + Math.PI / 2)));
      return [r * Math.cos(a), r * Math.sin(a) + 4];
    },
    table: 0.46, steps: [], star: true,
  },
  /** The emerald cut: a step-cut octagon, its facets running round it like terraces. */
  Emerald: {
    n: 8, points: [[-13, -38], [13, -38], [26, -25], [26, 25], [13, 38], [-13, 38], [-26, 25], [-26, -25]],
    table: 0, steps: [0.72, 0.46],
  },
};

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const white = (a) => {
    const p = new CK.Paint();
    p.setAntiAlias(true);
    p.setColor(CK.Color4f(1, 1, 1, a));
    return p;
  };
  const poly = (pts) => {
    const p = new CK.Path();
    pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.close();
    return p;
  };
  /** The glyphs' brush along a polyline: discs unioned and filled once. */
  const brush = (pts, width, { closed = false, taper = false } = {}) => {
    const all = closed ? [...pts, pts[0]] : pts;
    const out = new CK.Path();
    const dense = [];
    for (let i = 0; i + 1 < all.length; i++) {
      const [x0, y0] = all[i], [x1, y1] = all[i + 1];
      const k = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.4));
      for (let j = 0; j < k; j++) dense.push([x0 + ((x1 - x0) * j) / k, y0 + ((y1 - y0) * j) / k]);
    }
    dense.push(all[all.length - 1]);
    const n = dense.length - 1;
    dense.forEach(([x, y], i) => {
      const t = n ? i / n : 0;
      let r = (width / 2) * (closed ? 0.85 + 0.15 * Math.sin(t * Math.PI * 6) : 1);
      if (taper) r *= 0.25 + 0.75 * Math.pow(Math.sin(Math.PI * t), 0.5);
      out.addCircle(x, y, r);
    });
    return out;
  };

  const entries = [];
  for (const [tier, cut] of Object.entries(CUTS)) {
    const rot = cut.rot ?? -Math.PI / 2;
    const outline = ring(cut.n, cut.at, 1, rot, cut.points);
    const table = cut.table ? ring(cut.n, cut.at, cut.table, rot, cut.points) : null;
    const steps = cut.steps.map((s) => ring(cut.n, cut.at, s, rot, cut.points));
    const body = poly(outline);

    const layers = {
      body(c) {
        c.drawPath(body, white(1));
      },
      shade(c) {
        c.save();
        c.clipPath(body, CK.ClipOp.Intersect, true);
        // The deep side: light comes from the upper left, so the lower right falls away.
        const fall = new CK.Paint();
        fall.setAntiAlias(true);
        fall.setShader(CK.Shader.MakeLinearGradient([20, 20], [82, 84],
          [CK.Color4f(1, 1, 1, 0), CK.Color4f(1, 1, 1, 0.35), CK.Color4f(1, 1, 1, 0.9)], [0, 0.5, 1], CK.TileMode.Clamp));
        c.drawRect(CK.LTRBRect(0, 0, V, V), fall);
        if (table) {
          // Every other crown facet in shadow: what makes a cut stone flash as it turns.
          for (let k = 0; k < cut.n; k += 2) {
            const q = poly([table[k], outline[k], outline[(k + 1) % cut.n], table[(k + 1) % cut.n]]);
            c.drawPath(q, white(0.4));
          }
        }
        // Step cut: each terrace darker toward the middle.
        steps.forEach((s, i) => c.drawPath(poly(s), white(0.18 + i * 0.14)));
        if (cut.cabochon) {
          const rim = new CK.Paint();
          rim.setAntiAlias(true);
          rim.setShader(CK.Shader.MakeRadialGradient([44, 44], 44,
            [CK.Color4f(1, 1, 1, 0), CK.Color4f(1, 1, 1, 0.75)], [0.55, 1], CK.TileMode.Clamp));
          c.drawRect(CK.LTRBRect(0, 0, V, V), rim);
        }
        c.restore();
        // The ink outline, in the shade's colour: the stone drawn, not rendered.
        c.drawPath(brush(outline, 3.4, { closed: true }), white(1));
      },
      light(c) {
        c.save();
        c.clipPath(body, CK.ClipOp.Intersect, true);
        const edge = white(0.42);
        if (table) {
          c.drawPath(brush(table, 1.6, { closed: true }), edge);
          for (let k = 0; k < cut.n; k++) c.drawPath(brush([table[k], outline[k]], 1.3), edge);
          if (cut.star) {
            // A glint on two crown facets at the upper left.
            const g = Math.floor(cut.n * 0.62);
            c.drawPath(poly([table[g], outline[g], outline[(g + 1) % cut.n], table[(g + 1) % cut.n]]), white(0.55));
            c.drawPath(poly([table[(g + 2) % cut.n], outline[(g + 2) % cut.n], outline[(g + 3) % cut.n]]), white(0.3));
          }
        }
        steps.forEach((s) => c.drawPath(brush(s, 1.5, { closed: true }), edge));
        if (steps.length) {
          // The step cut's corners: the lines that run from terrace to terrace.
          const all = [outline, ...steps];
          for (let k = 0; k < cut.n; k++) {
            c.drawPath(brush(all.map((r) => r[k]), 1.2), edge);
          }
          c.drawPath(poly([outline[7], outline[0], steps[0][0], steps[0][7]]), white(0.5));
        }
        if (cut.ridge) {
          // The crystal's faces meet in ridges running up to the point.
          c.drawPath(brush([[50, 12], [50, 88]], 1.5), edge);
          c.drawPath(brush([[50, 12], [26, 38], [26, 76]], 1.2), edge);
          c.drawPath(brush([[50, 12], [74, 38], [74, 76]], 1.2), edge);
          c.drawPath(poly([[50, 12], [28, 37], [28, 70], [48, 82]]), white(0.28));
        }
        if (cut.cabochon) {
          // A dome takes the light as one soft glare, and an opal throws its colour as flecks.
          const glare = new CK.Paint();
          glare.setAntiAlias(true);
          glare.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 3, true));
          glare.setColor(CK.Color4f(1, 1, 1, 0.7));
          c.drawOval(CK.LTRBRect(26, 28, 52, 40), glare);
          for (const [x, y, r] of [[60, 46, 2.4], [44, 58, 2], [66, 60, 1.6], [36, 48, 1.4], [54, 66, 1.8]]) {
            c.drawCircle(x, y, r, white(0.55));
          }
        }
        c.restore();
      },
      setting(c) {
        const bezel = ring(cut.n, cut.at, 1.16, rot, cut.points);
        c.drawPath(brush(bezel, 3, { closed: true }), white(1));
      },
    };

    for (const layer of LAYERS) {
      for (const px of SIZES) {
        const surface = CK.MakeSurface(px, px);
        const canvas = surface.getCanvas();
        canvas.clear(CK.TRANSPARENT);
        canvas.scale(px / V, px / V);
        layers[layer](canvas);
        const image = surface.makeImageSnapshot();
        fs.writeFileSync(path.join(OUT_DIR, `${tier.toLowerCase()}-${layer}-${px}.png`), Buffer.from(image.encodeToBytes()));
        image.delete();
        surface.delete();
      }
    }
    entries.push(`  ${tier}: {\n${LAYERS.map((l) => `    ${l}: { ${SIZES.map((s) => `${s}: require('../../assets/gems/${tier.toLowerCase()}-${l}-${s}.png')`).join(', ')} },`).join('\n')}\n  },`);
  }

  // The portrait's frame on Profile, one per rung: each tier adds the next piece of the carving, so
  // the frame says how far someone has climbed before the gem beside it is read. Cut by the same
  // hand as the floor friezes (`scripts/gen-carvings.js`): drawn clean, then pecked into the stone
  // dot by dot. The portrait is a sun, as every rock in the steppe has one — a ring, then rays,
  // then cup-marks, then the animals walking round it. Baked on a 160pt box at 3x, centred on the
  // avatar's 118pt one (it overhangs by 21 a side); the photo is the 100pt circle in the middle.
  const carver = require('./gen-carvings');
  const F = 160, FX = 480, O = F / 2, K = FX / F;
  const at = (r, a) => [O + r * Math.cos(a), O + r * Math.sin(a)];
  const deg = Math.PI / 180;
  // [figure, angle, facing, first rung]: a procession round the sun, feet on the ring, heads out.
  // The edit badge sits at the lower right (about 45°), so nothing is carved there.
  const herd = [
    [carver.ibex, -106, 1, 3], [carver.ibex, -74, -1, 3],
    [carver.stag, -145, 1, 4], [carver.horse, -35, -1, 4],
    [carver.wolf, 174, -1, 5], [carver.horse, 6, -1, 5],
  ];
  const BADGE = 45;
  const clear = (a, level) =>
    Math.abs(((a - BADGE + 540) % 360) - 180) > 16 &&
    herd.every(([, fa, , from]) => level < from || Math.abs(((a - fa + 540) % 360) - 180) > 15);
  const frames = [];
  for (let level = 0; level < 6; level++) {
    const r = carver.rng(0x5a7 + level);
    // 1. The carving as the carver meant it, clean.
    const maskSurface = CK.MakeSurface(FX, FX);
    const m = maskSurface.getCanvas();
    m.clear(CK.TRANSPARENT);
    m.scale(K, K);
    const d = carver.chisel(CK, m);
    d.ring(O, O, 52.8, 5.2);
    if (level >= 1) {
      // Rays, short and blunt, the way the sun is pecked on the rocks.
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * 360 + 9;
        if (!clear(a, level)) continue;
        d.line([at(58.4, a * deg), at(64.5, a * deg)], 2.6);
      }
    }
    if (level >= 2) {
      // Cup-marks between the rays: the oldest mark there is, a pit ground into the rock.
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * 360;
        if (k % 2 || !clear(a, level)) continue;
        const [x, y] = at(62, a * deg);
        d.dot(x, y, 2.3);
      }
    }
    for (const [fig, a, facing, from] of herd) {
      if (level < from) continue;
      const [x, y] = at(55.4, a * deg);
      m.save();
      m.translate(x, y);
      m.rotate(a + 90, 0, 0);
      m.scale(0.165 * facing, 0.165);
      fig(carver.chisel(CK, m, 1.6), r);
      m.restore();
    }
    const maskImage = maskSurface.makeImageSnapshot();
    const px = maskImage.readPixels(0, 0, {
      width: FX, height: FX, colorType: CK.ColorType.RGBA_8888,
      alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB,
    });
    const inside = (x, y) => {
      const xi = x | 0, yi = y | 0;
      if (xi < 0 || yi < 0 || xi >= FX || yi >= FX) return 0;
      return px[(yi * FX + xi) * 4 + 3] / 255;
    };

    // 2. What is actually on the rock: a faint worn groove where the ring runs, so the photo's
    // edge is closed even between pecks, and the pecks themselves.
    const surface = CK.MakeSurface(FX, FX);
    const c = surface.getCanvas();
    c.clear(CK.TRANSPARENT);
    c.save();
    c.scale(K, K);
    const groove = white(0.3);
    groove.setStyle(CK.PaintStyle.Stroke);
    groove.setStrokeWidth(3.4);
    c.drawCircle(O, O, 51.9, groove);
    c.restore();
    carver.peck(CK, c, inside, FX, FX, r, 0.62);

    const image = surface.makeImageSnapshot();
    fs.writeFileSync(path.join(OUT_DIR, `frame-${level}.png`), Buffer.from(image.encodeToBytes()));
    image.delete();
    maskImage.delete();
    surface.delete();
    maskSurface.delete();
    frames.push(`  require('../../assets/gems/frame-${level}.png'),`);
  }

  fs.writeFileSync(MAP_FILE, [
    '// Generated by scripts/gen-gems.js — rerun it, never edit this.',
    "import type { ImageSourcePropType } from 'react-native';",
    "import type { GemTier } from '../../models/user';",
    '',
    `/** The pixel sizes each stone is baked at; the badge picks the smallest that covers its size. */`,
    `export const GEM_PIXELS = [${SIZES.join(', ')}] as const;`,
    '',
    `export type GemLayer = ${LAYERS.map((l) => `'${l}'`).join(' | ')};`,
    '',
    `export const GEM_IMAGES: Record<GemTier, Record<GemLayer, Record<(typeof GEM_PIXELS)[number], ImageSourcePropType>>> = {`,
    ...entries,
    '};',
    '',
    '/** The portrait frame for each rung, `TIER_ORDER` order; tinted the tier colour by `ProfileAvatar`. */',
    'export const GEM_FRAMES: readonly ImageSourcePropType[] = [',
    ...frames,
    '];',
    '',
  ].join('\n'));
  console.log(`${Object.keys(CUTS).length} stones x ${LAYERS.length} layers x ${SIZES.length} sizes`);
}

main().catch((e) => { console.error(e); process.exit(1); });
