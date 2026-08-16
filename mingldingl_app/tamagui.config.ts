import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui } from '@tamagui/core';
import { createAnimations } from '@tamagui/animations-react-native';

const animations = createAnimations({
  fast: { type: 'spring', damping: 20, mass: 1.2, stiffness: 250 },
  medium: { type: 'spring', damping: 10, mass: 0.9, stiffness: 100 },
  slow: { type: 'spring', damping: 20, stiffness: 60 },
});

const tamaguiConfig = createTamagui({
  ...defaultConfig,
  animations,
  defaultTheme: 'dark',
  settings: {
    ...defaultConfig.settings,
    onlyAllowShorthands: false,
  },
  themes: {
    ...defaultConfig.themes,
    dark: {
      ...defaultConfig.themes.dark,
      // Kept in sync with lib/theme.ts COLORS by hand — Tamagui needs its own
      // theme registration separate from the plain RN StyleSheet tokens.
      background: '#0A0B10',
      backgroundStrong: '#12141C',
      backgroundFocus: '#1A1E2A',
      color: '#EDE4D3',
      colorMuted: '#8F97A3',
      borderColor: '#4A5A6B',
      gold: '#D97F1F',
      goldWarm: '#C07820',
    },
  },
});

export type AppConfig = typeof tamaguiConfig;
declare module '@tamagui/web' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
