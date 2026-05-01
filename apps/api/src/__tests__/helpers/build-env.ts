import type { Bindings } from '../../lib/bindings';
import { createInMemoryR2 } from './in-memory-r2';

export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Tests need a stable secret long enough to satisfy HS256 (>= 32 bytes).
export const DEFAULT_ROOM_TOKEN_SECRET = 'test-secret-32-bytes-min-padding-aaa';

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
  ...overrides,
});
