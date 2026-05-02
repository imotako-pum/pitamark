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

  /**
   * Phase 7: Workers Rate Limiting binding for `POST /rooms`.
   * `wrangler.toml` `[[ratelimits]] name = "RL_CREATE_ROOM"` (5 req / 60s).
   */
  RL_CREATE_ROOM: RateLimit;
  /**
   * Phase 7: Workers Rate Limiting binding for `POST /rooms/:id/auth`.
   * Keyed on `${roomId}:${ip}` so different rooms / IPs are independent.
   * (10 req / 60s).
   */
  RL_AUTH: RateLimit;
  /**
   * Phase 7: Workers Rate Limiting binding for `/sync/:id` WS upgrades on
   * UNPROTECTED rooms. Protected rooms already pay PBKDF2 + token verify and
   * skip this layer. (30 req / 60s).
   */
  RL_SYNC: RateLimit;

  /**
   * Phase 7: KV namespace storing SHA-256 hex of blocked images. Keys are the
   * lowercase hex digest, values are operator-supplied reason strings.
   * `wrangler kv namespace create IMAGE_BLOCKLIST` to provision.
   */
  IMAGE_BLOCKLIST: KVNamespace;

  /**
   * Phase 7: Public Turnstile site key. Safe to ship in the client bundle and
   * commit to wrangler.toml.
   */
  TURNSTILE_SITE_KEY: string;
  /**
   * Phase 7: Turnstile siteverify secret. `wrangler secret put TURNSTILE_SECRET_KEY`.
   * Local dev: `apps/api/.dev.vars`.
   */
  TURNSTILE_SECRET_KEY: string;
  /**
   * Phase 7: When `"true"`, the Turnstile verification is skipped. Used by
   * dev/CI builds where calling the real siteverify endpoint is impractical.
   * Defaults to `"false"` in production.
   */
  BYPASS_TURNSTILE: string;
};
