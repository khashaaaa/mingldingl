#!/usr/bin/env node
// Measures how far a device screenshot is from its Figma frame, so "matches Figma" is a number.
//
//   node scripts/visual-diff.mjs <figma.png> <device.png> [--out diff.png] [--max 3] [--status-bar 44]
//   node scripts/visual-diff.mjs --figma 26:3 <device.png> ...    (fetches the frame; token ~/.figma-token)
//
// The device shot is scaled to the frame's width (area-averaged), the top --status-bar frame pixels
// are cropped from both (the frames draw no status bar), pixelmatch runs at threshold 0.1, and a
// three-panel PNG (Figma | device | diff) is written. Rows one image lacks count as different.
// Exit 1 when the mismatch is above --max percent.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const FIGMA_FILE = 'nLwcONhTplnnOmXu3wroIx';
const GAP = 8;

/** Resample RGBA to `w`×`h` by area averaging (each target pixel is the mean of the source it covers). */
export function resize(src, w, h) {
  if (src.width === w && src.height === h) return src;
  const pass = (data, sw, sh, tw, horizontal) => {
    const [n, other] = horizontal ? [sw, sh] : [sh, sw];
    const out = new Float64Array((horizontal ? tw * sh : sw * tw) * 4);
    const ratio = n / tw;
    for (let t = 0; t < tw; t++) {
      const a = t * ratio;
      const b = a + ratio;
      for (let s = Math.floor(a); s < Math.min(Math.ceil(b), n); s++) {
        const weight = (Math.min(b, s + 1) - Math.max(a, s)) / ratio;
        if (weight <= 0) continue;
        for (let o = 0; o < other; o++) {
          const si = horizontal ? (o * sw + s) * 4 : (s * sw + o) * 4;
          const ti = horizontal ? (o * tw + t) * 4 : (t * sw + o) * 4;
          for (let c = 0; c < 4; c++) out[ti + c] += data[si + c] * weight;
        }
      }
    }
    return out;
  };
  const wide = pass(src.data, src.width, src.height, w, true);
  const both = pass(wide, w, src.height, h, false);
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < both.length; i++) png.data[i] = Math.round(both[i]);
  return png;
}

/** Copy `src` rows [top, top+h) into a fresh `w`×`h` image; rows past its end are left magenta. */
function window(src, top, w, h) {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([255, 0, 255, 255], i);
  const rows = Math.max(0, Math.min(h, src.height - top));
  for (let y = 0; y < rows; y++)
    src.data.copy(png.data, y * w * 4, (top + y) * src.width * 4, ((top + y) * src.width + w) * 4);
  return png;
}

export function compare(figma, device, { statusBar = 44, threshold = 0.1 } = {}) {
  const w = figma.width;
  const scaled = resize(device, w, Math.round((device.height * w) / device.width));
  const h = Math.max(figma.height, scaled.height) - statusBar;
  const a = window(figma, statusBar, w, h);
  const b = window(scaled, statusBar, w, h);
  const diff = new PNG({ width: w, height: h });
  const mismatched = pixelmatch(a.data, b.data, diff.data, w, h, { threshold });
  const panel = new PNG({ width: w * 3 + GAP * 2, height: h });
  for (const [k, img] of [a, b, diff].entries()) PNG.bitblt(img, panel, 0, 0, w, h, k * (w + GAP), 0);
  return { mismatched, total: w * h, percent: (mismatched / (w * h)) * 100, panel, gap: GAP };
}

async function fetchFrame(nodeId, scale) {
  const token =
    process.env.FIGMA_TOKEN ?? fs.readFileSync(path.join(os.homedir(), '.figma-token'), 'utf8').trim();
  const api = `https://api.figma.com/v1/images/${FIGMA_FILE}?ids=${encodeURIComponent(nodeId)}&scale=${scale}&format=png`;
  const res = await fetch(api, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) throw new Error(`Figma ${res.status}: ${await res.text()}`);
  const url = (await res.json()).images?.[nodeId];
  if (!url) throw new Error(`Figma has no frame ${nodeId}`);
  return PNG.sync.read(Buffer.from(await (await fetch(url)).arrayBuffer()));
}

async function main(argv) {
  const opts = { out: null, max: 3, statusBar: 44, figma: null, scale: 1 };
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const flag = {
      '--out': 'out',
      '--max': 'max',
      '--status-bar': 'statusBar',
      '--figma': 'figma',
      '--scale': 'scale',
    }[argv[i]];
    if (flag) opts[flag] = argv[++i];
    else files.push(argv[i]);
  }
  if ((opts.figma ? 1 : 2) !== files.length) {
    console.error(
      'usage: visual-diff.mjs <figma.png> <device.png> | --figma <nodeId> <device.png> [--out] [--max] [--status-bar] [--scale]',
    );
    process.exit(2);
  }
  const statusBar = Number(opts.statusBar) * Number(opts.scale);
  const figma = opts.figma
    ? await fetchFrame(opts.figma, opts.scale)
    : PNG.sync.read(fs.readFileSync(files[0]));
  const devicePath = files.at(-1);
  const r = compare(figma, PNG.sync.read(fs.readFileSync(devicePath)), { statusBar });
  const out = opts.out ?? `${devicePath.replace(/\.png$/i, '')}.diff.png`;
  fs.writeFileSync(out, PNG.sync.write(r.panel));
  const verdict = r.percent > Number(opts.max) ? 'over' : 'within';
  console.log(
    `${r.percent.toFixed(2)} % differ (${r.mismatched} of ${r.total} px) — ${verdict} ${opts.max} % · ${out}`,
  );
  if (verdict === 'over') process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
