import { describe, expect, it } from 'vitest';
import app from '../index';
import { buildEnv } from './helpers/build-env';

describe('GET /api/openapi.json', () => {
  it('returns 200 with an OpenAPI 3.1 document covering the 3 phase-2 routes', async () => {
    const res = await app.request('/api/openapi.json', undefined, buildEnv());
    expect(res.status).toBe(200);
    const doc = (await res.json()) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
    };
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('snap-share API');
    expect(doc.paths).toHaveProperty('/rooms');
    expect(doc.paths).toHaveProperty('/rooms/{id}');
    expect(doc.paths).toHaveProperty('/rooms/{id}/image');
  });

  it('does not advertise /sync routes (Yjs WS lives outside the OpenAPI surface)', async () => {
    const res = await app.request('/api/openapi.json', undefined, buildEnv());
    const doc = (await res.json()) as { paths: Record<string, unknown> };
    const paths = Object.keys(doc.paths);
    expect(paths).not.toContain('/sync/{id}');
    expect(paths).not.toContain('/sync/:id');
    expect(paths.some((p) => p.startsWith('/sync'))).toBe(false);
  });
});

describe('GET /api/docs', () => {
  it('returns Scalar HTML referencing /api/openapi.json', async () => {
    const res = await app.request('/api/docs', undefined, buildEnv());
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('/api/openapi.json');
  });
});
