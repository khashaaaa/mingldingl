import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewStyle } from 'react-native';
import { colorForTier } from '../../lib/tiers';
import { ACCENT, LINE, RADIUS, SCRIM, SURFACE, glow, overlay, tint as tintColor } from '../../lib/theme';
import { ORNAMENTS } from '../../lib/ornaments';
import { useActiveFestival } from '../../lib/festivals';
import { ParchmentFill } from './ParchmentFill';

interface Props {
  children: React.ReactNode;
  tier?: string;

  tint?: string;
  /**
   * The one panel a screen is *for*. Knots, parchment, the frame and the glow are its alone —
   * the kit's rule is "one hero panel, then rows", and "its glow is the only glow". Every other
   * card is a ledger section: no fill, no border, one hairline across its top, and its contents
   * on the screen's gutter like every row list's. At most one per screen; the rule is enforced
   * in `lib/__tests__/hero.test.ts`.
   *
   * (2026-10-04) Ordinary cards used to keep the panel fill and border, so half the app read as
   * hairline rows (Quest Log, Satchel, Settings) and the other half as a stack of boxes (Profile,
   * Edit, Missions, Town Square) — the same rule drawn two ways.
   */
  hero?: boolean;
  /**
   * Clip the card's contents to its rounded corners (art that runs edge to edge, like the hearth's
   * sky). Use this, never `overflow: 'hidden'` in `style`: the knots sit 6pt outside the card, so
   * clipping the card itself cut them in half. Here only an inner layer clips; the knots stay out.
   * Art needs an edge to run to, so a clipped card keeps its frame even when it is not the hero.
   */
  clip?: boolean;
  /**
   * An object on the floor rather than a section of the page — a struck plaque (the Oath, the
   * Flame Rite). It keeps its border and its call site's inset, so what is written on the plate
   * sits inside it. Without this, the ledger-section inset put the oath against the plate's edge.
   */
  framed?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppCard({ children, tier, tint: tintOverride, hero, clip, framed, style }: Props) {
  const tint = tintOverride ?? (tier ? colorForTier(tier) : ACCENT.base);
  // On a festival day the gold knots take the festival's colour. The PNGs are metal-shaded over
  // alpha, so tintColor flattens them to one colour while keeping their shape.
  const festival = useActiveFestival();
  const knotTint = festival ? { tintColor: festival.color } : undefined;
  if (!hero && !clip && !framed) {
    // Horizontal padding is dropped after the call site's style, so a section's text starts on
    // the same gutter as the rows above and below it rather than one card-inset further in.
    return (
      <View testID="app-card" style={[styles.section, style, styles.sectionInset]}>
        {children}
      </View>
    );
  }
  const body = (
    <>
      {hero ? (
        <ParchmentFill style={styles.texture} />
      ) : (
        <LinearGradient
          colors={[SURFACE.raised, SURFACE.panel]}
          style={styles.fill}
          pointerEvents="none"
        />
      )}
      <View style={styles.hairline} pointerEvents="none" />
      <View style={[styles.topHighlight, { backgroundColor: tintColor(tint, 0.4) }]} pointerEvents="none" />
      {hero && <View style={styles.bottomShadow} testID="card-bottom-shadow" pointerEvents="none" />}
      {children}
    </>
  );
  return (
    <View testID="app-card" style={[styles.card, hero && glow(tint, 0.35, 12, 6), style]}>
      {clip ? <View style={styles.clip}>{body}</View> : body}
      {/* Drawn last, so they sit over the contents at every corner rather than under them. */}
      {hero && (
        <>
          <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotTl, knotTint]} />
          <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotTr, knotTint]} />
          <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotBl, knotTint]} />
          <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotBr, knotTint]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE.hairline,
  },
  sectionInset: { paddingHorizontal: 0, paddingLeft: 0, paddingRight: 0, backgroundColor: 'transparent', borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderRadius: 0 },
  card: {
    backgroundColor: SURFACE.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: LINE.edge,
  },
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.md },
  // Inside the 1pt border, so its radius is one less than the card's.
  clip: { flexGrow: 1, borderRadius: RADIUS.md - 1, overflow: 'hidden' },
  // Layout only — `ParchmentFill` draws its own gradient and texture; this just clips both to
  // the card's own corners, the way `styles.fill`'s `borderRadius` already does for the plain fill.
  texture: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.md, overflow: 'hidden' },
  topHighlight: { position: 'absolute', top: 0, left: RADIUS.md, right: RADIUS.md, height: 1 },
  bottomShadow: { position: 'absolute', bottom: 0, left: RADIUS.md, right: RADIUS.md, height: 1, backgroundColor: overlay(SCRIM.edge) },
  hairline: {
    position: 'absolute',
    top: 3, left: 3, right: 3, bottom: 3,
    borderWidth: 1,
    borderColor: ACCENT.line,
    borderRadius: RADIUS.sm,
  },
  knot: { position: 'absolute', width: 24, height: 24, pointerEvents: 'none' },
  knotTl: { top: -6, left: -6 },
  knotTr: { top: -6, right: -6, transform: [{ scaleX: -1 }] },
  knotBl: { bottom: -6, left: -6, transform: [{ scaleY: -1 }] },
  knotBr: { bottom: -6, right: -6, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
});
