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

  // BYPASS_RATE_LIMIT は dev / E2E 用 escape hatch。production は wrangler.toml
  // [vars] で "false" を明示し、middleware は "true" 文字列のみを bypass trigger と
  // して扱う。production で誤って有効化されると RL 全体が無効化されるため、unit
  // レベルで両分岐を lock する。
  it('passes through when BYPASS_RATE_LIMIT="true" even if the binding would block', async () => {
    const app = buildApp(createStubRateLimit({ alwaysBlock: true }));
    const env = { BYPASS_RATE_LIMIT: 'true' } as Bindings;
    const res = await app.request('/protected', undefined, env);
    expect(res.status).toBe(200);
  });

  it('still applies the limit when BYPASS_RATE_LIMIT="false" (production default)', async () => {
    const app = buildApp(createStubRateLimit({ alwaysBlock: true }));
    const env = { BYPASS_RATE_LIMIT: 'false' } as Bindings;
    const res = await app.request('/protected', undefined, env);
    expect(res.status).toBe(429);
  });

  it('still applies the limit when BYPASS_RATE_LIMIT is unset (production fallback)', async () => {
    // Cloudflare Workers env が未定義の場合 `c.env.BYPASS_RATE_LIMIT === undefined`
    // → 文字列 "true" との strict 比較で false → bypass しない。
    const app = buildApp(createStubRateLimit({ alwaysBlock: true }));
    const res = await app.request('/protected', undefined, minimalEnv);
    expect(res.status).toBe(429);
  });

  it('does NOT bypass for truthy-but-not-"true" values like "1" / "yes" / "TRUE"', async () => {
    // 文字列 "true" 以外（"1", "yes", "TRUE" など）を bypass 扱いにすると
    // typo / misconfiguration での silent disable が起こる。strict 比較を維持。
    const app = buildApp(createStubRateLimit({ alwaysBlock: true }));
    for (const value of ['1', 'yes', 'TRUE', 'True']) {
      const env = { BYPASS_RATE_LIMIT: value } as Bindings;
      const res = await app.request('/protected', undefined, env);
      expect(res.status, `BYPASS_RATE_LIMIT="${value}" should NOT bypass`).toBe(429);
    }
  });
});
