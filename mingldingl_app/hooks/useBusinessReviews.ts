import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export interface BusinessReview {
  stars: number;
  review: string | null;
  photoUrl: string | null;
  createdAt: string;
}

// Anonymous by design, matching the engine response — no reviewer identity,
// just what a date at this business was actually like.
export function useBusinessReviews(businessId: string) {
  const { data: reviews, isLoading } = useQuery<BusinessReview[]>({
    queryKey: queryKeys.businessReviews(businessId),
    queryFn: async () => {
      const res = await apiClient.business.reviews(businessId);
      return res.map((r) => ({
        stars: r.stars ?? 0,
        review: r.review ?? null,
        photoUrl: r.photoUrl ?? null,
        createdAt: r.createdAt ?? '',
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  return { reviews, isLoading };
}
