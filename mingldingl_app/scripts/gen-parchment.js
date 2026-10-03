// scripts/gen-parchment.js — the paper under every hero card and rising strip (`ParchmentFill`).
//
// It was 256px of even noise stretched across the card, which blurred to nothing at a card's size:
// at the 6% it was washed in, nobody could tell it was there. Now it is paper: a few soft blooms
// where the wash pooled, long fibres laid mostly one way, and a fine tooth — a 512px tile that
// repeats edge to edge (every mark wraps across the seam), so it stays crisp on any card. White
// light and black dark on a mid-grey, so it lightens and darkens whatever gradient it sits on.
//
// Rerun with: node scripts/gen-parchment.js   (writes assets/textures/parchment.png)

const fs = require('fs');
const path = require('path');

const N = 512;

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

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  const surface = CK.MakeSurface(N, N);
  const c = surface.getCanvas();
  c.clear(CK.Color4f(0.5, 0.5, 0.5, 1));
  const r = rng(2026);
  /** Draw at (x, y) and at every wrapped copy, so the tile has no seam. */
  const wrapped = (draw) => {
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      c.save();
      c.translate(dx, dy);
      draw();
      c.restore();
    }
  };
  const paint = (v, a, blur = 0) => {
    const p = new CK.Paint();
    p.setAntiAlias(true);
    p.setColor(CK.Color4f(v, v, v, a));
    if (blur) p.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, blur, true));
    return p;
  };

  // Blooms: where the wash pooled and dried, light and dark.
  for (let i = 0; i < 26; i++) {
    const x = r() * N, y = r() * N, rad = 30 + r() * 90, dark = r() < 0.5;
    const p = paint(dark ? 0.32 : 0.7, 0.22 + r() * 0.18, rad * 0.45);
    wrapped(() => c.drawOval(CK.LTRBRect(x - rad, y - rad * (0.5 + r() * 0.4), x + rad, y + rad * 0.6), p));
  }
  // Fibres: long, thin, mostly running one way, a few across.
  for (let i = 0; i < 380; i++) {
    const x = r() * N, y = r() * N;
    const len = 12 + r() * 46;
    const a = (r() < 0.8 ? 0.15 : 1.4) + (r() - 0.5) * 0.5;
    const bend = (r() - 0.5) * 10;
    const path = new CK.Path();
    path.moveTo(x, y);
    path.quadTo(x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len);
    const p = paint(r() < 0.55 ? 0.82 : 0.25, 0.35 + r() * 0.35);
    p.setStyle(CK.PaintStyle.Stroke);
    p.setStrokeWidth(0.5 + r() * 0.8);
    p.setStrokeCap(CK.StrokeCap.Round);
    wrapped(() => c.drawPath(path, p));
    path.delete();
  }
  // The tooth: a fine grain over everything.
  for (let i = 0; i < 9000; i++) {
    const x = r() * N, y = r() * N;
    c.drawCircle(x, y, 0.4 + r() * 0.7, paint(r() < 0.5 ? 0.2 : 0.85, 0.25 + r() * 0.3));
  }

  const image = surface.makeImageSnapshot();
  const out = path.join(__dirname, '..', 'assets', 'textures', 'parchment.png');
  fs.writeFileSync(out, Buffer.from(image.encodeToBytes()));
  console.log('wrote parchment.png', `${N}x${N}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
