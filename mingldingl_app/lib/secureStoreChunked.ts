export interface KeyValueStore {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

// SecureStore's per-item limit is 2048 bytes — Supabase's session (JWT +
// refresh token + user metadata) regularly exceeds that. Margin under the
// limit rather than exactly at it, since chunk length is measured in JS
// string length, not the UTF-8 byte length SecureStore actually enforces.
const CHUNK_SIZE = 1800;

// Wraps any single-value async key/value store (SecureStore in production,
// an in-memory Map in tests) to transparently split oversized values across
// `${key}__0`, `${key}__1`, ... plus a `${key}__count` manifest, and
// reassemble them on read. Values at or under the limit are stored under
// the plain key unchanged, so this is a no-op wrapper for the common case.
export function createChunkedStore(store: KeyValueStore): KeyValueStore {
  async function removeItem(key: string): Promise<void> {
    const countRaw = await store.getItem(`${key}__count`);
    if (countRaw !== null) {
      const count = Number(countRaw);
      for (let i = 0; i < count; i++) {
        await store.removeItem(`${key}__${i}`);
      }
      await store.removeItem(`${key}__count`);
    }
    await store.removeItem(key);
  }

  return {
    async getItem(key) {
      const countRaw = await store.getItem(`${key}__count`);
      if (countRaw === null) return store.getItem(key);

      const count = Number(countRaw);
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await store.getItem(`${key}__${i}`);
        if (part === null) return null; // partial/corrupted write — treat as missing, not crash
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(key, value) {
      // Clear whichever shape (plain or chunked) a previous write left behind.
      await removeItem(key);
      if (value.length <= CHUNK_SIZE) {
        await store.setItem(key, value);
        return;
      }
      const count = Math.ceil(value.length / CHUNK_SIZE);
      for (let i = 0; i < count; i++) {
        await store.setItem(`${key}__${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }
      await store.setItem(`${key}__count`, String(count));
    },

    removeItem,
  };
}
