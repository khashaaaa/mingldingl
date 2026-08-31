import { createChunkedStore, KeyValueStore } from '../secureStoreChunked';

function fakeStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key) => (data.has(key) ? data.get(key)! : null),
    setItem: async (key, value) => { data.set(key, value); },
    removeItem: async (key) => { data.delete(key); },
  };
}

describe('createChunkedStore', () => {
  it('stores a small value under the plain key, unchunked', async () => {
    const backing = fakeStore();
    const store = createChunkedStore(backing);

    await store.setItem('session', 'short-value');

    expect(backing.data.get('session')).toBe('short-value');
    expect(backing.data.has('session__count')).toBe(false);
  });

  it('round-trips a small value through getItem', async () => {
    const store = createChunkedStore(fakeStore());
    await store.setItem('session', 'short-value');

    expect(await store.getItem('session')).toBe('short-value');
  });

  it('splits a value larger than the chunk size across multiple keys, none exceeding 2048 bytes', async () => {
    const backing = fakeStore();
    const store = createChunkedStore(backing);
    const big = 'x'.repeat(5000);

    await store.setItem('session', big);

    expect(backing.data.has('session')).toBe(false);
    const count = Number(backing.data.get('session__count'));
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i++) {
      expect(backing.data.get(`session__${i}`)!.length).toBeLessThanOrEqual(2048);
    }
  });

  it('round-trips a large value through getItem, reassembled exactly', async () => {
    const store = createChunkedStore(fakeStore());
    const big = 'abcdefghij'.repeat(600);

    await store.setItem('session', big);

    expect(await store.getItem('session')).toBe(big);
  });

  it('overwriting a large value with a small one removes the leftover chunks', async () => {
    const backing = fakeStore();
    const store = createChunkedStore(backing);
    await store.setItem('session', 'x'.repeat(5000));

    await store.setItem('session', 'small');

    expect(backing.data.get('session')).toBe('small');
    expect(backing.data.has('session__0')).toBe(false);
    expect(backing.data.has('session__count')).toBe(false);
  });

  it('getItem returns null for a key that was never set', async () => {
    const store = createChunkedStore(fakeStore());

    expect(await store.getItem('nope')).toBeNull();
  });

  it('removeItem clears both a plain value and a chunked value', async () => {
    const backing = fakeStore();
    const store = createChunkedStore(backing);
    await store.setItem('a', 'small');
    await store.setItem('b', 'x'.repeat(5000));

    await store.removeItem('a');
    await store.removeItem('b');

    expect(await store.getItem('a')).toBeNull();
    expect(await store.getItem('b')).toBeNull();
    expect(backing.data.size).toBe(0);
  });
});
