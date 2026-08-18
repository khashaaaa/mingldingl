// Dark-fantasy design tokens. Single source of truth for the RPG skin —
// see docs/superpowers/specs/2026-07-03-rpg-ui-overhaul-design.md
import type { TextStyle, ViewStyle } from 'react-native';

// Night-sky base (cool indigo-black, not brown-black) + molten-amber accent
// (glowing orange, not brass-yellow) + a stony blue-grey for structure. Warm
// accent = firelight/connection; cool base + structure = the vast dark
// steppe around it. See docs/superpowers/specs/2026-07-03-rpg-ui-overhaul-design.md
// for the original overhaul this retheme sits on top of.
export const COLORS = {
  bg: '#0A0B10',
  panel: '#12141C',
  panelRaised: '#1A1E2A',
  panelDeep: '#07080D',
  gold: '#D97F1F',
  goldBright: '#F5A83C',
  bronze: '#4A5A6B',
  // Actual polished-brass metal tone (warm yellow-bronze), distinct from the
  // amber/gold accent above — used only by GameButton's "brass" variant for
  // compact secondary/nav-style buttons (settings, profile) that want a
  // forged-metal look without competing with primary gold CTAs.
  brass: '#B8923F',
  brassDark: '#5C4720',
  ember: '#C1461E',
  text: '#EDE4D3',
  textDim: '#8F97A3',
} as const;

// Cinzel (the previous display face) has no Cyrillic glyphs at all, so
// Mongolian headers silently fell back to the OS default font — flat and
// "formal" next to the rest of the RPG skin. Yeseva One is a single-weight
// decorative serif with full Cyrillic coverage and enough built-in weight
// (ornate, heavy strokes) to carry display/black/regular roles from one cut.
export const FONTS = {
  display: 'YesevaOne_400Regular',
  displayBlack: 'YesevaOne_400Regular',
  displayRegular: 'YesevaOne_400Regular',
  body: 'Alegreya_400Regular',
  bodyMedium: 'Alegreya_500Medium',
  bodyBold: 'Alegreya_700Bold',
  // Blackletter has no Cyrillic tradition (Cloister Black itself has zero
  // Cyrillic glyphs) — only for strings that are identical in every locale
  // (the wordmark, gem-tier names), never for i18n.t() output.
  wordmark: 'CloisterBlack-Light',
} as const;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const RADIUS = { sm: 4, md: 6 } as const;

export function panelBorder(tint: string = COLORS.bronze): ViewStyle {
  return { borderWidth: 1, borderColor: tint, borderRadius: RADIUS.md };
}

// Night-sky-tinted scrim (rgb of COLORS.bg) for dimming backdrops behind
// modals/photos — use instead of raw rgba(0,0,0,*), which reads as
// off-palette brown-black next to the rest of the UI.
export function overlay(opacity: number): string {
  return `rgba(10,11,16,${opacity})`;
}

export function glow(color: string, strength: number = 0.5): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: strength,
    shadowRadius: 10,
    elevation: 6,
  };
}

export function displayText(size: number, color: string = COLORS.text): TextStyle {
  return { fontFamily: FONTS.display, fontSize: size, color, letterSpacing: 1 };
}

function mix(hex: string, target: string, amt: number): string {
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

// Same "forged metal" bevel GameButton's primary/danger variants hand-tune —
// generalized to any base color so other panel-like elements (badges, card
// frames) can get the same light-from-above sheen without their own
// hand-picked gradient stops.
export function metalGradient(base: string): [string, string, string] {
  return [mix(base, '#FFFFFF', 0.4), base, mix(base, '#000000', 0.55)];
}
