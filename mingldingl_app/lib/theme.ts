import type { ViewStyle } from 'react-native';

export const COLORS = {
  bg: '#0A0B10',
  panel: '#12141C',
  panelRaised: '#1A1E2A',
  panelDeep: '#07080D',
  gold: '#D97F1F',
  goldBright: '#F5A83C',
  bronze: '#4A5A6B',
  brass: '#B8923F',
  brassDark: '#5C4720',
  ember: '#C1461E',
  emberDark: '#913416',
  emberLight: '#D77951',
  text: '#EDE4D3',
  textDim: '#8F97A3',
  silver: '#C7D0DA',
  silverDark: '#5B6672',
  bronzeDark: '#26303B',
} as const;

/**
 * Gem tier identity. Each tier keeps its own hue — a garnet must look like garnet — but every
 * jewel is clamped into a 4.5:1 … 8:1 contrast band against `panel`.
 *
 * The band exists because the old values let brightness contradict rank. Opal (tier 2) measured
 * 12.75:1, the brightest colour anywhere in the app, while Sapphire (tier 4) sat at 3.78:1 —
 * dimmer than tier 1 and below the 4.5:1 needed to read at all. The gem is the first thing anyone
 * learns about a stranger here, so a ladder whose brightness ran 1-6-3-2-2-5 was actively lying.
 *
 * Rank is therefore NOT carried by the jewel any more. It is carried by `TIER_PRESENCE`, which
 * climbs monotonically. Hue says which stone; presence says how high.
 *
 * Garnet and Ruby are the exception to "hue is identity": they are both red stones and sat 11.9°
 * apart, so tiers 1 and 5 were nearly indistinguishable — true of the original palette too. They
 * separate on saturation instead of hue, which is also how the real stones differ: garnet is a
 * dusty brick red, ruby a vivid one. Every other pair separates on hue.
 */
export const GEM_COLORS = {
  Garnet:   '#B06B78',
  Opal:     '#10C0AC',
  Amethyst: '#A855F7',
  Sapphire: '#427BE2',
  Ruby:     '#EE2B75',
  Emerald:  '#2CC46C',
} as const;

/** Deep shade for badge bodies and bezels, each at a uniform 1.45:1 against `panel`. Derived from
 *  the jewel rather than hand-picked, so a re-tuned jewel cannot drift away from its own body. */
export const GEM_SHADES = {
  Garnet:   '#4C282F',
  Opal:     '#053934',
  Amethyst: '#480687',
  Sapphire: '#10306A',
  Ruby:     '#68082C',
  Emerald:  '#0D3A20',
} as const;

/**
 * What rank looks like once the jewel stops encoding it. Ring weight and glow strength climb with
 * the tier and nothing else does, so the ramp cannot disagree with `TIER_ORDER` the way six
 * independently chosen hues could.
 */
export const TIER_PRESENCE = {
  Garnet:   { ring: 1, glow: 0.00 },
  Opal:     { ring: 1, glow: 0.16 },
  Amethyst: { ring: 2, glow: 0.32 },
  Sapphire: { ring: 2, glow: 0.48 },
  Ruby:     { ring: 3, glow: 0.64 },
  Emerald:  { ring: 3, glow: 0.80 },
} as const;

export const FONTS = {
  display: 'YesevaOne_400Regular',
  displayBlack: 'YesevaOne_400Regular',
  displayRegular: 'YesevaOne_400Regular',
  body: 'Alegreya_400Regular',
  bodyMedium: 'Alegreya_500Medium',
  bodyBold: 'Alegreya_700Bold',
  wordmark: 'CloisterBlack-Light',
  // Small-caps utility face for tiny labels, where a display face turns to mush.
  utility: 'AlegreyaSC_700Bold',
} as const;

// 4px grid. gutter/scrollTail are named for the layout role they always play.
export const SPACE = {
  hair: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  huge: 32,
  giant: 40,
  gutter: 20,
  scrollTail: 40,
} as const;

export const RADIUS = { sm: 4, md: 6, lg: 16, pill: 999 } as const;

// Icon sizes. The last axis to get a ladder — before this, 17 distinct sizes were in play
// with 13 and 14 both in heavy use, which is a difference nobody can see but every new
// screen had to guess at.
export const ICON_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  huge: 32,
  hero: 44,
  splash: 72,
} as const;

// The type ladder. Every fontSize in the app resolves to one of these steps —
// xs/sm are utility-face territory, md/lg carry body copy, xl and up are display.
export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  title: 22,
  display: 28,
  wordmark: 40,
} as const;

// Leading, one step per type size, so the same size never gets two different line heights.
// `xs` is also the deliberate snug setting for single-line labels set at `FONT_SIZES.sm`,
// where full leading is dead space rather than breathing room.
export const LINE_HEIGHTS = {
  xs: 14,
  sm: 17,
  md: 20,
  lg: 22,
  title: 30,
} as const;

// Translucent affordance fills. One alpha per role, so a "selected" surface
// looks the same everywhere instead of drifting between 0.1 and 0.22.
export const FILL = {
  gold: tint(COLORS.gold, 0.15),
  goldSoft: tint(COLORS.goldBright, 0.12),
  bronze: tint(COLORS.bronze, 0.16),
  hairline: tint(COLORS.gold, 0.22),
} as const;

// Hand-tuned metal surfaces for GameButton. They live here, not in the component,
// so the palette file stays the single place any colour value is written down.
export const BUTTON_METALS = {
  primary: { gradient: ['#F2A03D', COLORS.gold, '#8A4310'], border: '#8A4310', highlight: tint(COLORS.goldBright, 0.4), label: '#1A1406' },
  ghost:   { gradient: ['#2A241C', COLORS.panelRaised, '#14100C'], border: COLORS.bronze, highlight: tint(COLORS.text, 0.1), label: COLORS.text },
  danger:  { gradient: ['#934C2C', COLORS.emberDark, '#5E2E17'], border: '#7E3D1F', highlight: tint(COLORS.emberLight, 0.4), label: COLORS.text },
  brass:   { gradient: metalGradient(COLORS.brass), border: COLORS.brassDark, highlight: tint(COLORS.brass, 0.5), label: '#241704' },
} as const satisfies Record<string, { gradient: readonly [string, string, string]; border: string; highlight: string; label: string }>;

/**
 * THE ROLE LAYER.
 *
 * Everything above this line is pigment: `COLORS` is a box of paint named after what it looks
 * like. Everything below is a *role* — named after the job it does. Components import roles;
 * only this file is allowed to know which pigment fills a role.
 *
 * The split exists because `COLORS.gold` was being asked 178 questions and giving one answer. It
 * was the heading colour, the icon colour, the card border, the button fill and the shadow, all
 * at once — so nothing on a screen could be more important than anything else, and the palette
 * could not be re-tuned without moving six unrelated things together. After the split those are
 * five separately addressable roles, and hierarchy becomes expressible.
 *
 * Adding a colour means adding a role here, not a hex at a call site.
 */

/** What a thing is made of. Ordered back-to-front: `ground` is furthest away, `raised` nearest. */
export const SURFACE = {
  ground: COLORS.bg,
  panel: COLORS.panel,
  raised: COLORS.panelRaised,
  sunken: COLORS.panelDeep,
} as const;

/** What text is made of. `onAccent` is for labels sitting *on* an accent fill, where the usual
 *  light ink would vanish. */
export const INK = {
  primary: COLORS.text,
  dim: COLORS.textDim,
  /**
   * A mark that is deliberately quiet but must still be perceivable: empty-state iconography, a
   * locked honour's ring, an unearned tier. This is the role `bronze` was doing by accident at
   * 2.60:1 — quiet to the point of invisible. 4.49:1 is quiet on purpose.
   */
  muted: '#698097',
  onAccent: '#1A1406',
} as const;

/** The brand mark and the things that carry it. Not the same as an action — a gold heading is
 *  not a button, and conflating the two is what flattened the hierarchy in the first place. */
export const ACCENT = {
  base: COLORS.gold,
  bright: COLORS.goldBright,
  soft: tint(COLORS.gold, 0.15),
  line: tint(COLORS.gold, 0.22),
} as const;

/**
 * Rules and edges, as a ramp rather than one value. `bronze` used to serve every border at
 * 2.60:1 — under the 3:1 that WCAG requires of a UI boundary, so card edges were invisible to
 * low-vision users and in daylight, which matters for a phone used outdoors. Each step here is
 * solved against `panel`: decorative, standard, and selected.
 */
export const LINE = {
  hairline: '#394553',
  edge: '#526476',
  strong: '#698097',
  focus: COLORS.goldBright,
} as const;

/**
 * Outcome colours. None of these existed: `danger` was only ever a button gradient, so every
 * error and success state in the app was improvised at its call site. All four sit in the same
 * 4.5:1 … 10:1 band as the gems.
 *
 * Two deliberate choices worth knowing before you change them:
 *
 * `success` IS the Emerald jewel, not a near-miss of it. Two greens a hair apart would read as a
 * mistake; one green that means both "good" and "the top tier" reads as a system.
 *
 * `warning` sits 15.9° from `ACCENT.base` in hue, which is a collision — in an app whose accent
 * is orange, a hue-distinct warning does not exist. It separates on lightness instead (1.63:1
 * brighter), so warning must always appear as a filled banner with an icon and never as bare
 * text, where nothing would distinguish it from an ordinary gold heading.
 */
export const STATUS = {
  success: GEM_COLORS.Emerald,
  warning: '#EAB90A',
  danger: '#E5484D',
  info: '#5B9CF8',
} as const;

/** Banner and chip fills for each status. Text on these stays `INK.primary` — the fill is a
 *  wash, not a surface, so it never needs its own ink. */
export const STATUS_SOFT = {
  success: tint(STATUS.success, 0.14),
  warning: tint(STATUS.warning, 0.14),
  danger: tint(STATUS.danger, 0.14),
  info: tint(STATUS.info, 0.14),
} as const;

export function overlay(opacity: number): string {
  return `rgba(10,11,16,${opacity})`;
}

export function tint(color: string, alpha: number): string {
  const v = parseInt(color.slice(1), 16);
  return `rgba(${(v >> 16) & 0xff},${(v >> 8) & 0xff},${v & 0xff},${alpha})`;
}

export function circle(size: number) {
  return { width: size, height: size, borderRadius: size / 2 };
}

export function glow(color: string, strength: number = 0.5, radius: number = 10, elevation: number = 6): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: strength,
    shadowRadius: radius,
    elevation,
  };
}

export function mix(hex: string, target: string, amt: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(target.slice(1), 16);
  const ch = (shift: number) => {
    const av = (a >> shift) & 0xff;
    const bv = (b >> shift) & 0xff;
    return Math.round(av + (bv - av) * amt);
  };
  const r = ch(16), g = ch(8), bl = ch(0);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

export function metalGradient(base: string): [string, string, string] {
  return [mix(base, '#FFFFFF', 0.4), base, mix(base, '#000000', 0.55)];
}
