// scripts/gen-brush.js — the app's dry brush, and every stroke painted with it.
//
// The glyphs are brush ink; the lines between things were ruled. This paints those lines instead,
// with a dry brush: each stroke is a few dozen bristles side by side, each carrying its own ink that
// runs out at its own rate, so a stroke lands heavy and wet, then breaks into streaks as it dries —
// the edge bristles first, which feathers it. It began on the Seek card (2026-10-04) and the user
// asked for it wherever it applied.
//
//   card-edge   the Seek card's gem line along its top: pressed at the left, dragged dry.
//   card-rule   the Seek card's line over its buttons: a light stroke, a hair at both ends.
//   card-ring   an open circle behind the Seek card's seal, left unclosed where the brush lifts.
//   trail       the way to the next gem on the Character sheet (`XPBar`): one long stroke, drawn
//               bare and then inked over in the gem's colour as far as the score has come.
//   rule        `SectionDivider`'s line, swelling from a hair at the margin to full at the knot.
//   frame-0…5   the portrait's frame on the Character sheet, one per rung, each a stroke more:
//               a ring; rays flicked off it; ink dabs between them; an arc over the top; one
//               under; and the two arcs drawn round into a second ring. Its outer arcs throw
//               a few flecks of splatter, as the Seek card's edge does off its lifted end.
//   digit-*     the numerals `BrushNumber` paints the score and the streak with, two hands each.
//   pool-*      an ink wash puddled under each room's name in `HeaderBar` (full colour, not a mask).
//   wash        the ink-wash passage (`InkWash`): frames side by side, clear to covered.
//
// White masks, tinted where they are used, unless said otherwise. Rendered with canvaskit-wasm like the other gen-*.js.
//
// Rerun with: node scripts/gen-brush.js
//   (writes assets/brush/*.png and components/ui/brushImages.ts)

const fs = require('fs');
const path = require('path');
const { rng } = require('./gen-carvings');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'brush');
const MAP_FILE = path.join(ROOT, 'components', 'ui', 'brushImages.ts');

/** The edge stroke is laid in a 44px band; the bake runs deeper so its splatter has room below. */
const EDGE_W = 1200, EDGE_BAND = 44, EDGE_H = 96;
const CARD_RULE_W = 1000, CARD_RULE_H = 20;
const CARD_RING = 520;
const TRAIL_W = 1400, TRAIL_H = 40;
const RULE_W = 600, RULE_H = 18;
/** The portrait frame: a 160pt box at 3x, centred on the avatar's 118pt one; the photo is the
 *  100pt circle in the middle and the edit badge sits at its lower right (45°). */
const FRAME = 160, FRAME_PX = 480;

/** Smooth 1-D value noise in [0, 1]: random knots `step` apart, eased between. */
function noise1(r, step) {
  const knots = Array.from({ length: Math.ceil(1 / step) + 2 }, () => r());
  return (t) => {
    const f = t / step, i = Math.floor(f), u = f - i, e = u * u * (3 - 2 * u);
    return knots[i] * (1 - e) + knots[i + 1] * e;
  };
}

/** Smooth noise round a loop: `knots` random values eased between, the last easing back into the
 *  first, so a closed outline drawn with it has no seam. */
function loopNoise(r, knots) {
  const k = Array.from({ length: knots }, () => r());
  return (t) => {
    const f = (((t % 1) + 1) % 1) * knots, i = Math.floor(f), u = f - i, e = u * u * (3 - 2 * u);
    return k[i % knots] * (1 - e) + k[(i + 1) % knots] * e;
  };
}

/**
 * One dry-brush stroke along `at(t) -> [x, y]` for t in [0, 1], `width` px across at full pressure.
 * `pressure(t)` scales the width; `dry` is how fast the ink runs out (0 = never). Drawn as discs
 * per bristle into `canvas` in white.
 */
function stroke(CK, canvas, at, length, width, { pressure, dry, bristles = 44, seed }) {
  const r = rng(seed);
  const paint = new CK.Paint();
  paint.setAntiAlias(true);
  paint.setColor(CK.WHITE);
  const steps = Math.ceil(length / 0.7);
  const radius = (width / bristles) * 1.25;
  for (let b = 0; b < bristles; b++) {
    const o = (b / (bristles - 1)) * 2 - 1;
    const supply = 0.75 + r() * 0.5;
    // Edge bristles carry less and dry sooner, which is what feathers a real stroke.
    const rate = dry * (0.7 + r() * 0.6) * (1 + Math.abs(o) * 1.1);
    const streak = noise1(r, 0.02 + r() * 0.03);
    const wobble = noise1(r, 0.08);
    const lag = r() * 0.03;
    const p = new CK.Path();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (t < lag) continue;
      const ink = supply - rate * t + (streak(t) - 0.5) * 0.9;
      if (ink < 0.35) continue;
      const w = width * pressure(t);
      if (w <= 0.2) continue;
      const [x, y] = at(t);
      const [x2, y2] = at(Math.min(1, t + 0.001));
      const [xa, ya] = at(Math.max(0, t - 0.001));
      const dx = x2 - xa, dy = y2 - ya, d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d, ny = dx / d;
      const off = (o + (wobble(t) - 0.5) * 0.12) * (w / 2);
      p.addCircle(x + nx * off, y + ny * off, radius * Math.min(1, 0.5 + ink * 0.6) * Math.min(1, w / width + 0.3));
    }
    canvas.drawPath(p, paint);
    p.delete();
  }
  paint.delete();
}

/** An arc of radius `R` round (`cx`, `cy`) from angle `a0` sweeping `sweep` (radians). */
const arc = (cx, cy, R, a0, sweep) => (t) => [cx + Math.cos(a0 + sweep * t) * R, cy + Math.sin(a0 + sweep * t) * R];
/** Lands at `land` of full width, swells to full by `t0`, then lifts to `lift` by the end. */
const press = (land, t0, lift, curve = 1.5) => (t) =>
  t < t0 ? land + (t / t0) * (1 - land) : 1 - Math.pow((t - t0) / (1 - t0), curve) * (1 - lift);

/**
 * Flecks of ink thrown off a stroke `at(t)`: most from its last quarter (`tail` onward), flung
 * forward along it, a few off its landing flung back. Round drops and a few drawn-out ones, smaller
 * the further they fly. `down` > 0 throws them a little downward too (the brush moved down-right).
 */
function splatter(CK, canvas, at, { seed, count, tail = 0.75, spread, size, down = 0 }) {
  const r = rng(seed);
  const paint = new CK.Paint();
  paint.setAntiAlias(true);
  paint.setColor(CK.WHITE);
  for (let i = 0; i < count; i++) {
    const from = r() < 0.8 ? tail + r() * (1 - tail) : r() * 0.06;
    const [x0, y0] = at(from);
    const [x1, y1] = at(Math.min(1, from + 0.01));
    const [xb, yb] = at(Math.max(0, from - 0.01));
    const heading = Math.atan2(y1 - yb, x1 - xb) + (from < 0.5 ? Math.PI : 0);
    const dist = 4 + Math.pow(r(), 1.6) * spread;
    const ang = heading + (r() - 0.5) * 1.3;
    const x = x0 + Math.cos(ang) * dist, y = y0 + Math.sin(ang) * dist * 0.6 + down * dist * 0.4 * r();
    const s = Math.max(0.7, size - dist / (spread / 2.2)) * (0.5 + r());
    if (r() < 0.35) {
      canvas.save();
      canvas.rotate((ang * 180) / Math.PI, x, y);
      canvas.drawOval(CK.LTRBRect(x - s * 2.2, y - s * 0.8, x + s * 2.2, y + s * 0.8), paint);
      canvas.restore();
    } else {
      canvas.drawCircle(x, y, s, paint);
    }
  }
  paint.delete();
}

/** A smooth path through `pts` (Catmull-Rom), parameterised by arc length: `{ at(t), length }`. */
function smoothPath(pts) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < 16; j++) {
      const u = j / 16, u2 = u * u, u3 = u2 * u;
      dense.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3)));
    }
  }
  dense.push(pts[pts.length - 1]);
  const acc = [0];
  for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const L = acc[acc.length - 1] || 1;
  const at = (t) => {
    const s = Math.min(1, Math.max(0, t)) * L;
    let lo = 0, hi = acc.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (acc[m] < s) lo = m; else hi = m; }
    const u = (s - acc[lo]) / (acc[hi] - acc[lo] || 1);
    return [dense[lo][0] + (dense[hi][0] - dense[lo][0]) * u, dense[lo][1] + (dense[hi][1] - dense[lo][1]) * u];
  };
  return { at, length: L };
}

/** Each numeral as the hand writes it: one stroke through these points, in a box 1 tall and about
 *  0.62 wide. Two hands per numeral (the second a little looser), so "955" is not two stamps. */
const DIGITS = {
  0: [[0.32, 0.04], [0.08, 0.3], [0.1, 0.75], [0.32, 0.97], [0.55, 0.72], [0.55, 0.28], [0.36, 0.03], [0.24, 0.1]],
  1: [[0.1, 0.2], [0.3, 0.04], [0.3, 0.98]],
  2: [[0.08, 0.24], [0.3, 0.03], [0.55, 0.16], [0.48, 0.42], [0.06, 0.94], [0.62, 0.92]],
  3: [[0.08, 0.1], [0.5, 0.07], [0.26, 0.44], [0.55, 0.62], [0.46, 0.93], [0.06, 0.88]],
  4: [[0.46, 0.98], [0.44, 0.04], [0.04, 0.68], [0.64, 0.68]],
  5: [[0.56, 0.05], [0.14, 0.06], [0.1, 0.44], [0.42, 0.4], [0.58, 0.66], [0.42, 0.95], [0.04, 0.88]],
  6: [[0.52, 0.04], [0.16, 0.38], [0.1, 0.74], [0.3, 0.97], [0.55, 0.8], [0.46, 0.55], [0.12, 0.62]],
  7: [[0.04, 0.08], [0.6, 0.07], [0.24, 0.98]],
  8: [[0.48, 0.14], [0.3, 0.02], [0.1, 0.18], [0.48, 0.55], [0.58, 0.8], [0.32, 0.97], [0.06, 0.8], [0.16, 0.56], [0.5, 0.3], [0.48, 0.12]],
  9: [[0.55, 0.32], [0.3, 0.46], [0.08, 0.3], [0.26, 0.04], [0.56, 0.2], [0.5, 0.6], [0.3, 0.97]],
};
/** Numeral bakes are this tall in px; widths follow each numeral's own reach. */
const DIGIT_PX = 128;
/** Inner margin round a numeral, as a share of its height, so the brush's edge is never cut. */
const DIGIT_PAD = 0.1;

async function main() {
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const CK = await CanvasKitInit({ locateFile: (f) => require.resolve(`canvaskit-wasm/bin/${f}`) });
  // Clear old bakes file by file: removing the folder itself loses it from a running Metro.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));
  const bake = (name, w, h, draw) => {
    const surface = CK.MakeSurface(w, h);
    const c = surface.getCanvas();
    c.clear(CK.TRANSPARENT);
    draw(c);
    const image = surface.makeImageSnapshot();
    fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(image.encodeToBytes()));
    image.delete();
    surface.delete();
  };

  // ── The Seek card ──────────────────────────────────────────────────────────────────────────
  // The gem's edge: the brush comes down hard just inside the left, then is dragged across and
  // lifts before the right, drying as it goes. A slight sag, as a hand draws a long line.
  bake('card-edge', EDGE_W, EDGE_H, (c) => {
    const x0 = 6, x1 = EDGE_W - 30, y = EDGE_BAND * 0.4;
    const at = (t) => [x0 + (x1 - x0) * t, y + Math.sin(Math.PI * t) * 3 - t * 2];
    stroke(CK, c, at, x1 - x0, EDGE_BAND * 0.62, {
      pressure: (t) => (t < 0.04 ? 0.55 + (t / 0.04) * 0.45 : 1 - Math.pow((t - 0.04) / 0.96, 1.8) * 0.85),
      dry: 0.75,
      bristles: 40,
      seed: 0xed6e,
    });
    // Flecks thrown ahead where the brush lifted fastest, and a few off the landing.
    splatter(CK, c, at, { seed: 0x5b1a7, count: 30, tail: 0.75, spread: 70, size: 3.4, down: 0.9 });
  });

  // The rule over the buttons: lighter, the brush barely touching, a hair at both ends.
  bake('card-rule', CARD_RULE_W, CARD_RULE_H, (c) => {
    const x0 = 10, x1 = CARD_RULE_W - 10, y = CARD_RULE_H / 2;
    stroke(CK, c, (t) => [x0 + (x1 - x0) * t, y + Math.sin(Math.PI * t * 1.3) * 1.2], x1 - x0, CARD_RULE_H * 0.5, {
      pressure: (t) => 0.15 + 0.85 * Math.pow(Math.sin(Math.PI * t), 0.6),
      dry: 0.55,
      bristles: 24,
      seed: 0x7a1e,
    });
  });

  // The ring behind the seal: one stroke round, starting low-left, pressed heavy, thinning and
  // drying, and lifted before it meets itself — the gap is where the face is not yet given.
  bake('card-ring', CARD_RING, CARD_RING, (c) => {
    const o = CARD_RING / 2, R = CARD_RING * 0.4;
    const a0 = Math.PI * 0.72, sweep = Math.PI * 1.82;
    stroke(CK, c, (t) => {
      const a = a0 + sweep * t;
      const rr = R * (1 + 0.025 * Math.sin(t * Math.PI * 2.2));
      return [o + Math.cos(a) * rr, o + Math.sin(a) * rr];
    }, R * sweep, CARD_RING * 0.075, {
      pressure: (t) => (t < 0.03 ? 0.6 + (t / 0.03) * 0.4 : 1 - Math.pow(t, 1.5) * 0.8),
      dry: 0.7,
      bristles: 36,
      seed: 0x0e50,
    });
  });

  // ── The trail to the next gem ──────────────────────────────────────────────────────────────
  // One even stroke the whole way, so the ink over it reads as distance and not as the brush
  // running out: it dries only a little, and lifts at the far end where the next stone waits.
  bake('trail', TRAIL_W, TRAIL_H, (c) => {
    const x0 = 8, x1 = TRAIL_W - 8, y = TRAIL_H / 2;
    stroke(CK, c, (t) => [x0 + (x1 - x0) * t, y + Math.sin(Math.PI * t * 2) * 1.5], x1 - x0, TRAIL_H * 0.6, {
      pressure: press(0.6, 0.02, 0.35, 3),
      dry: 0.5,
      bristles: 36,
      seed: 0x7a11,
    });
  });

  // ── The section rule ───────────────────────────────────────────────────────────────────────
  // A hair at the margin, swelling to full at the knot; `SectionDivider` mirrors it for the other
  // side, so the brush seems to sweep in toward the knot from both.
  bake('rule', RULE_W, RULE_H, (c) => {
    const x0 = 4, x1 = RULE_W - 6, y = RULE_H / 2;
    stroke(CK, c, (t) => [x0 + (x1 - x0) * t, y + Math.sin(Math.PI * t) * 0.8], x1 - x0, RULE_H * 0.6, {
      pressure: (t) => (0.08 + 0.92 * Math.pow(t, 1.4)) * (t > 0.96 ? 1 - (t - 0.96) / 0.04 * 0.7 : 1),
      dry: 0.3,
      bristles: 20,
      seed: 0x2017,
    });
  });

  // ── The portrait frame ─────────────────────────────────────────────────────────────────────
  const K = FRAME_PX / FRAME, O = FRAME_PX / 2;
  const deg = Math.PI / 180;
  const BADGE = 45;
  /** True when angle `a` (degrees) is clear of the edit badge. */
  const clearOfBadge = (a) => Math.abs(((a - BADGE + 540) % 360) - 180) > 18;
  const frames = [];
  for (let level = 0; level < 6; level++) {
    bake(`frame-${level}`, FRAME_PX, FRAME_PX, (c) => {
      // The ring: one stroke round from just past the badge, lifted just before it.
      stroke(CK, c, arc(O, O, 54 * K, (BADGE + 16) * deg, 330 * deg), 54 * K * 330 * deg, 5.5 * K, {
        pressure: press(0.55, 0.03, 0.3),
        dry: 0.55,
        bristles: 36,
        seed: 0xf4a0 + level,
      });
      if (level >= 1) {
        // Rays, each one flick of the brush out from the ring: pressed, swept a little sideways as
        // the wrist turns, and lifted to nothing — no two the same length.
        const jr = rng(0x5a0 + level);
        for (let k = 0; k < 20; k++) {
          const a = (k / 20) * 360 + 9 + (jr() - 0.5) * 4;
          if (!clearOfBadge(a)) continue;
          const r0 = 58.5 * K;
          const r1 = ((level >= 5 && k % 2 === 0 ? 69 : 64.5) + (jr() - 0.5) * 2.5) * K;
          const turn = (6 + jr() * 5) * deg;
          stroke(CK, c, (t) => {
            const rr = r0 + (r1 - r0) * t, aa = a * deg + turn * t * t;
            return [O + Math.cos(aa) * rr, O + Math.sin(aa) * rr];
          }, r1 - r0, 3 * K, {
            pressure: (t) => (t < 0.2 ? 0.55 + (t / 0.2) * 0.45 : Math.max(0.04, 1 - Math.pow((t - 0.2) / 0.8, 0.8))),
            dry: 0.55,
            bristles: 9,
            seed: 0x5a0 + k * 7 + level,
          });
        }
      }
      if (level >= 2) {
        // Dabs between the rays: the brush pressed once, turned a little, and lifted.
        for (let k = 0; k < 20; k += 2) {
          const a = (k / 20) * 360;
          if (!clearOfBadge(a)) continue;
          const R = 62.5 * K;
          stroke(CK, c, (t) => {
            const aa = a * deg + Math.cos(t * Math.PI) * 0.01, rr = R + Math.sin(t * Math.PI) * 0.8 * K;
            return [O + Math.cos(aa) * rr, O + Math.sin(aa) * rr];
          }, 3 * K, 4 * K, { pressure: (t) => 0.5 + 0.5 * Math.sin(Math.PI * t), dry: 0.2, bristles: 14, seed: 0xdab + k + level });
        }
      }
      if (level >= 3) {
        // An arc over the top, a second, lighter ring begun.
        const sweep = level >= 5 ? 175 : 120;
        const over = arc(O, O, 72 * K, (-90 - sweep / 2) * deg, sweep * deg);
        stroke(CK, c, over, 72 * K * sweep * deg, 3 * K,
          { pressure: press(0.3, 0.15, 0.1), dry: 0.6, bristles: 22, seed: 0xa4c + level });
        splatter(CK, c, over, { seed: 0x5ff + level, count: 9, tail: 0.85, spread: 7 * K, size: 0.9 * K });
      }
      if (level >= 4) {
        // And one under, on the side away from the badge.
        const sweep = level >= 5 ? 130 : 80;
        const under = arc(O, O, 72 * K, (155 - sweep / 2) * deg, sweep * deg);
        stroke(CK, c, under, 72 * K * sweep * deg, 3 * K,
          { pressure: press(0.3, 0.15, 0.1), dry: 0.6, bristles: 22, seed: 0xb4c + level });
        splatter(CK, c, under, { seed: 0x6ff + level, count: 7, tail: 0.85, spread: 7 * K, size: 0.9 * K });
      }
    });
    frames.push(`require('../../assets/brush/frame-${level}.png')`);
  }

  // ── Numerals ───────────────────────────────────────────────────────────────────────────────
  // Each numeral one stroke, two hands of each. `BrushNumber` sets them side by side, tinted.
  const digitAspects = {};
  for (const [d, pts] of Object.entries(DIGITS)) {
    for (let v = 0; v < 2; v++) {
      const H = DIGIT_PX, pad = H * DIGIT_PAD, inner = H - pad * 2;
      const maxX = Math.max(...pts.map(([x]) => x));
      const W = Math.ceil(maxX * inner + pad * 2);
      const jr = rng(0xd16 + Number(d) * 17 + v * 101);
      const jitter = v === 0 ? 0 : 0.035;
      const path = smoothPath(pts.map(([x, y]) => [pad + (x + (jr() - 0.5) * jitter) * inner, pad + (y + (jr() - 0.5) * jitter) * inner]));
      bake(`digit-${d}-${v}`, W, H, (c) => stroke(CK, c, path.at, path.length, inner * 0.15, {
        pressure: press(0.55, 0.12, 0.25, 1.6), dry: 0.4, bristles: 18, seed: 0xd1600 + Number(d) * 7 + v,
      }));
      digitAspects[`${d}-${v}`] = W / H;
    }
  }
  // The thousands mark: one dab with a short tail.
  const COMMA_W = Math.round(DIGIT_PX * 0.28);
  bake('digit-comma', COMMA_W, DIGIT_PX, (c) => {
    const path = smoothPath([[COMMA_W * 0.55, DIGIT_PX * 0.82], [COMMA_W * 0.5, DIGIT_PX * 0.9], [COMMA_W * 0.3, DIGIT_PX * 0.98]]);
    stroke(CK, c, path.at, path.length, DIGIT_PX * 0.12, { pressure: (t) => 1 - t * 0.85, dry: 0.1, bristles: 12, seed: 0xc0aa });
  });

  // ── Ink pools under room names ─────────────────────────────────────────────────────────────
  // A wash puddled behind the blackletter: faint in the middle, darker at the rim where the ink
  // dried, its edge irregular. Baked in its own colour, not as a mask — the rim's darkening is
  // part of it. Four pools; `HeaderBar` picks one per room name.
  const POOL_W = 900, POOL_H = 240, POOLS = 4;
  for (let p = 0; p < POOLS; p++) {
    bake(`pool-${p}`, POOL_W, POOL_H, (c) => {
      const r = rng(0x7001 + p);
      const n = loopNoise(r, 14), n2 = loopNoise(r, 40), n3 = loopNoise(r, 14);
      const cx = POOL_W * (0.46 + r() * 0.06), cy = POOL_H / 2;
      const shape = (grow = 1) => {
        const path = new CK.Path();
        for (let i = 0; i <= 200; i++) {
          const t = i / 200, a = t * Math.PI * 2;
          const rx = POOL_W * 0.34 * grow * (0.85 + 0.25 * n(t) + 0.06 * n2(t));
          const ry = POOL_H * 0.36 * grow * (0.8 + 0.3 * n3(t));
          const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
          if (i) path.lineTo(x, y); else path.moveTo(x, y);
        }
        path.close();
        return path;
      };
      const body = shape();
      const fill = new CK.Paint();
      fill.setAntiAlias(true);
      fill.setColor(CK.Color4f(52 / 255, 64 / 255, 84 / 255, 0.3));
      c.drawPath(body, fill);
      c.save();
      c.clipPath(body, CK.ClipOp.Intersect, true);
      const rim = new CK.Paint();
      rim.setAntiAlias(true);
      rim.setStyle(CK.PaintStyle.Stroke);
      rim.setStrokeWidth(16);
      rim.setColor(CK.Color4f(26 / 255, 33 / 255, 46 / 255, 0.55));
      rim.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 6, false));
      c.drawPath(body, rim);
      c.restore();
      const edge = new CK.Paint();
      edge.setAntiAlias(true);
      edge.setStyle(CK.PaintStyle.Stroke);
      edge.setStrokeWidth(2);
      edge.setColor(CK.Color4f(90 / 255, 104 / 255, 128 / 255, 0.3));
      c.drawPath(body, edge);
      // A few blooms inside, where the water pushed pigment back.
      for (let b = 0; b < 3; b++) {
        const bloom = new CK.Paint();
        bloom.setAntiAlias(true);
        bloom.setColor(CK.Color4f(30 / 255, 38 / 255, 52 / 255, 0.18));
        bloom.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 10, false));
        c.drawCircle(cx + (r() - 0.5) * POOL_W * 0.5, cy + (r() - 0.5) * POOL_H * 0.3, 20 + r() * 40, bloom);
        bloom.delete();
      }
      [body].forEach((x) => x.delete());
      [fill, rim, edge].forEach((x) => x.delete());
    });
  }

  // ── The ink-wash passage ───────────────────────────────────────────────────────────────────
  // A wash of ink spreading over the whole screen from a few blooms, as frames side by side in
  // one strip: frame 0 is clear, the last is covered. `InkWash` plays it forward to cover and
  // back to uncover. Small frames stretched to the screen: wash edges are soft and forgive it.
  const WASH_W = 216, WASH_H = 384, WASH_FRAMES = 14;
  bake('wash', WASH_W * WASH_FRAMES, WASH_H, (c) => {
    const r = rng(0x3a5b);
    const blooms = [[0.5, 0.6, 1], [0.18, 0.28, 0.7], [0.84, 0.22, 0.62], [0.72, 0.92, 0.66], [0.12, 0.85, 0.5]]
      .map(([x, y, s]) => ({ x, y, s, n: loopNoise(r, 12), n2: loopNoise(r, 30), lag: r() * 0.25 }));
    const maxR = Math.hypot(WASH_W, WASH_H);
    for (let f = 0; f < WASH_FRAMES; f++) {
      const k = Math.pow(f / (WASH_FRAMES - 1), 1.35);
      c.save();
      c.clipRect(CK.LTRBRect(f * WASH_W, 0, (f + 1) * WASH_W, WASH_H), CK.ClipOp.Intersect, false);
      c.translate(f * WASH_W, 0);
      for (const b of blooms) {
        const grow = Math.max(0, (k - b.lag) / (1 - b.lag));
        const R = maxR * b.s * grow * 0.9;
        if (R <= 0.5) continue;
        const cx = b.x * WASH_W, cy = b.y * WASH_H;
        const path = new CK.Path();
        for (let i = 0; i <= 160; i++) {
          const t = i / 160, a = t * Math.PI * 2;
          const rr = R * (0.8 + 0.24 * b.n(t) + 0.08 * b.n2((t * 3) % 1));
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          if (i) path.lineTo(x, y); else path.moveTo(x, y);
        }
        path.close();
        const paint = new CK.Paint();
        paint.setAntiAlias(true);
        paint.setShader(CK.Shader.MakeRadialGradient([cx, cy], R,
          [CK.Color4f(0.02, 0.024, 0.04, 0.97), CK.Color4f(0.03, 0.04, 0.063, 0.95), CK.Color4f(0.008, 0.012, 0.024, 1), CK.Color4f(0.008, 0.012, 0.024, 0.75)],
          [0, 0.8, 0.94, 1], CK.TileMode.Clamp));
        c.drawPath(path, paint);
        paint.delete();
        path.delete();
      }
      c.restore();
    }
  });

  const req = (n) => `require('../../assets/brush/${n}.png')`;
  const lines = [
    '// Generated by scripts/gen-brush.js — do not edit; rerun the script instead.',
    '',
    'import type { ImageSourcePropType } from \'react-native\';',
    '',
    '/** The Seek card\'s gem line along its top, dry-brushed: a white mask, tinted the gem. */',
    `export const BRUSH_CARD_EDGE: ImageSourcePropType = ${req('card-edge')};`,
    `export const BRUSH_CARD_EDGE_ASPECT = ${EDGE_W / EDGE_H};`,
    '/** The Seek card\'s line over its buttons: a white mask. */',
    `export const BRUSH_CARD_RULE: ImageSourcePropType = ${req('card-rule')};`,
    `export const BRUSH_CARD_RULE_ASPECT = ${CARD_RULE_W / CARD_RULE_H};`,
    '/** The open ring behind the Seek card\'s seal: a white mask. */',
    `export const BRUSH_CARD_RING: ImageSourcePropType = ${req('card-ring')};`,
    '',
    '/** The trail to the next gem: one even stroke, a white mask drawn bare and inked over. */',
    `export const BRUSH_TRAIL: ImageSourcePropType = ${req('trail')};`,
    `export const BRUSH_TRAIL_ASPECT = ${TRAIL_W / TRAIL_H};`,
    '',
    '/** `SectionDivider`\'s line: a hair at the left, full at the right; mirrored for the other side. */',
    `export const BRUSH_RULE: ImageSourcePropType = ${req('rule')};`,
    '',
    '/** The portrait frame for each rung, `TIER_ORDER` order: a 160pt box centred on the 118pt avatar. */',
    `export const BRUSH_FRAMES: readonly ImageSourcePropType[] = [${frames.join(', ')}];`,
    '',
    '/** Numerals, two hands of each (`${digit}-${hand}`), as white masks with their width over height.',
    ' *  The comma is one dab. */',
    'export const BRUSH_DIGITS: Record<string, { source: ImageSourcePropType; aspect: number }> = {',
    ...Object.entries(digitAspects).map(([k, a]) => `  '${k}': { source: ${req(`digit-${k}`)}, aspect: ${a.toFixed(4)} },`),
    `  ',': { source: ${req('digit-comma')}, aspect: ${(COMMA_W / DIGIT_PX).toFixed(4)} },`,
    '};',
    `/** The share of a numeral's bake left as margin above and below its ink. */`,
    `export const BRUSH_DIGIT_PAD = ${DIGIT_PAD};`,
    '',
    '/** Ink pools for under a room\'s name: full colour with alpha, 900×240. */',
    `export const BRUSH_POOLS: readonly ImageSourcePropType[] = [${Array.from({ length: POOLS }, (_, p) => req(`pool-${p}`)).join(', ')}];`,
    `export const BRUSH_POOL_ASPECT = ${POOL_W / POOL_H};`,
    '',
    '/** The ink-wash passage: `BRUSH_WASH_FRAMES` frames side by side, clear to covered. */',
    `export const BRUSH_WASH: ImageSourcePropType = ${req('wash')};`,
    `export const BRUSH_WASH_FRAMES = ${WASH_FRAMES};`,
    '',
  ];
  fs.writeFileSync(MAP_FILE, lines.join('\n'));
  console.log('wrote card strokes, trail, rule, frames, numerals, pools, wash and components/ui/brushImages.ts');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
