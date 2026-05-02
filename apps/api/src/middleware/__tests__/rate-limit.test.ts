import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createStubRateLimit } from '../../__tests__/helpers/in-memory-rl';
import type { Bindings } from '../../lib/bindings';
import { onAppError } from '../../lib/error';
import { withRateLimit } from '../rate-limit';

const buildApp = (binding: RateLimit | undefined): Hono<{ Bindings: Bindings }> => {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use(
    '/protected',
    withRateLimit({
      binding: () => binding,
      keyFn: () => 'test-key',
      routeId: 'test',
    }),
  );
  app.get('/protected', (c) => c.json({ ok: true }));
  // Middleware throws AppError; the production app converts it via onAppError.
  // Wire the same handler here so tests assert the envelope shape end-to-end.
  app.onError(onAppError);
  return app;
};

const minimalEnv = {} as Bindings;

describe('withRateLimit', () => {
  it('passes through when the binding is undefined (test env without stub)', async () => {
    const app = buildApp(undefined);
    const res = await app.request('/protected', undefined, minimalEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('forwards to the next handler when limit returns success', async () => {
    const app = buildApp(createStubRateLimit());
    const res = await app.request('/protected', undefined, minimalEnv);
    expect(res.status).toBe(200);
  });

  it('returns 429 envelope when limit returns success: false', async () => {
    const app = buildApp(createStubRateLimit({ alwaysBlock: true }));
    const res = await app.request('/protected', undefined, minimalEnv);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { ok: false; error: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toBe('Too many requests');
  });

  it('passes through (fail-open) when the binding throws', async () => {
    const broken: RateLimit = {
      async limit() {
        throw new Error('RL plane unavailable');
      },
    };
    const app = buildApp(broken);
    const res = await app.request('/protected', undefined, minimalEnv);
    expect(res.status).toBe(200);
  });
});
