import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE, RADIUS, SPACE } from '../../lib/theme';
import type { DeepFields, PartialUser } from '../../models/match';
import { CardEyebrow } from '../ui/CardEyebrow';
import { deepRevealLevel, nextRevealThreshold } from '../../lib/reveal';
import { useRevealLadder } from '../../hooks/useRevealThresholds';

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
  /** The engine's effective level for this match; the last rung is the deep-profile one. */
  revealLevel?: number;
  /**
   * Chat opens this collapsed: the strip plus four action banners pushed the conversation itself off
   * the first screen. The progress line — the part that motivates — stays visible either way.
   */
  defaultExpanded?: boolean;
}

export function RevealStrip({ otherUser, messageCount, revealLevel, defaultExpanded = true }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const revealLadder = useRevealLadder();
  const router = useRouter();
  // Only as many slots as they actually have. A padlock on a photo that does not exist reads as
  // "keep talking and this opens", and it never does.
  const allSlots = [otherUser.firstPhoto, otherUser.secondPhoto, otherUser.thirdPhoto];
  const slotCount = Math.min(otherUser.photoCount ?? allSlots.length, allSlots.length);
  const photos = allSlots.slice(0, Math.max(slotCount, 1));
  const nextAt = nextRevealThreshold(messageCount, revealLadder);
  const photosShown = photos.filter(Boolean).length;
  // The engine hands out deep fields at the top rung *and* only to Silver/Gold. Once the
  // conversation has earned that rung, an absent `deep` can only be the membership gate — showing
  // it under the same padlock as an unearned field reads as a bug rather than as a paywall.
  const deepGatedByMembership =
    revealLevel != null && revealLevel >= deepRevealLevel(revealLadder) && !otherUser.deep;
  const chips: Chip[] = [
    { key: 'age', label: i18n.t('reveal_age'), value: otherUser.age != null ? String(otherUser.age) : null },
    { key: 'district', label: i18n.t('reveal_district'), value: otherUser.district ?? null },
    ...(otherUser.deep || deepGatedByMembership
      ? deepChips(otherUser.deep)
      : [{ key: 'deep', label: i18n.t('reveal_deep_profile'), value: null }]),
  ];

  const progress = nextAt !== null
    ? i18n.t('reveal_next_at', { count: nextAt })
    : i18n.t('reveal_complete');

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={i18n.t('reveal_title')}
        style={styles.titleRow}
        testID="reveal-toggle"
      >
        {expanded
          ? <CardEyebrow style={styles.title}>{i18n.t('reveal_title')}</CardEyebrow>
          : <Text style={styles.summary}>{i18n.t('reveal_summary', { shown: photosShown, total: photos.length })}</Text>}
        <View style={styles.progressRow}>
          <Text style={styles.next}>{progress}</Text>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={ICON_SIZES.sm} color={COLORS.textDim} />
        </View>
      </Pressable>
      {!expanded ? null : (
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
          {deepGatedByMembership && (
            <Pressable
              onPress={() => router.push('/membership')}
              accessibilityRole="button"
              style={[styles.chip, styles.chipUpgrade]}
              testID="reveal-deep-upgrade"
            >
              <Icon name="crown" size={ICON_SIZES.xs} color={COLORS.gold} />
              <Text style={[styles.chipText, styles.chipTextUpgrade]} numberOfLines={1}>
                {i18n.t('reveal_deep_membership')}
              </Text>
            </Pressable>
          )}
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
      )}
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
    borderColor: LINE.edge,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACE.sm },
  title: { marginBottom: 0 },
  summary: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.sm, color: COLORS.text, flexShrink: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
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
  locked: { borderColor: LINE.edge, alignItems: 'center', justifyContent: 'center' },
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
  chipLocked: { borderColor: LINE.edge },
  chipUpgrade: { borderColor: COLORS.gold },
  chipTextUpgrade: { color: COLORS.gold },
  chipText: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.text, flexShrink: 1 },
  chipTextLocked: { color: COLORS.textDim },
});
