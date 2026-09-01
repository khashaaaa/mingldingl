import { useMutation, useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export interface CampaignRoom {
  roomId: string;
  cleared: boolean;
  claimed: boolean;
  bonusScore: number;
}

export interface Campaign {
  rooms: CampaignRoom[];
  clearedCount: number;
  bossCleared: boolean;
}

export function useCampaign(matchId: string) {
  const { data: campaign = null, isLoading, error } = useQuery<Campaign>({
    queryKey: queryKeys.campaign(matchId),
    queryFn: async () => {
      const res = await apiClient.matches.campaign(matchId);
      return {
        rooms: (res.rooms ?? []).map((r) => ({
          roomId: r.roomId ?? '',
          cleared: r.cleared ?? false,
          claimed: r.claimed ?? false,
          bonusScore: r.bonusScore ?? 0,
        })),
        clearedCount: res.clearedCount ?? 0,
        bossCleared: res.bossCleared ?? false,
      };
    },
    enabled: !!matchId,
    meta: { silentError: true },
  });

  // 404 means the campaign is disabled server-side — an absent feature, not a failure.
  const unavailable = isAxiosError(error) && error.response?.status === 404;

  const claim = useMutation({
    mutationFn: (roomId: string) => apiClient.matches.claimCampaignRoom(matchId, roomId),
    meta: {
      invalidates: [queryKeys.campaign(matchId), queryKeys.scoreDetail, queryKeys.itemsMine],
      awardedSelector: (data) => (data as { awarded?: number }).awarded,
    },
  });

  return {
    campaign,
    isLoading,
    unavailable,
    error: unavailable ? null : (error as Error | null),
    claimRoom: claim.mutate,
    isClaiming: claim.isPending,
    claimingRoomId: claim.isPending ? claim.variables ?? null : null,
    lastClaim: claim.data ?? null,
  };
}
