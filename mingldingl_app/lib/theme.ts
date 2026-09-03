import type { TextStyle, ViewStyle } from 'react-native';

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

// Gem tier identity. Each tier has a jewel colour and a hand-tuned deep shade for
// badge bodies and bezels; the shade is not a straight mix, so it is written down here.
export const GEM_COLORS = {
  Garnet:   '#C23B54',
  Opal:     '#3DEFDB',
  Amethyst: '#A855F7',
  Sapphire: '#2D6CDF',
  Ruby:     '#E0115F',
  Emerald:  '#2ECC71',
} as const;

export const GEM_SHADES = {
  Garnet:   '#5C0F22',
  Opal:     '#0E6E68',
  Amethyst: '#4C1D82',
  Sapphire: '#0A2F6E',
  Ruby:     '#6E0630',
  Emerald:  '#0B5A32',
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

export function panelBorder(tint: string = COLORS.bronze): ViewStyle {
  return { borderWidth: 1, borderColor: tint, borderRadius: RADIUS.md };
}

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

export function displayText(size: number, color: string = COLORS.text): TextStyle {
  return { fontFamily: FONTS.display, fontSize: size, color, letterSpacing: 1 };
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
