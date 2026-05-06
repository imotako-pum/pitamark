import { logger } from '../lib/logger';

// 画像 SHA-256 blocklist の read 専用 service。
//
// 書き込みは out-of-band に `wrangler kv key put --binding=IMAGE_BLOCKLIST <hex>
// "<reason>"` で行い、本 service は upload 時の照会だけを担当する。KV read は
// eventually consistent (~60s 伝搬) だが、blocklist 用途では許容範囲 —
// 「書き込み直後の 1 request が hit しない」程度の遅延は、blocklist が無い場合に
// 比べて security regression にはならない。

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
      // fail-open: KV 障害で legitimate な upload を止めない。代わりに error を大きく
      // log に出して、運用側が習慣化する前に気付ける状態を保つ。
      logger.error('blocklist KV read failed (fail-open)', {
        err: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  },
});
