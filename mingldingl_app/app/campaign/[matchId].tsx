import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Spinner } from 'tamagui';
import { useCampaign } from '../../hooks/useCampaign';
import type { CampaignRoom } from '../../hooks/useCampaign';
import { useAuthStore } from '../../store/authStore';
import { GameButton } from '../../components/ui/GameButton';
import { Icon } from '../../components/ui/Icon';
import { QuestBanner } from '../../components/quest/QuestBanner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { toDroppedItem } from '../../lib/tiers';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';
import { ORNAMENTS } from '../../lib/ornaments';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

const VOICES_MESSAGE_THRESHOLD = 15;

type IconName = React.ComponentProps<typeof Icon>['name'];

const ROOM_ICONS: Record<string, IconName> = {
  gate: 'castle',
  echoes: 'target',
  runes: 'brain',
  voices: 'message-text',
  flame: 'fire',
  bridge: 'map-marker',
  threshold: 'sword-cross',
};

const BOSS_ROOM_ID = 'threshold';

export default function CampaignScreen() {
  useLocaleStore((s) => s.locale);
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const setPendingDrop = useAuthStore((s) => s.setPendingDrop);
  const {
    campaign, isLoading, unavailable, error,
    claimRoom, isClaiming, claimingRoomId,
  } = useCampaign(matchId);

  const currentRoomId = campaign?.rooms.find((r) => !r.cleared)?.roomId ?? null;

  const onClaim = (roomId: string) =>
    claimRoom(roomId, {
      onSuccess: (data) => {
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

  const renderRoom = (room: CampaignRoom, index: number, rooms: CampaignRoom[]) => {
    const isBoss = room.roomId === BOSS_ROOM_ID;
    const isCurrent = room.roomId === currentRoomId;
    const roomTint = isBoss ? COLORS.ember : COLORS.gold;
    const dimmed = !room.cleared && !isCurrent;

    return (
      <View key={room.roomId} style={styles.roomRow}>
        <View style={styles.pathColumn}>
          <View style={[styles.medallion, isCurrent && styles.medallionCurrent]}>
            <Image
              testID={`room-knot-${room.roomId}`}
              source={isBoss ? ORNAMENTS.knotBossEmber : room.cleared || isCurrent ? ORNAMENTS.knotGold : ORNAMENTS.knotDim}
              style={isBoss ? styles.bossKnot : styles.roomKnot}
            />
          </View>
          {index < rooms.length - 1 && <View style={styles.pathLine} />}
        </View>

        <View style={[styles.roomBody, dimmed && styles.roomBodyDimmed]}>
          <View style={styles.roomTitleRow}>
            <Text style={[styles.roomName, { color: room.cleared || isCurrent ? roomTint : COLORS.textDim }]}>
              {i18n.t(`campaign_room_${room.roomId}`)}
            </Text>
            {isBoss && (
              <View style={styles.bossChip}>
                <Text style={styles.bossChipText}>{i18n.t('campaign_boss_label')}</Text>
              </View>
            )}
          </View>

          {room.cleared ? (
            room.claimed ? (
              <View style={styles.statusRow}>
                <Icon name="check-decagram" size={14} color={COLORS.textDim} />
                <Text style={styles.statusText}>{i18n.t('campaign_claimed')}</Text>
              </View>
            ) : (
              <GameButton
                variant={isBoss ? 'danger' : 'brass'}
                size="compact"
                icon="treasure-chest"
                loading={isClaiming && claimingRoomId === room.roomId}
                disabled={isClaiming}
                onPress={() => onClaim(room.roomId)}
                style={styles.claimButton}
              >
                {`${i18n.t('campaign_claim')}  +${room.bonusScore}`}
              </GameButton>
            )
          ) : isCurrent ? (
            <QuestBanner
              icon={ROOM_ICONS[room.roomId] ?? 'help'}
              tint={roomTint}
              title={i18n.t(`campaign_hint_${room.roomId}`, { count: VOICES_MESSAGE_THRESHOLD })}
              onPress={() => onHintPress(room.roomId)}
            />
          ) : (
            <View style={styles.statusRow}>
              <Icon name="lock" size={14} color={COLORS.textDim} />
              <Text style={styles.statusText}>{i18n.t('campaign_room_sealed')}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ScreenHeader title={i18n.t('campaign_title')} />

      {isLoading ? (
        <View style={styles.centered}>
          <Spinner color="$gold" />
        </View>
      ) : unavailable ? (
        <View style={styles.centered}>
          <Icon name="door-closed-lock" size={40} color={COLORS.textDim} />
          <Text style={styles.emptyText}>{i18n.t('campaign_unavailable')}</Text>
        </View>
      ) : error || !campaign ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{i18n.t('campaign_load_error')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.progress}>
            {i18n.t('campaign_progress', { cleared: campaign.clearedCount, total: campaign.rooms.length })}
          </Text>
          {campaign.bossCleared && (
            <Text style={styles.completeText}>{i18n.t('campaign_complete')}</Text>
          )}
          <View style={styles.map}>
            {campaign.rooms.map((room, index) => renderRoom(room, index, campaign.rooms))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textDim,
    textAlign: 'center',
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  progress: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: COLORS.goldBright,
    textAlign: 'center',
    marginBottom: 4,
  },
  completeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.emberLight,
    textAlign: 'center',
    marginBottom: 4,
  },
  map: { marginTop: 12 },
  roomRow: { flexDirection: 'row', alignItems: 'stretch' },
  pathColumn: { alignItems: 'center', width: 48 },
  medallion: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionCurrent: {
    shadowColor: COLORS.goldBright,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  roomKnot: { width: 38, height: 38 },
  bossKnot: { width: 44, height: 44 },
  pathLine: { flex: 1, width: 2, backgroundColor: COLORS.bronze, marginVertical: 4, minHeight: 16 },
  roomBody: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 20,
  },
  roomBodyDimmed: { opacity: 0.55 },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  roomName: { fontFamily: FONTS.display, fontSize: 16, flexShrink: 1 },
  bossChip: {
    borderWidth: 1,
    borderColor: COLORS.ember,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  bossChipText: { fontFamily: FONTS.utility, fontSize: 10, letterSpacing: 1, color: COLORS.emberLight },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusText: { fontFamily: FONTS.utility, fontSize: 12, letterSpacing: 1, color: COLORS.textDim },
  claimButton: { alignSelf: 'flex-start', marginTop: 4 },
});
