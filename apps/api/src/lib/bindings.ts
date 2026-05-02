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
  /**
   * Phase 7.6: When `"true"`, all `withRateLimit` middleware short-circuits
   * and lets every request through. Used by E2E test runs where 14+ rooms
   * are created in a 60s window and the production limit (5/60s) would
   * cause spurious failures. MUST be `"false"` (or unset) in production.
   * Defaults to `"false"`.
   */
  BYPASS_RATE_LIMIT: string;

  /**
   * Phase 7.5: API を叩いてよいブラウザ origin の allowlist（カンマ区切り）。
   * 各エントリは完全オリジン（`https://snap-share.pages.dev`）か、
   * ワイルドカード接尾辞（`*.snap-share.pages.dev`、https 限定 — Pages の
   * preview URL を吸収）のいずれか。空 / パース不能な値は module load 時では
   * なく初回リクエスト時に CORS middleware（`index.ts`）が例外を投げる
   * （Worker のログ可観測性を残すための fail-closed 方針）。WebSocket `/sync`
   * upgrade は CORS 対象外で、別経路の origin check に依存する。
   */
  CORS_ALLOWED_ORIGINS: string;
};
