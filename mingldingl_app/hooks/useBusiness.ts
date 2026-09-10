import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export interface Business {
  id: string;
  name: string;
  category: string;
  district: string;
  description: string;
  photoUrl: string | null;
  operatingHours: string;
  averageRating: number;
  ratingCount: number;
}

/**
 * The venue behind a detail screen. The Mission Board already carries every field in its
 * navigation params, so this exists for the ways that screen is reached *without* them — a deep
 * link, a shared URL, a browser reload, a restored session. Those used to render an empty header
 * over an empty photo band, because the screen read the params and never asked the engine.
 */
export function useBusiness(businessId: string) {
  const { data: business, isLoading, isError } = useQuery<Business>({
    queryKey: queryKeys.business(businessId),
    queryFn: async () => {
      const b = await apiClient.business.get(businessId);
      return {
        id: b.id ?? businessId,
        name: b.name ?? '',
        category: b.category ?? '',
        district: b.district ?? '',
        description: b.description ?? '',
        photoUrl: b.photoUrls?.[0] ?? null,
        operatingHours: b.operatingHours ?? '',
        averageRating: b.averageRating ?? 0,
        ratingCount: b.ratingCount ?? 0,
      };
    },
    enabled: !!businessId,
    staleTime: 1000 * 60 * 5,
  });

  return { business, isLoading, isError };
}
