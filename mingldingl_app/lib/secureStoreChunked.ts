export interface KeyValueStore {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const CHUNK_SIZE = 1800;

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
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key, value) {
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
