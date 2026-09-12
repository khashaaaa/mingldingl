import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Glyph } from './Glyph';
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

/** The cut. One weight across the set, `Glyph`'s weight. */
const STROKE = 2.4;

interface Cuts {
  readonly lines: readonly string[];
  /** Stroked circles as `[cx, cy, r]` — the one form a straight line cannot make. */
  readonly rings?: readonly (readonly [number, number, number])[];
  /** A line drawn in the ground's own pigment rather than the mark's: what the thing stands on. */
  readonly ground?: string;
}

/** Every drawing in the set, so a test can walk all of them. */
export const PLACE_NAMES = ['gate', 'window-dark', 'empty-stage', 'signpost', 'cold-hearth', 'ember'] as const;

export type PlaceName = typeof PLACE_NAMES[number];

export interface PlaceProps {
  size?: number;
  color?: string;
}

export type PlaceDrawing = (props: PlaceProps) => React.JSX.Element;

const CUTS: Record<Exclude<PlaceName, 'cold-hearth'>, Cuts> = {
  /** A shut gate: two posts, a lintel, and the ring that holds it closed. */
  gate: {
    lines: [
      'M4 21V6', 'M20 21V6', 'M2 6h20', 'M8 21V6', 'M16 21V6', 'M12 6v6', 'M12 16v5',
    ],
    rings: [[12, 14, 2]],
    ground: 'M2 21h20',
  },
  /** A window with nobody behind it — the lantern in that room has gone out. */
  'window-dark': {
    lines: ['M5 3h14v15H5z', 'M12 3v15', 'M5 10.5h14'],
    ground: 'M3 18h18',
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

/** One drawing, cut. Decorative by construction: the block's title is what carries the meaning. */
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
      importantForAccessibility="no"
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

function WindowDark(props: PlaceProps) {
  return <Cut cuts={CUTS['window-dark']} testID="state-place-window-dark" {...props} />;
}

function EmptyStage(props: PlaceProps) {
  return <Cut cuts={CUTS['empty-stage']} testID="state-place-empty-stage" {...props} />;
}

function Signpost(props: PlaceProps) {
  return <Cut cuts={CUTS.signpost} testID="state-place-signpost" {...props} />;
}

function Ember({ size, color = HEAT.flame }: PlaceProps) {
  return <Cut cuts={CUTS.ember} testID="state-ember" size={size} color={color} />;
}

/**
 * The cold hearth is already cut, in `Glyph` — the same room's fire, unlit. `Glyph` takes only
 * name/size/color/style and does not forward a testID, and widening that shared primitive's API
 * for one test hook is the larger change, so the wrapper carries the name instead. It is hidden
 * from assistive tech like every other drawing here.
 */
function ColdHearth({ size = ICON_SIZES.hero, color = INK.muted }: PlaceProps) {
  return (
    <View testID="state-place-cold-hearth" importantForAccessibility="no-hide-descendants" aria-hidden>
      <Glyph name="hearth" size={size} color={color} />
    </View>
  );
}

export const PLACES: Record<PlaceName, PlaceDrawing> = {
  gate: Gate,
  'window-dark': WindowDark,
  'empty-stage': EmptyStage,
  signpost: Signpost,
  'cold-hearth': ColdHearth,
  ember: Ember,
};
