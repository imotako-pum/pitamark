// Phase 7: minimal `KVNamespace` shim for service tests. Only the methods
// `image-blocklist-service` actually calls (`get`, `put`, `delete`) are
// implemented; the rest are stubbed to throw so any accidental dependency on
// `list` / `getWithMetadata` shows up loudly in failures.
//
// Phase 8.x: extended to honor `put`'s `expirationTtl` option so the WS
// ticket service (which relies on KV TTL for one-shot consume semantics)
// can be exercised under vitest. `now` is injectable for deterministic
// expiry tests.

export type InMemoryKvOptions = Readonly<{
  now?: () => number;
}>;

type Entry = { value: string; expiresAt: number | null };

export const createInMemoryKv = (
  initial: Record<string, string> = {},
  options: InMemoryKvOptions = {},
): KVNamespace => {
  const now = options.now ?? Date.now;
  const store = new Map<string, Entry>(
    Object.entries(initial).map(([k, v]) => [k, { value: v, expiresAt: null }]),
  );
  const isExpired = (entry: Entry): boolean => entry.expiresAt !== null && entry.expiresAt <= now();
  const unsupported = (name: string) => () => {
    throw new Error(`InMemoryKv: ${name} not implemented for tests`);
  };
  return {
    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (isExpired(entry)) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(
      key: string,
      value: string,
      opts?: { expirationTtl?: number; expiration?: number },
    ): Promise<void> {
      const expiresAt =
        typeof opts?.expirationTtl === 'number'
          ? now() + opts.expirationTtl * 1000
          : typeof opts?.expiration === 'number'
            ? opts.expiration * 1000
            : null;
      store.set(key, { value: String(value), expiresAt });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    list: unsupported('list'),
    getWithMetadata: unsupported('getWithMetadata'),
  } as unknown as KVNamespace;
};
