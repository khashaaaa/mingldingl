import { QueryObserver } from '@tanstack/react-query';
import { queryClient } from '../query';
import { signIn, signOutLocally } from '../session';

test('no refetch triggers and a bounded cache', () => {
  const q = queryClient.getDefaultOptions().queries ?? {};
  expect(q.staleTime).toBe(Number.POSITIVE_INFINITY);
  expect(q.gcTime).toBe(300_000);
  expect(q.refetchOnWindowFocus).toBe(false);
  expect(q.refetchOnReconnect).toBe(false);
  expect(q.refetchInterval).toBeUndefined();
});

test('a screen that remounts refetches only what a live event invalidated while it was away', async () => {
  let fetches = 0;
  const queryFn = jest.fn(async () => ++fetches);
  const watch = async () => {
    const observer = new QueryObserver(queryClient, { queryKey: ['/remount'], queryFn });
    const stop = observer.subscribe(() => {});
    await new Promise((r) => setTimeout(r, 0));
    stop();
  };

  await watch();
  await watch();
  expect(queryFn).toHaveBeenCalledTimes(1);

  await queryClient.invalidateQueries({ queryKey: ['/remount'], exact: true });
  expect(queryFn).toHaveBeenCalledTimes(1);
  await watch();
  expect(queryFn).toHaveBeenCalledTimes(2);
  queryClient.removeQueries({ queryKey: ['/remount'] });
});

test('signing out clears the cache', async () => {
  await signIn({
    accessToken: 'a',
    accessExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshToken: 'r',
    accountId: 'x',
  });
  queryClient.setQueryData(['/me'], { name: 'x' });
  await signOutLocally();
  expect(queryClient.getQueryData(['/me'])).toBeUndefined();
});
