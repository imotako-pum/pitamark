export type Bindings = {
  IMAGES: R2Bucket;
  /**
   * Room TTL in milliseconds, sourced from `[vars]` in `wrangler.toml`.
   * Cloudflare Workers env vars are always strings; callers must `Number(...)` it
   * and validate with `Number.isFinite(x) && Number.isInteger(x) && x > 0`.
   */
  ROOM_TTL_MS: string;
  /** Yjs/CRDT room state. Bound to SnapShareYDO class via wrangler.toml. */
  Y_ROOM: DurableObjectNamespace;
  /**
   * HS256 JWT signing secret for password-protected room tokens.
   * Production: `wrangler secret put ROOM_TOKEN_SECRET`.
   * Local dev: `apps/api/.dev.vars` (gitignored). Min 32 bytes.
   */
  ROOM_TOKEN_SECRET: string;
};
