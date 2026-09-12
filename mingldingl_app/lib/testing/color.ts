/**
 * Colour maths shared by tests that check the palette itself (`palette.test.ts`) and tests that
 * check something *rendered from* the palette (`world.test.ts`'s room floors). Both used to carry
 * their own copy of `luminance`/`contrast`; a WCAG formula is not the kind of thing that should
 * drift into two slightly different implementations because nobody thought to share it.
 */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((v >> 16) & 0xff) +
    0.7152 * channel((v >> 8) & 0xff) +
    0.0722 * channel(v & 0xff)
  );
}

/** WCAG 2.1 contrast ratio. 4.5 is the floor for body text, 3.0 for a UI boundary. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Straight-line distance through RGB space. WCAG contrast is a poor instrument for two colours
 * that are both nearly black — it reacts to their luminance ratio, and two near-black colours a
 * comfortable distance apart in hue can still score barely above 1:1 (`neutral`/`soft` in
 * `world.test.ts` do, at 1.005). `rgbDistance` is what actually answers "would a person looking
 * at these two floors tell them apart," which is the question a *room* comparison is asking.
 */
export function rgbDistance(a: string, b: string): number {
  const va = parseInt(a.slice(1), 16);
  const vb = parseInt(b.slice(1), 16);
  const dr = ((va >> 16) & 0xff) - ((vb >> 16) & 0xff);
  const dg = ((va >> 8) & 0xff) - ((vb >> 8) & 0xff);
  const db = (va & 0xff) - (vb & 0xff);
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
