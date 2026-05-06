export type Bindings = {
  IMAGES: R2Bucket;
  /**
   * Room TTL (ms 単位)。`wrangler.toml` の `[vars]` から渡る。Cloudflare Workers の
   * env var は常に string なので、caller が `Number(...)` 変換し
   * `Number.isFinite(x) && Number.isInteger(x) && x > 0` で validate すること。
   */
  ROOM_TTL_MS: string;
  /** Yjs/CRDT の room state。`wrangler.toml` で `SnapShareYDO` class に bind される。 */
  Y_ROOM: DurableObjectNamespace;
  /**
   * password-protected room token を署名する HS256 JWT secret。
   * production: `wrangler secret put ROOM_TOKEN_SECRET`。
   * local dev: `apps/api/.dev.vars` (gitignore 済)。最低 32 byte。
   */
  ROOM_TOKEN_SECRET: string;

  /**
   * `POST /rooms` 用の Workers Rate Limiting binding。
   * `wrangler.toml` の `[[ratelimits]] name = "RL_CREATE_ROOM"` (5 req / 60s)。
   */
  RL_CREATE_ROOM: RateLimit;
  /**
   * `POST /rooms/:id/auth` 用の Workers Rate Limiting binding。`${roomId}:${ip}` を
   * key にするので、room や IP ごとに独立。10 req / 60s。
   */
  RL_AUTH: RateLimit;
  /**
   * unprotected room の `/sync/:id` WS upgrade 用の Workers Rate Limiting binding。
   * protected room は PBKDF2 + token verify を既に払っているのでこの層を skip する。
   * 30 req / 60s。
   */
  RL_SYNC: RateLimit;

  /**
   * blocklist された画像の SHA-256 hex を保持する KV namespace。key は lowercase hex
   * digest、value は operator が書く理由 string。provision は
   * `wrangler kv namespace create IMAGE_BLOCKLIST`。
   */
  IMAGE_BLOCKLIST: KVNamespace;

  /**
   * 短命 one-shot WebSocket upgrade ticket を保持する KV namespace。key は
   * `ws-ticket:<32 hex chars>`、value は bind 対象の roomId。`expirationTtl=60`
   * (Cloudflare KV の最小値) で auto-expire し、consume 時に削除される。protected
   * room の WS 接続は 24h JWT をこの ticket に交換することで JWT を URL に乗せない。
   * provision は `wrangler kv namespace create WS_TICKETS`。
   */
  WS_TICKETS: KVNamespace;

  /**
   * 公開 Turnstile site key。client bundle に乗せて公開しても安全で、wrangler.toml に
   * commit しても良い。
   */
  TURNSTILE_SITE_KEY: string;
  /**
   * Turnstile siteverify secret。`wrangler secret put TURNSTILE_SECRET_KEY` で設定する。
   * local dev: `apps/api/.dev.vars`。
   */
  TURNSTILE_SECRET_KEY: string;
  /**
   * `"true"` のとき Turnstile 検証を skip する。実 siteverify を叩けない dev / CI
   * build 用。production では `"false"` がデフォルト。
   */
  BYPASS_TURNSTILE: string;
  /**
   * `"true"` のとき `withRateLimit` middleware が常に short-circuit してすべての
   * request を通す。E2E test run で 60s 以内に 14+ rooms 作るとき、production limit
   * (5/60s) が spurious failure を起こすのを避けるためのみに使う。production では
   * 必ず `"false"` (または未設定)。デフォルト `"false"`。
   */
  BYPASS_RATE_LIMIT: string;

  /**
   * API を叩いてよいブラウザ origin の allowlist (カンマ区切り)。各エントリは完全
   * origin (`https://pitamark.app`) か、wildcard 接尾辞 (`*.pitamark.app`、https 限定 —
   * Pages の preview URL を吸収) のいずれか。空 / parse 不能な値は module load 時では
   * なく初回 request 時に CORS middleware (`index.ts`) が例外を投げる (Worker log の
   * 可観測性を残す fail-closed 方針)。WebSocket `/sync` upgrade は CORS 対象外で、
   * 別経路の origin check に依存する。
   */
  CORS_ALLOWED_ORIGINS: string;
};
