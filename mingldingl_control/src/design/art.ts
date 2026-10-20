import brass from './art/brass_plate.webp';
import back from './art/glyph-back.png';
import book from './art/glyph-book.png';
import chest from './art/glyph-chest.png';
import cup from './art/glyph-cup.png';
import door from './art/glyph-door.png';
import eye from './art/glyph-eye.png';
import forge from './art/glyph-forge.png';
import frost from './art/glyph-frost.png';
import hearth from './art/glyph-hearth.png';
import knot from './art/glyph-knot.png';
import map from './art/glyph-map.png';
import person from './art/glyph-person.png';
import scales from './art/glyph-scales.png';
import scroll from './art/glyph-scroll.png';
import shield from './art/glyph-shield.png';
import stage from './art/glyph-stage.png';
import thread from './art/glyph-thread.png';
import guildSeal from './art/guild_seal.webp';
import honourLocked from './art/honour_locked.webp';
import stateWaiting from './art/state_waiting.webp';

/** Copied from the app by scripts/sync-art.js; never edited here. */
export const art = {
  brass,
  guildSeal,
  honourLocked,
  stateWaiting,
  glyphs: {
    back,
    book,
    chest,
    cup,
    door,
    eye,
    forge,
    frost,
    hearth,
    knot,
    map,
    person,
    scales,
    scroll,
    shield,
    stage,
    thread,
  },
} as const;
export type GlyphName = keyof typeof art.glyphs;
