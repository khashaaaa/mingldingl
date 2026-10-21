import type { GlyphName } from '@/design/glyphs';
import type { StringKey } from '@/lib/i18n';

/** Each quest kind's glyph and name; the engine owns what counts and what it pays. */
export const QUEST: Record<string, { glyph: GlyphName; title: StringKey }> = {
  lightHearth: { glyph: 'hearth', title: 'quest.lightHearth' },
  answerLetters: { glyph: 'letters', title: 'quest.answerLetters' },
  firstLetter: { glyph: 'quill', title: 'quest.firstLetter' },
  summon: { glyph: 'bell', title: 'quest.summon' },
  breakIce: { glyph: 'ice', title: 'quest.breakIce' },
  takeTrial: { glyph: 'target', title: 'quest.takeTrial' },
  keepEncounter: { glyph: 'pledge', title: 'quest.keepEncounter' },
  lightRite: { glyph: 'flame', title: 'quest.lightRite' },
  breakSeal: { glyph: 'seal', title: 'quest.breakSeal' },
};

export const questTitle = (kind: string): StringKey => QUEST[kind]?.title ?? 'quest.lightHearth';
