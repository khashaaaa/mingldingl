import { useEffect, useRef, useState } from 'react';
import { Animated, TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { colorForTier } from '../../lib/tiers';
import { useRevealLadder } from '../../hooks/useRevealThresholds';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE, RADIUS, SPACE, circle } from '../../lib/theme';
import { Icon } from '../ui/Icon';
import OathSigil from '../OathSigil';
import type { Match } from '../../models/match';

interface Props {
  match: Match;
  onPress: () => void;
}

type StatusIconName = React.ComponentProps<typeof Icon>['name'];

/**
 * A conversation counts as under way once it has earned its second reveal rung — the live ladder
 * rather than a literal 5, which drifted the moment `reveal.level2.messages` was tuned.
 */
function questStatus(match: Match, underwayAt: number): { icon: StatusIconName; label: string; color: string } {
  if (!match.icebreakerComplete) return { icon: 'lock', label: i18n.t('quest_new'), color: COLORS.gold };
  if (match.messageCount < underwayAt) return { icon: 'sword-cross', label: i18n.t('quest_in_progress'), color: COLORS.brass };
  return { icon: 'fire', label: i18n.t('quest_active'), color: COLORS.goldBright };
}

export function QuestTile({ match, onPress }: Props) {
  const { otherUser, revealLevel } = match;
  const blurred = revealLevel < 2;

  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photo = otherUser.firstPhoto;
  const showPhoto = photo && photo !== failedUrl;
  const tier = (otherUser as any).gemTier ?? 'Garnet';
  const tierColor = colorForTier(tier);
  const ladder = useRevealLadder();
  const status = questStatus(match, ladder[1] ?? 5);

  const wasBlurred = useRef(blurred);
  const reveal = useRef(new Animated.Value(blurred ? 0 : 1)).current;
  useEffect(() => {
    if (wasBlurred.current && !blurred) {
      Animated.timing(reveal, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
    wasBlurred.current = blurred;
  }, [blurred, reveal]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={styles.row}>
        <View style={[styles.runeStrip, { backgroundColor: status.color + '22', borderColor: status.color + '66' }]}>
          <View style={[styles.runeCorner, styles.runeCornerTl, { borderColor: status.color }]} />
          <View style={[styles.runeCorner, styles.runeCornerBr, { borderColor: status.color }]} />
          <Icon name={status.icon} size={ICON_SIZES.md} color={status.color} />
        </View>
        <View style={[styles.avatarRing, { borderColor: tierColor + '80' }]}>
          {showPhoto ? (
            <>
              <Image
                source={{ uri: photo }}
                style={styles.avatar}
                blurRadius={18}
                onError={() => setFailedUrl(photo)}
              />
              <Animated.Image
                source={{ uri: photo }}
                style={[styles.avatar, styles.avatarSharpOverlay, { opacity: reveal }]}
                blurRadius={0}
              />
            </>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="account" size={ICON_SIZES.xl} color={COLORS.textDim} />
            </View>
          )}
        </View>
        <View style={styles.info}>
          {blurred ? (
            <Text style={styles.name} numberOfLines={1}>{i18n.t('mystery_match_name')}</Text>
          ) : (
            <Animated.Text
              style={[
                styles.name,
                { opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] },
              ]}
              numberOfLines={1}
            >
              {otherUser.isDeleted ? i18n.t('deleted_user') : (otherUser.displayName ?? i18n.t('unknown_name'))}
            </Animated.Text>
          )}
          <OathSigil oath={otherUser.oath ?? null} proven={otherUser.oathProven ?? false} size="sm" />
          <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: LINE.edge,
    padding: SPACE.md,
    marginBottom: SPACE.md,
    overflow: 'hidden',
  },
  runeStrip: {
    // Sized to the avatar beside it rather than stretched to the card: a card with an Oath sigil
    // is taller than one without, and `stretch` made the same tablet two different heights down
    // a single list.
    alignSelf: 'center',
    width: 30,
    height: 56,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  runeCorner: { position: 'absolute', width: 7, height: 7 },
  runeCornerTl: { top: 2, left: 2, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  runeCornerBr: { bottom: 2, right: 2, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  avatarRing: { ...circle(56), borderWidth: 2, overflow: 'hidden' },
  avatar: circle(52),
  avatarSharpOverlay: { position: 'absolute', top: 0, left: 0 },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: SPACE.xs },
  name: { fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.lg, color: COLORS.text },
  status: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md },
});
