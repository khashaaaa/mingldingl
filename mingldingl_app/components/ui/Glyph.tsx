import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ACCENT, ICON_SIZES } from '../../lib/theme';

/**
 * The hand-cut set.
 *
 * Every app in the store draws the same shield, the same speech bubble and the same two people,
 * because every app in the store reaches for the same icon font. Where an icon carries the
 * identity of a place or a deed — the five destinations, the six quests — it is cut here
 * instead: few strokes, no curve where a straight line will do, one heavy line weight held
 * across the whole set. `Icon` (MaterialCommunityIcons) still serves everything else, which is
 * most things; a glyph is not a cheaper icon, it is a different job.
 *
 * The forms are the drawings in `docs/design/sealed-fire/boards/Glyphs.dc.html`.
 */

/**
 * The cut. One weight across the set — a second weight is a second hand.
 *
 * Exported because the hand does not stop at this file: `Places` and `Waiting` draw in the same
 * ink and used to each declare their own 2.4, so changing the weight of the set meant finding
 * three copies of it and any drawing that missed the change simply looked slightly wrong.
 */
export const STROKE = 2.4;
/** A seal, drawn as the smallest mark that still reads as pressed wax. */
const DOT = 4;

interface Cuts {
  /** Stroked paths, in draw order. */
  readonly lines: readonly string[];
  /** Stroked circles as `[cx, cy, r]` — the one form a straight line cannot make. */
  readonly rings?: readonly (readonly [number, number, number])[];
  /** Filled square seals as `[cx, cy]`: the only fill in the set. */
  readonly dots?: readonly (readonly [number, number])[];
}

/** Every glyph in the set, so a test can walk all of them. */
export const GLYPH_NAMES = [
  'fire', 'letters', 'lantern', 'forge', 'gem', 'ice', 'seals', 'knot', 'flame', 'pledge',
  'seal', 'candle', 'bell', 'hearth',
] as const;

export type GlyphName = typeof GLYPH_NAMES[number];

/**
 * All geometry is on a 24-unit viewBox, so the stroke keeps its weight at every rendered size.
 *
 * Typed by the name tuple rather than inferred from itself: a drawing with no name, or a name
 * with no drawing, is then a compile error instead of an empty box on someone's tab bar.
 */
const GLYPHS: Record<GlyphName, Cuts> = {
  /** Seek. A fire seen from above: four logs, a core, four sparks. */
  fire: {
    lines: [
      'M12 3v5', 'M12 16v5', 'M3 12h5', 'M16 12h5',
      'M12 8l2.5 4L12 16l-2.5-4z',
      'M6.5 6.5l2 2', 'M17.5 6.5l-2 2', 'M6.5 17.5l2-2', 'M17.5 17.5l-2-2',
    ],
  },
  /** The quest log, and the deed of exchanging words: a folded letter under its seal. */
  letters: {
    lines: ['M5 4h11l3 3v13H5z', 'M8 9h8', 'M8 12.5h8', 'M8 16h5'],
    dots: [[17, 17]],
  },
  /** The town square: a lantern carried to a gathering. */
  lantern: {
    lines: ['M12 2v2', 'M8 6h8l-1 9H9z', 'M7 15h10', 'M9 21h6', 'M12 15v6', 'M10.5 9.5h3'],
  },
  /** Missions: the forge they are worked at. */
  forge: {
    lines: ['M3 20h18', 'M6 20v-5h12v5', 'M8 15V9l4-5 4 5v6', 'M12 10v5'],
  },
  /** The character: the stone that names a rank. */
  gem: {
    lines: ['M12 3l8 7-8 11-8-11z', 'M12 3v18', 'M4 10h16'],
  },
  /** Breaking the ice: a floe already cracked. */
  ice: {
    lines: ['M3 16l4-7 3 4 2-3 4 6 5-2v6H3z', 'M10 13l2 3'],
  },
  /** Sending a summons: two seals, one pressed for each side. */
  seal: {
    lines: [],
    rings: [[8, 9, 4.5], [16, 15, 4.5]],
    dots: [[8, 9], [16, 15]],
  },
  /** The reveal ladder: three seals on a strip, the whole way a face is uncovered. */
  seals: {
    lines: ['M8 12h2', 'M14 12h2'],
    dots: [[6, 12], [12, 12], [18, 12]],
  },
  /** The trial: four knotted turns, the Ulzii figure reduced to its corners. */
  knot: {
    lines: [
      'M12 3l4 4-4 4-4-4z', 'M12 13l4 4-4 4-4-4z',
      'M3 12l4-4 4 4-4 4z', 'M13 12l4-4 4 4-4 4z',
    ],
  },
  /** Facing the flame: a fire standing on the hearthstone. */
  flame: {
    lines: [
      'M12 3c-1 4-5 6-5 11a5 5 0 0 0 10 0c0-3-2-4-2-7',
      'M12 12c-1 2-2 3-2 5a2 2 0 0 0 4 0',
      'M4 21h16',
    ],
  },
  /** The pledge: a locked chest, the promise kept in it. */
  pledge: {
    lines: ['M4 8h16v12H4z', 'M8 8V5h8v3', 'M12 12v4', 'M10 14h4'],
  },
  /** Waiting: a candle burning down, never a spinner. */
  candle: {
    lines: ['M12 2l2 3-2 3-2-3z', 'M9 8h6v11H9z', 'M7 19h10v2H7z'],
  },
  /** The hour: the bell that rings it. */
  bell: {
    lines: ['M12 3c-4 0-6 3-6 7v5l-2 3h16l-2-3v-5c0-4-2-7-6-7z', 'M10 20h4'],
  },
  /** Home: a hearth, cold or lit. */
  hearth: {
    lines: ['M2 8h20', 'M5 8v13', 'M19 8v13', 'M3 21h18', 'M9 21l3-7 3 7z'],
  },
};

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

export function Glyph({ name, size = ICON_SIZES.lg, color = ACCENT.base, label, style }: Props) {
  const { lines, rings, dots } = GLYPHS[name];
  // `no` hides this view and nothing under it, so TalkBack walked straight past the `<Svg>` and
  // announced its paths one by one — a decorative glyph read out as a dozen unnamed shapes.
  // `no-hide-descendants` takes the whole drawing out of the tree, which is what decorative means.
  const a11y = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const, 'aria-hidden': true };

  return (
    <Svg
      testID={`glyph-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={style}
      {...a11y}
    >
      {lines.map((d) => (
        <Path
          key={d}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ))}
      {rings?.map(([cx, cy, r]) => (
        <Circle
          key={`${cx},${cy},${r}`}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ))}
      {dots?.map(([cx, cy]) => (
        <Rect
          key={`${cx},${cy}`}
          x={cx - DOT / 2}
          y={cy - DOT / 2}
          width={DOT}
          height={DOT}
          fill={color}
        />
      ))}
    </Svg>
  );
}
