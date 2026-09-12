/**
 * What a drawing actually put on the screen, for the tests that assert about the cuts rather than
 * about a snapshot.
 *
 * Three suites had grown their own copy of this walk — `Glyph`, `StateBlock` and `Waiting` — and
 * they had already drifted: two matched `polygon|polyline` and one did not, so a component that
 * drew nothing but polygons registered as having drawn nothing at all in the third. A drawing test
 * that finds no marks passes every rule it then applies to them, which is the one failure mode
 * these suites exist to catch, so the walk belongs in one place.
 */

/** A node in a rendered tree, as `toJSON()` hands it back. */
export interface TreeNode {
  type?: string;
  props?: Record<string, unknown>;
  children?: unknown;
}

/** Every drawn mark in a rendered tree: the cuts and seals themselves, never the wrapper. */
export function marks(node: unknown): TreeNode[] {
  if (Array.isArray(node)) return node.flatMap(marks);
  if (!node || typeof node !== 'object') return [];
  const el = node as TreeNode;
  const here = /path|rect|circle|line|polygon|polyline/i.test(el.type ?? '') ? [el] : [];
  return [...here, ...marks(el.children)];
}

/** What each mark was painted in — its stroke, or its fill where it has no stroke. */
export function paints(tree: unknown): unknown[] {
  return marks(tree).map((mark) => mark.props?.stroke ?? mark.props?.fill);
}

/** react-native-svg packs a colour into an ARGB int before it reaches the native view. */
export function packed(hex: string) {
  return { type: 0, payload: 0xff000000 + parseInt(hex.slice(1), 16) };
}
