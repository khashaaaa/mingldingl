import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SheetModal } from '../modals/SheetModal';
import { CardEyebrow } from '../ui/CardEyebrow';
import { GameButton } from '../ui/GameButton';
import { Glyph } from '../ui/Glyph';
import OathSigil from '../OathSigil';
import { i18n } from '../../lib/i18n';
import { deepRevealLevel, nextRevealThreshold } from '../../lib/reveal';
import { useRevealLadder } from '../../hooks/useRevealThresholds';
import { sealsBroken } from './SealDots';
import { FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, METAL, RADIUS, SPACE, SURFACE } from '../../lib/theme';
import type { DeepFields, PartialUser } from '../../models/match';

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
  visible: boolean;
  onClose: () => void;
  otherUser: PartialUser;
  /** The engine's mutual count (see `Match.messageCount`), so the countdown matches the gate. */
  messageCount: number;
  /** The engine's effective level for this match; the last rung is the deep-profile one. */
  revealLevel: number;
}

const PHOTO = 48;

/**
 * The Seals board: the reveal ladder as three wax seals, opened from the chat header's `SealDots`.
 * Everything below the eyebrow is `RevealStrip`'s old chip-building logic moved verbatim, with the
 * copy changed to the seal vocabulary — see Task 5's brief.
 */
export function SealsSheet({ visible, onClose, otherUser, messageCount, revealLevel }: Props) {
  const revealLadder = useRevealLadder();
  const router = useRouter();
  const broken = sealsBroken(revealLevel);
  // Only as many slots as they actually have. A wax seal on a photo that does not exist reads as
  // "keep talking and this opens", and it never does.
  const allSlots = [otherUser.firstPhoto, otherUser.secondPhoto, otherUser.thirdPhoto];
  const slotCount = Math.min(otherUser.photoCount ?? allSlots.length, allSlots.length);
  const photos = allSlots.slice(0, Math.max(slotCount, 1));
  const nextAt = nextRevealThreshold(messageCount, revealLadder);
  // The engine hands out deep fields at the top rung *and* only to Silver/Gold. Once the
  // conversation has earned that rung, an absent `deep` can only be the membership gate — showing
  // it under the same wax as an unearned field reads as a bug rather than as a paywall.
  const deepGatedByMembership =
    revealLevel != null && revealLevel >= deepRevealLevel(revealLadder) && !otherUser.deep;
  const chips: Chip[] = [
    { key: 'age', label: i18n.t('reveal_age'), value: otherUser.age != null ? i18n.t('age_winters', { age: otherUser.age }) : null },
    { key: 'district', label: i18n.t('reveal_district'), value: otherUser.district ?? null },
    ...(otherUser.deep || deepGatedByMembership
      ? deepChips(otherUser.deep)
      : [{ key: 'deep', label: i18n.t('reveal_deep_profile'), value: null }]),
  ];

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <CardEyebrow>{i18n.t(`seals_broken_${broken}`)}</CardEyebrow>
      <Text style={styles.next}>
        {nextAt !== null ? i18n.t('seals_next_at', { count: nextAt }) : i18n.t('seals_left_0')}
      </Text>
      <View style={styles.row}>
        {photos.map((uri, i) => (
          uri ? (
            <Image key={i} source={{ uri }} style={styles.photo} contentFit="cover" testID={`seal-photo-${i}`} />
          ) : (
            <View
              key={i}
              style={[styles.photo, styles.wax]}
              accessibilityLabel={i18n.t('seal_under_wax')}
              testID={`seal-photo-wax-${i}`}
            >
              <Glyph name="seal" size={ICON_SIZES.sm} />
            </View>
          )
        ))}
        <View style={styles.chips}>
          {chips.map((c) => (
            c.value === null ? (
              <View key={c.key} style={[styles.chip, styles.chipLocked]} accessibilityLabel={i18n.t('seal_under_wax')}>
                <Glyph name="seal" size={ICON_SIZES.xs} />
                <Text style={styles.chipTextLocked} numberOfLines={1}>{c.label}</Text>
              </View>
            ) : (
              <View key={c.key} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {c.key === 'age' ? c.value : `${c.label}: ${c.value}`}
                </Text>
              </View>
            )
          ))}
        </View>
      </View>
      {!!otherUser.oath && <OathSigil oath={otherUser.oath} proven={!!otherUser.oathProven} size="sm" />}
      {deepGatedByMembership && (
        <View style={styles.climbRow} testID="seals-climb">
          <Text style={styles.law}>{i18n.t('seals_deep_membership')}</Text>
          <GameButton
            variant="ink"
            size="compact"
            onPress={() => { onClose(); router.push('/membership'); }}
          >
            {i18n.t('seals_climb')}
          </GameButton>
        </View>
      )}
      <Text style={styles.law}>{i18n.t('seals_law')}</Text>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  next: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.dim },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: METAL.brass,
    backgroundColor: SURFACE.raised,
  },
  wax: { borderColor: LINE.edge, alignItems: 'center', justifyContent: 'center' },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.hair,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: METAL.brass,
    backgroundColor: SURFACE.raised,
    maxWidth: '100%',
  },
  chipLocked: { borderColor: LINE.edge },
  chipText: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.primary, flexShrink: 1 },
  chipTextLocked: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.dim, flexShrink: 1 },
  climbRow: { gap: SPACE.sm },
  // The law is italic: this is the app speaking, not either person in the thread.
  law: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, color: INK.dim },
});
