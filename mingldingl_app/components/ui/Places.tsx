import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Glyph, STROKE, type GlyphName } from './Glyph';
import { HEAT, ICON_SIZES, INK, METAL } from '../../lib/theme';

/**
 * The drawings the three states are made of: a place for an empty screen, an ember for a wrong
 * one. The forms are the board in `docs/design/sealed-fire/boards/States.dc.html`.
 *
 * An empty screen used to draw a stock icon of the *concept* — a crossed-out wifi bar, a circled
 * exclamation mark — which is a status light, not a scene. A place drawn as a place says the
 * same thing without a sentence: the gate is shut, the hearth is cold, the stage is bare. The
 * wrong state is the ember: warm, never the red of a dialog box, because nothing here has
 * crashed — a message did not reach the scribe.
 *
 * Same hand as `Glyph`: one stroke weight, square caps, mitred corners, all on a 24 viewBox, so
 * a place standing beside a cut glyph looks like it came from the same knife. Where a place
 * already exists in that set — the hearth — it is reused rather than re-cut.
 */

interface Cuts {
  readonly lines: readonly string[];
  /** Stroked circles as `[cx, cy, r]` — the one form a straight line cannot make. */
  readonly rings?: readonly (readonly [number, number, number])[];
  /** A line drawn in the ground's own pigment rather than the mark's: what the thing stands on. */
  readonly ground?: string;
}

/** Every drawing in the set, so a test can walk all of them. */
export const PLACE_NAMES = [
  'gate', 'empty-stage', 'signpost', 'calendar-page', 'letter', 'empty-chair', 'moon', 'lantern',
  'door', 'ember',
] as const;

export type PlaceName = typeof PLACE_NAMES[number];

interface PlaceProps {
  size?: number;
  color?: string;
}

type PlaceDrawing = (props: PlaceProps) => React.JSX.Element;

/** The places cut here. `letter` and `lantern` are already in `Glyph` and are reused below. */
const CUTS: Record<Exclude<PlaceName, 'letter' | 'lantern'>, Cuts> = {
  /** A shut gate: two posts, a lintel, and the ring that holds it closed. */
  gate: {
    lines: [
      'M4 21V6', 'M20 21V6', 'M2 6h20', 'M8 21V6', 'M16 21V6', 'M12 6v6', 'M12 16v5',
    ],
    rings: [[12, 14, 2]],
    ground: 'M2 21h20',
  },
  /** An empty stage: the arch, the curtains tied back, and nobody on the boards. */
  'empty-stage': {
    lines: ['M2 3h20', 'M4 3v15', 'M20 3v15', 'M7 3v8', 'M17 3v8', 'M4 11h3', 'M17 11h3'],
    ground: 'M2 18h20',
  },
  /** A signpost where a question is standing: two arms, neither of them taken yet. */
  signpost: {
    lines: ['M12 3v18', 'M12 5h6l3 3-3 3h-6z', 'M12 12H6l-3 3 3 3h6z'],
    ground: 'M4 21h16',
  },
  /** A day with nothing written on it: the page on its nail, ruled and blank. */
  'calendar-page': {
    lines: ['M5 4h14v16H5z', 'M8 13h8', 'M8 16.5h8'],
    rings: [[12, 8, 1.2]],
  },
  /**
   * A chair with nobody in it. The stock name here was a skull, and the kit keeps no monsters —
   * an empty seat says "they did not come" without drawing a corpse to say it.
   */
  'empty-chair': {
    lines: ['M8 3v18', 'M8 12h8', 'M16 12v9', 'M8 6h5', 'M8 9h5'],
    ground: 'M4 21h16',
  },
  /**
   * Night, and nothing happening under it: a full moon over the hill. The ridge is left open at
   * both ends so the brass horizon closes it, rather than drawing the ground twice.
   */
  moon: {
    lines: ['M3 21l6-7 4 4 3-3 5 6'],
    rings: [[16, 6, 3]],
    ground: 'M2 21h20',
  },
  /** A shut door under its lintel — the room is there, it is simply not open. */
  door: {
    lines: ['M2 6h20', 'M5 21V6', 'M19 21V6', 'M7 21V8h10v13'],
    rings: [[15, 15, 1]],
    ground: 'M2 21h20',
  },
  /**
   * The wrong state. An ember, upright on the hearthstone: the mark glows warm and the ground
   * under it stays brass, so the failure is a thing that happened in a room rather than a red
   * banner shouting at the reader.
   */
  ember: {
    lines: ['M6 19l6-14 6 14z', 'M12 10v4', 'M12 16v1.5'],
    ground: 'M4 20h16',
  },
};

/**
 * One drawing, cut. Decorative by construction: the block's title is what carries the meaning,
 * so the whole drawing leaves the accessibility tree — `no-hide-descendants` rather than `no`,
 * which would hide the `<Svg>` and leave its paths behind to be read out one at a time.
 */
function Cut({ cuts, testID, size = ICON_SIZES.hero, color = INK.muted }: {
  cuts: Cuts;
  testID: string;
} & PlaceProps) {
  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {cuts.lines.map((d) => (
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
      {cuts.rings?.map(([cx, cy, r]) => (
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
      {cuts.ground ? (
        <Path
          d={cuts.ground}
          fill="none"
          stroke={METAL.brassDeep}
          strokeWidth={STROKE}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ) : null}
    </Svg>
  );
}

function Gate(props: PlaceProps) {
  return <Cut cuts={CUTS.gate} testID="state-place-gate" {...props} />;
}

function EmptyStage(props: PlaceProps) {
  return <Cut cuts={CUTS['empty-stage']} testID="state-place-empty-stage" {...props} />;
}

function Signpost(props: PlaceProps) {
  return <Cut cuts={CUTS.signpost} testID="state-place-signpost" {...props} />;
}

function CalendarPage(props: PlaceProps) {
  return <Cut cuts={CUTS['calendar-page']} testID="state-place-calendar-page" {...props} />;
}

function EmptyChair(props: PlaceProps) {
  return <Cut cuts={CUTS['empty-chair']} testID="state-place-empty-chair" {...props} />;
}

function Moon(props: PlaceProps) {
  return <Cut cuts={CUTS.moon} testID="state-place-moon" {...props} />;
}

function Door(props: PlaceProps) {
  return <Cut cuts={CUTS.door} testID="state-place-door" {...props} />;
}

function Ember({ size, color = HEAT.flame }: PlaceProps) {
  return <Cut cuts={CUTS.ember} testID="state-ember" size={size} color={color} />;
}

/**
 * Two of these places are already cut, in `Glyph`: the folded letter and the carried lantern. They
 * are reused rather than re-cut — a second drawing of the same object is a second hand. `Glyph`
 * takes only name/size/color/style and does not forward a testID, and widening that shared
 * primitive's API for one test hook is the larger change, so the wrapper carries the name — and
 * nothing else: an unlabelled `Glyph` now hides its own descendants, so the wrapper no longer
 * repeats that.
 */
function GlyphPlace({ name, testID, size = ICON_SIZES.hero, color = INK.muted }: {
  name: GlyphName;
  testID: string;
} & PlaceProps) {
  return (
    <View testID={testID}>
      <Glyph name={name} size={size} color={color} />
    </View>
  );
}

/** Nothing said yet: the letter still folded, its seal unbroken. */
function Letter(props: PlaceProps) {
  return <GlyphPlace name="letters" testID="state-place-letter" {...props} />;
}

/** Nobody gathered: the lantern is lit and carried, and there is no one at the square. */
function Lantern(props: PlaceProps) {
  return <GlyphPlace name="lantern" testID="state-place-lantern" {...props} />;
}

export const PLACES: Record<PlaceName, PlaceDrawing> = {
  gate: Gate,
  'empty-stage': EmptyStage,
  signpost: Signpost,
  'calendar-page': CalendarPage,
  letter: Letter,
  'empty-chair': EmptyChair,
  moon: Moon,
  lantern: Lantern,
  door: Door,
  ember: Ember,
};
