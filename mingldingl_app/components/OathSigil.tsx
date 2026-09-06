import { View as RNView, Text as RNText, Image as RNImage, StyleSheet } from 'react-native';
import { i18n, tKey } from '../lib/i18n';
import { COLORS, FILL, FONTS, FONT_SIZES, ICON_SIZES, INK, RADIUS, SPACE, glow } from '../lib/theme';
import { ORNAMENTS } from '../lib/ornaments';
import type { Oath } from '../models/user';

interface Props {
  oath: Oath | null;
  proven: boolean;
  size?: 'sm' | 'md';

  progress?: { held: number; needed: number } | null;
}

export const OATH_VALUES: readonly Oath[] = ['Bond', 'Fate', 'Kinship'];

// Each oath's ulzii sigil — a different knot density in a different metal.
export const OATH_SIGILS: Record<Oath, number> = {
  Bond: ORNAMENTS.sigilBond,
  Fate: ORNAMENTS.sigilFate,
  Kinship: ORNAMENTS.sigilKinship,
};
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

/**
 * Oaths arrive from the engine as English identifiers, so the key is data: `tKey` falls back to
 * the raw value rather than letting an unmapped oath render as i18n-js's literal
 * `[missing "en." translation]` marker.
 */
export function oathLabel(oath: string | null | undefined): string {
  if (!oath) return '';
  return tKey(OATH_NAME_KEYS[oath as Oath], oath);
}

const SIZES = {
  sm: { sigil: ICON_SIZES.lg, name: FONT_SIZES.sm, state: FONT_SIZES.xs, padH: SPACE.sm, padV: SPACE.xs, gap: SPACE.xs },
  md: { sigil: ICON_SIZES.xl, name: FONT_SIZES.md, state: FONT_SIZES.sm, padH: SPACE.md, padV: SPACE.sm, gap: SPACE.sm },
} as const;

export default function OathSigil({ oath, proven, size = 'md', progress }: Props) {
  if (!oath) return null;
  const sz = SIZES[size];
  const tint = proven ? COLORS.goldBright : INK.muted;

  return (
    <RNView
      style={[
        styles.badge,
        {
          borderColor: tint,
          paddingHorizontal: sz.padH,
          paddingVertical: sz.padV,
          gap: sz.gap,
          backgroundColor: proven ? FILL.goldSoft : FILL.bronze,
        },
        proven && glow(COLORS.goldBright, 0.4),
      ]}
    >
      {!!OATH_SIGILS[oath] && (
        <RNImage
          source={OATH_SIGILS[oath]}
          testID={`oath-sigil-${oath}`}
          style={{ width: sz.sigil, height: sz.sigil, opacity: proven ? 1 : 0.75 }}
        />
      )}
      <RNView>
        <RNText style={[styles.name, { fontSize: sz.name }]} numberOfLines={1}>
          {oathLabel(oath)}
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
  name: { fontFamily: FONTS.bodyBold, color: COLORS.text, letterSpacing: 0.3 },
  state: { fontFamily: FONTS.utility, letterSpacing: 0.5, textTransform: 'uppercase' },
  progress: { fontFamily: FONTS.body, fontSize: FONT_SIZES.xs, color: COLORS.textDim, marginTop: SPACE.hair },
});
