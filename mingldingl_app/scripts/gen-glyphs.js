// scripts/gen-glyphs.js — inks the glyph set (components/ui/Glyph.tsx) and bakes it to PNGs.
//
// The drawings stay where they are: this reads the GLYPHS table, STROKE and DOT straight out of
// Glyph.tsx, so that file is still the one place a glyph is cut. What changes is how the app
// shows one. Drawn live as react-native-svg, every glyph on Android was its own view rasterized
// on the CPU into its own bitmap whenever it appeared — 23 of them made up much of the Hearth's
// 400ms opening frame on the Galaxy A51 (2026-10-03). As a white PNG tinted at draw time it is a
// texture the GPU already has.
//
// Rendered with canvaskit-wasm (Skia, already installed for the web build). Each path is walked
// and inked as a brush stroke: a run of discs along it, sized by where the brush is (an open stroke
// swells from a point to its full width and back; a closed one breathes) and by its direction
// (a nib laid at 45°, so strokes running one diagonal sit fuller than the other). The discs are
// unioned into one path and filled once, so the edge is anti-aliased once and stays clean. Three
// sizes per glyph so nothing is ever shrunk more than 2x on screen (bilinear scaling past that
// loses thin lines).
//
// Rerun with: node scripts/gen-glyphs.js   (writes assets/glyphs/*.png and components/ui/glyphImages.ts)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'components', 'ui', 'Glyph.tsx');
const OUT_DIR = path.join(ROOT, 'assets', 'glyphs');
const MAP_FILE = path.join(ROOT, 'components', 'ui', 'glyphImages.ts');
const SIZES = [48, 96, 192];
const VIEWBOX = 24;

function readCuts() {
  const src = fs.readFileSync(SOURCE, 'utf8');
  const literal = src.match(/(?:export )?const GLYPHS: Record<GlyphName, Cuts> = (\{[\s\S]*?\n\});/);
  const stroke = src.match(/export const STROKE = ([\d.]+);/);
  const dot = src.match(/(?:export )?const DOT = ([\d.]+);/);
  if (!literal || !stroke || !dot) throw new Error('Glyph.tsx no longer has the shape this script reads');
  // The table is a plain object literal (comments and all), so it evaluates as JavaScript.
  const glyphs = new Function(`return (${literal[1]});`)();
  return { glyphs, stroke: Number(stroke[1]), dot: Number(dot[1]) };
}

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  const { glyphs, stroke, dot } = readCuts();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const ink = new CK.Paint();
  ink.setAntiAlias(true);
  ink.setColor(CK.WHITE);
  ink.setStyle(CK.PaintStyle.Fill);
  const lift = new CK.Paint();
  lift.setAntiAlias(true);
  lift.setBlendMode(CK.BlendMode.Clear);
  const die = new CK.Paint();
  die.setAntiAlias(true);
  die.setBlendMode(CK.BlendMode.Clear);
  die.setStyle(CK.PaintStyle.Stroke);

  /** One brush stroke along every contour of `svg`, as a single filled outline. */
  function brush(svg, name) {
    const source = CK.Path.MakeFromSVGString(svg);
    if (!source) throw new Error(`${name}: unreadable path ${svg}`);
    const out = new CK.Path();
    const contours = new CK.ContourMeasureIter(source, false, 1);
    let contour;
    while ((contour = contours.next())) {
      const length = contour.length();
      const closed = contour.isClosed();
      const steps = Math.max(12, Math.ceil(length / 0.04));
      const breaths = Math.max(1, Math.round(length / 12));
      // A flick (a spark, a hanging ring) carries less ink than a full stroke, or it blots.
      const load = Math.min(1, 0.5 + length / 10);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const [x, y, tx, ty] = contour.getPosTan(t * length);
        const swell = closed
          ? 0.82 + 0.18 * Math.sin(2 * Math.PI * breaths * t + 0.6)
          : 0.26 + 0.74 * Math.pow(Math.sin(Math.PI * t), 0.45);
        const nib = 0.8 + 0.2 * Math.abs(Math.sin(Math.atan2(ty, tx) - Math.PI / 4));
        out.addCircle(x, y, (stroke / 2) * swell * nib * load);
      }
      contour.delete();
    }
    contours.delete();
    source.delete();
    return out;
  }

  /** A pressed wax disc, its rim a little uneven, as a closed path. */
  function wax(cx, cy, r) {
    const p = new CK.Path();
    const n = 72;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * 2 * Math.PI;
      const rr = r * (1 + 0.06 * Math.sin(9 * a));
      const [x, y] = [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
      if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    p.close();
    return p;
  }

  const names = Object.keys(glyphs);
  for (const name of names) {
    const { lines = [], rings = [], dots = [] } = glyphs[name];
    for (const px of SIZES) {
      const surface = CK.MakeSurface(px, px);
      const canvas = surface.getCanvas();
      canvas.clear(CK.TRANSPARENT);
      canvas.scale(px / VIEWBOX, px / VIEWBOX);
      const strokes = [
        ...lines,
        ...rings.map(([cx, cy, r]) => `M${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}Z`),
      ];
      for (const d of strokes) {
        const p = brush(d, name);
        canvas.drawPath(p, ink);
        p.delete();
      }
      // A seal is pressed over whatever it sits on: lift the ink in a margin around it first, so it
      // reads as wax on the line rather than a blot in it, then the disc, then its die ring.
      const r = dot / 2;
      for (const [cx, cy] of dots) {
        canvas.drawCircle(cx, cy, r + stroke * 0.4, lift);
        const p = wax(cx, cy, r);
        canvas.drawPath(p, ink);
        p.delete();
        die.setStrokeWidth(r * 0.24);
        canvas.drawCircle(cx, cy, r * 0.52, die);
      }
      const image = surface.makeImageSnapshot();
      fs.writeFileSync(path.join(OUT_DIR, `${name}-${px}.png`), Buffer.from(image.encodeToBytes()));
      image.delete();
      surface.delete();

      // A place's ground is its own image, so it can be tinted brass under a mark in another tone.
      if (glyphs[name].ground) {
        const ground = CK.MakeSurface(px, px);
        const gc = ground.getCanvas();
        gc.clear(CK.TRANSPARENT);
        gc.scale(px / VIEWBOX, px / VIEWBOX);
        const p = brush(glyphs[name].ground, name);
        gc.drawPath(p, ink);
        p.delete();
        const gi = ground.makeImageSnapshot();
        fs.writeFileSync(path.join(OUT_DIR, `${name}-ground-${px}.png`), Buffer.from(gi.encodeToBytes()));
        gi.delete();
        ground.delete();
      }
    }
  }
  const grounded = names.filter((n) => glyphs[n].ground);

  const key = (n) => (/^[a-z]+$/.test(n) ? n : `'${n}'`);
  const entries = names.map((n) => `  ${key(n)}: { ${SIZES.map((s) => `${s}: require('../../assets/glyphs/${n}-${s}.png')`).join(', ')} },`);
  fs.writeFileSync(MAP_FILE, [
    '// Generated by scripts/gen-glyphs.js from the GLYPHS table in ./Glyph.tsx — rerun it, never edit this.',
    "import type { ImageSourcePropType } from 'react-native';",
    "import type { GlyphName } from './Glyph';",
    '',
    `/** The pixel sizes each glyph is baked at; \`Glyph\` picks the smallest that covers the screen size. */`,
    `export const GLYPH_PIXELS = [${SIZES.join(', ')}] as const;`,
    '',
    `export const GLYPH_IMAGES: Record<GlyphName, Record<(typeof GLYPH_PIXELS)[number], ImageSourcePropType>> = {`,
    ...entries,
    '};',
    '',
    '/** The ground each place stands on, baked apart so it takes its own tint (see `Places`). */',
    `export const GLYPH_GROUNDS: Partial<Record<GlyphName, Record<(typeof GLYPH_PIXELS)[number], ImageSourcePropType>>> = {`,
    ...grounded.map((n) => `  ${key(n)}: { ${SIZES.map((s) => `${s}: require('../../assets/glyphs/${n}-ground-${s}.png')`).join(', ')} },`),
    '};',
    '',
  ].join('\n'));
  console.log(`${names.length} glyphs x ${SIZES.length} sizes`);
}

main().catch((e) => { console.error(e); process.exit(1); });
