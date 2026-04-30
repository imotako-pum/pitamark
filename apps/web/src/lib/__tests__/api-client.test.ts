import { describe, expect, it } from 'vitest';
import { api } from '../api-client';

// Smoke test: verifies the hc<AppType> client is wired and the route tree
// is reachable. We do NOT make real network calls here — the server is not
// running during unit tests.
describe('api client (smoke)', () => {
  it('exposes POST /rooms via api.rooms.$post', () => {
    expect(typeof api.rooms.$post).toBe('function');
  });

  it('exposes GET /rooms/:id via api.rooms[":id"].$get', () => {
    expect(typeof api.rooms[':id'].$get).toBe('function');
  });

  it('exposes GET /rooms/:id/image via api.rooms[":id"].image.$get', () => {
    expect(typeof api.rooms[':id'].image.$get).toBe('function');
  });

  it('exposes GET /health via api.health.$get', () => {
    expect(typeof api.health.$get).toBe('function');
  });
});
