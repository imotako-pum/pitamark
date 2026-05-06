import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api, authenticateRoom, createRoom, fetchRoom } from '../api-client';

// smoke test: hc<AppType> client が配線済で route tree が到達可能なことを確認する。
// 実 network call はしない (unit test 中は server を立てていない)。
//
// `createRoom` (raw multipart) を除く全ての web → api fetch は `hc<AppType>` を経由する。
// 下の各 smoke 期待は `api-client.ts` の本番 call site に 1:1 で対応していて、API path
// rename はまずここで typecheck failure として浮上する。
describe('api client (smoke)', () => {
  it('exposes POST /rooms via api.rooms.$post (createRoom — raw multipart)', () => {
    expect(typeof api.rooms.$post).toBe('function');
  });

  it('exposes GET /rooms/:id via api.rooms[":id"].$get (fetchRoom)', () => {
    expect(typeof api.rooms[':id'].$get).toBe('function');
  });

  it('exposes POST /rooms/:id/auth via api.rooms[":id"].auth.$post (authenticateRoom)', () => {
    expect(typeof api.rooms[':id'].auth.$post).toBe('function');
  });

  it('exposes POST /rooms/:id/ws-ticket via api.rooms[":id"]["ws-ticket"].$post (requestWsTicket)', () => {
    expect(typeof api.rooms[':id']['ws-ticket'].$post).toBe('function');
  });

  it('exposes GET /rooms/:id/image via api.rooms[":id"].image.$get (fetchProtectedImage)', () => {
    expect(typeof api.rooms[':id'].image.$get).toBe('function');
  });

  it('exposes GET /health via api.health.$get', () => {
    expect(typeof api.health.$get).toBe('function');
  });
});

// 各 fetch path が response を safeParse するようになったことを検証する。schema
// mismatch は規定の failure reason に降格し、UI state には流れ込まない契約を保つ。
const stubResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('api client (Zod response parsing)', () => {
  // `globalThis.fetch` を直接差し替えて、各テストが次の resolution を stub できる
  // ようにする。`vi.spyOn` の方が綺麗だが、推論される return type が `globalThis`
  // の広い surface と相性が悪いため、この素朴な置換で readable + assertion 間 reset
  // を両立させている。
  const originalFetch = globalThis.fetch;
  let calls: Array<Response> = [];

  beforeEach(() => {
    calls = [];
    globalThis.fetch = ((..._args: Parameters<typeof fetch>): Promise<Response> => {
      const next = calls.shift();
      if (!next) throw new Error('No more queued fetch responses');
      return Promise.resolve(next);
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const queueResponse = (res: Response) => calls.push(res);

  it('createRoom returns network failure when 201 body has unexpected shape', async () => {
    queueResponse(stubResponse(201, { id: 'short' /* missing fields */ }));
    const result = await createRoom(new File([new Uint8Array(4)], 'cat.png'), undefined, 'tok');
    expect(result).toEqual({ ok: false, reason: 'network' });
  });

  it('fetchRoom returns null when 200 body fails RoomPublicSchema', async () => {
    queueResponse(stubResponse(200, { id: 'abc', protected: true }));
    const result = await fetchRoom('V1StGXR8_Z5jdHi6B-mYT');
    expect(result).toBeNull();
  });

  it('authenticateRoom returns unexpected when 200 body has missing token', async () => {
    queueResponse(stubResponse(200, { not_token: 'x' }));
    const result = await authenticateRoom('V1StGXR8_Z5jdHi6B-mYT', 'pw');
    expect(result).toEqual({ ok: false, reason: 'unexpected' });
  });

  it('authenticateRoom returns unexpected when token is empty string', async () => {
    queueResponse(stubResponse(200, { token: '' }));
    const result = await authenticateRoom('V1StGXR8_Z5jdHi6B-mYT', 'pw');
    expect(result).toEqual({ ok: false, reason: 'unexpected' });
  });
});
