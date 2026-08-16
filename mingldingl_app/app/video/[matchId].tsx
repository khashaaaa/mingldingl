import { YStack, Text, Spinner } from 'tamagui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useVideoCall } from '../../hooks/useVideoCall';
import { VideoControls } from '../../components/video/VideoControls';
import { AgoraVideoCall } from '../../components/video/AgoraVideoCall';
import { GameButton } from '../../components/ui/GameButton';
import { apiClient } from '../../lib/api/apiClient';
import { useAuthStore } from '../../store/authStore';
import { useOptimisticScoreBump } from '../../hooks/useOptimisticScoreBump';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { queryKeys } from '../../lib/api/queryKeys';
import { COLORS, FONTS } from '../../lib/theme';
import { toDroppedItem } from '../../lib/tiers';

export default function VideoScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const bumpScore = useOptimisticScoreBump();
  const setPendingDrop = useAuthStore((s) => s.setPendingDrop);
  const { token, loading, error, muted, setMuted, cameraOff, setCameraOff } = useVideoCall(matchId);

  async function handleEnd() {
    try {
      const result = await apiClient.video.complete(matchId);
      if ((result.awarded ?? 0) > 0) {
        bumpScore(result.awarded ?? 0);
        // Completion also always calls MilestoneService.AchieveAsync
        // ("first_video_call") — refresh the trophy case/quest board so
        // they don't sit stale until their own staleTime lapses.
        qc.invalidateQueries({ queryKey: queryKeys.quests });
        qc.invalidateQueries({ queryKey: queryKeys.milestones });
      }
      const drop = toDroppedItem(result.droppedItem);
      if (drop) setPendingDrop(drop);
    } catch {
      // Best-effort: don't block leaving the call on a failed award.
    }
    router.back();
  }

  if (loading) return (
    <YStack flex={1} backgroundColor={COLORS.bg} alignItems="center" justifyContent="center">
      <Spinner color={COLORS.gold} />
    </YStack>
  );

  if (error || !token) return (
    <YStack flex={1} backgroundColor={COLORS.bg} alignItems="center" justifyContent="center" gap="$4">
      <Text color={COLORS.text} fontSize={18} textAlign="center" fontFamily={FONTS.body as any}>
        {error ?? i18n.t('video_unavailable')}
      </Text>
      <GameButton variant="primary" onPress={() => router.back()}>
        {i18n.t('back')}
      </GameButton>
    </YStack>
  );

  return (
    <YStack flex={1} backgroundColor={COLORS.bg}>
      <AgoraVideoCall
        token={token}
        muted={muted}
        cameraOff={cameraOff}
        onJoined={() => {}}
        onError={() => router.back()}
      />
      <VideoControls
        muted={muted}
        cameraOff={cameraOff}
        onToggleMute={() => setMuted((m) => !m)}
        onToggleCamera={() => setCameraOff((c) => !c)}
        onEnd={handleEnd}
      />
    </YStack>
  );
}
