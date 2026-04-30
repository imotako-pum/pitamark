import { describe, expect, it } from 'vitest';
import app from '../index';

describe('GET /health', () => {
  it('returns 200 and ok payload', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('snap-share-api');
  });
});
