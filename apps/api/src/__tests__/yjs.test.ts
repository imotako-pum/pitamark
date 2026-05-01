import type { Room } from '@snap-share/shared';
import { describe, expect, it } from 'vitest';
import app from '../index';
import { buildEnv } from './helpers/build-env';

type ErrorBody = { ok: false; error: { code: string; message: string } };

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
    const form = new FormData();
    form.set('image', new File([new Uint8Array(4)], 'cat.png', { type: 'image/png' }));
    const created = (await (
      await app.request('/rooms', { method: 'POST', body: form }, env)
    ).json()) as Room;

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
