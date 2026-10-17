import type { CSSProperties } from 'react';
import { art, type GlyphName } from './art';

/** A painted glyph tinted with the surrounding text colour. */
export function Glyph({ name }: { name: GlyphName }) {
  return (
    <span aria-hidden className="glyph" style={{ '--glyph': `url(${art.glyphs[name]})` } as CSSProperties} />
  );
}
