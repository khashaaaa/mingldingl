// scripts/gen-stones.js — the stone shards letters float on in a thread (`components/chat/LetterRow.tsx`).
//
// Every letter is a shard of rock hovering over its own shadow: mine warm sandstone on the right,
// theirs cold slate on the left — side, colour and grain all say who spoke, before a word is read.
//
// A shard has to fit any letter, one word or a paragraph, so each stone is baked at five aspect
// ratios (three different breaks of rock at each) and the row picks the nearest and stretches it
// the rest of the way; a rock that is 20% wider than it was cut still reads as rock. Each shard
// is a slab: the face, lit from above, sitting on a darker band of its own thickness, with the
// edge chipped all the way round. Sandstone carries strata, slate its cleavage lines. The face is
// kept dark enough that `INK.primary` stands on it.
//
// Also bakes `shadow.png`, the soft blot each shard hovers over.
//
// Rerun with: node scripts/gen-stones.js
//   (writes assets/stones/*.png and components/chat/stoneImages.ts)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'stones');
const MAP_FILE = path.join(ROOT, 'components', 'chat', 'stoneImages.ts');

/** Width over height of each bake; a row picks the nearest. */
const ASPECTS = [1.4, 2.2, 3.4, 5, 7.5];
const VARIANTS = 3;
/** Baked height in px. A one-line letter is ~48pt tall, so this is about three times that. */
const H = 150;

const STONES = {
  // Mine: warm sandstone, laid in strata.
  sand: { top: '#6A5038', bottom: '#4C3826', side: '#2C1F14', rim: '#9C7A55', speck: ['#8A6A48', '#3A2A1C'], grain: 'strata' },
  // Theirs: cold slate, split along its cleavage.
  slate: { top: '#3A4352', bottom: '#2A313D', side: '#161B23', rim: '#66748A', speck: ['#55606F', '#1E242D'], grain: 'cleave' },
};

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

/**
 * The outline of one shard inside a w×h box: the rectangle walked round with its edge chipped in
 * by up to `jag`, the corners knocked off at random, never two shards alike.
 */
function outline(r, w, h, jag) {
  const pts = [];
  const side = (x0, y0, x1, y1, nx, ny) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(3, Math.round(len / (14 + r() * 12)));
    // A slow wander along the side, so no edge is a ruled line, and chips knocked out of it.
    const f = 1 + r() * 2, ph = r() * 6;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const wander = (0.5 + 0.5 * Math.sin(t * Math.PI * f + ph)) * jag * 1.1;
      const chip = r() < 0.2 ? jag * (0.6 + r() * 0.6) : jag * r() * 0.35;
      const bite = Math.min(jag * 2, wander + chip);
      pts.push([x0 + (x1 - x0) * t + nx * bite, y0 + (y1 - y0) * t + ny * bite]);
    }
  };
  const c = () => Math.min(h * 0.3, jag * (1.5 + r() * 4));
  const [a, b, d, e] = [c(), c(), c(), c()];
  side(a, 0, w - b, 0, 0, 1);
  side(w, b, w, h - d, -1, 0);
  side(w - d, h, e, h, 0, -1);
  side(0, h - e, 0, a, 1, 0);
  return pts;
}

/**
 * The crag under a floating shard: the face's outline with its lower edge dragged down into a
 * rough belly, deepest toward the middle, broken into points.
 */
function belly(r, face, w, faceH, depth) {
  return face.map(([x, y]) => {
    if (y < faceH * 0.55) return [x, y + 4];
    const t = Math.max(0, Math.min(1, x / w));
    const sag = Math.sin(t * Math.PI);
    return [x, y + 5 + depth * (0.35 + 0.65 * sag) * (0.6 + r() * 0.5)];
  });
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
  const pathOf = (pts, dx = 0, dy = 0) => {
    const p = new CK.Path();
    p.moveTo(pts[0][0] + dx, pts[0][1] + dy);
    for (const q of pts.slice(1)) p.lineTo(q[0] + dx, q[1] + dy);
    p.close();
    return p;
  };

  const files = {};
  for (const [stone, def] of Object.entries(STONES)) {
    files[stone] = [];
    for (const [ai, aspect] of ASPECTS.entries()) {
      const row = [];
      for (let v = 0; v < VARIANTS; v++) {
        const r = rng(0x5707e + ai * 131 + v * 977 + (stone === 'sand' ? 0 : 50021));
        const W = Math.round(H * aspect);
        /** The face takes the top of the bake; the crag beneath it, the rest. */
        const crag = Math.round(H * 0.2);
        const thick = crag;
        const jag = 8;
        const surface = CK.MakeSurface(W, H);
        const c = surface.getCanvas();
        c.clear(CK.TRANSPARENT);
        const face = outline(r, W, H - thick, jag);
        const paint = new CK.Paint();
        paint.setAntiAlias(true);

        // The crag under the face, in the stone's shadow side, with a few lit planes on it.
        const under = pathOf(belly(r, face, W, H - thick, thick - 6));
        paint.setColor(color(def.side));
        c.drawPath(under, paint);
        c.save();
        c.clipPath(under, CK.ClipOp.Intersect, true);
        for (let k = 0; k < W / 60; k++) {
          const x = r() * W, y = H - thick + r() * thick * 0.5;
          paint.setColor(color(def.bottom, 0.15 + r() * 0.15));
          const p = pathOf([[x, y], [x + 8 + r() * 14, y + 2], [x + 4, y + 6 + r() * 12]]);
          c.drawPath(p, paint);
          p.delete();
        }
        c.restore();

        // The face, lit from above.
        const facePath = pathOf(face);
        paint.setShader(CK.Shader.MakeLinearGradient([0, 0], [0, H - thick], [color(def.top), color(def.bottom)], null, CK.TileMode.Clamp));
        c.drawPath(facePath, paint);
        paint.setShader(null);

        c.save();
        c.clipPath(facePath, CK.ClipOp.Intersect, true);
        // Grain: sandstone's strata run level and wander; slate's cleavage runs on a slant.
        const grain = new CK.Paint();
        grain.setAntiAlias(true);
        grain.setStyle(CK.PaintStyle.Stroke);
        // Mottle first: broad soft patches where the stone is lighter or darker.
        for (let k = 0; k < W / 26; k++) {
          const blot = new CK.Paint();
          blot.setAntiAlias(true);
          blot.setColor(color(r() < 0.5 ? def.speck[0] : def.speck[1], 0.18 + r() * 0.18));
          blot.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 8 + r() * 10, true));
          c.drawOval(CK.XYWHRect(r() * W - 30, r() * H - 20, 30 + r() * 90, 18 + r() * 40), blot);
          blot.delete();
        }
        // Planes the stone broke along: a few large faint facets, lit or shadowed.
        for (let k = 0; k < 2 + W / 160; k++) {
          const x = r() * W, y = r() * (H - thick);
          const p = pathOf([[x, y], [x + 30 + r() * 80, y + (r() - 0.5) * 40], [x + (r() - 0.5) * 60, y + 25 + r() * 50]]);
          paint.setColor(r() < 0.55 ? color(def.rim, 0.07 + r() * 0.06) : color(def.side, 0.12 + r() * 0.1));
          c.drawPath(p, paint);
          p.delete();
        }
        if (def.grain === 'strata') {
          for (let y = 14 + r() * 14; y < H; y += 20 + r() * 26) {
            const p = new CK.Path();
            p.moveTo(-10, y);
            for (let x = 0; x <= W + 20; x += 40) p.lineTo(x, y + (r() - 0.5) * 5);
            grain.setStrokeWidth(0.8 + r() * 1.6);
            grain.setColor(color(r() < 0.5 ? def.speck[0] : def.speck[1], 0.14 + r() * 0.14));
            c.drawPath(p, grain);
            p.delete();
          }
        } else {
          for (let x = -H; x < W + H; x += 18 + r() * 40) {
            const p = new CK.Path();
            p.moveTo(x, -5);
            p.lineTo(x + H * 0.55 + (r() - 0.5) * 10, H);
            grain.setStrokeWidth(0.8 + r() * 1.6);
            grain.setColor(color(r() < 0.6 ? def.speck[1] : def.speck[0], 0.16 + r() * 0.18));
            c.drawPath(p, grain);
            p.delete();
          }
        }
        // Speckle: the stone's own grit.
        for (let k = 0; k < (W * H) / 70; k++) {
          paint.setColor(color(r() < 0.5 ? def.speck[0] : def.speck[1], 0.25 + r() * 0.35));
          c.drawCircle(r() * W, r() * H, 0.5 + r() * 1.3, paint);
        }
        // A crack or two, from an edge inward.
        const cracks = Math.floor(r() * 2.2);
        for (let k = 0; k < cracks; k++) {
          const p = new CK.Path();
          let x = r() < 0.5 ? r() * W * 0.2 : W - r() * W * 0.2;
          let y = r() * (H - thick);
          p.moveTo(x, y);
          for (let s = 0; s < 4; s++) {
            x += (x < W / 2 ? 1 : -1) * (8 + r() * 18);
            y += (r() - 0.5) * 16;
            p.lineTo(x, y);
          }
          grain.setStrokeWidth(1.4);
          grain.setColor(color(def.side, 0.6));
          c.drawPath(p, grain);
          p.delete();
        }
        c.restore();

        // The edge: lit along the top where the light catches it, shadowed underneath.
        const rim = new CK.Paint();
        rim.setAntiAlias(true);
        rim.setStyle(CK.PaintStyle.Stroke);
        rim.setStrokeJoin(CK.StrokeJoin.Round);
        rim.setStrokeWidth(2.2);
        c.save();
        c.clipRect(CK.XYWHRect(0, 0, W, (H - thick) * 0.45), CK.ClipOp.Intersect, true);
        rim.setColor(color(def.rim, 0.75));
        c.drawPath(facePath, rim);
        c.restore();
        c.save();
        c.clipRect(CK.XYWHRect(0, (H - thick) * 0.45, W, H), CK.ClipOp.Intersect, true);
        rim.setColor(color(def.side, 0.8));
        c.drawPath(facePath, rim);
        c.restore();

        const name = `${stone}-${ai}-${v}`;
        const image = surface.makeImageSnapshot();
        fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(image.encodeToBytes()));
        image.delete();
        [under, facePath].forEach((p) => p.delete());
        [paint, grain, rim].forEach((p) => p.delete());
        surface.delete();
        row.push(name);
      }
      files[stone].push(row);
    }
  }

  // The shadow each shard floats over: a soft dark blot, wider than tall.
  {
    const surface = CK.MakeSurface(240, 40);
    const c = surface.getCanvas();
    c.clear(CK.TRANSPARENT);
    const p = new CK.Paint();
    p.setAntiAlias(true);
    p.setColor(CK.Color4f(0, 0, 0, 0.75));
    p.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 7, true));
    c.drawOval(CK.LTRBRect(20, 10, 220, 30), p);
    const image = surface.makeImageSnapshot();
    fs.writeFileSync(path.join(OUT_DIR, 'shadow.png'), Buffer.from(image.encodeToBytes()));
  }

  const req = (n) => `require('../../assets/stones/${n}.png')`;
  const lines = [
    '// Generated by scripts/gen-stones.js — do not edit; rerun the script instead.',
    '',
    'import type { ImageSourcePropType } from \'react-native\';',
    '',
    '/** Width over height of each bake, in the order `STONE_IMAGES` lists them. */',
    `export const STONE_ASPECTS = ${JSON.stringify(ASPECTS)} as const;`,
    '',
    '/** [stone][aspect index][variant]. */',
    'export const STONE_IMAGES: Record<\'sand\' | \'slate\', ImageSourcePropType[][]> = {',
    ...Object.entries(files).map(([stone, rows]) =>
      `  ${stone}: [\n${rows.map((row) => `    [${row.map(req).join(', ')}],`).join('\n')}\n  ],`),
    '};',
    '',
    `export const STONE_SHADOW: ImageSourcePropType = ${req('shadow')};`,
    '',
  ];
  fs.writeFileSync(MAP_FILE, lines.join('\n'));
  console.log(`wrote ${Object.values(files).flat(2).length + 1} stones and components/chat/stoneImages.ts`);
}

main().catch((e) => { console.error(e); process.exit(1); });
