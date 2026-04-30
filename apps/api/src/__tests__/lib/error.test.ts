import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { AppError, errorEnvelope, onAppError, onAppNotFound } from '../../lib/error';

describe('errorEnvelope', () => {
  it('produces an ok=false envelope with code/message', () => {
    expect(errorEnvelope('NOT_FOUND', 'missing')).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'missing' },
    });
  });
});

describe('AppError', () => {
  it('captures status and code', () => {
    const err = new AppError(413, 'PAYLOAD_TOO_LARGE', 'too big');
    expect(err.status).toBe(413);
    expect(err.code).toBe('PAYLOAD_TOO_LARGE');
    expect(err.message).toBe('too big');
  });
});

describe('onAppError + onAppNotFound (integration)', () => {
  const app = new Hono();
  app.get('/throw-app', () => {
    throw new AppError(404, 'NOT_FOUND', 'no such thing');
  });
  app.get('/throw-other', () => {
    throw new Error('boom');
  });
  app.notFound(onAppNotFound);
  app.onError(onAppError);

  it('maps AppError to envelope with original status', async () => {
    const res = await app.request('/throw-app');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'no such thing' },
    });
  });

  it('falls back to INTERNAL envelope for unknown errors', async () => {
    const res = await app.request('/throw-other');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'Internal Server Error' },
    });
  });

  it('returns generic NOT_FOUND envelope when no route matches (path is not echoed)', async () => {
    const res = await app.request('/missing-route');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; error: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Route not found');
    // Path must NOT leak in the public envelope (only logged server-side).
    expect(body.error.message).not.toContain('/missing-route');
  });
});
