import { MAX_IMAGE_BYTES, type Room } from '@snap-share/shared';
import { describe, expect, it } from 'vitest';
import app from '../index';
import { buildEnv } from './helpers/build-env';

const pngFile = (bytes = 4): File =>
  new File([new Uint8Array(bytes).fill(0)], 'cat.png', { type: 'image/png' });

type ErrorBody = { ok: false; error: { code: string; message: string } };

describe('POST /rooms', () => {
  it('returns 201 with Room JSON when valid PNG is uploaded', async () => {
    const env = buildEnv();
    const form = new FormData();
    form.set('image', pngFile(4));

    const res = await app.request('/rooms', { method: 'POST', body: form }, env);

    expect(res.status).toBe(201);
    const body = (await res.json()) as Room;
    expect(body.id).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(body.image.contentType).toBe('image/png');
    expect(body.image.size).toBe(4);
    expect(body.image.key).toBe(`rooms/${body.id}/image.png`);
    expect(body.ttlMs).toBeGreaterThan(0);
    expect(body.createdAt).toBeGreaterThan(0);
  });

  it('returns 400 envelope when image field is missing', async () => {
    const env = buildEnv();
    const form = new FormData();
    form.set('other', 'value');
    const res = await app.request('/rooms', { method: 'POST', body: form }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 415 envelope without echoing the user-supplied MIME type', async () => {
    const env = buildEnv();
    const form = new FormData();
    // Attacker tries to inject a long / control-bearing MIME string.
    const malicious = `text/plain;${'A'.repeat(200)}\n[api] forged log line`;
    form.set('image', new File([new Uint8Array([1, 2])], 'note.txt', { type: malicious }));
    const res = await app.request('/rooms', { method: 'POST', body: form }, env);
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
    const form = new FormData();
    form.set(
      'image',
      new File([new Uint8Array(MAX_IMAGE_BYTES + 1).fill(0)], 'big.png', {
        type: 'image/png',
      }),
    );
    const res = await app.request('/rooms', { method: 'POST', body: form }, env);
    expect(res.status).toBe(413);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(body.error.message).toBe('File too large');
  });

  it('returns 400 envelope when file is empty', async () => {
    const env = buildEnv();
    const form = new FormData();
    form.set('image', new File([new Uint8Array(0)], 'empty.png', { type: 'image/png' }));
    const res = await app.request('/rooms', { method: 'POST', body: form }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('INVALID_REQUEST');
  });
});

describe('GET /rooms/:id', () => {
  it('returns 200 with the same Room created via POST', async () => {
    const env = buildEnv();
    const form = new FormData();
    form.set('image', pngFile(4));
    const created = (await (
      await app.request('/rooms', { method: 'POST', body: form }, env)
    ).json()) as Room;

    const res = await app.request(`/rooms/${created.id}`, undefined, env);

    expect(res.status).toBe(200);
    const fetched = (await res.json()) as Room;
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

type PublicRoom = {
  id: string;
  createdAt: number;
  ttlMs: number;
  protected: boolean;
  image?: { key: string; contentType: string; size: number };
};

type AuthOk = { token: string };

const createUnprotectedRoom = async (env: ReturnType<typeof buildEnv>): Promise<PublicRoom> => {
  const form = new FormData();
  form.set('image', pngFile(4));
  const res = await app.request('/rooms', { method: 'POST', body: form }, env);
  return (await res.json()) as PublicRoom;
};

const createProtectedRoom = async (
  env: ReturnType<typeof buildEnv>,
  password: string,
): Promise<PublicRoom> => {
  const form = new FormData();
  form.set('image', pngFile(4));
  form.set('password', password);
  const res = await app.request('/rooms', { method: 'POST', body: form }, env);
  return (await res.json()) as PublicRoom;
};

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
    const form = new FormData();
    form.set('image', pngFile(4));
    form.set('password', '');
    const res = await app.request('/rooms', { method: 'POST', body: form }, env);
    expect(res.status).toBe(201);
    const body = (await res.json()) as PublicRoom;
    expect(body.protected).toBe(false);
  });

  it('rejects passwords longer than 256 chars with 400', async () => {
    const env = buildEnv();
    const form = new FormData();
    form.set('image', pngFile(4));
    form.set('password', 'a'.repeat(257));
    const res = await app.request('/rooms', { method: 'POST', body: form }, env);
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
});
