import { MAX_IMAGE_BYTES, MAX_ROOM_TTL_MS } from '@pitamark/shared';
import { describe, expect, it } from 'vitest';
import app from '../index';
import type { ErrorEnvelope } from '../lib/error';
import { buildEnv } from './helpers/build-env';
import { createInMemoryKv } from './helpers/in-memory-kv';
import { createStubRateLimit } from './helpers/in-memory-rl';

const pngFile = (bytes = 4): File =>
  new File([new Uint8Array(bytes).fill(0)], 'cat.png', { type: 'image/png' });

// Phase 7: every multipart upload must carry `cf-turnstile-response`. In
// tests `BYPASS_TURNSTILE='true'` lets any non-empty token through, but the
// field itself is still required by the Zod schema.
const TEST_TS_TOKEN = 'test-turnstile-token';

const formWithImage = (file: File, extra: Record<string, string> = {}): FormData => {
  const form = new FormData();
  form.set('image', file);
  form.set('cf-turnstile-response', TEST_TS_TOKEN);
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return form;
};

// Phase 8.x error-envelope review #11 L3: re-use the shared `ErrorEnvelope`
// so the test asserts against the actual `ErrorCode` union — a typo or
// removed code surfaces as a compile error here.
type ErrorBody = ErrorEnvelope;
type PublicRoom = {
  id: string;
  createdAt: number;
  ttlMs: number;
  protected: boolean;
  image?: { key: string; contentType: string; size: number; sha256?: string };
};
type AuthOk = { token: string };

describe('POST /rooms', () => {
  it('returns 201 with Room JSON when valid PNG is uploaded', async () => {
    const env = buildEnv();
    const res = await app.request(
      '/rooms',
      { method: 'POST', body: formWithImage(pngFile(4)) },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as PublicRoom;
    expect(body.id).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(body.protected).toBe(false);
    expect(body.image?.contentType).toBe('image/png');
    expect(body.image?.size).toBe(4);
    expect(body.image?.key).toBe(`rooms/${body.id}/image.png`);
    expect(body.image?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(body.ttlMs).toBeGreaterThan(0);
    expect(body.createdAt).toBeGreaterThan(0);
  });

  it('returns 400 envelope when image field is missing', async () => {
    const env = buildEnv();
    const form = new FormData();
    form.set('other', 'value');
    form.set('cf-turnstile-response', TEST_TS_TOKEN);
    const res = await app.request('/rooms', { method: 'POST', body: form }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 envelope when cf-turnstile-response field is missing', async () => {
    const env = buildEnv();
    const form = new FormData();
    form.set('image', pngFile(4));
    const res = await app.request('/rooms', { method: 'POST', body: form }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 415 envelope without echoing the user-supplied MIME type', async () => {
    const env = buildEnv();
    // Attacker tries to inject a long / control-bearing MIME string.
    const malicious = `text/plain;${'A'.repeat(200)}\n[api] forged log line`;
    const file = new File([new Uint8Array([1, 2])], 'note.txt', { type: malicious });
    const res = await app.request('/rooms', { method: 'POST', body: formWithImage(file) }, env);
    expect(res.status).toBe(415);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    // Public message must be the fixed string, not the attacker-controlled MIME.
    expect(body.error.message).toBe('Unsupported media type');
    expect(body.error.message).not.toContain('AAA');
    expect(body.error.message).not.toContain('forged');
  });

  it('returns 413 envelope with a fixed public message', async () => {
    const env = buildEnv();
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1).fill(0)], 'big.png', {
      type: 'image/png',
    });
    const res = await app.request('/rooms', { method: 'POST', body: formWithImage(big) }, env);
    expect(res.status).toBe(413);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(body.error.message).toBe('File too large');
  });

  it('returns 400 envelope when file is empty', async () => {
    const env = buildEnv();
    const empty = new File([new Uint8Array(0)], 'empty.png', { type: 'image/png' });
    const res = await app.request('/rooms', { method: 'POST', body: formWithImage(empty) }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  // Phase 10.B: per-room ttlMs override surface tests.
  it('honours an explicit ttlMs within the cap and stores it on the room', async () => {
    const env = buildEnv();
    const requested = 3 * 24 * 60 * 60 * 1000; // 3 days, < MAX_ROOM_TTL_MS
    const res = await app.request(
      '/rooms',
      {
        method: 'POST',
        body: formWithImage(pngFile(4), { ttlMs: String(requested) }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as PublicRoom;
    expect(body.ttlMs).toBe(requested);
  });

  it('falls back to env default ROOM_TTL_MS when ttlMs is omitted', async () => {
    const env = buildEnv();
    const res = await app.request(
      '/rooms',
      { method: 'POST', body: formWithImage(pngFile(4)) },
      env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as PublicRoom;
    // build-env helper now defaults to 24h (Phase 10.B production default).
    expect(body.ttlMs).toBe(24 * 60 * 60 * 1000);
  });

  it('returns 400 INVALID_REQUEST when ttlMs exceeds MAX_ROOM_TTL_MS', async () => {
    const env = buildEnv();
    const tooBig = MAX_ROOM_TTL_MS + 1;
    const res = await app.request(
      '/rooms',
      {
        method: 'POST',
        body: formWithImage(pngFile(4), { ttlMs: String(tooBig) }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('INVALID_REQUEST');
    // Public message must not echo the requested value (Phase 8.x error-envelope review #11 pattern).
    expect(body.error.message).not.toContain(String(tooBig));
  });

  it('returns 400 INVALID_REQUEST when ttlMs is non-numeric', async () => {
    const env = buildEnv();
    const res = await app.request(
      '/rooms',
      {
        method: 'POST',
        body: formWithImage(pngFile(4), { ttlMs: '7d' }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('INVALID_REQUEST');
  });
});

describe('POST /rooms (Phase 7 — Turnstile + RL + blocklist)', () => {
  it('returns 401 UNAUTHORIZED when Turnstile bypass is off and the token verifies as invalid', async () => {
    // Force bypass=false and let the dev secret fail the live siteverify call.
    // We also stub `fetch` indirectly by making the secret empty so the service
    // short-circuits to `misconfigured`. The public envelope must still surface
    // as 401 — clients should not learn whether it was misconfig vs invalid.
    const env = buildEnv({ BYPASS_TURNSTILE: 'false', TURNSTILE_SECRET_KEY: '' });
    const res = await app.request(
      '/rooms',
      { method: 'POST', body: formWithImage(pngFile(4)) },
      env,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 422 UNPROCESSABLE_ENTITY when the image SHA-256 is in the blocklist', async () => {
    // Pre-compute the SHA-256 of the test fixture so we can prime the blocklist.
    const buf = new Uint8Array(4); // matches pngFile(4) — all zero bytes
    const digest = await crypto.subtle.digest('SHA-256', buf.buffer);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const env = buildEnv({
      IMAGE_BLOCKLIST: createInMemoryKv({ [hex]: 'phishing-sample' }),
    });

    const res = await app.request(
      '/rooms',
      { method: 'POST', body: formWithImage(pngFile(4)) },
      env,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(body.error.message).toBe('This image cannot be uploaded');
  });

  it('returns 429 RATE_LIMITED when RL_CREATE_ROOM rejects', async () => {
    const env = buildEnv({ RL_CREATE_ROOM: createStubRateLimit({ alwaysBlock: true }) });
    const res = await app.request(
      '/rooms',
      { method: 'POST', body: formWithImage(pngFile(4)) },
      env,
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});

describe('GET /rooms/:id', () => {
  it('returns 200 with the same Room created via POST', async () => {
    const env = buildEnv();
    const created = (await (
      await app.request('/rooms', { method: 'POST', body: formWithImage(pngFile(4)) }, env)
    ).json()) as PublicRoom;

    const res = await app.request(`/rooms/${created.id}`, undefined, env);

    expect(res.status).toBe(200);
    const fetched = (await res.json()) as PublicRoom;
    expect(fetched).toEqual(created);
  });

  it('returns 404 envelope when room with valid ID is missing', async () => {
    const env = buildEnv();
    // Valid NanoID-shaped id that does not exist in storage.
    const res = await app.request('/rooms/V1StGXR8_Z5jdHi6B-mYT', undefined, env);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Room not found');
  });

  it('returns 400 INVALID_REQUEST when ID does not match the NanoID pattern', async () => {
    const env = buildEnv();
    // Path traversal attempt — must be rejected at the validator layer.
    const res = await app.request('/rooms/..%2Fetc%2Fpasswd', undefined, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('INVALID_REQUEST');
  });
});

const createUnprotectedRoom = async (env: ReturnType<typeof buildEnv>): Promise<PublicRoom> => {
  const res = await app.request('/rooms', { method: 'POST', body: formWithImage(pngFile(4)) }, env);
  return (await res.json()) as PublicRoom;
};

const createProtectedRoom = async (
  env: ReturnType<typeof buildEnv>,
  password: string,
): Promise<PublicRoom> => {
  const res = await app.request(
    '/rooms',
    { method: 'POST', body: formWithImage(pngFile(4), { password }) },
    env,
  );
  return (await res.json()) as PublicRoom;
};

describe('POST /rooms (Phase 7.6 既知-5 — uploader token)', () => {
  it('returns no `token` when no password is given (unprotected room)', async () => {
    const env = buildEnv();
    const body = (await createUnprotectedRoom(env)) as PublicRoom & { token?: string };
    expect(body.protected).toBe(false);
    expect(body.token).toBeUndefined();
  });

  it('returns a non-empty `token` (JWT, 3 segments) when password is given (protected room)', async () => {
    const env = buildEnv();
    const body = (await createProtectedRoom(env, 'letmein')) as PublicRoom & { token?: string };
    expect(body.protected).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token?.length ?? 0).toBeGreaterThan(0);
    // Must be the same JWT shape as the authRoute issues so RoomEditor can
    // reuse it directly via auth-storage / Bearer header.
    expect(body.token?.split('.').length).toBe(3);
  });

  it('GET /rooms/:id never echoes a `token` field (no leak path)', async () => {
    const env = buildEnv();
    const created = await createProtectedRoom(env, 'letmein');
    const res = await app.request(`/rooms/${created.id}`, undefined, env);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.token).toBeUndefined();
  });
});

describe('POST /rooms (Phase 5 — password)', () => {
  it('returns RoomPublic with protected:false and image present when no password is given', async () => {
    const env = buildEnv();
    const body = await createUnprotectedRoom(env);
    expect(body.protected).toBe(false);
    expect(body.image).toBeDefined();
    expect(body.image?.contentType).toBe('image/png');
  });

  it('returns RoomPublic with protected:true and no image when a password is given', async () => {
    const env = buildEnv();
    const body = await createProtectedRoom(env, 'letmein');
    expect(body.protected).toBe(true);
    expect(body.image).toBeUndefined();
  });

  it('treats empty password as unprotected', async () => {
    const env = buildEnv();
    const res = await app.request(
      '/rooms',
      { method: 'POST', body: formWithImage(pngFile(4), { password: '' }) },
      env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as PublicRoom;
    expect(body.protected).toBe(false);
  });

  it('rejects passwords longer than 256 chars with 400', async () => {
    const env = buildEnv();
    const res = await app.request(
      '/rooms',
      { method: 'POST', body: formWithImage(pngFile(4), { password: 'a'.repeat(257) }) },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('INVALID_REQUEST');
  });
});

describe('GET /rooms/:id (Phase 5 — public shape)', () => {
  it('returns image for unprotected rooms', async () => {
    const env = buildEnv();
    const created = await createUnprotectedRoom(env);
    const res = await app.request(`/rooms/${created.id}`, undefined, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PublicRoom;
    expect(body.protected).toBe(false);
    expect(body.image).toBeDefined();
  });

  it('hides image for protected rooms (does not leak R2 key)', async () => {
    const env = buildEnv();
    const created = await createProtectedRoom(env, 'letmein');
    const res = await app.request(`/rooms/${created.id}`, undefined, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PublicRoom;
    expect(body.protected).toBe(true);
    expect(body.image).toBeUndefined();
    // Auth field must never leak, even by accident.
    expect((body as Record<string, unknown>).auth).toBeUndefined();
  });
});

describe('POST /rooms/:id/auth (Phase 5 — token issuance)', () => {
  it('returns 200 + JWT when password matches', async () => {
    const env = buildEnv();
    const created = await createProtectedRoom(env, 'letmein');
    const res = await app.request(
      `/rooms/${created.id}/auth`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'letmein' }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as AuthOk;
    expect(typeof body.token).toBe('string');
    expect(body.token.split('.').length).toBe(3); // JWT has 3 segments
  });

  it('returns 401 UNAUTHORIZED when password does not match', async () => {
    const env = buildEnv();
    const created = await createProtectedRoom(env, 'letmein');
    const res = await app.request(
      `/rooms/${created.id}/auth`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      },
      env,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('UNAUTHORIZED');
    // Public message must not vary based on what failed (timing/oracle protection).
    expect(body.error.message).toBe('Invalid password');
  });

  it('returns 400 when the room is not password-protected', async () => {
    const env = buildEnv();
    const created = await createUnprotectedRoom(env);
    const res = await app.request(
      `/rooms/${created.id}/auth`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'anything' }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 when password field is missing', async () => {
    const env = buildEnv();
    const created = await createProtectedRoom(env, 'letmein');
    const res = await app.request(
      `/rooms/${created.id}/auth`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 404 when the room does not exist', async () => {
    const env = buildEnv();
    const res = await app.request(
      '/rooms/V1StGXR8_Z5jdHi6B-mYT/auth',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'letmein' }),
      },
      env,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 429 RATE_LIMITED when RL_AUTH rejects', async () => {
    const env = buildEnv({ RL_AUTH: createStubRateLimit({ alwaysBlock: true }) });
    const created = await createProtectedRoom(env, 'letmein');
    const res = await app.request(
      `/rooms/${created.id}/auth`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'letmein' }),
      },
      env,
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});

// Phase 8.x security review #13 H1: WS upgrade ticket exchange.
describe('POST /rooms/:id/ws-ticket (Phase 8.x — short-lived WS upgrade ticket)', () => {
  const fetchAuthToken = async (
    env: ReturnType<typeof buildEnv>,
    id: string,
    password: string,
  ): Promise<string> => {
    const res = await app.request(
      `/rooms/${id}/auth`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as AuthOk;
    return body.token;
  };

  it('returns 201 with a 32-hex ticket for a valid bearer on a protected room', async () => {
    const env = buildEnv();
    const created = await createProtectedRoom(env, 'letmein');
    const token = await fetchAuthToken(env, created.id, 'letmein');

    const res = await app.request(
      `/rooms/${created.id}/ws-ticket`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { ticket: string };
    expect(body.ticket).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns 401 UNAUTHORIZED when no Authorization header is present', async () => {
    const env = buildEnv();
    const created = await createProtectedRoom(env, 'letmein');
    const res = await app.request(`/rooms/${created.id}/ws-ticket`, { method: 'POST' }, env);
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED when bearer is malformed', async () => {
    const env = buildEnv();
    const created = await createProtectedRoom(env, 'letmein');
    const res = await app.request(
      `/rooms/${created.id}/ws-ticket`,
      {
        method: 'POST',
        headers: { authorization: 'Bearer garbage' },
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 when bearer JWT is bound to a different room (sub mismatch)', async () => {
    const env = buildEnv();
    const a = await createProtectedRoom(env, 'letmein');
    const b = await createProtectedRoom(env, 'letmein');
    const tokenA = await fetchAuthToken(env, a.id, 'letmein');

    const res = await app.request(
      `/rooms/${b.id}/ws-ticket`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${tokenA}` },
      },
      env,
    );

    expect(res.status).toBe(401);
  });

  it('returns 400 when the room is unprotected (no ticket needed for public rooms)', async () => {
    const env = buildEnv();
    const form = formWithImage(pngFile(4));
    const create = await app.request('/rooms', { method: 'POST', body: form }, env);
    const created = (await create.json()) as PublicRoom;

    const res = await app.request(
      `/rooms/${created.id}/ws-ticket`,
      {
        method: 'POST',
        headers: { authorization: 'Bearer anything' },
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 404 when the room does not exist', async () => {
    const env = buildEnv();
    const res = await app.request(
      '/rooms/V1StGXR8_Z5jdHi6B-mYT/ws-ticket',
      {
        method: 'POST',
        headers: { authorization: 'Bearer anything' },
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it('applies RL_AUTH rate limit', async () => {
    // Setup uses permissive RL_AUTH (default) so we can fetch a real bearer.
    const env = buildEnv();
    const created = await createProtectedRoom(env, 'letmein');
    const token = await fetchAuthToken(env, created.id, 'letmein');

    // Now flip RL_AUTH to alwaysBlock and reuse the same R2 + KV state.
    const blockedEnv = {
      ...env,
      RL_AUTH: createStubRateLimit({ alwaysBlock: true }),
    };

    const res = await app.request(
      `/rooms/${created.id}/ws-ticket`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      },
      blockedEnv,
    );

    expect(res.status).toBe(429);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});
