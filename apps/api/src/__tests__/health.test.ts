import { describe, expect, it } from 'vitest';
import app from '../index';
import { buildEnv } from './helpers/build-env';

describe('GET /health', () => {
  it('returns 200 and ok payload', async () => {
    // env を明示的に渡す。CORS middleware が `c.env.CORS_ALLOWED_ORIGINS` を読む
    // ため、Workers 実機と同等の bindings を毎 request に供給する必要がある。
    const res = await app.request('/health', {}, buildEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('pitamark-api');
  });
});
