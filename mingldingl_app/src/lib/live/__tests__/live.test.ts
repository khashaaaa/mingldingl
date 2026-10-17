import { QueryClient } from '@tanstack/react-query';
import {
  getGetAppStatusQueryKey,
  getGetMeQueryKey,
  getListMyPhotosQueryKey,
} from '../../api/generated/engine';
import { applyLiveEvent, LIVE, LIVE_KINDS, refetchActiveOnce } from '../events';

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
