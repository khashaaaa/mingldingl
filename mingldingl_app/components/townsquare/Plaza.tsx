import { View } from 'react-native';
import Svg, {
  Circle, Defs, G, Path, Pattern, RadialGradient, Rect, Stop, Text as SvgText,
} from 'react-native-svg';
import { BELL_PATHS, STROKE } from '../ui/Glyph';
import { i18n } from '../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, INK, LINE, MATERIAL, tint } from '../../lib/theme';

/**
 * The Square, drawn rather than told — a plaza board (move 9). "No new animation" holds here the
 * same way it holds `SkyWindow`: the cobbles, the gates and the bell never move, so a returning
 * viewer reads the same square every time and the only thing that changes between renders is how
 * many lanterns are lit.
 */

/** Fixed per the brief: an `Svg` `width × 220`. */
const HEIGHT = 220;
const INSET = 12;
const BELL_R = 14;
const LANTERN_R = 9;
/** A gathering can seat far more people than a plaza this size can draw as separate dots without
 *  them merging into one smear of light — the label still speaks the real count. */
const MAX_LANTERNS = 24;
/** How far a lantern must sit from the bell's own centre before it is allowed to stand there. */
const BELL_CLEARANCE = BELL_R + LANTERN_R + 4;
/** Width of the short bar drawn across a shut gate. */
const GATE_BAR_LENGTH = 28;

/**
 * A tiny, seeded generator (mulberry32) rather than `Math.random()` — the plaza is furniture, not
 * a slot machine, so the same lantern has to land in the same place every time this session's
 * gathering is drawn. Two draws per lantern (one per axis) keep the x and y walks independent.
 */
function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) | 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Where lantern `index` stands. A pure function of the index and the square's own geometry, so
 * the walk is reproducible without anywhere to store it — and nudged, not rerolled, off the bell:
 * the point the walk picked is still the point drawn, just pushed clear along the line it already
 * sits on.
 */
function lanternPosition(index: number, width: number, bellCx: number, bellCy: number) {
  const minX = INSET + LANTERN_R;
  const maxX = Math.max(minX, width - INSET - LANTERN_R);
  const minY = INSET + LANTERN_R;
  const maxY = HEIGHT - INSET - LANTERN_R;

  let x = minX + mulberry32(index * 2) * (maxX - minX);
  let y = minY + mulberry32(index * 2 + 1) * (maxY - minY);

  const dx = x - bellCx;
  const dy = y - bellCy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < BELL_CLEARANCE) {
    // A lantern that landed exactly on the bell (dist 0) has no direction to push along; the
    // index gives it one so it still lands somewhere deterministic rather than at the centre.
    const angle = dist === 0 ? index * 2.399963 : Math.atan2(dy, dx);
    x = Math.min(maxX, Math.max(minX, bellCx + Math.cos(angle) * BELL_CLEARANCE));
    y = Math.min(maxY, Math.max(minY, bellCy + Math.sin(angle) * BELL_CLEARANCE));
  }
  return { x, y };
}

interface Props {
  /** Measured by the caller (`SessionStatusCard`'s own `onLayout`), the way `SkyWindow`'s is. */
  width: number;
  /** Lanterns lit so far — `TownSquareNextSession.rsvpCount`. */
  lanterns: number;
  /** Whether the viewer is one of the lit lanterns. */
  mine: boolean;
  /** RSVP still open (gates standing) versus the roster locked (gates barred). */
  open: boolean;
}

export function Plaza({ width, lanterns, mine, open }: Props) {
  const cx = width / 2;
  const cy = HEIGHT / 2;
  const squareW = Math.max(0, width - INSET * 2);
  const squareH = HEIGHT - INSET * 2;
  const gateColor = open ? INK.dim : INK.muted;
  const count = Math.min(Math.max(0, lanterns), MAX_LANTERNS);
  const positions = Array.from({ length: count }, (_, i) => lanternPosition(i, width, cx, cy));
  const bellScale = 16 / 24;

  // Three fixed sentences rather than i18n-js pluralization: "mine" is an ownership switch, not a
  // count, so it needs its own key alongside the zero/nonzero split the rest of the app already
  // spells out by hand (`keepsake_line`/`_one`/`_none`).
  const label = lanterns === 0
    ? i18n.t('plaza_label_none')
    : mine
      ? i18n.t('plaza_label_mine', { count: lanterns })
      : i18n.t('plaza_label', { count: lanterns });

  return (
    // One node, one sentence — the same shape `SkyWindow` draws itself in: every stroke below is
    // decorative under this label, so a screen reader learns the plaza's state in one pass rather
    // than walking cobbles and gate bars one shape at a time.
    <View testID="plaza" accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={width} height={HEIGHT} accessible={false} importantForAccessibility="no">
        <Defs>
          <Pattern id="plaza-cobbles" width={10} height={10} patternUnits="userSpaceOnUse">
            <Circle cx={5} cy={5} r={1.2} fill={tint(INK.muted, 0.35)} />
          </Pattern>
          {positions.map((_, i) => {
            // The last lantern is the viewer's own, drawn hot rather than tinted bronze — this
            // file is not on the furnace allow-list, so `ACCENT.bright` carries "mine" instead.
            const isYou = mine && i === count - 1;
            const color = isYou ? ACCENT.bright : MATERIAL.bronze;
            return (
              <RadialGradient key={i} id={`plaza-lantern-glow-${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={color} stopOpacity={1} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </RadialGradient>
            );
          })}
        </Defs>

        <Rect x={INSET} y={INSET} width={squareW} height={squareH} fill="url(#plaza-cobbles)" />
        <Rect
          x={INSET} y={INSET} width={squareW} height={squareH}
          fill="none" stroke={LINE.edge} strokeWidth={1} strokeDasharray="4 3"
        />

        {/* North and south gates: a carved label either way, and a short bar across the shut one. */}
        <SvgText x={cx} y={INSET + 12} fontFamily={FONTS.utility} fontSize={FONT_SIZES.xs} fill={gateColor} textAnchor="middle">
          NORTH GATE
        </SvgText>
        <SvgText x={cx} y={HEIGHT - INSET - 4} fontFamily={FONTS.utility} fontSize={FONT_SIZES.xs} fill={gateColor} textAnchor="middle">
          SOUTH GATE
        </SvgText>
        {!open && (
          <>
            <Rect testID="plaza-gate-bar" x={cx - GATE_BAR_LENGTH / 2} y={INSET - 1} width={GATE_BAR_LENGTH} height={2} fill={INK.muted} />
            <Rect testID="plaza-gate-bar" x={cx - GATE_BAR_LENGTH / 2} y={HEIGHT - INSET - 1} width={GATE_BAR_LENGTH} height={2} fill={INK.muted} />
          </>
        )}

        {/* The bell, at the plaza's own centre — the one fixed point every lantern walks around. */}
        <Circle testID="plaza-bell" cx={cx} cy={cy} r={BELL_R} fill={tint(ACCENT.bright, 0.35)} />
        <G transform={`translate(${cx} ${cy}) scale(${bellScale}) translate(-12 -12)`}>
          {BELL_PATHS.map((d) => (
            <Path key={d} d={d} fill="none" stroke={ACCENT.bright} strokeWidth={STROKE} strokeLinecap="square" strokeLinejoin="miter" />
          ))}
        </G>
        <SvgText x={cx} y={cy + BELL_R + 12} fontFamily={FONTS.utility} fontSize={FONT_SIZES.xs} fill={INK.dim} textAnchor="middle">
          THE BELL
        </SvgText>

        {positions.map((pos, i) => (
          <Circle key={i} testID="plaza-lantern" cx={pos.x} cy={pos.y} r={LANTERN_R} fill={`url(#plaza-lantern-glow-${i})`} />
        ))}
        {mine && count > 0 && (
          <SvgText
            testID="plaza-you"
            x={positions[count - 1].x} y={positions[count - 1].y + LANTERN_R + 10}
            fontFamily={FONTS.utility} fontSize={FONT_SIZES.xs} fill={ACCENT.bright} textAnchor="middle"
          >
            YOU
          </SvgText>
        )}
      </Svg>
    </View>
  );
}
