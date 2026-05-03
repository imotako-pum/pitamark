import { describe, expect, it } from 'vitest';
import app from '../index';
import { issueRoomToken } from '../lib/token';
import { buildEnv, DEFAULT_ROOM_TOKEN_SECRET } from './helpers/build-env';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SVG_BYTES = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
// Phase 7: every multipart upload must carry `cf-turnstile-response`.
const TEST_TS_TOKEN = 'test-turnstile-token';

type CreatedRoom = { id: string };

const createRoomWithImage = async (
  env: ReturnType<typeof buildEnv>,
  bytes: Uint8Array,
  type: string,
  name: string,
): Promise<CreatedRoom> => {
  const form = new FormData();
  form.set('image', new File([bytes], name, { type }));
  form.set('cf-turnstile-response', TEST_TS_TOKEN);
  const res = await app.request('/rooms', { method: 'POST', body: form }, env);
  return (await res.json()) as CreatedRoom;
};

type ErrorBody = { ok: false; error: { code: string; message: string } };

describe('GET /rooms/:id/image', () => {
  it('returns 200 with stored image bytes, content-type, and nosniff', async () => {
    const env = buildEnv();
    const room = await createRoomWithImage(env, PNG_BYTES, 'image/png', 'cat.png');

    const res = await app.request(`/rooms/${room.id}/image`, undefined, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('etag')).toMatch(/^"mock-rooms\/.+\/image\.png"$/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    // PNG should NOT force download.
    expect(res.headers.get('content-disposition')).toBeNull();
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf).toEqual(PNG_BYTES);
  });

  it('forces download via Content-Disposition for SVG (XSS mitigation)', async () => {
    const env = buildEnv();
    const room = await createRoomWithImage(env, SVG_BYTES, 'image/svg+xml', 'icon.svg');

    const res = await app.request(`/rooms/${room.id}/image`, undefined, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="image.svg"');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('returns 404 envelope when room with valid ID is missing', async () => {
    const env = buildEnv();
    const res = await app.request('/rooms/V1StGXR8_Z5jdHi6B-mYT/image', undefined, env);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Room not found');
  });

  it('returns 400 when ID does not match the NanoID pattern', async () => {
    const env = buildEnv();
    const res = await app.request('/rooms/..%2Fpasswd/image', undefined, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('INVALID_REQUEST');
  });
});

const createProtectedRoomWithImage = async (
  env: ReturnType<typeof buildEnv>,
  password: string,
): Promise<{ id: string }> => {
  const form = new FormData();
  form.set('image', new File([PNG_BYTES], 'cat.png', { type: 'image/png' }));
  form.set('password', password);
  form.set('cf-turnstile-response', TEST_TS_TOKEN);
  const res = await app.request('/rooms', { method: 'POST', body: form }, env);
  return (await res.json()) as { id: string };
};

describe('GET /rooms/:id/image (Phase 5 — protected rooms)', () => {
  it('returns 200 stream for unprotected rooms even without Authorization', async () => {
    const env = buildEnv();
    const room = await createRoomWithImage(env, PNG_BYTES, 'image/png', 'cat.png');
    const res = await app.request(`/rooms/${room.id}/image`, undefined, env);
    expect(res.status).toBe(200);
  });

  it('returns 401 UNAUTHORIZED when protected room is accessed without a token', async () => {
    const env = buildEnv();
    const created = await createProtectedRoomWithImage(env, 'letmein');
    const res = await app.request(`/rooms/${created.id}/image`, undefined, env);
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when Authorization header carries a malformed token', async () => {
    const env = buildEnv();
    const created = await createProtectedRoomWithImage(env, 'letmein');
    const res = await app.request(
      `/rooms/${created.id}/image`,
      { headers: { authorization: 'Bearer not-a-jwt' } },
      env,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 stream when a valid Bearer token is supplied', async () => {
    const env = buildEnv();
    const created = await createProtectedRoomWithImage(env, 'letmein');
    const token = await issueRoomToken(created.id, DEFAULT_ROOM_TOKEN_SECRET);
    const res = await app.request(
      `/rooms/${created.id}/image`,
      { headers: { authorization: `Bearer ${token}` } },
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('returns 401 when Bearer token was issued for a different room', async () => {
    const env = buildEnv();
    const created = await createProtectedRoomWithImage(env, 'letmein');
    const otherToken = await issueRoomToken('OtherR8_Z5jdHi6B-myZ', DEFAULT_ROOM_TOKEN_SECRET);
    const res = await app.request(
      `/rooms/${created.id}/image`,
      { headers: { authorization: `Bearer ${otherToken}` } },
      env,
    );
    expect(res.status).toBe(401);
  });

  it('overrides Cache-Control to private/no-store for protected rooms', async () => {
    // HIGH-1 regression: R2 stores `public, max-age=3600` httpMetadata for
    // every image (Phase 2 default). Phase 5 protected images must override
    // this so a Bearer-authenticated response is never re-served from a
    // shared cache to an unauthenticated client.
    const env = buildEnv();
    const created = await createProtectedRoomWithImage(env, 'letmein');
    const token = await issueRoomToken(created.id, DEFAULT_ROOM_TOKEN_SECRET);
    const res = await app.request(
      `/rooms/${created.id}/image`,
      { headers: { authorization: `Bearer ${token}` } },
      env,
    );
    expect(res.status).toBe(200);
    const cc = res.headers.get('cache-control') ?? '';
    expect(cc).toContain('no-store');
    expect(cc).not.toContain('public');
  });
});

describe('GET /rooms/:id/image (Phase 7.6 — CORS for cross-origin <img crossorigin="anonymous">)', () => {
  // Phase 7.6 既知-1 回帰検知: 公開ルームの受信側で Pages → Workers の
  // cross-origin 画像取得を <img crossorigin="anonymous"> 経路で踏むと、
  // サーバが Access-Control-Allow-Origin を返さない限り browser が canvas
  // を tainted 化し PNG export (`stage.toCanvas().toBlob()`) を `SecurityError`
  // で落とす。CORS middleware が GET /rooms/:id/image でも origin allowlist
  // と一致した時に ACAO + `Vary: Origin` を返すことを保証する。
  const PAGES_ORIGIN = 'https://snap-share.pages.dev';
  const PREVIEW_ORIGIN = 'https://abc123.snap-share.pages.dev';
  const FOREIGN_ORIGIN = 'https://evil.example.com';

  it('returns Access-Control-Allow-Origin for an exact-match Pages origin', async () => {
    const env = buildEnv();
    const room = await createRoomWithImage(env, PNG_BYTES, 'image/png', 'cat.png');

    const res = await app.request(
      `/rooms/${room.id}/image`,
      { headers: { origin: PAGES_ORIGIN } },
      env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(PAGES_ORIGIN);
  });

  it('returns Access-Control-Allow-Origin for a wildcard-match Pages preview origin', async () => {
    const env = buildEnv();
    const room = await createRoomWithImage(env, PNG_BYTES, 'image/png', 'cat.png');

    const res = await app.request(
      `/rooms/${room.id}/image`,
      { headers: { origin: PREVIEW_ORIGIN } },
      env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(PREVIEW_ORIGIN);
  });

  it('emits Vary: Origin so shared caches key responses per origin', async () => {
    // CDN / browser cache が「ACAO 付きレスポンス」を「ACAO 無しレスポンス」
    // としてオリジン違いの client に再配信しないよう、Vary: Origin が必須。
    const env = buildEnv();
    const room = await createRoomWithImage(env, PNG_BYTES, 'image/png', 'cat.png');

    const res = await app.request(
      `/rooms/${room.id}/image`,
      { headers: { origin: PAGES_ORIGIN } },
      env,
    );

    expect(res.status).toBe(200);
    const vary = res.headers.get('vary') ?? '';
    expect(vary.toLowerCase()).toContain('origin');
  });

  it('does NOT echo Access-Control-Allow-Origin for a non-allowlisted origin', async () => {
    const env = buildEnv();
    const room = await createRoomWithImage(env, PNG_BYTES, 'image/png', 'cat.png');

    const res = await app.request(
      `/rooms/${room.id}/image`,
      { headers: { origin: FOREIGN_ORIGIN } },
      env,
    );

    // Image bytes still flow (the GET itself succeeds), but without the
    // ACAO header so the browser refuses to use the response as image data
    // for canvas / fetch contexts. This keeps fork deployments isolated.
    const acao = res.headers.get('access-control-allow-origin');
    expect(acao).not.toBe(FOREIGN_ORIGIN);
  });
});
