import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCampaign } from '../../hooks/useCampaign';
import type { CampaignRoom } from '../../hooks/useCampaign';
import { useAuthStore } from '../../store/authStore';
import { GameButton } from '../../components/ui/GameButton';
import { Icon } from '../../components/ui/Icon';
import { Tap } from '../../components/ui/Tap';
import { HeaderBar } from '../../components/ui/HeaderBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { i18n } from '../../lib/i18n';
import { signal } from '../../lib/world/feedback';
import { useLocaleStore } from '../../store/localeStore';
import { toDroppedItem } from '../../lib/tiers';
import { romanNumeral } from '../../lib/numerals';
import { PRESS, ACCENT, FONTS, FONT_SIZES, HEAT, ICON_SIZES, INK, LINE, METAL, RADIUS, SPACE, TRACKING, circle } from '../../lib/theme';
import { StateBlock } from '../../components/ui/StateBlock';
import { ORNAMENTS } from '../../lib/ornaments';
import { useScrollTail } from '../../hooks/useScrollTail';

const BOSS_ROOM_ID = 'threshold';

export default function CampaignScreen() {
  const tail = useScrollTail();
  useLocaleStore((s) => s.locale);
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const setPendingDrop = useAuthStore((s) => s.setPendingDrop);
  const {
    campaign, isLoading, unavailable, error,
    claimRoom, isClaiming, claimingRoomId,
  } = useCampaign(matchId);

  const currentRoomId = campaign?.rooms.find((r) => !r.cleared)?.roomId ?? null;
  const voicesMessageThreshold = campaign?.voicesMessageThreshold ?? 15;

  const onClaim = (roomId: string) =>
    claimRoom(roomId, {
      onSuccess: (data) => {
        if (roomId === BOSS_ROOM_ID) signal('sealBreak');
        const item = toDroppedItem(data.droppedItem);
        if (item) setPendingDrop(item);
      },
    });

  const onHintPress = (roomId: string) => {
    switch (roomId) {
      case 'echoes': router.push(`/icebreaker/${matchId}`); break;
      case 'runes': router.push(`/quiz/${matchId}`); break;
      case 'bridge':
      case 'threshold': router.push(`/activities/${matchId}`); break;
      // 'voices' and 'flame' both live in the chat (messages, FlameRiteCard).
      default: router.back();
    }
  };

  // The forge rule is one slab per screen: of every claimable room, only the first in list order
  // gets `primary`; every later one is `ink`. The boss used to get its own `danger` slab, but a
  // dragon's spoils are claimed the same way any other room's are — the rule doesn't carve out
  // an exception for it.
  const firstClaimableRoomId = campaign?.rooms.find((r) => r.cleared && !r.claimed)?.roomId ?? null;

  const renderRoom = (room: CampaignRoom, index: number, rooms: CampaignRoom[]) => {
    const isBoss = room.roomId === BOSS_ROOM_ID;
    const isCurrent = room.roomId === currentRoomId;
    const roomTint = isBoss ? METAL.ember : METAL.gold;
    const dimmed = !room.cleared && !isCurrent;
    const numeral = romanNumeral(index + 1);
    const name = i18n.t(`campaign_room_${room.roomId}`);
    const locked = !room.cleared && !isCurrent;

    let stateText: string;
    let stateNode: React.ReactNode;
    if (room.cleared && room.claimed) {
      stateText = i18n.t('campaign_claimed');
      stateNode = (
        <View style={styles.statusRow}>
          <Icon name="check-decagram" size={ICON_SIZES.sm} color={INK.dim} />
          <Text style={styles.statusText}>{stateText}</Text>
        </View>
      );
    } else if (room.cleared) {
      stateText = `${i18n.t('campaign_claim')} +${room.bonusScore}`;
      stateNode = (
        <GameButton
          variant={room.roomId === firstClaimableRoomId ? 'primary' : 'ink'}
          size="compact"
          icon="treasure-chest"
          loading={isClaiming && claimingRoomId === room.roomId}
          disabled={isClaiming}
          onPress={() => onClaim(room.roomId)}
          style={styles.claimButton}
          accessibilityLabel={`${numeral}. ${name}. ${stateText}`}
        >
          {stateText}
        </GameButton>
      );
    } else if (isCurrent) {
      stateText = i18n.t(`campaign_hint_${room.roomId}`, { count: voicesMessageThreshold });
      stateNode = (
        <Tap
          onPress={() => onHintPress(room.roomId)}
          accessibilityRole="button"
          accessibilityLabel={`${numeral}. ${name}. ${stateText}`}
        >
          <Text style={styles.hintText}>{stateText}</Text>
        </Tap>
      );
    } else if (isBoss) {
      // The dragon carries its own locked line instead of the ' · sealed' suffix — the other
      // six rooms are sealed doors, this one is a sleeping threat.
      stateText = i18n.t('campaign_dragon_sleeps');
      stateNode = <Text style={styles.dragonText}>{stateText}</Text>;
    } else {
      stateText = i18n.t('campaign_room_sealed');
      stateNode = null;
    }

    const rowLabel = `${numeral}. ${name}. ${stateText}`;
    // Non-interactive states get one consolidated a11y node (see app/leaderboard.tsx's row);
    // the claim button and the current-room hint already carry the same label themselves.
    const consolidate = locked || (room.cleared && room.claimed);

    return (
      <View key={room.roomId} style={styles.roomRow}>
        <View style={styles.pathColumn}>
          <View style={[styles.medallion, isCurrent && styles.medallionCurrent]}>
            <Image
              testID={`room-knot-${room.roomId}`}
              source={isBoss ? ORNAMENTS.knotBossEmber : room.cleared || isCurrent ? ORNAMENTS.knotGold : ORNAMENTS.knotDim}
              style={isBoss ? styles.bossKnot : styles.roomKnot}
              accessible={false}
              importantForAccessibility="no"
            />
          </View>
          {index < rooms.length - 1 && <View style={styles.pathLine} />}
        </View>

        <View
          style={[styles.roomBody, dimmed && styles.roomBodyDimmed]}
          {...(consolidate ? { accessible: true, accessibilityLabel: rowLabel } : null)}
        >
          <View style={styles.roomTitleRow}>
            <Text style={styles.numeral}>{numeral}</Text>
            <Text style={[styles.roomName, { color: room.cleared || isCurrent ? roomTint : INK.dim }]}>
              {name}
              {locked && !isBoss && (
                <Text style={styles.sealedSuffix}>{` · ${i18n.t('campaign_room_sealed')}`}</Text>
              )}
            </Text>
            {isBoss && (
              <View style={styles.bossChip}>
                <Text style={styles.bossChipText}>{i18n.t('campaign_boss_label')}</Text>
              </View>
            )}
          </View>

          {stateNode}
        </View>
      </View>
    );
  };

  return (
    // This route sits in the `deep` room (lib/world/rooms.ts), which already carries
    // `vfx: 'fog'` — WorldCanopy drifts it in behind the navigator on every screen in that room.
    // No FogDrift is mounted here; adding one would double the haze this screen already stands in.
    <View style={styles.screen}>
      <HeaderBar title={i18n.t('campaign_title')} />

      {isLoading ? (
        <View style={styles.scrollContent}>
          <Skeleton width="100%" height={240} radius={RADIUS.md} />
        </View>
      ) : unavailable ? (
        <StateBlock icon="door-closed-lock" title={i18n.t('campaign_unavailable')} />
      ) : error || !campaign ? (
        <StateBlock tone="danger" icon="alert-circle-outline" title={i18n.t('campaign_load_error')} />
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tail }]}>
          <Text style={styles.sub}>{i18n.t('campaign_sub')}</Text>
          <Text style={styles.progress}>
            {i18n.t('campaign_progress', { cleared: campaign.clearedCount, total: campaign.rooms.length })}
          </Text>
          {campaign.bossCleared && (
            <Text style={styles.completeText}>{i18n.t('campaign_complete')}</Text>
          )}
          {/* cave frame and dragon: illustrator's job (CampaignCave board); placement is this column */}
          <View style={styles.map}>
            {campaign.rooms.map((room, index) => renderRoom(room, index, campaign.rooms))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.md, padding: SPACE.xxl },
  scrollContent: { padding: SPACE.lg, paddingBottom: SPACE.scrollTail },
  sub: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.md,
    color: INK.dim,
    textAlign: 'center',
    marginBottom: SPACE.sm,
  },
  progress: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.lg,
    color: ACCENT.bright,
    textAlign: 'center',
    marginBottom: SPACE.xs,
  },
  completeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: FONT_SIZES.md,
    color: HEAT.flame,
    textAlign: 'center',
    marginBottom: SPACE.xs,
  },
  map: { marginTop: SPACE.md },
  roomRow: { flexDirection: 'row', alignItems: 'stretch' },
  pathColumn: { alignItems: 'center', width: 48 },
  medallion: {
    ...circle(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionCurrent: {
    shadowColor: ACCENT.bright,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  roomKnot: { width: 38, height: 38 },
  bossKnot: { width: 44, height: 44 },
  pathLine: { flex: 1, width: 2, backgroundColor: LINE.edge, marginVertical: SPACE.xs, minHeight: 16 },
  roomBody: {
    flex: 1,
    paddingLeft: SPACE.sm,
    paddingBottom: SPACE.xl,
  },
  roomBodyDimmed: { opacity: PRESS.dimmed },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 40 },
  numeral: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: INK.dim },
  roomName: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, flexShrink: 1 },
  sealedSuffix: { color: INK.muted },
  hintText: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.md, color: INK.dim, marginTop: SPACE.hair },
  dragonText: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.md, color: INK.dim, marginTop: SPACE.hair },
  bossChip: {
    borderWidth: 1,
    borderColor: METAL.ember,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.hair,
  },
  bossChipText: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.xs, letterSpacing: TRACKING.wide, color: HEAT.flame },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.hair },
  statusText: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.sm, letterSpacing: TRACKING.wide, color: INK.dim },
  claimButton: { alignSelf: 'flex-start', marginTop: SPACE.xs },
});
