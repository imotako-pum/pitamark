// Phase 7: minimal `KVNamespace` shim for service tests. Only the methods
// `image-blocklist-service` actually calls (`get`, `put`, `delete`) are
// implemented; the rest are stubbed to throw so any accidental dependency on
// `list` / `getWithMetadata` shows up loudly in failures.

export const createInMemoryKv = (initial: Record<string, string> = {}): KVNamespace => {
  const store = new Map<string, string>(Object.entries(initial));
  const unsupported = (name: string) => () => {
    throw new Error(`InMemoryKv: ${name} not implemented for tests`);
  };
  return {
    async get(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string): Promise<void> {
      store.set(key, String(value));
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    list: unsupported('list'),
    getWithMetadata: unsupported('getWithMetadata'),
  } as unknown as KVNamespace;
};
