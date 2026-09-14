import { Glyph } from '../ui/Glyph';
import { PLACES } from '../ui/Places';
import type { FireMark } from '../../lib/fire';

const Ember = PLACES.ember;

/** Draws `fireMark`'s answer, so the tile and the hearth render the same three marks one way. */
export function FireMarkGlyph({ mark, size }: { mark: FireMark; size: number }) {
  switch (mark.mark) {
    case 'flame': return <Glyph name="flame" size={size} color={mark.color} />;
    case 'ember': return <Ember size={size} color={mark.color} />;
    case 'ice': return <Glyph name="ice" size={size} color={mark.color} />;
    default: return null;
  }
}
