// npm run test:scripts — kept out of jest (pixelmatch is ESM-only; jest-expo would transform it).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PNG } from 'pngjs';
import { compare } from './visual-diff.mjs';

/** A 120×200 frame: a dark field with a lighter band, so scaling has edges to get wrong. */
function frame(w, h, scale = 1) {
  const png = new PNG({ width: w * scale, height: h * scale });
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const band = y / scale >= 80 && y / scale < 120;
      png.data[i] = band ? 200 : 20;
      png.data[i + 1] = band ? 160 : 24;
      png.data[i + 2] = band ? 60 : 40;
      png.data[i + 3] = 255;
    }
  return png;
}

test('identical images differ by 0 %', () => {
  const r = compare(frame(120, 200), frame(120, 200), { statusBar: 0 });
  assert.equal(r.mismatched, 0);
  assert.equal(r.percent, 0);
});

test('a 10×10 changed block is found and marked in the diff panel', () => {
  const device = frame(120, 200);
  for (let y = 150; y < 160; y++)
    for (let x = 50; x < 60; x++) device.data.fill(255, (y * 120 + x) * 4, (y * 120 + x) * 4 + 3);
  const r = compare(frame(120, 200), device, { statusBar: 0 });
  assert.ok(r.percent > 0);
  assert.equal(r.mismatched, 100);
  // third panel starts after two panels and two gaps; pixelmatch marks differences in red
  const x0 = 2 * (120 + r.gap) + 55;
  const i = (155 * r.panel.width + x0) * 4;
  assert.deepEqual([...r.panel.data.subarray(i, i + 3)], [255, 0, 0]);
});

test('a device shot at 3× is scaled to the frame width before comparing', () => {
  const r = compare(frame(120, 200), frame(120, 200, 3), { statusBar: 0 });
  assert.ok(r.percent < 0.5, `got ${r.percent}`);
});

test('the status bar band is cropped from both', () => {
  const device = frame(120, 200);
  device.data.fill(255, 0, 120 * 20 * 4); // a bright status bar
  assert.ok(compare(frame(120, 200), device, { statusBar: 0 }).percent > 0);
  assert.equal(compare(frame(120, 200), device, { statusBar: 20 }).percent, 0);
});

test('a shorter device shot counts the missing rows as different', () => {
  const r = compare(frame(120, 200), frame(120, 180), { statusBar: 0 });
  assert.equal(r.mismatched, 120 * 20);
});
