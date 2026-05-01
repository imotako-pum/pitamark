import { describe, expect, it } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  constantTimeEqual,
  derivePbkdf2,
  generateSalt,
  PBKDF2_ITERATIONS,
  SALT_BYTES,
} from '../password';

describe('PBKDF2 constants', () => {
  it('iteration count meets OWASP 2023 minimum (>= 210k)', () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(210_000);
  });
  it('salt is 16 bytes', () => {
    expect(SALT_BYTES).toBe(16);
  });
});

describe('generateSalt', () => {
  it('returns SALT_BYTES of randomness', () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a.length).toBe(SALT_BYTES);
    expect(b.length).toBe(SALT_BYTES);
    expect(constantTimeEqual(a, b)).toBe(false);
  });
});

describe('derivePbkdf2', () => {
  // Use low iteration counts for these tests so the suite stays fast.
  const TEST_ITER = 1000;
  const salt = new Uint8Array(SALT_BYTES).fill(7);

  it('is deterministic for same (password, salt, iterations)', async () => {
    const a = await derivePbkdf2('correct horse', salt, TEST_ITER);
    const b = await derivePbkdf2('correct horse', salt, TEST_ITER);
    expect(constantTimeEqual(a, b)).toBe(true);
    expect(a.length).toBe(32);
  });

  it('produces different output for different salt', async () => {
    const otherSalt = new Uint8Array(SALT_BYTES).fill(8);
    const a = await derivePbkdf2('pw', salt, TEST_ITER);
    const b = await derivePbkdf2('pw', otherSalt, TEST_ITER);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it('produces different output for different password', async () => {
    const a = await derivePbkdf2('one', salt, TEST_ITER);
    const b = await derivePbkdf2('two', salt, TEST_ITER);
    expect(constantTimeEqual(a, b)).toBe(false);
  });
});

describe('constantTimeEqual', () => {
  it('returns true for identical buffers', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3, 4]), new Uint8Array([1, 2, 3, 4]))).toBe(
      true,
    );
  });
  it('returns false when lengths differ', () => {
    expect(constantTimeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
  it('returns false on a 1-byte difference', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
  });
});

describe('base64Url round-trip', () => {
  it('handles 0 / 1 / 2 / 3 / 16 / 32 byte inputs', () => {
    for (const n of [0, 1, 2, 3, 16, 32]) {
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) bytes[i] = (i * 17) & 0xff;
      const encoded = base64UrlEncode(bytes);
      const decoded = base64UrlDecode(encoded);
      expect(constantTimeEqual(decoded, bytes)).toBe(true);
    }
  });
  it('encoded form contains only base64url alphabet (no padding, no +/)', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0xfd]);
    const encoded = base64UrlEncode(bytes);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('decoding invalid length throws', () => {
    expect(() => base64UrlDecode('A')).toThrow();
  });

  it('decoding non-alphabet characters throws (defensive validation)', () => {
    // `*` is not in base64url alphabet — must surface as an error rather than
    // silently producing garbage bytes via NaN coercion.
    expect(() => base64UrlDecode('AAA*')).toThrow(/Invalid base64url/);
    expect(() => base64UrlDecode('AA*=')).toThrow();
    // `+` and `/` are standard base64 (not URL-safe variant) — also rejected.
    expect(() => base64UrlDecode('AB+D')).toThrow();
    expect(() => base64UrlDecode('AB/D')).toThrow();
    // ASCII control byte
    expect(() => base64UrlDecode('A\x00BC')).toThrow();
  });
});
