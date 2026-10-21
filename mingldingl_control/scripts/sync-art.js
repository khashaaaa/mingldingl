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
  ['art/ember_glow_lit@2x.webp', 'ember_glow_lit.webp'],
  ['art/sign_plank@2x.webp', 'sign_plank.webp'],
  ['art/sign_chain@2x.webp', 'sign_chain.webp'],
  ['art/screw_a@2x.webp', 'screw_a.webp'],
  ['art/screw_c@2x.webp', 'screw_c.webp'],
  ['art/makers_mark@2x.webp', 'makers_mark.webp'],
  ['art/dry_brush_rule@2x.webp', 'dry_brush_rule.webp'],
  ['art/corner_tl@2x.webp', 'corner_tl.webp'],
  ['art/corner_tr@2x.webp', 'corner_tr.webp'],
  ['art/corner_bl@2x.webp', 'corner_bl.webp'],
  ['art/corner_br@2x.webp', 'corner_br.webp'],
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
// S9 shares the app's exported Figma sky and star positions, rather than an approximate gradient.
const floor = JSON.parse(fs.readFileSync(path.join(app, 'figma/world-floor.json'), 'utf8'));
const [width, height] = floor.frame;
const stops = floor.gradient.map((g) => `<stop offset="${g.at}" stop-color="${g.color}"/>`).join('');
const stars = floor.star.stars
  .map(
    (s) =>
      `<circle cx="${s.x}" cy="${s.y}" r="${s.size / 2}" fill="${floor.star.color}" opacity="${s.opacity}"/>`,
  )
  .join('');
fs.writeFileSync(
  path.join(out, 'guild-sky.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><title>Night sky</title><defs><linearGradient id="sky" x2="0" y2="1">${stops}</linearGradient></defs><path fill="url(#sky)" d="M0 0h${width}v${height}H0z"/>${stars}</svg>\n`,
);
console.log(`${files.length} files → src/design/art`);
