import type { Room } from '@snap-share/shared';
import { describe, expect, it } from 'vitest';
import app from '../index';
import { buildEnv } from './helpers/build-env';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SVG_BYTES = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');

const createRoomWithImage = async (
  env: ReturnType<typeof buildEnv>,
  bytes: Uint8Array,
  type: string,
  name: string,
): Promise<Room> => {
  const form = new FormData();
  form.set('image', new File([bytes], name, { type }));
  const res = await app.request('/rooms', { method: 'POST', body: form }, env);
  return (await res.json()) as Room;
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
