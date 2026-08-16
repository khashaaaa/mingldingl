import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { parseMembershipTier, parseMembershipMe } from '../models/membership';
import { queryKeys } from '../lib/api/queryKeys';

export function useMembership() {
  const qc = useQueryClient();

  const { data: me, isLoading } = useQuery({
    queryKey: queryKeys.membership,
    queryFn: async () => parseMembershipMe(await apiClient.membership.me()),
  });

  // Static reference data (pricing/feature flags per tier) — long staleTime
  // since this only changes when the engine's Tiers list does, not per user.
  const { data: tiersData, isLoading: tiersLoading } = useQuery({
    queryKey: queryKeys.membershipTiers,
    queryFn: () => apiClient.membership.tiers(),
    staleTime: 1000 * 60 * 60,
  });
  const tiers = (tiersData ?? []).map(parseMembershipTier);

  const upgrade = useMutation({
    mutationFn: ({ level, durationMonths }: { level: string; durationMonths: number }) =>
      apiClient.membership.upgrade(level, durationMonths),
    onSuccess: (res) => qc.setQueryData(queryKeys.membership, parseMembershipMe(res)),
  });

  return {
    currentLevel: me?.level,
    expiresAt: me?.expiresAt ?? null,
    isLoading,
    tiers,
    tiersLoading,
    upgrade: (level: string, durationMonths: number) => upgrade.mutate({ level, durationMonths }),
    isUpgrading: upgrade.isPending,
    upgradeError: upgrade.isError,
  };
}
