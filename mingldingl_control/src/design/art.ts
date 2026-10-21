import brass from './art/brass_plate.webp';
import back from './art/glyph-back.png';
import bell from './art/glyph-bell.png';
import book from './art/glyph-book.png';
import chest from './art/glyph-chest.png';
import chevron from './art/glyph-chevron.png';
import crown from './art/glyph-crown.png';
import cup from './art/glyph-cup.png';
import door from './art/glyph-door.png';
import eye from './art/glyph-eye.png';
import feast from './art/glyph-feast.png';
import forge from './art/glyph-forge.png';
import frost from './art/glyph-frost.png';
import hearth from './art/glyph-hearth.png';
import map from './art/glyph-map.png';
import person from './art/glyph-person.png';
import plus from './art/glyph-plus.png';
import scales from './art/glyph-scales.png';
import scroll from './art/glyph-scroll.png';
import shield from './art/glyph-shield.png';
import stage from './art/glyph-stage.png';
import tally from './art/glyph-tally.png';
import thread from './art/glyph-thread.png';
import turn from './art/glyph-turn.png';
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
    bell,
    book,
    chest,
    chevron,
    crown,
    cup,
    door,
    eye,
    feast,
    forge,
    frost,
    hearth,
    map,
    person,
    plus,
    scales,
    scroll,
    shield,
    stage,
    tally,
    thread,
    turn,
  },
} as const;
export type GlyphName = keyof typeof art.glyphs;
