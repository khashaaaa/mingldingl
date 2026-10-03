import { Image, PixelRatio, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { GLYPH_GROUNDS, GLYPH_IMAGES, GLYPH_PIXELS } from './glyphImages';
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
  /**
   * What a place stands on, baked as its own image so it can be inked in the ground's pigment
   * (brass) while the place takes the block's tone. Only `Places` draws it.
   */
  readonly ground?: string;
  /** Brushed circles as `[cx, cy, r]`. */
  readonly rings?: readonly (readonly [number, number, number])[];
  /** Wax seals as `[cx, cy]`: a pressed disc with its die ring, lifted off the strokes beneath. */
  readonly dots?: readonly (readonly [number, number])[];
}

/** Every glyph in the set, so a test can walk all of them. */
export const GLYPH_NAMES = [
  'fire', 'letters', 'lantern', 'forge', 'gem', 'ice', 'seals', 'knot', 'flame', 'pledge',
  'seal', 'candle', 'bell', 'hearth',
  // The honours, the score history's deeds and the room links (2026-10-03): the marks that name
  // the world, inked so they stand beside the set above instead of the icon font.
  'oath', 'thread-1', 'thread-2', 'thread-3', 'horn', 'clasp', 'dawn', 'mended', 'map', 'bow',
  'moon', 'chest-open', 'quill', 'scroll', 'waypoint', 'frost', 'target', 'scales', 'crown',
  'swords', 'book', 'shield', 'spark',
  // The venues a pledge can be kept at.
  'cup', 'feast', 'goblet', 'mask', 'mountain', 'temple',
  // The places an empty screen draws (`Places`), each standing on its own ground.
  'gate', 'stage', 'signpost', 'page', 'chair', 'door', 'night', 'ember',
  // `Waiting`'s candle in two layers, so the flame can flicker over still wax.
  'wax', 'wick',
  // An honour's coin: struck once it is earned, a blank until then.
  'medal', 'medal-blank',
  // A letter's ring in the ledger: the sender's mark is written inside it.
  'ring',
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

  /** The Oathkeeper: a hand raised to swear, the seal pressed in its palm. */
  oath: {
    lines: [
      'M8.4 10.8V4.4', 'M11.4 10V2.6', 'M14.4 10.2V3.4', 'M17.4 11.4V6',
      'M8.2 11.8C7.4 14.8 7.8 18.2 9.4 21.4', 'M17.8 12.4C18.4 16 17.4 19 15.6 21.4',
      'M8 14.6L4.6 10.8',
    ],
    dots: [[12.8, 15.4]],
  },
  /** The thread honours grow a bead a rung: a thread between two hearts... */
  'thread-1': { lines: ['M6.6 15.8L17.4 8.2'], rings: [[5, 17, 1.8], [19, 7, 1.8]] },
  /** ...a thread that has passed through a third... */
  'thread-2': {
    lines: ['M5.3 15.7L10.7 10.3', 'M13.5 10.2L18.5 13.8'],
    rings: [[4, 17, 1.8], [12, 9, 1.8], [20, 15, 1.8]],
  },
  /** ...and three bound into one. */
  'thread-3': {
    lines: ['M11.1 5.6L18.9 17.4', 'M12.9 5.6L5.1 17.4', 'M6 19.2H18'],
    rings: [[12, 4, 1.8], [20, 19, 1.8], [4, 19, 1.8]],
  },
  /** The Allycaller, and sharing: a horn sounded. */
  horn: {
    lines: [
      'M3 9.8C7 9.6 12.6 7.2 17.6 3.8V20.2C12.6 16.8 7 14.4 3 14.2Z', 'M6.6 14.4L8 19.4',
      'M20 8.6L21.8 7.4', 'M20.4 12H22.4', 'M20 15.4L21.8 16.6',
    ],
  },
  /** The True Word: two rings closed through each other — a word given and kept. */
  clasp: { lines: ['M9 4.6V2.4', 'M15 19.4V21.6'], rings: [[9, 10.4, 5.2], [15, 13.6, 5.2]] },
  /** Seven Dawns and the daily return: the sun rising off the edge of the steppe. */
  dawn: {
    lines: [
      'M2 17H22', 'M6.6 17C6.6 14 9 11.6 12 11.6C15 11.6 17.4 14 17.4 17', 'M12 4V8',
      'M4.8 8.4L7.2 10.8', 'M19.2 8.4L16.8 10.8', 'M2.4 13.4H4.6', 'M19.4 13.4H21.6', 'M5.6 20.4H18.4',
    ],
  },
  /** The Mended, and a healed scar: a cut closed with stitches. */
  mended: {
    lines: [
      'M4 19.6C9 15.6 14 10.4 20 4.4',
      'M6.6 14.4L9.4 17.6', 'M10 11.4L12.8 14.6', 'M13.4 8.4L16.2 11.6', 'M16.6 5.6L19.2 8.6',
    ],
  },
  /** The Cartographer, and the campaign's path: a folded map with its mark. */
  map: {
    lines: [
      'M3 6L8.4 4L15.6 6.4L21 4.4V18L15.6 20L8.4 17.6L3 19.6Z', 'M8.4 4.4V17.2', 'M15.6 6.8V19.6',
      'M4.8 15.4C6.6 13.2 9 14.6 10.6 12.6C11.8 11.2 13 10.4 14.4 10.6',
      'M17 9.2L19.2 11.4', 'M19.2 9.2L17 11.4',
    ],
  },
  /** Naadam's archery, and every arrow loosed at someone: the bow drawn. */
  bow: {
    lines: [
      'M7 2.8C14.4 6.6 14.4 17.4 7 21.2', 'M7 3.2V20.8', 'M2.6 12H21.2',
      'M21.2 12L18.6 10', 'M21.2 12L18.6 14', 'M2.6 12L1.6 10.2', 'M2.6 12L1.6 13.8',
    ],
  },
  /** The White Moon: the full moon of the new year, its seas showing. */
  moon: { lines: [], rings: [[12, 12, 8.4], [9.4, 9.6, 1.6], [14.8, 14.4, 2.2], [14.2, 8, 1]] },
  /** A chest thrown open: the day's bounty, a milestone, the loot. */
  'chest-open': {
    lines: [
      'M4 12.2H20V20.4H4Z', 'M4 12L5.4 5.6C10 4 15 4 18.8 6L20 12', 'M8.4 12.6V20', 'M15.6 12.6V20',
      'M12 1.6V3.2', 'M7.6 2.4L8.6 3.8', 'M16.4 2.4L15.4 3.8',
    ],
    dots: [[12, 15.2]],
  },
  /** Writing yourself down: a quill, nib to the page. */
  quill: {
    lines: [
      'M20.6 3.4C13.6 4.8 8.4 10 6.6 17.4', 'M20.6 3.4C20 10 15.2 14.8 8.6 15.4',
      'M14.8 8.2L16.8 11', 'M11.8 11.2L13.4 13.6', 'M6.6 17.4L4 21',
    ],
  },
  /** The trial's questions and the house rules: a scroll, unrolled. */
  scroll: {
    lines: [
      'M5.6 4.2H17.4C18.8 4.2 19.8 5.2 19.8 6.2C19.8 7.2 18.8 8 17.6 8',
      'M5.6 4.2C4.4 4.2 3.6 5.2 3.6 6.2C3.6 7.2 4.4 8 5.6 8H7.6', 'M7.6 4.6V18.4', 'M17.6 6.6V18',
      'M4.2 17.8C4.2 19 5.2 19.8 6.4 19.8H18.4C19.6 19.8 20.4 19 20.4 17.8H7.6',
      'M10.2 10.6H15.2', 'M10.2 13.4H15.2',
    ],
  },
  /** A place an encounter was kept: the waypoint on the map. */
  waypoint: {
    lines: ['M12 21.6C8.4 17 5.6 13.6 5.6 9.6C5.6 6 8.4 3.2 12 3.2C15.6 3.2 18.4 6 18.4 9.6C18.4 13.6 15.6 17 12 21.6Z'],
    rings: [[12, 9.6, 2.4]],
  },
  /** Ghosting: the frost a silence leaves. */
  frost: {
    lines: [
      'M12 2.6V21.4', 'M3.9 7.3L20.1 16.7', 'M3.9 16.7L20.1 7.3',
      'M9.8 4.4L12 6.4L14.2 4.4', 'M9.8 19.6L12 17.6L14.2 19.6',
      'M4.6 10.8L7 9.6L6.6 7', 'M19.4 10.8L17 9.6L17.4 7', 'M4.6 13.2L7 14.4L6.6 17', 'M19.4 13.2L17 14.4L17.4 17',
    ],
  },
  /** A quest done: the arrow home in the mark. */
  target: {
    lines: ['M12 12L20.4 3.6', 'M20.4 3.6V6.4', 'M20.4 3.6H17.6'],
    rings: [[11, 13, 8.2], [11, 13, 4.2]],
  },
  /** The keeper's hand on the ledger: scales. */
  scales: {
    lines: [
      'M3.6 6.4H20.4', 'M12 3V20.2', 'M7.6 20.6H16.4',
      'M4 6.8L1.8 12.4C1.8 14.2 6.2 14.2 6.2 12.4L4 6.8', 'M20 6.8L17.8 12.4C17.8 14.2 22.2 14.2 22.2 12.4L20 6.8',
    ],
  },
  /** Standing, membership and the boss: a crown. */
  crown: {
    lines: ['M3.4 18L2.6 7.4L8 11.6L12 4.4L16 11.6L21.4 7.4L20.6 18Z', 'M3.6 20.6H20.4'],
    rings: [[12, 14.6, 1.4]],
  },
  /** A trial passed, and the war room itself: crossed swords. */
  swords: {
    lines: [
      'M4.4 3.6L17 16.2', 'M19.6 3.6L7 16.2', 'M14.8 18.4L19.2 14', 'M9.2 18.4L4.8 14',
      'M17.2 16.4L20.4 19.6', 'M6.8 16.4L3.6 19.6',
    ],
  },
  /** The chronicle and the guides: a book lying open. */
  book: {
    lines: [
      'M12 6.4C9.6 4.6 6.6 4.2 3 4.6V18.6C6.6 18.2 9.6 18.6 12 20.4C14.4 18.6 17.4 18.2 21 18.6V4.6C17.4 4.2 14.4 4.6 12 6.4Z',
      'M12 6.8V19.8', 'M5.6 8.6C7 8.4 8.4 8.6 9.6 9.2', 'M14.4 9.2C15.6 8.6 17 8.4 18.4 8.6',
      'M5.6 12C7 11.8 8.4 12 9.6 12.6', 'M14.4 12.6C15.6 12 17 11.8 18.4 12',
    ],
  },
  /** Privacy and safety: a shield with the knot's cross. */
  shield: {
    lines: [
      'M12 2.8L20 5.6V11.4C20 16.2 16.6 19.6 12 21.4C7.4 19.6 4 16.2 4 11.4V5.6Z',
      'M12 7V17', 'M7.8 10.8H16.2',
    ],
  },
  /** Anything else worth a mark: a four-pointed spark. */
  spark: {
    lines: ['M12 2.6C12.8 8.4 15.6 11.2 21.4 12C15.6 12.8 12.8 15.6 12 21.4C11.2 15.6 8.4 12.8 2.6 12C8.4 11.2 11.2 8.4 12 2.6Z'],
  },
  /** A cafe: the cup, still steaming. */
  cup: {
    lines: [
      'M5 9H16.6V14.6C16.6 17.6 14.6 19.6 11.8 19.6C9 19.6 5 17.6 5 14.6Z',
      'M16.6 10.8C19.6 10.8 19.6 15.4 16.6 15.4', 'M3 21.2H19.6',
      'M8.6 6.6C7.8 5.4 9.4 4.4 8.6 3', 'M12.4 6.6C11.6 5.4 13.2 4.4 12.4 3',
    ],
  },
  /** A meal: the bowl, chopsticks resting across it. */
  feast: {
    lines: [
      'M3 11.4H21C21 16.4 17.2 19.8 12 19.8C6.8 19.8 3 16.4 3 11.4Z', 'M8.8 21.4H15.2',
      'M12.4 9.6L19.8 2.8', 'M15 10.2L21.6 4.6', 'M7.6 8.8C6.8 7.6 8.4 6.6 7.6 5.2',
    ],
  },
  /** A bar: the goblet. */
  goblet: {
    lines: [
      'M6 3.4H18C18 8.8 15.6 12 12 12C8.4 12 6 8.8 6 3.4Z', 'M6.6 6.6H17.4', 'M12 12.2V19',
      'M7.8 20.8C9 19.4 15 19.4 16.2 20.8',
    ],
  },
  /** A show: the player's mask. */
  mask: {
    lines: [
      'M4 4.6C9 6.2 15 6.2 20 4.6C20.4 12.4 17.4 19.4 12 19.4C6.6 19.4 3.6 12.4 4 4.6Z',
      'M7.4 10C8.2 9.2 9.4 9.2 10.2 10', 'M13.8 10C14.6 9.2 15.8 9.2 16.6 10',
      'M9 14.2C10.6 15.8 13.4 15.8 15 14.2',
    ],
  },
  /** The open air: a peak under the sun. */
  mountain: {
    lines: ['M2 20.4L9 7.6L13 13.6L15.6 10L22 20.4Z', 'M7.2 10.8L9 12.4L10.6 10.6'],
    rings: [[18.4, 5, 1.8]],
  },
  /** Culture: a temple under its sweeping roof. */
  temple: {
    lines: [
      'M12 1.8V4.6', 'M8.6 4.8H15.4', 'M2.2 9.6C5 9.2 7.6 7.6 8.8 4.8', 'M21.8 9.6C19 9.2 16.4 7.6 15.2 4.8',
      'M4.4 9.8H19.6', 'M6 10.6V18', 'M10 10.6V18', 'M14 10.6V18', 'M18 10.6V18',
      'M3.6 19.2H20.4', 'M2.4 21.6H21.6',
    ],
  },
  /** A shut gate under its arch: nobody is let in yet. */
  gate: {
    lines: [
      'M4.6 21V7', 'M19.4 21V7', 'M3 7.6C7 4.4 17 4.4 21 7.6', 'M9.4 21V9', 'M14.6 21V9',
      'M4.8 12.6H19.2',
    ],
    rings: [[12, 16.6, 1.4]],
    ground: 'M2 21.4H22',
  },
  /** An empty stage: curtains tied back, nobody on the boards. */
  stage: {
    lines: [
      'M2.4 3.6H21.6', 'M4 3.8V18', 'M20 3.8V18',
      'M4.4 5.2C6.6 6.6 9.2 6.6 12 5.4C14.8 6.6 17.4 6.6 19.6 5.2',
      'M4.2 4.4C6 7.4 7 9.4 7.4 12.6C6 12.8 5 12.2 4.2 11.6', 'M19.8 4.4C18 7.4 17 9.4 16.6 12.6C18 12.8 19 12.2 19.8 11.6',
    ],
    ground: 'M2 18.6H22',
  },
  /** A signpost where a question stands: two arms, neither taken yet. */
  signpost: {
    lines: ['M12 2.6V21', 'M12 5H18.4L20.8 7.4L18.4 9.8H12', 'M12 11.6H5.6L3.2 14L5.6 16.4H12'],
    ground: 'M6 21.4H18',
  },
  /** A day with nothing written on it: the page on its nail, its corner turned. */
  page: {
    lines: ['M5 4.8H19V16.8L15.4 20.4H5Z', 'M19 16.8H15.4V20.4', 'M8.4 11.4H15.6', 'M8.4 14.4H13.6'],
    rings: [[12, 3.4, 1.1]],
  },
  /** A chair with nobody in it: they did not come. */
  chair: {
    lines: ['M7.4 3.4V21', 'M7.4 3.6C9 3.2 11.4 3.2 13 3.6V11.6', 'M7 12H17', 'M16.6 12.4V21', 'M7.6 16.4H16.4'],
    ground: 'M4 21.4H20',
  },
  /** A shut door under its lintel — the room is there, it is simply not open. */
  door: {
    lines: [
      'M2.6 5.6H21.4', 'M5 21V6', 'M19 21V6', 'M7.4 21V11C7.4 8.4 9.4 7.2 12 7.2C14.6 7.2 16.6 8.4 16.6 11V21',
    ],
    rings: [[14.6, 15, 0.9]],
    ground: 'M2 21.4H22',
  },
  /** Night, and nothing happening under it: the moon over the hills, a star out. */
  night: {
    lines: ['M2 20.6C5 16 8 14.6 11 16.6C13.4 18.2 16.6 15.4 22 19', 'M6 4V7.6', 'M4.2 5.8H7.8'],
    rings: [[16, 7, 3.2]],
    ground: 'M2 21.4H22',
  },
  /** The wrong state: an ember on the hearthstone, warm rather than alarmed. */
  ember: {
    lines: [
      'M12 3.4C13.4 6.6 17 8.6 17 13C17 16.2 14.8 18.6 12 18.6C9.2 18.6 7 16.2 7 13C7 10.8 8.2 9.4 9 8.2C9.6 9.6 10.4 10.4 11 10.8C10.6 8.4 11 5.8 12 3.4',
      'M12 11.4C12.8 12.6 13.4 13.4 13.4 14.4C13.4 15.4 12.8 16 12 16C11.2 16 10.6 15.4 10.6 14.4C10.6 13.8 11 13.2 11.2 12.8',
    ],
    ground: 'M4 20.8H20',
  },
  /** An honour once earned: the coin struck, its rim milled. */
  medal: {
    lines: [
      'M19.60 12.00L20.80 12.00', 'M19.02 14.91L20.13 15.37', 'M17.37 17.37L18.22 18.22', 'M14.91 19.02L15.37 20.13', 'M12.00 19.60L12.00 20.80', 'M9.09 19.02L8.63 20.13', 'M6.63 17.37L5.78 18.22', 'M4.98 14.91L3.87 15.37',
      'M4.40 12.00L3.20 12.00', 'M4.98 9.09L3.87 8.63', 'M6.63 6.63L5.78 5.78', 'M9.09 4.98L8.63 3.87', 'M12.00 4.40L12.00 3.20', 'M14.91 4.98L15.37 3.87', 'M17.37 6.63L18.22 5.78', 'M19.02 9.09L20.13 8.63',
    ],
    rings: [[12, 12, 10.6]],
  },
  /** An honour not yet earned: the blank waiting for its die, only its edge marked out. */
  'medal-blank': {
    lines: [
      'M22.40 12.00A10.4 10.4 0 0 1 21.97 14.95', 'M21.01 17.20A10.4 10.4 0 0 1 19.16 19.54', 'M17.20 21.01A10.4 10.4 0 0 1 14.43 22.11', 'M12.00 22.40A10.4 10.4 0 0 1 9.05 21.97', 'M6.80 21.01A10.4 10.4 0 0 1 4.46 19.16', 'M2.99 17.20A10.4 10.4 0 0 1 1.89 14.43',
      'M1.60 12.00A10.4 10.4 0 0 1 2.03 9.05', 'M2.99 6.80A10.4 10.4 0 0 1 4.84 4.46', 'M6.80 2.99A10.4 10.4 0 0 1 9.57 1.89', 'M12.00 1.60A10.4 10.4 0 0 1 14.95 2.03', 'M17.20 2.99A10.4 10.4 0 0 1 19.54 4.84', 'M21.01 6.80A10.4 10.4 0 0 1 22.11 9.57',
    ],
  },
  /** The ring a letter hangs from on the thread, its sender's initial written inside. */
  ring: { lines: [], rings: [[12, 12, 10.4]] },
  /** The waiting candle's wax and dish... */
  wax: {
    lines: [
      'M9 9.2C10 8.6 14 8.6 15 9.2V19H9Z', 'M15 11C15.8 11.9 15.8 13.2 15 14',
      'M5.4 19.2H18.6C18 20.8 16.6 21.6 12 21.6C7.4 21.6 6 20.8 5.4 19.2',
    ],
  },
  /** ...and its flame on the wick, drawn apart so it can flicker. */
  wick: {
    lines: [
      'M12 1.8C13.2 3.4 13.8 4.4 13.8 5.4C13.8 6.5 13 7.2 12 7.2C11 7.2 10.2 6.5 10.2 5.4C10.2 4.6 10.8 3.9 11.2 3.2',
      'M12 7.4V8.6',
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
  /** Draw the place's ground instead of the place — `Places` lays the two over each other. */
  ground?: boolean;
}

/** The smallest baked size that covers `pixels`, so a glyph is never shrunk more than 2x. */
function sourceFor(name: GlyphName, size: number, ground: boolean) {
  const pixels = size * PixelRatio.get();
  const baked = GLYPH_PIXELS.find((p) => p >= pixels) ?? GLYPH_PIXELS[GLYPH_PIXELS.length - 1];
  const set = ground ? GLYPH_GROUNDS[name] : GLYPH_IMAGES[name];
  if (!set) throw new Error(`Glyph "${name}" has no ground`);
  return set[baked];
}

/**
 * Draws a glyph from its baked image (`scripts/gen-glyphs.js`, which reads `GLYPHS` above), tinted
 * to `color`. It used to be a live `<Svg>`, and on Android each one was a view rasterized on the
 * CPU into its own bitmap whenever it appeared — the Hearth alone stood twenty-three of them up
 * in its opening frame. The drawings did not change; only how they reach the screen.
 */
export function Glyph({ name, size = ICON_SIZES.lg, color = ACCENT.base, label, style, ground = false }: Props) {
  // `no` hides this view and nothing under it; `no-hide-descendants` takes the whole drawing out
  // of the tree, which is what decorative means.
  const a11y = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const, 'aria-hidden': true };

  return (
    <Image
      testID={ground ? `glyph-${name}-ground` : `glyph-${name}`}
      source={sourceFor(name, size, ground)}
      style={[{ width: size, height: size, tintColor: color }, style as StyleProp<ImageStyle>]}
      fadeDuration={0}
      {...a11y}
    />
  );
}
