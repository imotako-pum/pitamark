// service テスト用の最小 `KVNamespace` shim。`image-blocklist-service` が実際に呼ぶ
// (`get` / `put` / `delete`) だけを実装し、他は throw する stub にする。`list` /
// `getWithMetadata` への意図しない依存は failure で大きく浮上させる方針。
//
// `put` の `expirationTtl` option も honor するよう拡張済。WS ticket service
// (KV TTL に依存する one-shot consume semantics を持つ) を vitest で exercise
// できるようにするため。`now` は決定論的な expiry テスト用に注入可能。

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
