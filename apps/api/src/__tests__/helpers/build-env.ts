import type { Bindings } from '../../lib/bindings';
import { createInMemoryKv } from './in-memory-kv';
import { createInMemoryR2 } from './in-memory-r2';
import { createStubRateLimit } from './in-memory-rl';

// helper の default は production と同じ 24h に揃える。7 日窓が必要なテストは
// 個別に `MAX_ROOM_TTL_MS` で pin する。
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
// HS256 を満たす長さ (>= 32 byte) の安定 secret をテスト用に固定。
export const DEFAULT_ROOM_TOKEN_SECRET = 'test-secret-32-bytes-min-padding-aaa';
// Cloudflare ドキュメントが「常に pass」とする Turnstile dev secret。commit して問題ない。
export const DEFAULT_TURNSTILE_DEV_SECRET = '1x0000000000000000000000000000000AA';
export const DEFAULT_TURNSTILE_DEV_SITE_KEY = '1x00000000000000000000AA';

// テストは live DO を exercise しない。yRoute 前段の validation middleware だけを
// 検証する。yRoute 本体は `wrangler dev` + 2 タブで手動 smoke する。最小限の
// namespace stub で typing を満たし、`app.request` が middleware を通って crash
// しない経路を確保する。
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
  // テスト用 default は permissive (no-block RL / 空 blocklist / Turnstile bypass)。
  // rooms / yjs / images の既存テストが自分の assertion に集中できるようにし、
  // 個別テストは override で 1 dimension だけ flip する。
  RL_CREATE_ROOM: createStubRateLimit(),
  RL_AUTH: createStubRateLimit(),
  RL_SYNC: createStubRateLimit(),
  IMAGE_BLOCKLIST: createInMemoryKv(),
  // WS upgrade ticket 交換用の KV namespace。
  WS_TICKETS: createInMemoryKv(),
  TURNSTILE_SITE_KEY: DEFAULT_TURNSTILE_DEV_SITE_KEY,
  TURNSTILE_SECRET_KEY: DEFAULT_TURNSTILE_DEV_SECRET,
  BYPASS_TURNSTILE: 'true',
  // テスト helper の default は production と同じ "false" にして、RL middleware が
  // in-memory stub に到達する経路を維持する。E2E のように全環境 bypass したい場合は
  // 呼び出し側で `buildEnv({ BYPASS_RATE_LIMIT: 'true' })`。
  BYPASS_RATE_LIMIT: 'false',
  // テストは Origin header を立てないので CORS middleware は pass-through するが、
  // 空 allowlist を fail-closed にしている関係で値そのものは必須。production の
  // 本番 + preview と同等の値を入れる。
  CORS_ALLOWED_ORIGINS: 'https://pitamark.app,*.pitamark.app',
  ...overrides,
});
