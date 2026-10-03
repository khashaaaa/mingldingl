import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { AppCard } from '../ui/AppCard';
import { CardEyebrow } from '../ui/CardEyebrow';
import { SectionDivider } from '../ui/SectionDivider';
import { Icon } from '../ui/Icon';
import { Tap } from '../ui/Tap';
import { useStanding } from '../../hooks/useStanding';
import { goTo } from '../../lib/navigation';
import { i18n } from '../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LEADING, LINE, METAL, SPACE } from '../../lib/theme';
import type { GemTier } from '../../models/user';

/**
 * The character's standing beyond its score: the seats at their fire, any ghosting scar still
 * open and how close it is to closing, and the districts their kept encounters have charted.
 * Three hairline rows, no forge: nothing here is bought, only earned or owed.
 */
export function StandingCard({ gemTier, style }: { gemTier: GemTier; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const { data } = useStanding();
  if (!data) return null;

  const seats = data.partySeats ?? 0;
  const used = Math.min(data.partyUsed ?? 0, seats);
  const scars = data.openScars ?? 0;

  return (
    <AppCard tier={gemTier} style={style}>
      <CardEyebrow>{i18n.t('standing_title')}</CardEyebrow>

      {data.partyEnabled && (
        <Tap onPress={() => goTo(router, '/(tabs)/matches')} accessibilityRole="button"
          accessibilityLabel={i18n.t('party_seats', { used, seats })}>
          <View style={styles.row}>
            <Text style={styles.label}>{i18n.t('party_label')}</Text>
            <View style={styles.pips} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {Array.from({ length: seats }).map((_, i) => (
                <View key={i} style={[styles.pip, i < used && styles.pipFilled]} />
              ))}
            </View>
          </View>
          <Text style={styles.sub}>{i18n.t('party_seats', { used, seats })}</Text>
        </Tap>
      )}

      <SectionDivider />
      <View style={styles.row}>
        <Text style={styles.label}>{i18n.t('scars_label')}</Text>
        {scars > 0 && <Icon name="bandage" size={ICON_SIZES.sm} color={METAL.ember} />}
      </View>
      <Text style={[styles.sub, scars > 0 && styles.ember]}>
        {scars > 0
          ? i18n.t('scars_open', { scars, held: data.scarHealProgress ?? 0, needed: data.scarHealNeeded ?? 0 })
          : i18n.t('scars_none')}
      </Text>

      <SectionDivider />
      <Tap onPress={() => router.push('/date-log')} accessibilityRole="button">
        <View style={styles.row}>
          <Text style={styles.label}>{i18n.t('waypoints_label')}</Text>
          <Icon name="map-legend" size={ICON_SIZES.sm} color={ACCENT.base} />
        </View>
        <Text style={styles.sub}>
          {i18n.t('waypoints_charted', { charted: data.districtsCharted ?? 0, needed: data.cartographerNeeded ?? 0 })}
        </Text>
      </Tap>

      {data.retiredAt && (
        <>
          <SectionDivider />
          <Text style={[styles.sub, styles.gold]}>{i18n.t('retired_standing')}</Text>
        </>
      )}
    </AppCard>
  );
}

const PIP = 10;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  label: { fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.md, lineHeight: LEADING.md, color: INK.primary },
  sub: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, lineHeight: LEADING.sm, color: INK.dim, marginTop: SPACE.hair },
  ember: { color: METAL.ember },
  gold: { color: ACCENT.base },
  pips: { flexDirection: 'row', gap: SPACE.xs, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1 },
  pip: { width: PIP, height: PIP, borderRadius: PIP / 2, borderWidth: 1, borderColor: LINE.edge },
  pipFilled: { backgroundColor: ACCENT.base, borderColor: ACCENT.base },
});
