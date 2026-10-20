import fs from 'node:fs';
import path from 'node:path';
import { ART, type ArtName } from '../art/manifest';
import artSpec from '../figma/art.json';

const dir = path.join(__dirname, '..', 'art');

test('every Figma art entry is in the manifest', () => {
  expect(Object.keys(ART).sort()).toEqual(Object.keys(artSpec).sort());
});

// 3x is left out only where the source is too small for it (the device then uses 2x).
test.each(Object.keys(artSpec))('%s exists at 1x and 2x', (name) => {
  for (const suffix of ['', '@2x']) expect(fs.existsSync(path.join(dir, `${name}${suffix}.webp`))).toBe(true);
  expect(fs.readdirSync(dir).filter((f) => f.endsWith('.png'))).toEqual([]);
});

test('names are typed', () => {
  const n: ArtName = 'gem_garnet';
  expect(ART[n]).toBeDefined();
});
