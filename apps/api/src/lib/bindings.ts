export type Bindings = {
  IMAGES: R2Bucket;
  /**
   * Room TTL in milliseconds, sourced from `[vars]` in `wrangler.toml`.
   * Cloudflare Workers env vars are always strings; callers must `Number(...)` it
   * and validate with `Number.isFinite(x) && Number.isInteger(x) && x > 0`.
   */
  ROOM_TTL_MS: string;
};
