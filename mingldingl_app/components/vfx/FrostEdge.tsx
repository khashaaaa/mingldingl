import Svg, { Path } from 'react-native-svg';
import { TEMPERATURE } from '../../lib/theme';

/**
 * Frost, as an edge. `docs/design/sealed-fire/boards/Temperature.dc.html` and
 * `LettersFrost.dc.html` draw the same crystal — a jagged line of rime clinging right at the
 * boundary, a deeper and sparser line of glacier further in, and a few bare ticks between them —
 * reused wherever a screen needs to say silence rather than describe it: a thread gone quiet, the
 * shut gate, the War Room, the offline strip, a meeting not kept.
 *
 * One drawing, reused: the geometry below is authored once for the top edge, in a 0..100 (along
 * the edge) by 0..100 (`length` units, into the screen) space, and `orient()` maps it onto
 * whichever edge is asked for rather than keeping four copies of the same crystal.
 *
 * Not mounted anywhere in Wave 1 — Wave 3 places it. `pointerEvents="none"` and absolute
 * positioning are left to the parent, the same contract `TorchGlow`'s `Canvas` and `Places`'
 * `Cut` already follow: this component only ever answers "what does frost look like," never
 * "where does it sit."
 */

export type FrostEdgeEdge = 'top' | 'bottom' | 'left' | 'right';

interface Props {
  edge: FrostEdgeEdge;
  /** How far the crystal reaches in from the edge, in px. */
  length?: number;
  /** 0..1 scale on the whole drawing, for a caller that wants the frost to fade rather than snap. */
  opacity?: number;
}

/** Local space: 0..100 along the edge, 0 (at the edge) .. 100 (`length` units deep) into the screen. */
const SPAN = 100;
const DEPTH = 100;

/** The rime line: jagged, right at the boundary, the lightest and busiest of the three marks. */
const RIME_TICKS: readonly [number, number][] = [
  [6, 10], [18, 16], [30, 8], [42, 18], [54, 11], [66, 19], [78, 9], [90, 15],
];

/** The ice line: the crystal's main body, a broken zigzag partway into the reach. */
const ICE_LINE: readonly [number, number][] = [
  [0, 22], [10, 32], [19, 25], [29, 36], [38, 27], [48, 38], [57, 28], [67, 37], [76, 26],
  [86, 34], [95, 24], [100, 30],
];

/** The glacier line: deepest, sparsest and darkest — the last of the frost, furthest from the edge. */
const GLACIER_LINE: readonly [number, number][] = [
  [4, 58], [22, 68], [40, 54], [58, 66], [76, 52], [94, 62],
];

/** Maps a point authored for the top edge onto whichever edge is being drawn. */
function orient(edge: FrostEdgeEdge, x: number, y: number): readonly [number, number] {
  switch (edge) {
    case 'top': return [x, y];
    case 'bottom': return [x, DEPTH - y];
    case 'left': return [y, x];
    case 'right': return [DEPTH - y, x];
  }
}

function pathFor(edge: FrostEdgeEdge, points: readonly (readonly [number, number])[]): string {
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${orient(edge, x, y).join(' ')}`)
    .join(' ');
}

function tickPath(edge: FrostEdgeEdge, x: number, tickDepth: number): string {
  const [x0, y0] = orient(edge, x, 0);
  const [x1, y1] = orient(edge, x, tickDepth);
  return `M${x0} ${y0} L${x1} ${y1}`;
}

export function FrostEdge({ edge, length = 96, opacity = 1 }: Props) {
  const alongEdge = edge === 'top' || edge === 'bottom';
  const width = alongEdge ? '100%' : length;
  const height = alongEdge ? length : '100%';
  const viewBox = alongEdge ? `0 0 ${SPAN} ${DEPTH}` : `0 0 ${DEPTH} ${SPAN}`;

  return (
    <Svg
      testID={`frost-edge-${edge}`}
      width={width}
      height={height}
      viewBox={viewBox}
      preserveAspectRatio="none"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
      aria-hidden
    >
      {RIME_TICKS.map(([x, tickDepth]) => (
        <Path
          key={`rime-${x}`}
          d={tickPath(edge, x, tickDepth)}
          fill="none"
          stroke={TEMPERATURE.rime}
          strokeWidth={1}
          strokeLinecap="round"
          opacity={0.6 * opacity}
        />
      ))}
      <Path
        d={pathFor(edge, ICE_LINE)}
        fill="none"
        stroke={TEMPERATURE.ice}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75 * opacity}
      />
      <Path
        d={pathFor(edge, GLACIER_LINE)}
        fill="none"
        stroke={TEMPERATURE.glacier}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.5 * opacity}
      />
    </Svg>
  );
}
