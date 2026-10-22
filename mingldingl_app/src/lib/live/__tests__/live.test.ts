import { QueryClient } from '@tanstack/react-query';
import {
  getGetAppStatusQueryKey,
  getGetBondQueryKey,
  getGetBondsQueryKey,
  getGetEncounterQueryKey,
  getGetHonoursQueryKey,
  getGetMeQueryKey,
  getListMyPhotosQueryKey,
} from '../../api/generated/engine';
import { applyLiveBatch, applyLiveEvent, LIVE, LIVE_KINDS, refetchActiveOnce } from '../events';
import { beginWrite } from '../writes';

const client = () => {
  const q = new QueryClient();
  q.setQueryData(getGetMeQueryKey(), { accountId: 'a' });
  q.setQueryData(getListMyPhotosQueryKey(), []);
  q.setQueryData(getGetAppStatusQueryKey(), { minVersion: '1.0.0', maintenance: false });
  return q;
};
const stale = (q: QueryClient, key: readonly unknown[]) => q.getQueryState(key)?.isInvalidated === true;

test('every engine live kind has an entry', () => {
  expect(Object.keys(LIVE).sort()).toEqual([...LIVE_KINDS].sort());
});

test('profile.updated invalidates me only', async () => {
  const q = client();
  await applyLiveEvent(q, { kind: 'profile.updated', ids: ['a'] }, jest.fn());
  expect(stale(q, getGetMeQueryKey())).toBe(true);
  expect(stale(q, getListMyPhotosQueryKey())).toBe(false);
});

test('photos.updated invalidates me and my photos', async () => {
  const q = client();
  await applyLiveEvent(q, { kind: 'photos.updated', ids: ['a'] }, jest.fn());
  expect(stale(q, getGetMeQueryKey())).toBe(true);
  expect(stale(q, getListMyPhotosQueryKey())).toBe(true);
});

test('config.updated invalidates app status', async () => {
  const q = client();
  await applyLiveEvent(q, { kind: 'config.updated', ids: [] }, jest.fn());
  expect(stale(q, getGetAppStatusQueryKey())).toBe(true);
});

test('session.revoked signs out', async () => {
  const signOut = jest.fn();
  await applyLiveEvent(client(), { kind: 'session.revoked', ids: ['s'] }, signOut);
  expect(signOut).toHaveBeenCalledTimes(1);
});

test('an unknown kind is ignored', async () => {
  const q = client();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(applyLiveEvent(q, { kind: 'mystery', ids: [] }, jest.fn())).resolves.toBeUndefined();
  expect(stale(q, getGetMeQueryKey())).toBe(false);
  warn.mockRestore();
});

test('reconnect refetches active queries once', async () => {
  const q = new QueryClient();
  const spy = jest.spyOn(q, 'refetchQueries').mockResolvedValue();
  await refetchActiveOnce(q);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith({ type: 'active' });
});

test('events landing together invalidate the union of their keys once', async () => {
  const q = client();
  q.setQueryData(getGetBondsQueryKey(), []);
  const spy = jest.spyOn(q, 'invalidateQueries');
  await Promise.all([
    applyLiveBatch(
      q,
      {
        events: [
          { kind: 'profile.updated', ids: ['a'] },
          { kind: 'profile.updated', ids: ['a'] },
        ],
      },
      jest.fn(),
    ),
    applyLiveEvent(q, { kind: 'bond.read', ids: ['b1'] }, jest.fn()),
  ]);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(stale(q, getGetMeQueryKey())).toBe(true);
  expect(stale(q, getGetBondsQueryKey())).toBe(true);
});

test('bond.read touches only the bonds list', async () => {
  const q = client();
  q.setQueryData(getGetBondsQueryKey(), []);
  q.setQueryData(getGetBondQueryKey('b1'), { id: 'b1' });
  await applyLiveEvent(q, { kind: 'bond.read', ids: ['b1'] }, jest.fn());
  expect(stale(q, getGetBondsQueryKey())).toBe(true);
  expect(stale(q, getGetBondQueryKey('b1'))).toBe(false);
});

test('honours are left to honour.earned, not refetched on every bond event', async () => {
  const q = client();
  q.setQueryData(getGetHonoursQueryKey(), []);
  await applyLiveEvent(q, { kind: 'bond.updated', ids: ['b1'] }, jest.fn());
  expect(stale(q, getGetHonoursQueryKey())).toBe(false);
  await applyLiveEvent(q, { kind: 'honour.earned', ids: ['a'] }, jest.fn());
  expect(stale(q, getGetHonoursQueryKey())).toBe(true);
});

test('only a venue change reaches every encounter', async () => {
  const q = client();
  q.setQueryData(getGetEncounterQueryKey('b1'), { bondId: 'b1' });
  await applyLiveEvent(q, { kind: 'wandering.updated', ids: ['b1'] }, jest.fn());
  expect(stale(q, getGetEncounterQueryKey('b1'))).toBe(false);
  await applyLiveEvent(q, { kind: 'venue.updated', ids: [] }, jest.fn());
  expect(stale(q, getGetEncounterQueryKey('b1'))).toBe(true);
});

test('the echo of our own write leaves what the write already put in the cache', async () => {
  const q = client();
  const write = beginWrite();
  const echo = applyLiveBatch(
    q,
    { events: [{ kind: 'photos.updated', ids: ['a'] }], origin: write.id },
    jest.fn(),
  );
  // The answer arrives after the echo; the screen writes it into the cache.
  q.setQueryData(getListMyPhotosQueryKey(), [{ id: 'p1' }]);
  write.end();
  await echo;
  expect(stale(q, getListMyPhotosQueryKey())).toBe(false);
  expect(stale(q, getGetMeQueryKey())).toBe(true);
});

test("someone else's event is never skipped for a hand-written cache entry", async () => {
  const q = client();
  const pending = applyLiveEvent(q, { kind: 'photos.updated', ids: ['a'] }, jest.fn());
  q.setQueryData(getListMyPhotosQueryKey(), [{ id: 'p1' }]);
  await pending;
  expect(stale(q, getListMyPhotosQueryKey())).toBe(true);
});

test('a fetch already started after the event is not repeated', async () => {
  const q = client();
  q.setQueryData(getGetBondQueryKey('b1'), { id: 'b1' });
  const pending = applyLiveEvent(q, { kind: 'letter.created', ids: ['b1'] }, jest.fn());
  await q.fetchQuery({
    queryKey: getGetBondQueryKey('b1'),
    queryFn: async () => ({ id: 'b1', fresh: true }),
    staleTime: 0,
  });
  await pending;
  expect(stale(q, getGetBondQueryKey('b1'))).toBe(false);
});

test('a broadcast waits a moment before it invalidates', async () => {
  jest.useFakeTimers();
  try {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const q = client();
    const pending = applyLiveBatch(
      q,
      { events: [{ kind: 'config.updated', ids: [] }], all: true },
      jest.fn(),
    );
    await jest.advanceTimersByTimeAsync(500);
    expect(stale(q, getGetAppStatusQueryKey())).toBe(false);
    await jest.advanceTimersByTimeAsync(1_000);
    await pending;
    expect(stale(q, getGetAppStatusQueryKey())).toBe(true);
  } finally {
    jest.useRealTimers();
    jest.restoreAllMocks();
  }
});
