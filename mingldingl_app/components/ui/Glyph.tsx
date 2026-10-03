import { Image, PixelRatio, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { GLYPH_IMAGES, GLYPH_PIXELS } from './glyphImages';
import { ACCENT, ICON_SIZES } from '../../lib/theme';

/**
 * The ink-cut set.
 *
 * Every app in the store draws the same shield, the same speech bubble and the same two people,
 * because every app in the store reaches for the same icon font. Where an icon carries the
 * identity of a place or a deed — the five destinations, the six quests — it is drawn here
 * instead. `Icon` (MaterialCommunityIcons) still serves everything else, which is most things; a
 * glyph is not a cheaper icon, it is a different job.
 *
 * The hand is a brush, not a ruler (chosen 2026-10-03 over a forged-metal and a framed-sigil
 * study): each path is one stroke of ink, swelling in its middle and tapering to a point at both
 * ends, and a closed path breathes along its length the way a loaded brush does. The paths below
 * only say where the brush goes; `scripts/gen-glyphs.js` inks them. The first cut was a single
 * square-capped weight with "no curve where a straight line will do", and on a phone it read as a
 * stock icon font.
 */

/**
 * The brush's full width at the swell of a stroke. One weight across the set — a second weight is
 * a second hand.
 *
 * Exported because the hand does not stop at this file: `Places` and `Waiting` draw in the same
 * ink and used to each declare their own 2.4, so changing the weight of the set meant finding
 * three copies of it and any drawing that missed the change simply looked slightly wrong.
 */
export const STROKE = 2.4;
/** A wax seal's diameter — pressed, so it is the one solid mark. Read by `scripts/gen-glyphs.js`. */
export const DOT = 4;

interface Cuts {
  /** Brush strokes, in draw order. An open path tapers at both ends; a closed one breathes. */
  readonly lines: readonly string[];
  /** Brushed circles as `[cx, cy, r]`. */
  readonly rings?: readonly (readonly [number, number, number])[];
  /** Wax seals as `[cx, cy]`: a pressed disc with its die ring, lifted off the strokes beneath. */
  readonly dots?: readonly (readonly [number, number])[];
}

/** Every glyph in the set, so a test can walk all of them. */
export const GLYPH_NAMES = [
  'fire', 'letters', 'lantern', 'forge', 'gem', 'ice', 'seals', 'knot', 'flame', 'pledge',
  'seal', 'candle', 'bell', 'hearth',
] as const;

export type GlyphName = typeof GLYPH_NAMES[number];

/**
 * All geometry is on a 24-unit viewBox, so the brush keeps its weight at every rendered size.
 *
 * Typed by the name tuple rather than inferred from itself: a drawing with no name, or a name
 * with no drawing, is then a compile error instead of an empty box on someone's tab bar.
 */
export const GLYPHS: Record<GlyphName, Cuts> = {
  /** Seek. A campfire: the flame with its heart, over two crossed logs. */
  fire: {
    lines: [
      'M12 2.6C13.6 6 17.2 7.6 17.2 11.6C17.2 14.6 14.9 16.6 12 16.6C9.1 16.6 6.8 14.6 6.8 11.6C6.8 9.1 8.4 7.8 9.3 6C9.9 7.6 10.8 8.4 11.6 8.8C11 6.6 11.2 4.4 12 2.6',
      'M12 10.6C13 12 14 13 14 14.2C14 15.4 13.1 16.2 12 16.2C10.9 16.2 10 15.4 10 14.2C10 13.2 10.7 12.6 11.2 11.8',
      'M4.2 21.6L19.4 17.4', 'M19.8 21.6L4.6 17.4',
    ],
  },
  /** The quest log, and the deed of exchanging words: a letter folded shut under its seal. */
  letters: {
    lines: ['M3 6.4H21V18.6H3Z', 'M3.4 6.8L12 13.2L20.6 6.8', 'M3.6 18.2L9.6 11.8', 'M20.4 18.2L14.4 11.8'],
    dots: [[12, 13.4]],
  },
  /** The town square: a lantern carried to a gathering, its flame behind the glass. */
  lantern: {
    lines: [
      'M9.4 4.4C9.4 1.9 14.6 1.9 14.6 4.4', 'M7.6 5.2H16.4',
      'M8.6 5.6C7.2 8.6 7.2 12.6 8.6 15.6', 'M15.4 5.6C16.8 8.6 16.8 12.6 15.4 15.6',
      'M7.6 16H16.4', 'M12 16.4V20.4', 'M9.2 21.2H14.8',
      'M12 8.2C13 9.5 13.6 10.4 13.6 11.5C13.6 12.6 12.9 13.4 12 13.4C11.1 13.4 10.4 12.6 10.4 11.5C10.4 10.6 11 10 11.4 9.3',
    ],
  },
  /** Missions: the anvil they are worked at, still throwing sparks. */
  forge: {
    lines: [
      'M2.8 7.6H17.6C19.6 7.6 21 6.8 21.4 5.8C21.4 9 19.6 10.8 16.6 11H15V13.4C15 14.6 16 15.4 17.4 15.8V18H6.6V15.8C8 15.4 9 14.6 9 13.4V11H7.2C4.8 11 3.2 9.8 2.8 7.6Z',
      'M4.4 20.6H19.6',
      'M8.6 5L7 2.2', 'M11.6 4.6L12 1.8', 'M14.6 5L16.4 2.6',
    ],
  },
  /** The character: the stone that names a rank, cut with its facets. */
  gem: {
    lines: [
      'M7 4H17L21 9.6L12 21L3 9.6Z', 'M3.4 9.6H20.6',
      'M7.2 4.4L9.4 9.4L12 4.4L14.6 9.4L16.8 4.4', 'M9.4 10L12 20.2L14.6 10',
    ],
  },
  /** Breaking the ice: a floe already cracked, riding the water. */
  ice: {
    lines: [
      'M2.4 16L5 11.6L8.2 13.2L11 8.4L14.6 12L17.4 10.2L21.6 14.6',
      'M2.4 16.4L4 20H20.2L21.6 15', 'M11 9.4L12.2 13L10.8 15.8L12 19.6',
      'M2 22.2C4.6 21.2 6.6 23 9.2 22C11.6 21.1 13.4 23 16 22C18.4 21.1 20 22.6 22 22',
    ],
  },
  /** Sending a summons: two seals, one pressed for each side. */
  seal: {
    lines: [],
    rings: [[8.4, 9, 5], [15.6, 15, 5]],
    dots: [[8.4, 9], [15.6, 15]],
  },
  /** The reveal ladder: three seals on a ribbon, the whole way a face is uncovered. */
  seals: {
    lines: ['M1.8 13.6C4.8 10.4 7.8 14.8 12 12C16.2 9.2 19.2 13.6 22.2 10.4'],
    dots: [[6, 12.6], [12, 12], [18, 11.4]],
  },
  /** The trial: the Ulzii knot — a turned square crossed through, a loop at each corner. */
  knot: {
    lines: ['M12 4.6L19.4 12L12 19.4L4.6 12Z', 'M8.3 8.3L15.7 15.7', 'M15.7 8.3L8.3 15.7'],
    rings: [[12, 3.4, 2], [20.6, 12, 2], [12, 20.6, 2], [3.4, 12, 2]],
  },
  /** Facing the flame: a fire standing on the hearthstone. */
  flame: {
    lines: [
      'M12 2.4C14 7 18.4 9 18.4 14C18.4 17.6 15.6 20 12 20C8.4 20 5.6 17.6 5.6 14C5.6 11 7.3 9.4 8.3 7.2C9 9 10 10 11 10.6C10.2 7.8 10.6 5 12 2.4',
      'M12 12.4C13.3 14.2 14.4 15.2 14.4 16.6C14.4 18 13.4 19.2 12 19.2C10.6 19.2 9.6 18 9.6 16.6C9.6 15.4 10.4 14.6 11 13.6',
      'M3.4 21.8H20.6',
    ],
  },
  /** The pledge: a strapped chest, the promise locked in it. */
  pledge: {
    lines: ['M4 10.4C4 5.4 20 5.4 20 10.4', 'M4 10.4H20V20.4H4Z', 'M8.4 7V20', 'M15.6 7V20'],
    dots: [[12, 13.6]],
  },
  /** Waiting: a candle burning down in its dish, never a spinner. */
  candle: {
    lines: [
      'M12 1.8C13.2 3.4 13.8 4.4 13.8 5.4C13.8 6.5 13 7.2 12 7.2C11 7.2 10.2 6.5 10.2 5.4C10.2 4.6 10.8 3.9 11.2 3.2',
      'M12 7.4V8.6', 'M9 9.2C10 8.6 14 8.6 15 9.2V19H9Z', 'M15 11C15.8 11.9 15.8 13.2 15 14',
      'M5.4 19.2H18.6C18 20.8 16.6 21.6 12 21.6C7.4 21.6 6 20.8 5.4 19.2',
    ],
  },
  /** The hour: the bell that rings it. */
  bell: {
    lines: [
      'M12 3.2C8.4 3.2 6.6 5.9 6.6 9.6V14.2C6.6 15.6 5.3 16.8 4 17.6H20C18.7 16.8 17.4 15.6 17.4 14.2V9.6C17.4 5.9 15.6 3.2 12 3.2Z',
      'M12 1.4V3',
    ],
    rings: [[12, 19.8, 1.3]],
  },
  /** Home: a hearth under its mantel, a small fire in the arch. */
  hearth: {
    lines: [
      'M2 6.2H22', 'M3 8.2H21', 'M4.6 8.6V21', 'M19.4 8.6V21',
      'M8 21V15.2C8 12.4 9.8 10.6 12 10.6C14.2 10.6 16 12.4 16 15.2V21', 'M2.4 21.4H21.6',
      'M12 14.6C12.9 15.8 13.6 16.8 13.6 18C13.6 19.2 12.9 20 12 20C11.1 20 10.4 19.2 10.4 18C10.4 17.2 10.9 16.6 11.3 16',
    ],
  },
};

/**
 * The bell's own strokes, exported so `Plaza` (Task 7, move 9) can draw the same bell scaled down
 * to sit over the plaza rather than cutting a second one — one hand, one bell.
 */
export const BELL_PATHS = GLYPHS.bell.lines;

interface Props {
  name: GlyphName;
  size?: number;
  color?: string;
  /**
   * What the glyph says, for a screen reader. Pass it only where the glyph carries meaning on
   * its own — beside its own name (a tab, a quest row) it would read the name twice, so an
   * unlabelled glyph is decorative and hidden.
   */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** The smallest baked size that covers `pixels`, so a glyph is never shrunk more than 2x. */
function sourceFor(name: GlyphName, size: number) {
  const pixels = size * PixelRatio.get();
  const baked = GLYPH_PIXELS.find((p) => p >= pixels) ?? GLYPH_PIXELS[GLYPH_PIXELS.length - 1];
  return GLYPH_IMAGES[name][baked];
}

/**
 * Draws a glyph from its baked image (`scripts/gen-glyphs.js`, which reads `GLYPHS` above), tinted
 * to `color`. It used to be a live `<Svg>`, and on Android each one was a view rasterized on the
 * CPU into its own bitmap whenever it appeared — the Hearth alone stood twenty-three of them up
 * in its opening frame. The drawings did not change; only how they reach the screen.
 */
export function Glyph({ name, size = ICON_SIZES.lg, color = ACCENT.base, label, style }: Props) {
  // `no` hides this view and nothing under it; `no-hide-descendants` takes the whole drawing out
  // of the tree, which is what decorative means.
  const a11y = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const, 'aria-hidden': true };

  return (
    <Image
      testID={`glyph-${name}`}
      source={sourceFor(name, size)}
      style={[{ width: size, height: size, tintColor: color }, style as StyleProp<ImageStyle>]}
      fadeDuration={0}
      {...a11y}
    />
  );
}
