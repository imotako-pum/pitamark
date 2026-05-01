import { describe, expect, it } from 'vitest';
import { buildSyncUrl, resolveWsBaseUrl } from '../yjs-config';

describe('resolveWsBaseUrl', () => {
  it('returns the explicit env override when present', () => {
    const url = resolveWsBaseUrl(
      { VITE_API_WS_URL: 'wss://example.com' } as unknown as ImportMetaEnv,
      { protocol: 'http:', host: 'localhost:5173' },
    );
    expect(url).toBe('wss://example.com');
  });

  it('falls back to ws:// when the page is served over http://', () => {
    const url = resolveWsBaseUrl({} as unknown as ImportMetaEnv, {
      protocol: 'http:',
      host: 'localhost:5173',
    });
    expect(url).toBe('ws://localhost:5173');
  });

  it('upgrades to wss:// when the page is served over https://', () => {
    const url = resolveWsBaseUrl({} as unknown as ImportMetaEnv, {
      protocol: 'https:',
      host: 'app.example.com',
    });
    expect(url).toBe('wss://app.example.com');
  });
});

describe('buildSyncUrl', () => {
  it('appends /sync/:roomId to the base URL', () => {
    expect(buildSyncUrl('V1StGXR8_Z5jdHi6B-mYT', 'ws://localhost:5173')).toBe(
      'ws://localhost:5173/sync/V1StGXR8_Z5jdHi6B-mYT',
    );
  });

  it('encodes unsafe characters defensively', () => {
    expect(buildSyncUrl('a/b c', 'ws://x')).toBe('ws://x/sync/a%2Fb%20c');
  });

  it('appends ?token= when a token is supplied', () => {
    expect(buildSyncUrl('V1StGXR8_Z5jdHi6B-mYT', 'ws://x', 'abc.def.ghi')).toBe(
      'ws://x/sync/V1StGXR8_Z5jdHi6B-mYT?token=abc.def.ghi',
    );
  });

  it('omits ?token= for null/undefined/empty token', () => {
    expect(buildSyncUrl('V1StGXR8_Z5jdHi6B-mYT', 'ws://x')).not.toContain('?token=');
    expect(buildSyncUrl('V1StGXR8_Z5jdHi6B-mYT', 'ws://x', null)).not.toContain('?token=');
    expect(buildSyncUrl('V1StGXR8_Z5jdHi6B-mYT', 'ws://x', '')).not.toContain('?token=');
  });

  it('encodes the token defensively', () => {
    // synthetic token containing characters that need URL-encoding
    expect(buildSyncUrl('V1StGXR8_Z5jdHi6B-mYT', 'ws://x', 'a b/c?d=e')).toBe(
      'ws://x/sync/V1StGXR8_Z5jdHi6B-mYT?token=a%20b%2Fc%3Fd%3De',
    );
  });
});
