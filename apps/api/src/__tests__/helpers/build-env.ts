import type { Bindings } from '../../lib/bindings';
import { createInMemoryKv } from './in-memory-kv';
import { createInMemoryR2 } from './in-memory-r2';
import { createStubRateLimit } from './in-memory-rl';

// Phase 10.B: helper now mirrors the production default (24h). Tests that
// need the previous 7-day window pin it explicitly via `MAX_ROOM_TTL_MS`.
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
// Tests need a stable secret long enough to satisfy HS256 (>= 32 bytes).
export const DEFAULT_ROOM_TOKEN_SECRET = 'test-secret-32-bytes-min-padding-aaa';
// Cloudflare's documented "always passes" Turnstile dev secret. Safe to commit.
export const DEFAULT_TURNSTILE_DEV_SECRET = '1x0000000000000000000000000000000AA';
export const DEFAULT_TURNSTILE_DEV_SITE_KEY = '1x00000000000000000000AA';

// Tests do not exercise the live DO — they only verify the validation
// middleware in front of yRoute. yRoute itself is exercised by `wrangler dev`
// + 2 tabs (manual smoke). A minimal namespace stub satisfies typing so
// `app.request` can route through the middleware without crashing.
const noopY_ROOM = {
  idFromName: (name: string) => ({ toString: () => name }),
  idFromString: (s: string) => ({ toString: () => s }),
  newUniqueId: () => ({ toString: () => 'unique' }),
  get: () => ({
    fetch: async () =>
      new Response(null, { status: 426, headers: { 'content-type': 'application/json' } }),
  }),
} as unknown as DurableObjectNamespace;

export const buildEnv = (overrides: Partial<Bindings> = {}): Bindings => ({
  IMAGES: createInMemoryR2(),
  ROOM_TTL_MS: String(DEFAULT_TTL_MS),
  Y_ROOM: noopY_ROOM,
  ROOM_TOKEN_SECRET: DEFAULT_ROOM_TOKEN_SECRET,
  // Phase 7 bindings. Defaults are permissive (no-block RL, empty blocklist,
  // bypass Turnstile) so existing rooms/yjs/images tests stay focused on
  // their own assertions; per-test overrides flip a single dimension.
  RL_CREATE_ROOM: createStubRateLimit(),
  RL_AUTH: createStubRateLimit(),
  RL_SYNC: createStubRateLimit(),
  IMAGE_BLOCKLIST: createInMemoryKv(),
  // Phase 8.x: WS upgrade ticket exchange KV namespace (security review #13 H1).
  WS_TICKETS: createInMemoryKv(),
  TURNSTILE_SITE_KEY: DEFAULT_TURNSTILE_DEV_SITE_KEY,
  TURNSTILE_SECRET_KEY: DEFAULT_TURNSTILE_DEV_SECRET,
  BYPASS_TURNSTILE: 'true',
  // Phase 7.6: テスト helper の default は production と同じ "false" にして、
  // RL middleware が in-memory stub に到達する経路を維持する。E2E のように
  // 全環境で bypass したい場合は呼び出し側で `buildEnv({ BYPASS_RATE_LIMIT: 'true' })`。
  BYPASS_RATE_LIMIT: 'false',
  // Phase 7.5: テストは Origin header を立てないため CORS middleware が
  // pass-through するが、空 allowlist を fail-closed にしている関係で
  // 値そのものは必須。プロダクション同等の本番 + preview を入れる。
  CORS_ALLOWED_ORIGINS: 'https://snap-share.pages.dev,*.snap-share.pages.dev',
  ...overrides,
});
