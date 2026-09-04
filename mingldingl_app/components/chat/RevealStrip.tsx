import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, RADIUS, SPACE } from '../../lib/theme';
import type { DeepFields, PartialUser } from '../../models/match';
import { CardEyebrow } from '../ui/CardEyebrow';

export const REVEAL_THRESHOLDS = [5, 15, 30] as const;

export function nextRevealThreshold(messageCount: number): number | null {
  return REVEAL_THRESHOLDS.find((t) => messageCount < t) ?? null;
}

interface Chip {
  key: string;
  label: string;
  value: string | null;
}

function deepChips(deep: DeepFields | null | undefined): Chip[] {
  if (!deep) return [];
  const enumLabel = (family: string, value: string | null) => (value ? i18n.t(`${family}_${value.toLowerCase()}`) : null);
  return [
    { key: 'hasKids', label: i18n.t('has_kids'), value: deep.hasKids == null ? null : i18n.t(deep.hasKids ? 'has_kids_yes' : 'has_kids_no') },
    { key: 'smoking', label: i18n.t('smoking_habit'), value: enumLabel('habit', deep.smokingHabit) },
    { key: 'drinking', label: i18n.t('drinking_habit'), value: enumLabel('habit', deep.drinkingHabit) },
    { key: 'religion', label: i18n.t('religion'), value: enumLabel('religion', deep.religion) },
    { key: 'lifestyle', label: i18n.t('lifestyle'), value: enumLabel('lifestyle', deep.lifestyle) },
  ].filter((c) => c.value !== null);
}

interface Props {
  otherUser: PartialUser;
  messageCount: number;
}

export function RevealStrip({ otherUser, messageCount }: Props) {
  const photos = [otherUser.firstPhoto, otherUser.secondPhoto, otherUser.thirdPhoto];
  const chips: Chip[] = [
    { key: 'age', label: i18n.t('reveal_age'), value: otherUser.age != null ? String(otherUser.age) : null },
    { key: 'district', label: i18n.t('reveal_district'), value: otherUser.district ?? null },
    ...(otherUser.deep ? deepChips(otherUser.deep) : [{ key: 'deep', label: i18n.t('reveal_deep_profile'), value: null }]),
  ];
  const nextAt = nextRevealThreshold(messageCount);

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <CardEyebrow style={styles.title}>{i18n.t('reveal_title')}</CardEyebrow>
        <Text style={styles.next}>
          {nextAt !== null ? i18n.t('reveal_next_at', { count: nextAt }) : i18n.t('reveal_complete')}
        </Text>
      </View>
      <View style={styles.row}>
        {photos.map((uri, i) => (
          uri ? (
            <Image key={i} source={{ uri }} style={styles.photo} contentFit="cover" testID={`reveal-photo-${i}`} />
          ) : (
            <View key={i} style={[styles.photo, styles.locked]} accessibilityLabel={i18n.t('reveal_locked')} testID={`reveal-photo-locked-${i}`}>
              <Icon name="lock" size={ICON_SIZES.sm} color={COLORS.textDim} />
            </View>
          )
        ))}
        <View style={styles.chips}>
          {chips.map((c) => (
            <View key={c.key} style={[styles.chip, c.value === null && styles.chipLocked]}>
              {c.value === null && <Icon name="lock" size={ICON_SIZES.xs} color={COLORS.textDim} />}
              <Text style={[styles.chipText, c.value === null && styles.chipTextLocked]} numberOfLines={1}>
                {c.value === null ? c.label : `${c.label}: ${c.value}`}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const PHOTO = 36;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: SPACE.gutter,
    marginBottom: SPACE.sm,
    padding: SPACE.sm,
    gap: SPACE.sm,
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.bronze,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { marginBottom: 0 },
  next: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.gold },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.brass,
    backgroundColor: COLORS.panelRaised,
  },
  locked: { borderColor: COLORS.bronze, alignItems: 'center', justifyContent: 'center' },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.hair,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.brass,
    backgroundColor: COLORS.panelRaised,
    maxWidth: '100%',
  },
  chipLocked: { borderColor: COLORS.bronze },
  chipText: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.text, flexShrink: 1 },
  chipTextLocked: { color: COLORS.textDim },
});
