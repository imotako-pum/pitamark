import { describe, expect, it } from 'vitest';
import { bytesToHex, sha256Hex } from '../sha256';

const encode = (s: string): ArrayBuffer => {
  const u8 = new TextEncoder().encode(s);
  // `TextEncoder` returns a Uint8Array view; copy into a fresh ArrayBuffer so
  // the API matches `File.arrayBuffer()` callers.
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
};

describe('bytesToHex', () => {
  it('encodes known bytes lowercase', () => {
    const buf = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer;
    expect(bytesToHex(buf)).toBe('deadbeef');
  });

  it('returns empty string for an empty buffer', () => {
    expect(bytesToHex(new ArrayBuffer(0))).toBe('');
  });

  it('zero-pads single-digit nibbles', () => {
    const buf = new Uint8Array([0x00, 0x0f, 0xa0]).buffer;
    expect(bytesToHex(buf)).toBe('000fa0');
  });
});

describe('sha256Hex', () => {
  it("matches the canonical SHA-256 of 'hello'", async () => {
    const out = await sha256Hex(encode('hello'));
    expect(out).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('matches the canonical SHA-256 of an empty buffer', async () => {
    const out = await sha256Hex(new ArrayBuffer(0));
    expect(out).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('returns 64 lowercase hex chars for any input', async () => {
    const out = await sha256Hex(encode('a'.repeat(10_000)));
    expect(out).toMatch(/^[a-f0-9]{64}$/);
  });
});
