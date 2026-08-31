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
  emberLight: '#D77951',
  text: '#EDE4D3',
  textDim: '#8F97A3',
} as const;

export const FONTS = {
  display: 'YesevaOne_400Regular',
  displayBlack: 'YesevaOne_400Regular',
  displayRegular: 'YesevaOne_400Regular',
  body: 'Alegreya_400Regular',
  bodyMedium: 'Alegreya_500Medium',
  bodyBold: 'Alegreya_700Bold',
  wordmark: 'CloisterBlack-Light',
} as const;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, gutter: 20 } as const;
export const RADIUS = { sm: 4, md: 6, lg: 16 } as const;
export const FONT_SIZES = { xs: 10, sm: 12, md: 14, lg: 16, xl: 18, title: 22, display: 28 } as const;

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
