// scripts/gen-sky.js — paints the four skies over the hearth (components/hearth/SkyWindow.tsx).
//
// The window shows the real hour on the device: night, dawn, day, dusk. Each is one ink-wash
// painting of the same place — the steppe running back in three ranges to the far peaks, a ger on
// the near rise with its smoke going up, grass in the foreground — so a returning visitor sees the
// same home at a different hour rather than a different picture. Everything is seeded, never
// random at run time: the hills, stars and grass are where they were yesterday.
//
// Painted with canvaskit-wasm (the same Skia `gen-glyphs.js` inks with) and baked to PNG: a
// painting on the GPU costs nothing, where drawing this live would cost every opening frame.
//
// Rerun with: node scripts/gen-sky.js   (writes assets/sky/{night,dawn,day,dusk}.png)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'sky');
/** The painting's own coordinates: three times the window's 160pt height. */
const W = 1080;
const H = 480;
/**
 * Baked at two thirds of that (720×320, twice the window). The wash is soft by nature, so the
 * extra pixels bought nothing a viewer could see and cost a megabyte of PNG across the four.
 */
const OUT = 2 / 3;

/** A small seeded generator, so every bake paints the same steppe. */
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

const hex = (h, a = 1) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
};

/**
 * The four hours. Colours are the app's palette pushed toward each light: `bg`/`panel` blues for
 * the night, the gold and ember of `COLORS` for dawn and dusk, the parchment `text` cream for the
 * felt of the ger by day.
 */
const PHASES = {
  night: {
    sky: ['#04050C', '#0A1128', '#1A2442'],
    far: '#1B2440', mid: '#121A2E', near: '#080C16', mist: hex('#2A3658', 0.35),
    felt: '#4C566E', feltLit: '#5E6A86', door: '#F5A83C', doorGlow: 0.55,
    smoke: hex('#8F97A3', 0.16), grass: '#05070D',
    moon: { x: 0.78, y: 0.2, r: 22, color: '#EDE4D3', glow: 0.22 }, stars: 150, milky: true,
  },
  dawn: {
    sky: ['#0E1430', '#4A3552', '#E3893A'],
    far: '#57405E', mid: '#2E2438', near: '#15111C', mist: hex('#E8A060', 0.22),
    felt: '#B9A196', feltLit: '#E6C3A3', door: '#F5A83C', doorGlow: 0.3,
    smoke: hex('#EDE4D3', 0.2), grass: '#0E0B12',
    sun: { x: 0.24, y: 0.6, r: 40, color: '#F5A83C', glow: 0.6 }, stars: 22, birds: 3,
  },
  day: {
    sky: ['#24405F', '#5F7E95', '#C9CFC4'],
    far: '#7D8D93', mid: '#5E6E57', near: '#36432F', mist: hex('#DCE2D6', 0.35),
    felt: '#E4DACA', feltLit: '#F4EEE2', door: '#8A4A20', doorGlow: 0,
    smoke: hex('#F4EEE2', 0.28), grass: '#28321F',
    sun: { x: 0.3, y: 0.18, r: 20, color: '#FFF6E0', glow: 0.35 }, clouds: true, birds: 4,
  },
  dusk: {
    sky: ['#120A12', '#5A2418', '#D9661F'],
    far: '#4A2620', mid: '#26151A', near: '#0E090C', mist: hex('#C1461E', 0.25),
    felt: '#3A2722', feltLit: '#6A3F2C', door: '#F5A83C', doorGlow: 0.6,
    smoke: hex('#D77951', 0.18), grass: '#0A0608',
    sun: { x: 0.34, y: 0.56, r: 44, color: '#F5A83C', glow: 0.65 }, stars: 6,
  },
};

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const paint = (color, alpha) => {
    const p = new CK.Paint();
    p.setAntiAlias(true);
    p.setColor(typeof color === 'string' ? CK.Color4f(...hex(color, alpha ?? 1)) : CK.Color4f(...color));
    return p;
  };
  const blurred = (p, sigma) => { p.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, sigma, true)); return p; };

  /** The glyph brush, at painting scale: discs along a path, unioned and filled once. */
  function brush(points, width, taper = true) {
    const out = new CK.Path();
    const n = points.length - 1;
    points.forEach(([x, y], i) => {
      const t = n ? i / n : 0.5;
      const swell = taper ? 0.2 + 0.8 * Math.pow(Math.sin(Math.PI * t), 0.5) : 1;
      out.addCircle(x, y, (width / 2) * swell);
    });
    return out;
  }
  const along = (pts, step = 1.5) => {
    // Resample a polyline densely so the brush reads as one stroke.
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const d = Math.hypot(x1 - x0, y1 - y0);
      const k = Math.max(1, Math.ceil(d / step));
      for (let j = 0; j < k; j++) out.push([x0 + ((x1 - x0) * j) / k, y0 + ((y1 - y0) * j) / k]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  };

  /** A ridge line across the width: rolling for the steppe, sharper for the far peaks. */
  function ridge(seed, base, amp, peaks) {
    const r = rng(seed);
    const waves = Array.from({ length: 5 }, (_, i) => ({
      f: (0.8 + r() * 1.6) * (i + 1) * Math.PI * 2 / W,
      p: r() * Math.PI * 2,
      a: amp / (i + 1.4),
    }));
    const ys = [];
    for (let x = -10; x <= W + 10; x += 4) {
      let y = base;
      for (const w of waves) y -= peaks ? Math.abs(Math.sin(w.f * x * 0.7 + w.p)) * w.a * 1.3 : Math.sin(w.f * x + w.p) * w.a;
      ys.push([x, y]);
    }
    return ys;
  }

  /** A range of hills: the wash darkest at its crest and thinning into the mist below. */
  function range(canvas, pts, color, mist) {
    const p = new CK.Path();
    p.moveTo(pts[0][0], H + 10);
    for (const [x, y] of pts) p.lineTo(x, y);
    p.lineTo(pts[pts.length - 1][0], H + 10);
    p.close();
    const top = Math.min(...pts.map(([, y]) => y));
    const fill = new CK.Paint();
    fill.setAntiAlias(true);
    fill.setShader(CK.Shader.MakeLinearGradient(
      [0, top], [0, H],
      [CK.Color4f(...hex(color)), CK.Color4f(...hex(color, 0.92))], null, CK.TileMode.Clamp,
    ));
    canvas.drawPath(p, fill);
    // The crest inked once more, darker, in a brush that comes and goes — the wash's edge.
    const crest = brush(along(pts, 3), 5, false);
    const ink = paint(color);
    ink.setColorFilter(CK.ColorFilter.MakeBlend(CK.Color4f(0, 0, 0, 0.25), CK.BlendMode.SrcATop));
    canvas.drawPath(crest, ink);
    // Mist lying in the range's own valleys: clipped to the hills, so it never hangs in the sky,
    // and fading in and out, so it has no edge of its own.
    if (mist) {
      const mean = pts.reduce((sum, [, y]) => sum + y, 0) / pts.length;
      const clear = CK.Color4f(mist[0], mist[1], mist[2], 0);
      const m = new CK.Paint();
      m.setAntiAlias(true);
      m.setShader(CK.Shader.MakeLinearGradient(
        [0, mean - 10], [0, mean + 90],
        [clear, CK.Color4f(...mist), clear], [0, 0.45, 1], CK.TileMode.Clamp,
      ));
      canvas.save();
      canvas.clipPath(p, CK.ClipOp.Intersect, true);
      canvas.drawRect(CK.LTRBRect(0, mean - 10, W, mean + 90), m);
      canvas.restore();
    }
  }

  function heightAt(pts, x) {
    for (let i = 0; i < pts.length - 1; i++) if (pts[i + 1][0] >= x) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return pts[pts.length - 1][1];
  }

  /** The ger: lattice wall, the roof's long curve up to the crown, a door, its smoke. */
  function ger(canvas, cx, ground, s, ph) {
    const wallH = 38 * s, halfW = 62 * s, roofH = 34 * s;
    const top = ground - wallH;
    // Its shadow on the grass.
    canvas.drawOval(CK.LTRBRect(cx - halfW * 1.25, ground - 6 * s, cx + halfW * 1.35, ground + 8 * s), blurred(paint('#000000', 0.35), 6));
    // Wall.
    const wall = new CK.Path();
    wall.moveTo(cx - halfW, ground); wall.lineTo(cx - halfW * 0.98, top); wall.lineTo(cx + halfW * 0.98, top); wall.lineTo(cx + halfW, ground); wall.close();
    const felt = new CK.Paint();
    felt.setAntiAlias(true);
    felt.setShader(CK.Shader.MakeLinearGradient([cx - halfW, 0], [cx + halfW, 0],
      [CK.Color4f(...hex(ph.felt)), CK.Color4f(...hex(ph.feltLit))], null, CK.TileMode.Clamp));
    canvas.drawPath(wall, felt);
    // Roof.
    const roof = new CK.Path();
    roof.moveTo(cx - halfW * 1.04, top + 2 * s);
    roof.cubicTo(cx - halfW * 0.6, top - roofH * 0.55, cx - halfW * 0.25, top - roofH * 0.95, cx - 9 * s, top - roofH);
    roof.lineTo(cx + 9 * s, top - roofH);
    roof.cubicTo(cx + halfW * 0.25, top - roofH * 0.95, cx + halfW * 0.6, top - roofH * 0.55, cx + halfW * 1.04, top + 2 * s);
    roof.close();
    canvas.drawPath(roof, felt);
    // The bands that tie the felt on, and the roof's edge — inked.
    const ink = paint(ph.near, 0.75);
    const bands = [[top + wallH * 0.32], [top + wallH * 0.7]];
    for (const [y] of bands) canvas.drawPath(brush(along([[cx - halfW * 0.99, y], [cx + halfW * 0.99, y]], 2), 2.6 * s, false), ink);
    canvas.drawPath(brush(along([[cx - halfW * 1.04, top + 2 * s], [cx + halfW * 1.04, top + 2 * s]], 2), 3.4 * s), ink);
    // Roof poles, faint.
    for (let i = -3; i <= 3; i++) {
      canvas.drawPath(brush(along([[cx + i * halfW * 0.3, top], [cx + i * 2.6 * s, top - roofH + 2 * s]], 2), 1.6 * s), paint(ph.near, 0.25));
    }
    // Crown.
    canvas.drawPath(brush(along([[cx - 10 * s, top - roofH], [cx + 10 * s, top - roofH]], 1.5), 4 * s, false), ink);
    // Door, painted gold — and lit, after dark.
    const dw = 15 * s, dh = 25 * s;
    const door = CK.LTRBRect(cx + halfW * 0.18 - dw / 2, ground - dh, cx + halfW * 0.18 + dw / 2, ground);
    if (ph.doorGlow > 0) canvas.drawOval(CK.LTRBRect(door[0] - 30 * s, door[1] - 14 * s, door[2] + 30 * s, ground + 26 * s), blurred(paint(ph.door, ph.doorGlow * 0.5), 18));
    canvas.drawRect(door, paint(ph.door, ph.doorGlow > 0 ? 1 : 0.9));
    canvas.drawPath(brush(along([[door[0], door[1]], [door[2], door[1]]], 1), 2 * s, false), ink);
    // Stovepipe and smoke, curling off with the wind.
    const pipeX = cx + 4 * s, pipeTop = top - roofH - 10 * s;
    canvas.drawPath(brush(along([[pipeX, top - roofH + 2 * s], [pipeX, pipeTop]], 1), 3 * s, false), ink);
    const r = rng(77);
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let t = 0; t <= 1; t += 0.02) {
        pts.push([pipeX + t * 140 * s + Math.sin(t * 9 + k) * 10 * s * (0.4 + t), pipeTop - t * (90 + k * 14) * s]);
      }
      const p = paint(ph.smoke);
      p.setColor(CK.Color4f(...ph.smoke));
      canvas.drawPath(brush(pts, (9 + k * 5 + r() * 4) * s), blurred(p, 3 + k * 2));
    }
  }

  for (const [name, ph] of Object.entries(PHASES)) {
    const surface = CK.MakeSurface(Math.round(W * OUT), Math.round(H * OUT));
    const canvas = surface.getCanvas();
    canvas.scale(OUT, OUT);
    // Sky.
    const sky = new CK.Paint();
    sky.setShader(CK.Shader.MakeLinearGradient([0, 0], [0, H * 0.78],
      ph.sky.map((c) => CK.Color4f(...hex(c))), [0, 0.55, 1], CK.TileMode.Clamp));
    canvas.drawRect(CK.LTRBRect(0, 0, W, H), sky);

    const r = rng(name.length * 991 + 7);
    if (ph.milky) {
      // The river of heaven: a soft band of low light, then dust along it.
      for (let i = 0; i < 260; i++) {
        const t = r();
        const x = t * W, y = 40 + t * 150 + (r() - 0.5) * 70;
        canvas.drawCircle(x, y, 10 + r() * 26, blurred(paint('#9FB0D8', 0.035), 14));
      }
      for (let i = 0; i < 260; i++) {
        const t = r();
        canvas.drawCircle(t * W, 40 + t * 150 + (r() - 0.5) * 60, 0.6 + r() * 0.8, paint('#DDE4F5', 0.25 + r() * 0.35));
      }
    }
    for (let i = 0; i < (ph.stars ?? 0); i++) {
      const x = r() * W, y = r() * H * 0.62, big = r() < 0.08;
      const a = (name === 'night' ? 0.5 : 0.25) + r() * 0.5;
      canvas.drawCircle(x, y, big ? 2.4 : 0.8 + r() * 1.1, paint('#EDE4D3', a));
      if (big) {
        // A bright one, with the brush's four-pointed spark.
        const s = paint('#EDE4D3', a * 0.7);
        canvas.drawPath(brush(along([[x - 9, y], [x + 9, y]], 0.5), 2.2), s);
        canvas.drawPath(brush(along([[x, y - 9], [x, y + 9]], 0.5), 2.2), s);
      }
    }
    if (ph.moon) {
      const { x, y, r: rad, color, glow } = ph.moon;
      canvas.drawCircle(x * W, y * H, rad * 4, blurred(paint(color, glow * 0.5), 40));
      canvas.drawCircle(x * W, y * H, rad, paint(color));
      // Its seas, washed in.
      canvas.drawCircle(x * W - rad * 0.3, y * H - rad * 0.2, rad * 0.32, blurred(paint('#B8B2A0', 0.5), 3));
      canvas.drawCircle(x * W + rad * 0.35, y * H + rad * 0.3, rad * 0.24, blurred(paint('#B8B2A0', 0.45), 3));
    }
    if (ph.sun) {
      const { x, y, r: rad, color, glow } = ph.sun;
      canvas.drawCircle(x * W, y * H, rad * 6, blurred(paint(color, glow * 0.45), 70));
      canvas.drawCircle(x * W, y * H, rad * 2.2, blurred(paint(color, glow * 0.6), 24));
      canvas.drawCircle(x * W, y * H, rad, paint(color));
    }
    if (ph.clouds) {
      // Long thin clouds, the way ink paintings lay them: dragged sideways in a dry brush.
      for (const [cx, cy, len] of [[260, 70, 320], [700, 110, 420], [940, 52, 220], [470, 150, 260]]) {
        for (let k = 0; k < 4; k++) {
          const pts = along([[cx - len / 2, cy + k * 5], [cx + len / 2, cy + k * 5 - 6]], 4);
          canvas.drawPath(brush(pts, 10 - k * 2), blurred(paint('#FFFFFF', 0.16), 4));
        }
      }
    }

    // The three ranges, far to near.
    const far = ridge(11, 300, 46, true);
    range(canvas, far, ph.far, ph.mist);
    const mid = ridge(23, 352, 26, false);
    range(canvas, mid, ph.mid, ph.mist);
    const near = ridge(37, 420, 22, false);

    // Birds, small and far, before the near rise covers the low sky.
    for (let i = 0; i < (ph.birds ?? 0); i++) {
      const bx = 380 + i * 46 + r() * 30, by = 120 + r() * 50, w = 7 + r() * 4;
      canvas.drawPath(brush(along([[bx - w, by - 3], [bx, by + 1], [bx + w, by - 4]], 0.5), 2.4), paint(ph.near, 0.8));
    }

    range(canvas, near, ph.near, null);
    // The ger on the near rise, right of centre.
    const gx = 690;
    ger(canvas, gx, heightAt(near, gx) + 8, 1.4, ph);
    // A hitching post beside it.
    const px = 540, py = heightAt(near, px) + 4;
    const post = paint(ph.near === '#36432F' ? '#2A2A22' : '#000000', 0.8);
    canvas.drawPath(brush(along([[px, py], [px, py - 34]], 1), 4, false), post);
    canvas.drawPath(brush(along([[px - 2, py - 30], [px + 46, py - 30]], 1), 3.4), post);
    canvas.drawPath(brush(along([[px + 44, py], [px + 44, py - 32]], 1), 4, false), post);

    // Grass in the foreground: quick upward flicks, denser at the edges of the frame.
    const g = rng(5);
    const grass = paint(ph.grass, 0.9);
    for (let i = 0; i < 420; i++) {
      const x = g() * W;
      const edge = Math.min(x, W - x) / (W / 2);
      if (g() < edge * 0.65) continue;
      const base = H - g() * 26;
      const h = 10 + g() * 26;
      const lean = (g() - 0.4) * 14;
      canvas.drawPath(brush(along([[x, base], [x + lean * 0.4, base - h * 0.6], [x + lean, base - h]], 1), 2.4 + g() * 1.6), grass);
    }

    // Paper: a faint grain over everything, so it reads as a wash rather than a gradient.
    // Quantised to a few levels: smooth noise is the one thing a PNG cannot compress.
    const GW = Math.round(W * OUT), GH = Math.round(H * OUT);
    const grain = new Uint8Array(GW * GH * 4);
    const n = rng(1234);
    for (let i = 0; i < GW * GH; i++) {
      const v = 128 + Math.round((n() - 0.5) * 4) * 22;
      grain[i * 4] = grain[i * 4 + 1] = grain[i * 4 + 2] = v;
      grain[i * 4 + 3] = 255;
    }
    const grainImage = CK.MakeImage({ width: GW, height: GH, alphaType: CK.AlphaType.Opaque, colorType: CK.ColorType.RGBA_8888, colorSpace: CK.ColorSpace.SRGB }, grain, GW * 4);
    const overlay = new CK.Paint();
    overlay.setBlendMode(CK.BlendMode.Overlay);
    overlay.setAlphaf(0.18);
    canvas.save();
    canvas.scale(1 / OUT, 1 / OUT);
    canvas.drawImage(grainImage, 0, 0, overlay);
    canvas.restore();
    // A vignette, so the painting sits in the window rather than running out of it.
    const vig = new CK.Paint();
    vig.setShader(CK.Shader.MakeRadialGradient([W / 2, H * 0.55], W * 0.72,
      [CK.Color4f(0, 0, 0, 0), CK.Color4f(0, 0, 0, 0.45)], [0.55, 1], CK.TileMode.Clamp));
    canvas.drawRect(CK.LTRBRect(0, 0, W, H), vig);

    const image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes(CK.ImageFormat.PNG, 100);
    fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(bytes));
    console.log(`${name}.png ${(bytes.length / 1024).toFixed(0)} KB`);
    image.delete();
    surface.delete();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
