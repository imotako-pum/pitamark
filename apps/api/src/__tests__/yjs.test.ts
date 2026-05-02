import { describe, expect, it } from 'vitest';
import app from '../index';
import { issueRoomToken } from '../lib/token';
import { buildEnv, DEFAULT_ROOM_TOKEN_SECRET } from './helpers/build-env';
import { createStubRateLimit } from './helpers/in-memory-rl';

type ErrorBody = { ok: false; error: { code: string; message: string } };
type CreatedRoom = { id: string };
// Phase 7: every multipart upload must carry `cf-turnstile-response`.
const TEST_TS_TOKEN = 'test-turnstile-token';

const createUnprotectedRoom = async (env: ReturnType<typeof buildEnv>): Promise<CreatedRoom> => {
  const form = new FormData();
  form.set('image', new File([new Uint8Array(4)], 'cat.png', { type: 'image/png' }));
  form.set('cf-turnstile-response', TEST_TS_TOKEN);
  const res = await app.request('/rooms', { method: 'POST', body: form }, env);
  return (await res.json()) as CreatedRoom;
};

describe('GET /sync/:id (room-existence middleware)', () => {
  it('returns 400 INVALID_REQUEST when the room ID does not match the NanoID pattern', async () => {
    const env = buildEnv();

    const res = await app.request('/sync/..%2Fetc%2Fpasswd', undefined, env);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 404 NOT_FOUND when a syntactically valid ID is absent from R2 meta', async () => {
    const env = buildEnv();

    const res = await app.request('/sync/V1StGXR8_Z5jdHi6B-mYT', undefined, env);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('passes the middleware for an existing room (yRoute receives the request)', async () => {
    const env = buildEnv();
    const created = await createUnprotectedRoom(env);

    const res = await app.request(`/sync/${created.id}`, undefined, env);

    // The middleware must let the request through; the upgrade itself is
    // yRoute's responsibility. Either yRoute responds (426/400) or the
    // noop Y_ROOM stub from build-env replies 426. Either way the response
    // must not be a NOT_FOUND envelope produced by the middleware.
    expect(res.status).not.toBe(404);
    const text = await res.text();
    if (text.length > 0) {
      try {
        const body = JSON.parse(text) as Partial<ErrorBody>;
        expect(body.error?.code).not.toBe('NOT_FOUND');
      } catch {
        // Non-JSON body is acceptable — yRoute can emit plain text on 426.
      }
    }
  });
});

const createProtectedRoomViaApi = async (
  env: ReturnType<typeof buildEnv>,
  password: string,
): Promise<{ id: string }> => {
  const form = new FormData();
  form.set('image', new File([new Uint8Array(4)], 'cat.png', { type: 'image/png' }));
  form.set('password', password);
  form.set('cf-turnstile-response', TEST_TS_TOKEN);
  const res = await app.request('/rooms', { method: 'POST', body: form }, env);
  return (await res.json()) as { id: string };
};

describe('GET /sync/:id (Phase 5 — query token authorization)', () => {
  it('passes through unprotected rooms even without a token', async () => {
    const env = buildEnv();
    const created = await createUnprotectedRoom(env);
    const res = await app.request(`/sync/${created.id}`, undefined, env);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(404);
  });

  it('returns 401 when a protected room is accessed without ?token=', async () => {
    const env = buildEnv();
    const created = await createProtectedRoomViaApi(env, 'letmein');
    const res = await app.request(`/sync/${created.id}`, undefined, env);
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when ?token= carries an invalid JWT', async () => {
    const env = buildEnv();
    const created = await createProtectedRoomViaApi(env, 'letmein');
    const res = await app.request(`/sync/${created.id}?token=garbage`, undefined, env);
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('passes the middleware when ?token= is a valid room-bound JWT', async () => {
    const env = buildEnv();
    const created = await createProtectedRoomViaApi(env, 'letmein');
    const token = await issueRoomToken(created.id, DEFAULT_ROOM_TOKEN_SECRET);
    const res = await app.request(
      `/sync/${created.id}?token=${encodeURIComponent(token)}`,
      undefined,
      env,
    );
    // Same as the unprotected passthrough check: not a 4xx envelope from
    // our middleware; yRoute is allowed to respond however it wants.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(404);
  });
});

describe('GET /sync/:id (Phase 7 — sync rate limit on unprotected rooms)', () => {
  it('returns 429 RATE_LIMITED when RL_SYNC blocks an unprotected room upgrade', async () => {
    const env = buildEnv({ RL_SYNC: createStubRateLimit({ alwaysBlock: true }) });
    const created = await createUnprotectedRoom(env);
    const res = await app.request(`/sync/${created.id}`, undefined, env);
    expect(res.status).toBe(429);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('does NOT apply RL_SYNC to protected rooms (token verify replaces RL)', async () => {
    // RL_SYNC alwaysBlock would force 429 if it were consulted, but for
    // protected rooms the middleware skips it and returns 401 (no token).
    const env = buildEnv({ RL_SYNC: createStubRateLimit({ alwaysBlock: true }) });
    const created = await createProtectedRoomViaApi(env, 'letmein');
    const res = await app.request(`/sync/${created.id}`, undefined, env);
    expect(res.status).toBe(401); // missing token, NOT 429
  });

  it('passes through unprotected rooms when RL_SYNC permits the request', async () => {
    const env = buildEnv(); // default permissive stub
    const created = await createUnprotectedRoom(env);
    const res = await app.request(`/sync/${created.id}`, undefined, env);
    expect(res.status).not.toBe(429);
  });
});
