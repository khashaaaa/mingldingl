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

// One name per face. `displayBlack` and `displayRegular` used to sit beside `display` and
// resolve to the very same file, so fourteen call sites were asking for a weight that does not
// exist and getting `display` anyway. A token that cannot change what is drawn is not a token.
export const FONTS = {
  display: 'YesevaOne_400Regular',
  body: 'Alegreya_400Regular',
  bodyMedium: 'Alegreya_500Medium',
  bodyBold: 'Alegreya_700Bold',
  wordmark: 'CloisterBlack-Light',
  // Small-caps utility face for tiny labels, where a display face turns to mush.
  utility: 'AlegreyaSC_700Bold',
} as const;

const XL = 20;

// 4px grid. gutter/scrollTail are named for the layout role they always play.
export const SPACE = {
  hair: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: XL,
  xxl: 24,
  xxxl: 28,
  huge: 32,
  giant: 40,
  // A page gutter is one xl step. Stated as a role so "the page edge" and "an xl gap" stay
  // separate decisions that happen to agree, rather than two spellings of the number 20.
  gutter: XL,
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
  /**
   * One step above display, for the single loudest thing on a screen. It exists because the app
   * had no such thing: the scale stopped at 28 and almost nothing reached it, so a person's own
   * name on their character sheet was set at `title` — the same size as the word "Honours" three
   * cards below it. A design that never raises its voice has no way to say what matters.
   */
  hero: 34,
  wordmark: 40,
  /**
   * The blackletter face at one size, once per screen — `HeaderBar`'s room-name title (Task 7,
   * Move 12). Set above `wordmark` because a thin blackletter stroke needs more size than a
   * regular face to stay legible at all; matches the size shown on the `Blackletter.dc.html`
   * board. The compact variant (`right` set on `HeaderBar`) reuses `hero` rather than adding a
   * second dedicated step, at the same ratio `xl` already sits below `title` (0.818).
   */
  roomName: 44,
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
  display: 34,
  hero: 40,
  wordmark: 46,
  /** Board shows 1.1× the room-name size, rounded to the 4px grid. */
  roomName: 48,
} as const;

/**
 * Which leading belongs to which type step. The ladder above promised that "the same size never
 * gets two different line heights" and could not keep it: `FONT_SIZES.xs` was set with both
 * `LINE_HEIGHTS.xs` and `LINE_HEIGHTS.sm` on two different screens, and the top two steps —
 * `display` and `wordmark` — had no leading to reach for at all. This map is the promise made
 * mechanical: `leading(size)` is the only correct answer, so the pair cannot drift apart.
 *
 * It is a default, not a law. Two styles deviate from it with a reason written next to them —
 * the tab bar's label takes full leading at `xs` because the display face's descenders were
 * shearing off against the bar, and the report sheet's `sm` label takes the snug `xs` step
 * because it is a single line and full leading was dead space. A deviation carrying its reason
 * is a decision; a deviation that carries none is the drift.
 */
export const LEADING = {
  xs: LINE_HEIGHTS.xs,
  sm: LINE_HEIGHTS.sm,
  md: LINE_HEIGHTS.md,
  lg: LINE_HEIGHTS.lg,
  xl: LINE_HEIGHTS.lg,
  title: LINE_HEIGHTS.title,
  display: LINE_HEIGHTS.display,
  hero: LINE_HEIGHTS.hero,
  wordmark: LINE_HEIGHTS.wordmark,
  roomName: LINE_HEIGHTS.roomName,
} as const satisfies Record<keyof typeof FONT_SIZES, number>;

/**
 * Tracking. The last axis to get a ladder, and the worst of it was inside `FONTS.utility` — the
 * small-caps face whose entire job is tracked labels, and which was being set at four different
 * widths, so the same eyebrow was a different shape depending on which screen you were on.
 */
export const TRACKING = {
  none: 0,
  /** A whisper of air in running copy. */
  body: 0.3,
  /** A button or a chip label. */
  label: 0.5,
  /** The standing setting for the small-caps utility face. */
  wide: 1,
  /** A card or section eyebrow — the widest a label goes before it stops reading as a word. */
  eyebrow: 1.5,
  /** Ceremony only: a tier-up, the Gate, a wordmark. */
  ceremony: 3,
} as const;

/**
 * How dark it gets behind a layer that sits over the app. `overlay()` takes a bare number and so
 * grew nine of them; these are the three that mean something. A dialog and a ceremony were being
 * scrimmed at 0.88 and 0.92 more or less at random, and the Atlas at 0.86 for no reason at all.
 *
 * `ceremony` is 0.97 rather than the 0.92 most ceremonies used because 0.92 was measured on
 * device and found wanting — see the note in `components/chat/Unsealing.tsx`, where the chat
 * behind the seal stayed legible and pulled the eye off the reveal.
 */
export const SCRIM = {
  /** A one-pixel shadow under a raised edge. */
  edge: 0.35,
  /** A wash over a photograph, so text can sit on it. */
  veil: 0.55,
  /** A sheet or picker rising over a screen still meant to be read behind it. */
  sheet: 0.6,
  /** The heavier wash for where a control, and not just text, sits on a photograph. */
  veilStrong: 0.75,
  /** A dialog. What is behind is context, not content. */
  dialog: 0.88,
  /** A ceremony, and the foot of a full-bleed photo gradient. Nothing behind it competes. */
  ceremony: 0.97,
} as const;

/**
 * What a tap looks like, and how present a control is.
 *
 * React Native's default `activeOpacity` is 0.2 — the row does not acknowledge the touch so much
 * as briefly leave. Nothing reaches for these directly: `components/ui/Tap` owns the press and
 * `ladders.test.ts` holds it there, which is what keeps this from going back to a value every
 * call site writes out for itself.
 */
export const PRESS = {
  /** The standard acknowledgement. */
  opacity: 0.8,
  /** For a control that animates its own press, where a fade would double up. */
  none: 1,
  /** A control that is present but cannot be used — disabled, or busy with a request. */
  disabled: 0.4,
  /** Content that is present but not current: a cleared room, a message that failed to send. */
  dimmed: 0.55,
} as const;

/**
 * The gem badge's size ladder. It is the first thing anyone learns about a stranger here and it
 * was being called at a spread of sizes including 28, 30 and 32 — three steps nobody can tell
 * apart. The badge draws everything from `size`, so the spread bought nothing at all.
 */
export const BADGE_SIZES = {
  /** Inside a bar or a HUD slab. */
  inline: 16,
  /** Beside a line of text. */
  chip: 20,
  /** A list row, or a card's corner. */
  row: 28,
  /** A profile or progression header. */
  hero: 44,
  /** The tier-up stage, where the badge is the whole screen rather than part of a layout. */
  ceremony: 96,
} as const;

/**
 * THE ROLE LAYER.
 *
 * Everything above this line is pigment: `COLORS` is a box of paint named after what it looks
 * like. Everything below is a *role* — named after the job it does. Components import roles;
 * only this file is allowed to know which pigment fills a role.
 *
 * The split exists because `COLORS.gold` was answering every question with one answer. It
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
 * solved against `panel`: decorative and standard.
 *
 * There were two more, `strong` and `focus`, and nothing ever climbed to them — React Native
 * draws no focus ring for `focus` to colour, and no surface asked for a third weight. Add a rung
 * when something needs to stand on it.
 */
export const LINE = {
  hairline: '#394553',
  edge: '#526476',
} as const;

/**
 * Outcome colours. None of these existed: `danger` was only ever a button gradient, so every
 * error and success state in the app was improvised at its call site. All four sit in the same
 * 4.5:1 … 10:1 band as the gems.
 *
 * There were four. `success` and `info` are gone: nothing in the app ever rendered either, and a
 * fully specified, contrast-tuned colour that no screen draws is a comment with a test attached.
 * The app says "good" in gold, like the rest of its ceremonies. If a real success or information
 * state ever arrives, add the colour back then — `success` was `GEM_COLORS.Emerald` on purpose,
 * so that one green meant both "good" and "the top tier" rather than two greens a hair apart.
 *
 * `warning` sits 15.9° from `ACCENT.base` in hue, which is a collision — in an app whose accent
 * is orange, a hue-distinct warning does not exist. It separates on lightness instead (1.63:1
 * brighter), so warning must always appear as a filled banner with an icon and never as bare
 * text, where nothing would distinguish it from an ordinary gold heading.
 */
export const STATUS = {
  warning: '#EAB90A',
  danger: '#E5484D',
} as const;

/** Banner and chip fills for each status. Text on these stays `INK.primary` — the fill is a
 *  wash, not a surface, so it never needs its own ink. */
export const STATUS_SOFT = {
  warning: tint(STATUS.warning, 0.14),
  danger: tint(STATUS.danger, 0.14),
} as const;

/**
 * A flat metal surface: a border, fill or icon standing for an object *made of* this material —
 * a medallion, a wax seal, a rarity badge, a brass-trimmed pill — rather than a hue chosen to
 * draw the eye. `ACCENT` tints attention; `METAL` names substance, and a gold heading is not a
 * button even though both are the same pigment (see `ACCENT`'s own note).
 *
 * Two metals, no fourth: the engine's item `rarity` field is literally either of these (see
 * `METAL_COLORS` in `lib/tiers.ts`) — gold for ordinary drops, ember for the honours with real
 * stakes (the Oath, the Rite, a boss room). `brass` is a third, UI-only metal for ornamental
 * trim (quest runes, card borders) that never carries rarity.
 */
export const METAL = {
  gold: COLORS.gold,
  ember: COLORS.ember,
  brass: COLORS.brass,
  /**
   * Deep shades, for the body or bezel of a thing made of the metal above it — a lantern's
   * unlit wick, a chain, the Gate's ironwork. These exist because `COLORS.emberDark` and
   * `COLORS.brassDark` were being reached for directly: the shade of a metal is part of the
   * metal, not a separate pigment anyone may pick up.
   */
  emberDeep: COLORS.emberDark,
  brassDeep: COLORS.brassDark,
} as const;

/**
 * Fire, as identity rather than alarm. The streak flame, a boss room's chip, the embers under
 * the Gate, a call that has dropped.
 *
 * This is the split `COLORS.emberLight` never got. That one pigment was speaking three
 * unrelated languages at once — form errors, a lost point, and genuine fire — so a lit streak
 * and a failed upload were the same colour, and neither could be re-tuned without moving the
 * other. Errors are `STATUS.danger` now. This is the fire.
 */
export const HEAT = {
  flame: COLORS.emberLight,
} as const;

/**
 * The app's temperature, `docs/design/sealed-fire/boards/Temperature.dc.html`: fire is what is
 * alive, answered and kept; frost is silence, absence and what was left.
 *
 * `furnace`/`furnaceBright` are not the gold accent turned up — they are a second, hotter
 * identity, and stay rare on purpose: only the Fire, the Oath, the Ascension, the Square's bell
 * and the Hall of Names may reach for them (`lib/__tests__/furnace.test.ts` guards the allowlist
 * by file). Everywhere else keeps gold and rounded corners.
 *
 * `rime`/`ice`/`glacier` are the second pole, ordered light to dark: a thread gone quiet, a shut
 * gate, a meeting not kept. `components/vfx/FrostEdge.tsx` draws them as the one frost drawing,
 * reused wherever a screen needs to say silence rather than describe it.
 *
 * Kept as one flat object, `furnace`/`furnaceBright`/`rime`/`ice`/`glacier`, rather than split
 * fire/frost tables: the guard test greps for the bare token names, and the design board already
 * treats all five as one dial with two ends.
 */
export const TEMPERATURE = {
  furnace: '#FF7A1A',
  furnaceBright: '#FFB347',
  rime: '#E8F4FA',
  ice: '#BFE3F2',
  glacier: '#7FB6D6',
} as const;

/**
 * What a thing means, as the only vocabulary a call site gets to choose from.
 *
 * Two components had grown private tone unions with incompatible words — `StateBlock`'s
 * `empty | error | good` and `AlertModal`'s `default | warning`, the latter resolving a warning
 * to `METAL.ember`, a *metal*, while `STATUS.warning` sat at zero call sites. One union means a
 * warning is a warning in both places; each component still decides how loud to draw it, because
 * an empty-state mark and a dialog's border are not asking for the same prominence.
 */
export type Tone = 'neutral' | 'good' | 'warning' | 'danger';

/**
 * A pigment used as *light* — the tone a room is lit by, in `lib/world/light.ts`. These are the
 * raw metals on purpose: a torch is gold-coloured light, not a gold button, and routing the
 * world's six light signatures through `ACCENT` or `METAL` would tie the colour of a wall wash
 * to the colour of a heading.
 *
 * `ink` and `soot` exist only so the cold and dark signatures can carry `NIGHT.blue` and
 * `NIGHT.black` as a *tone* — `WorldFloor`'s gradient composites `tone` through `tint()`, which
 * parses a hex string, so an rgba string (`NIGHT`'s own shape) would parse as nothing and paint
 * black regardless of alpha. Same RGB as their `NIGHT` counterpart, opaque, so the maths still
 * works: `ink` is `NIGHT.blue`'s rgb(8,12,24), `soot` is `NIGHT.black`'s rgb(4,4,9).
 */
export const TONE = {
  silver: COLORS.silver,
  gold: COLORS.gold,
  brass: COLORS.brass,
  ember: COLORS.ember,
  ink: '#080C18',
  soot: '#040409',
} as const;

/**
 * Membership tiers, which are metals of their own and not the item rarities in `METAL`. Face
 * and body sit together as with the gems, so a re-tuned face cannot drift from its own shade.
 */
export const MEMBERSHIP_METALS = {
  Free:   { color: INK.muted,     shade: COLORS.bronzeDark },
  Silver: { color: COLORS.silver, shade: COLORS.silverDark },
  Gold:   { color: ACCENT.bright, shade: METAL.gold },
} as const satisfies Record<string, { color: string; shade: string }>;

/**
 * The opaque counterpart to `STATUS_SOFT`, for a bar that sits *over* the app rather than
 * inside a page — the offline banner must not let the screen show through it, so a wash will
 * not do. Mixed down toward the ground from the status itself rather than hand-picked, so a
 * re-tuned status carries its bar with it, and held at 4.5:1 against `INK.primary` by test.
 */
export const STATUS_DEEP = {
  warning: mix(STATUS.warning, COLORS.bg, 0.6),
} as const;

/**
 * The dark a room's vignette closes to, and the ground its floor is made of.
 *
 * These were the last colour values living outside this file, in `lib/world/light.ts` and
 * `components/world/WorldFloor.tsx`. The world layer is the one place in the app where colour is
 * free, because nothing on it ever sits behind a word of text — but "free" is not the same as
 * "somewhere else".
 */
export const NIGHT = {
  plain: overlay(0.9),
  blue:  'rgba(8,12,24,0.90)',
  brown: 'rgba(20,11,6,0.90)',
  black: 'rgba(4,4,9,0.94)',
} as const;

export const GROUND = {
  /** Cold worked stone — the Gate, the Road, the Hearth, the Forge, the Hall. */
  wall: '#232C42',
  /** The Tavern. Warm dark earth, a few points off the stone at this layer's opacity. */
  parchment: '#3A2C1E',
} as const;

/**
 * Hand-tuned metal surfaces for GameButton. They live here, not in the component, so the
 * palette file stays the single place any colour value is written down.
 *
 * `ghost` used to run warm brown → `COLORS.panelRaised` → warm brown: a cool blue-grey middle
 * stop between two hand-picked browns, which is what a half-finished migration looks like from
 * the outside. It is built with `metalGradient` now, the same way `brass` is, so it is one
 * material lit from above instead of three colours in a row. Its border was `COLORS.bronze` —
 * the retired pigment this file's own test pins below the 3:1 a UI boundary needs — which made
 * the secondary button the one control on screen whose edge you could not see.
 */
export const BUTTON_METALS = {
  primary: { gradient: ['#F2A03D', COLORS.gold, '#8A4310'], border: '#8A4310', highlight: tint(COLORS.goldBright, 0.4), label: INK.onAccent },
  ghost:   { gradient: metalGradient(COLORS.panelRaised), border: LINE.edge, highlight: tint(INK.primary, 0.1), label: INK.primary },
  danger:  { gradient: ['#934C2C', COLORS.emberDark, '#5E2E17'], border: '#7E3D1F', highlight: tint(COLORS.emberLight, 0.4), label: INK.primary },
  brass:   { gradient: metalGradient(COLORS.brass), border: METAL.brassDeep, highlight: tint(COLORS.brass, 0.5), label: '#241704' },
} as const satisfies Record<string, { gradient: readonly [string, string, string]; border: string; highlight: string; label: string }>;

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
