import { describe, expect, it } from 'vitest';
import { matchOrigin, parseAllowedOrigins } from '../../lib/cors';

describe('parseAllowedOrigins', () => {
  it('parses a single full origin', () => {
    expect(parseAllowedOrigins('https://snap-share.pages.dev')).toEqual([
      { type: 'exact', origin: 'https://snap-share.pages.dev' },
    ]);
  });

  it('splits on commas and trims whitespace', () => {
    const out = parseAllowedOrigins(' https://a.example , https://b.example ,https://c.example');
    expect(out).toEqual([
      { type: 'exact', origin: 'https://a.example' },
      { type: 'exact', origin: 'https://b.example' },
      { type: 'exact', origin: 'https://c.example' },
    ]);
  });

  it('parses wildcard suffix entries', () => {
    expect(parseAllowedOrigins('*.snap-share.pages.dev')).toEqual([
      { type: 'suffix', suffix: '.snap-share.pages.dev' },
    ]);
  });

  it('mixes exact + suffix entries in one list', () => {
    expect(
      parseAllowedOrigins(
        'https://snap-share.pages.dev,*.snap-share.pages.dev,http://localhost:5173',
      ),
    ).toEqual([
      { type: 'exact', origin: 'https://snap-share.pages.dev' },
      { type: 'suffix', suffix: '.snap-share.pages.dev' },
      { type: 'exact', origin: 'http://localhost:5173' },
    ]);
  });

  it('drops empty entries from leading/trailing/double commas', () => {
    expect(parseAllowedOrigins(',https://a.example,,https://b.example,')).toEqual([
      { type: 'exact', origin: 'https://a.example' },
      { type: 'exact', origin: 'https://b.example' },
    ]);
  });

  it('returns an empty array for empty / whitespace input', () => {
    expect(parseAllowedOrigins('')).toEqual([]);
    expect(parseAllowedOrigins('   ')).toEqual([]);
    expect(parseAllowedOrigins(',,, ,')).toEqual([]);
  });
});

describe('matchOrigin', () => {
  const rules = parseAllowedOrigins(
    'https://snap-share.pages.dev,*.snap-share.pages.dev,http://localhost:5173',
  );

  it('matches an exact origin', () => {
    expect(matchOrigin('https://snap-share.pages.dev', rules)).toBe(true);
  });

  it('matches a wildcard suffix over https', () => {
    expect(matchOrigin('https://abc123.snap-share.pages.dev', rules)).toBe(true);
  });

  it('rejects a wildcard suffix served over http (downgrade guard)', () => {
    expect(matchOrigin('http://abc123.snap-share.pages.dev', rules)).toBe(false);
  });

  it('rejects an unknown origin', () => {
    expect(matchOrigin('https://evil.example', rules)).toBe(false);
  });

  it('rejects a partial-suffix match that does not end on a dot boundary', () => {
    // `evil-snap-share.pages.dev` は `share.pages.dev` で終わるが
    // `.snap-share.pages.dev` では終わらないので拒否されるべき。
    expect(matchOrigin('https://evil-snap-share.pages.dev', rules)).toBe(false);
  });

  it('matches an exact http origin (localhost dev) when listed', () => {
    expect(matchOrigin('http://localhost:5173', rules)).toBe(true);
  });

  it('returns false when the rules list is empty', () => {
    expect(matchOrigin('https://snap-share.pages.dev', [])).toBe(false);
  });
});
