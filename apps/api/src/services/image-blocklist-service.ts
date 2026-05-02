import { logger } from '../lib/logger';

// Phase 7: image SHA-256 blocklist read-side.
//
// Writes happen out-of-band via `wrangler kv key put --binding=IMAGE_BLOCKLIST
// <hex> "<reason>"`; this service only checks at upload time. KV reads are
// eventually consistent (~60s propagation) which is acceptable for blocklist
// use — a freshly added entry that misses the first request after writing is
// not a security regression compared to "no blocklist at all".

export type BlocklistDeps = Readonly<{ kv: KVNamespace }>;

export type ImageBlocklistService = Readonly<{
  isBlocked(sha256Hex: string): Promise<boolean>;
}>;

export const createImageBlocklistService = (deps: BlocklistDeps): ImageBlocklistService => ({
  async isBlocked(sha256Hex) {
    try {
      const v = await deps.kv.get(sha256Hex);
      return v !== null;
    } catch (err: unknown) {
      // Fail open: a KV outage must not block legitimate uploads. The error is
      // logged loudly so operations can react before this becomes a habit.
      logger.error('blocklist KV read failed (fail-open)', {
        err: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  },
});
