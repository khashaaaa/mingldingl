import { useInfiniteQuery } from '@tanstack/react-query';
import { getLetters } from '@/lib/api/generated/engine';
import type { LetterView } from '@/lib/api/generated/model';
import { lettersKey } from '@/lib/live/events';

/** A bond's letters, newest first, paged back in time. `letter.created` refetches the first page. */
export function useLetters(bondId: string) {
  const q = useInfiniteQuery({
    queryKey: lettersKey(bondId),
    queryFn: ({ pageParam }) =>
      getLetters(bondId, pageParam ? { before: pageParam, limit: 50 } : { limit: 50 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore ?? null,
    // A long bond keeps only the pages read; the cache never grows past this.
    maxPages: 20,
  });
  const letters: LetterView[] = q.data?.pages.flatMap((p) => p.items) ?? [];
  return { letters, loaded: q.isSuccess, more: q.hasNextPage ? () => q.fetchNextPage() : undefined };
}
