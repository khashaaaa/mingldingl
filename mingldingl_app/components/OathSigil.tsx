import { View as RNView, Text as RNText, StyleSheet } from 'react-native';
import { i18n } from '../lib/i18n';
import { COLORS, FONTS, RADIUS, glow } from '../lib/theme';
import type { Oath } from '../models/user';

interface Props {
  oath: Oath | null;
  proven: boolean;
  size?: 'sm' | 'md';

  progress?: { held: number; needed: number } | null;
}

export const OATH_VALUES: readonly Oath[] = ['Bond', 'Fate', 'Kinship'];

export const OATH_GLYPHS: Record<Oath, string> = { Bond: '\u2694\uFE0E', Fate: '◈', Kinship: '○' };
export const OATH_NAME_KEYS: Record<Oath, string> = {
  Bond: 'oath_bond_name',
  Fate: 'oath_fate_name',
  Kinship: 'oath_kinship_name',
};
export const OATH_DESC_KEYS: Record<Oath, string> = {
  Bond: 'oath_bond_desc',
  Fate: 'oath_fate_desc',
  Kinship: 'oath_kinship_desc',
};

const SIZES = {
  sm: { glyph: 13, name: 11, state: 9, padH: 8, padV: 4, gap: 5 },
  md: { glyph: 17, name: 13, state: 10, padH: 10, padV: 6, gap: 7 },
} as const;

export default function OathSigil({ oath, proven, size = 'md', progress }: Props) {
  if (!oath) return null;
  const sz = SIZES[size];
  const tint = proven ? COLORS.goldBright : COLORS.bronze;

  return (
    <RNView
      style={[
        styles.badge,
        {
          borderColor: tint,
          paddingHorizontal: sz.padH,
          paddingVertical: sz.padV,
          gap: sz.gap,
          backgroundColor: proven ? 'rgba(245,168,60,0.12)' : 'rgba(74,90,107,0.16)',
        },
        proven && glow(COLORS.goldBright, 0.4),
      ]}
    >
      <RNText style={[styles.glyph, { fontSize: sz.glyph, color: tint }]}>{OATH_GLYPHS[oath]}</RNText>
      <RNView>
        <RNText style={[styles.name, { fontSize: sz.name }]} numberOfLines={1}>
          {i18n.t(OATH_NAME_KEYS[oath])}
        </RNText>
        <RNText style={[styles.state, { fontSize: sz.state, color: tint }]}>
          {i18n.t(proven ? 'oath_state_proven' : 'oath_state_sworn')}
        </RNText>
        {!proven && progress && (
          <RNText style={styles.progress}>
            {i18n.t('oath_progress', { held: progress.held, needed: progress.needed })}
          </RNText>
        )}
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  glyph: { fontFamily: FONTS.display },
  name: { fontFamily: FONTS.bodyBold, color: COLORS.text, letterSpacing: 0.2 },
  state: { fontFamily: FONTS.body, letterSpacing: 0.5, textTransform: 'uppercase' },
  progress: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.textDim, marginTop: 1 },
});
