import { describe, expect, it } from 'vitest';
import { createInMemoryKv } from '../../__tests__/helpers/in-memory-kv';
import { createImageBlocklistService } from '../image-blocklist-service';

describe('createImageBlocklistService', () => {
  it('returns false when the hash is not in KV', async () => {
    const svc = createImageBlocklistService({ kv: createInMemoryKv() });
    expect(await svc.isBlocked('a'.repeat(64))).toBe(false);
  });

  it('returns true when the hash maps to any non-null value', async () => {
    const svc = createImageBlocklistService({
      kv: createInMemoryKv({ deadbeef: 'phishing-sample-2026-q2' }),
    });
    expect(await svc.isBlocked('deadbeef')).toBe(true);
  });

  it('fails open (returns false) when the KV read throws', async () => {
    const broken = {
      async get(): Promise<string | null> {
        throw new Error('KV outage');
      },
    } as unknown as KVNamespace;

    const svc = createImageBlocklistService({ kv: broken });
    expect(await svc.isBlocked('a'.repeat(64))).toBe(false);
  });

  it('queries KV with the exact hex value supplied', async () => {
    let observed: string | null = null;
    const recording = {
      async get(key: string): Promise<string | null> {
        observed = key;
        return null;
      },
    } as unknown as KVNamespace;

    const svc = createImageBlocklistService({ kv: recording });
    await svc.isBlocked('cafebabe');

    expect(observed).toBe('cafebabe');
  });
});
