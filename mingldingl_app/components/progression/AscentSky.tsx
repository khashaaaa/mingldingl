import { Fragment } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import type { GemTier } from '../../models/user';
import { TIER_ORDER, tierThresholdsSnapshot, tierLabel } from '../../lib/tiers';
import { ACCENT, BADGE_SIZES, CARVING, FONTS, FONT_SIZES, INK, SPACE, TRACKING } from '../../lib/theme';
import { i18n, lineLocale, normalizeLocale } from '../../lib/i18n';
import { GemTierBadge } from './GemTierBadge';
import { BrushNumber } from '../ui/BrushNumber';
import { ASCENT_HEIGHT, ASCENT_STOPS, CLIFF_IMAGE } from './cliffImages';

/** The streak's numerals, painted: the day count is the Ascent's one hero number. */
const STREAK_INK = 30;

interface Props {
  gemTier: GemTier;
  totalScore: number;
  currentStreak: number;
  /** Not in the brief's own signature, but the sky is the only place `StreakSummary` used to draw
   *  this number, and the controller ruling still asks for it under the streak block. */
  longestStreak: number;
  width: number;
}

const TOP_INDEX = TIER_ORDER.length - 1;

const AHEAD_OPACITY = 0.7;
/** The distance between a label's two lines, baseline to baseline. */
const LABEL_LEAD = 14;
/** "The sky beyond" sits in the strip of night over the summit. */
const BEYOND_Y = 26;

/**
 * The progression screen's hero: the six tiers as their own cut stones, set into a cliff along a
 * path that switchbacks up it (`scripts/gen-cliff.js` draws the rock and the sockets). Stones
 * already climbed past are polished and lit; the one held burns; the ones above are still rough
 * in the rock. The path is pecked all the way up and lit in gold as far as the score has walked it.
 *
 * It was the same climb drawn as dots through a night sky; the gems are what the tiers *are*, so
 * the drawing now shows the gems. Geometry is fractional against `width` (measured by the caller
 * via `onLayout`) and the sockets' positions come from the bake, so the gems land in them at any
 * card width.
 */
export function AscentSky({ gemTier, totalScore, currentStreak, longestStreak, width }: Props) {
  const heldIndex = TIER_ORDER.indexOf(gemTier);
  const thresholds = tierThresholdsSnapshot();
  const nextTier = heldIndex < TOP_INDEX ? TIER_ORDER[heldIndex + 1] : null;
  const pointsToGo = nextTier ? Math.max(0, thresholds[heldIndex + 1] - totalScore) : null;

  const points = TIER_ORDER.map((tier, i) => ({
    tier,
    x: width * ASCENT_STOPS[i][0],
    y: ASCENT_HEIGHT * ASCENT_STOPS[i][1],
  }));

  // Each leg bows a little to alternate sides, as `gen-cliff.js` bows the ledges under it. The
  // walked part is lit in gold; the rest is the same pecks, unlit.
  const leg = (a: (typeof points)[number], b: (typeof points)[number], i: number) => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const bow = (i % 2 ? 1 : -1) * len * 0.12;
    return `Q${mx - (dy / len) * bow} ${my + (dx / len) * bow} ${b.x} ${b.y}`;
  };
  const trail = (from: number, to: number) =>
    to <= from ? '' : `M${points[from].x} ${points[from].y} ` + points.slice(from + 1, to + 1).map((p, k) => leg(points[from + k], p, from + k)).join(' ');
  const walked = trail(0, Math.max(0, heldIndex));
  const ahead = trail(Math.max(0, heldIndex), TOP_INDEX);

  /** A gem's label as two short lines, its name over its number, so it fits the open side of
   *  its turn. `detail` is null for the tier that starts at zero. */
  function labelFor(index: number): { name: string; detail: string | null } {
    const tier = TIER_ORDER[index];
    const name = tierLabel(tier);
    // The words beside a gem are dropped, not switched, while they have no translation: the gems'
    // names are translated, so "Бадмаараг / 135 to go" mixed two languages in one label, and an
    // English gem there would sit among Mongolian ones. The number alone still reads.
    const here = normalizeLocale(i18n.locale);
    if (index === heldIndex) {
      return {
        name,
        detail: lineLocale('ascent_you') === here
          ? i18n.t('ascent_you', { score: totalScore.toLocaleString() })
          : totalScore.toLocaleString(),
      };
    }
    if (nextTier && index === heldIndex + 1 && lineLocale('ascent_to_go') === here) {
      return { name, detail: i18n.t('ascent_to_go', { points: pointsToGo!.toLocaleString() }) };
    }
    const threshold = thresholds[index] ?? 0;
    return { name, detail: threshold > 0 ? threshold.toLocaleString() : null };
  }

  // The whole drawing is one accessible group (the SVG is hidden, and an `accessible` ancestor
  // suppresses individual announcement of its RN `Text` descendants too) — so the longest-streak
  // line has to be said here, in words, or a screen reader never hears it at all. Reuses
  // `streak_longest`'s own English text rather than adding a key for one more number. Said whole in
  // one language: its untranslated pieces between a Mongolian gem and "Хамгийн урт дараалал" made
  // the one sentence switch language twice.
  const said = { locale: lineLocale(nextTier ? 'ascent_to_go' : 'ascent_beyond', 'ascent_dawns', 'streak_longest') };
  const saidBody = nextTier
    ? i18n.t('ascent_to_go', { points: pointsToGo!.toLocaleString(), ...said })
    : i18n.t('ascent_beyond', said);
  const a11yLabel = `${tierLabel(gemTier, said.locale)}. ${totalScore.toLocaleString()}. ${saidBody}. `
    + `${currentStreak} ${i18n.t('ascent_dawns', { count: currentStreak, ...said })}. ${i18n.t('streak_longest', said)} ${longestStreak}.`;

  const topPoint = points[TOP_INDEX];
  // A gem climbed past sits at row size, the one held at hero size, and one still ahead, smaller
  // and rough in the rock, at chip size.
  const sizeOf = (i: number) => (i === heldIndex ? BADGE_SIZES.hero : i < heldIndex ? BADGE_SIZES.row : BADGE_SIZES.chip);

  return (
    <View accessible accessibilityLabel={a11yLabel}>
      <View style={{ width, height: ASCENT_HEIGHT }}>
        <Image source={CLIFF_IMAGE} resizeMode="stretch" style={{ width, height: ASCENT_HEIGHT }} accessible={false} fadeDuration={0} />
        <Svg width={width} height={ASCENT_HEIGHT} style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no">
          {ahead !== '' && (
            <Path testID="ascent-ahead" d={ahead} stroke={CARVING.stone} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="0.1 9" fill="none" opacity={0.4} />
          )}
          {walked !== '' && (
            <>
              {/* The light the lit pecks throw on the ledge, then the pecks themselves. */}
              <Path d={walked} stroke={ACCENT.base} strokeWidth={10} strokeLinecap="round" fill="none" opacity={0.12} />
              <Path testID="ascent-walked" d={walked} stroke={ACCENT.base} strokeWidth={4} strokeLinecap="round" strokeDasharray="0.1 9" fill="none" opacity={0.95} />
            </>
          )}
          <SvgText
            x={topPoint.x}
            y={BEYOND_Y}
            textAnchor="middle"
            fill={INK.muted}
            fontFamily={FONTS.bodyItalic}
            fontSize={FONT_SIZES.sm}
          >
            {i18n.t('ascent_beyond')}
          </SvgText>
          {points.map((p, i) => {
            const reached = i <= heldIndex;
            // The label goes on the open side of the turn — outward, toward the card's edge —
            // since both of a turn's legs leave it toward the middle.
            const outLeft = ASCENT_STOPS[i][0] < 0.5;
            const gap = sizeOf(i) / 2 + SPACE.sm;
            const x = outLeft ? p.x - gap : p.x + gap;
            const anchor = outLeft ? 'end' : 'start';
            const { name, detail } = labelFor(i);
            return (
              <Fragment key={p.tier}>
                <SvgText
                  x={x}
                  y={detail ? p.y - LABEL_LEAD / 2 + FONT_SIZES.xs / 2 : p.y + FONT_SIZES.xs / 2}
                  textAnchor={anchor}
                  fill={reached ? INK.primary : INK.muted}
                  fontFamily={FONTS.utility}
                  fontSize={FONT_SIZES.xs}
                >
                  {name}
                </SvgText>
                {detail && (
                  <SvgText
                    x={x}
                    y={p.y + LABEL_LEAD / 2 + FONT_SIZES.xs / 2}
                    textAnchor={anchor}
                    fill={i === heldIndex ? ACCENT.base : INK.muted}
                    fontFamily={FONTS.body}
                    fontSize={FONT_SIZES.xs}
                  >
                    {detail}
                  </SvgText>
                )}
              </Fragment>
            );
          })}
        </Svg>
        {points.map((p, i) => {
          const held = i === heldIndex;
          const reached = i <= heldIndex;
          const size = sizeOf(i);
          return (
            <View
              key={p.tier}
              testID={held ? 'ascent-gem-held' : 'ascent-gem'}
              pointerEvents="none"
              style={[styles.gem, { left: p.x - size / 2, top: p.y - size / 2, width: size, height: size }, !reached && styles.ahead]}
            >
              <GemTierBadge
                tier={p.tier}
                size={held ? BADGE_SIZES.hero : reached ? BADGE_SIZES.row : BADGE_SIZES.chip}
                glow={held}
                dim={!reached}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.streakBlock}>
        <BrushNumber value={currentStreak} size={STREAK_INK} color={INK.primary} tick={false} testID="ascent-streak" />
        <Text style={styles.streakCaption}>{i18n.t('ascent_dawns', { count: currentStreak })}</Text>
        <Text style={styles.longestLine}>{i18n.t('streak_longest')} · {longestStreak}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gem: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ahead: { opacity: AHEAD_OPACITY },
  streakBlock: { alignItems: 'center', paddingTop: SPACE.lg, paddingBottom: SPACE.lg, gap: SPACE.hair },
  streakCaption: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.xs, color: INK.dim, letterSpacing: TRACKING.wide },
  longestLine: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.muted, marginTop: SPACE.xs },
});
