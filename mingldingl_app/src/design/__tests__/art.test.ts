import fs from 'node:fs';
import path from 'node:path';
import { ART, type ArtName } from '../art/manifest';
import artSpec from '../figma/art.json';

const dir = path.join(__dirname, '..', 'art');

test('every Figma art entry is in the manifest', () => {
  expect(Object.keys(ART).sort()).toEqual(Object.keys(artSpec).sort());
});

test.each(Object.keys(artSpec))('%s exists at 1x, 2x and 3x', (name) => {
  for (const suffix of ['', '@2x', '@3x'])
    expect(fs.existsSync(path.join(dir, `${name}${suffix}.png`))).toBe(true);
});

test('names are typed', () => {
  const n: ArtName = 'gem_garnet';
  expect(ART[n]).toBeDefined();
});
