#!/usr/bin/env node
// Copies the few painted assets the admin uses from the app (where gen/export scripts write them),
// so the admin never holds its own copy of an art decision. Rerun after the app's art changes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, '..', '..', 'mingldingl_app', 'src', 'design');
const out = path.join(here, '..', 'src', 'design', 'art');
const files = [
  ['art/brass_plate@2x.webp', 'brass_plate.webp'],
  ['glyphs/person@2x.png', 'glyph-person.png'],
  ['glyphs/scales@2x.png', 'glyph-scales.png'],
  ['glyphs/eye@2x.png', 'glyph-eye.png'],
  ['glyphs/back@2x.png', 'glyph-back.png'],
  ['glyphs/door@2x.png', 'glyph-door.png'],
  ['glyphs/shield@2x.png', 'glyph-shield.png'],
  ['glyphs/cup@2x.png', 'glyph-cup.png'],
  ['glyphs/thread@2x.png', 'glyph-thread.png'],
  ['glyphs/stage@2x.png', 'glyph-stage.png'],
  ['glyphs/book@2x.png', 'glyph-book.png'],
  ['glyphs/scroll@2x.png', 'glyph-scroll.png'],
  // The Guild House web page (/guild)
  ['art/guild_seal@2x.webp', 'guild_seal.webp'],
  ['art/honour_locked@2x.webp', 'honour_locked.webp'],
  ['art/state_waiting@2x.webp', 'state_waiting.webp'],
  // Dashboard, statistics, deletions, payments, the engine room
  ['glyphs/hearth@2x.png', 'glyph-hearth.png'],
  ['glyphs/map@2x.png', 'glyph-map.png'],
  ['glyphs/frost@2x.png', 'glyph-frost.png'],
  ['glyphs/chest@2x.png', 'glyph-chest.png'],
  ['glyphs/forge@2x.png', 'glyph-forge.png'],
  ['glyphs/tally@2x.png', 'glyph-tally.png'],
  ['glyphs/feast@2x.png', 'glyph-feast.png'],
  ['glyphs/crown@2x.png', 'glyph-crown.png'],
  ['glyphs/plus@2x.png', 'glyph-plus.png'],
  ['glyphs/bell@2x.png', 'glyph-bell.png'],
  ['glyphs/turn@2x.png', 'glyph-turn.png'],
  ['glyphs/chevron@2x.png', 'glyph-chevron.png'],
];
fs.mkdirSync(out, { recursive: true });
for (const [from, to] of files) fs.copyFileSync(path.join(app, from), path.join(out, to));
console.log(`${files.length} files → src/design/art`);
