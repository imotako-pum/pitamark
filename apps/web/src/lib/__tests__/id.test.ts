import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateId } from '../id';

describe('generateId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a non-empty string', () => {
    const id = generateId();

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique values across calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      ids.add(generateId());
    }

    expect(ids.size).toBe(100);
  });

  it('returns a UUID v4 shape when crypto.randomUUID is available', () => {
    const id = generateId();
    const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(uuidV4.test(id)).toBe(true);
  });

  it('falls back to a synthetic id when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});

    const id = generateId();

    expect(id.startsWith('id-')).toBe(true);
    expect(id.length).toBeGreaterThan(5);
  });
});
