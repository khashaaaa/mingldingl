import fs from 'node:fs';
import path from 'node:path';
import spec from '../figma/glyphs.json';
import { GLYPHS } from '../glyphs';

test('every Figma glyph is in the manifest at 1x, 2x and 3x', () => {
  expect(Object.keys(GLYPHS).sort()).toEqual(Object.keys(spec).sort());
  for (const name of Object.keys(spec))
    for (const s of ['', '@2x', '@3x'])
      expect(fs.existsSync(path.join(__dirname, '..', 'glyphs', `${name}${s}.png`))).toBe(true);
});
