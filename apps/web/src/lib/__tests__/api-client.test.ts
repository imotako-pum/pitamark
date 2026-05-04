import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api, authenticateRoom, createRoom, fetchRoom } from '../api-client';

// Smoke test: verifies the hc<AppType> client is wired and the route tree
// is reachable. We do NOT make real network calls here — the server is not
// running during unit tests.
describe('api client (smoke)', () => {
  it('exposes POST /rooms via api.rooms.$post', () => {
    expect(typeof api.rooms.$post).toBe('function');
  });

  it('exposes GET /rooms/:id via api.rooms[":id"].$get', () => {
    expect(typeof api.rooms[':id'].$get).toBe('function');
  });

  it('exposes GET /rooms/:id/image via api.rooms[":id"].image.$get', () => {
    expect(typeof api.rooms[':id'].image.$get).toBe('function');
  });

  it('exposes GET /health via api.health.$get', () => {
    expect(typeof api.health.$get).toBe('function');
  });
});

// Phase 8.x SSOT review #1 H1 / typesafety review #6 H1: validate that
// each fetch path now safeParse-s the response. A schema mismatch must
// degrade to the documented failure reason, not flow into UI state.
const stubResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('api client (Zod response parsing)', () => {
  // We swap `globalThis.fetch` directly so each test can stub the next
  // resolution. `vi.spyOn` would be cleaner but its inferred return type
  // does not play with `globalThis`'s broad surface; the fallback keeps
  // the test code readable while still resetting between assertions.
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
