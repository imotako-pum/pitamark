// PBKDF2-SHA256 hash utilities. Pure functions over Web Crypto so the module
// is platform-agnostic (Workers + Node 22 + Vitest jsdom). The service layer
// (`services/password-service.ts`) wraps these into a stateful API with
// `RoomAuth` envelopes and `AppError` mapping.

export const PBKDF2_ITERATIONS = 210_000;
export const SALT_BYTES = 16;
export const HASH_BITS = 256;

export const generateSalt = (): Uint8Array => crypto.getRandomValues(new Uint8Array(SALT_BYTES));

export const derivePbkdf2 = async (
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    HASH_BITS,
  );
  return new Uint8Array(bits);
};

// Length-stable comparison: bails on length mismatch (cheap), then bit-XORs
// every byte before checking. Early-return on first byte mismatch leaks timing.
export const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: index is bounded by a.length
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
};

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const base64UrlEncode = (bytes: Uint8Array): string => {
  let out = '';
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    // biome-ignore lint/style/noNonNullAssertion: bounded loop
    const a = bytes[i]!;
    // biome-ignore lint/style/noNonNullAssertion: bounded loop
    const b = bytes[i + 1]!;
    // biome-ignore lint/style/noNonNullAssertion: bounded loop
    const c = bytes[i + 2]!;
    // charAt always returns string (empty string when out of bounds), avoiding
    // the `string | undefined` widening from `noUncheckedIndexedAccess`.
    out +=
      ALPHA.charAt(a >> 2) +
      ALPHA.charAt(((a & 0x03) << 4) | (b >> 4)) +
      ALPHA.charAt(((b & 0x0f) << 2) | (c >> 6)) +
      ALPHA.charAt(c & 0x3f);
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    // biome-ignore lint/style/noNonNullAssertion: rem === 1
    const a = bytes[i]!;
    out += ALPHA.charAt(a >> 2) + ALPHA.charAt((a & 0x03) << 4);
  } else if (rem === 2) {
    // biome-ignore lint/style/noNonNullAssertion: rem === 2
    const a = bytes[i]!;
    // biome-ignore lint/style/noNonNullAssertion: rem === 2
    const b = bytes[i + 1]!;
    out +=
      ALPHA.charAt(a >> 2) +
      ALPHA.charAt(((a & 0x03) << 4) | (b >> 4)) +
      ALPHA.charAt((b & 0x0f) << 2);
  }
  return out;
};

const REVERSE: Record<string, number> = {};
for (let i = 0; i < ALPHA.length; i++) {
  // biome-ignore lint/style/noNonNullAssertion: bounded
  REVERSE[ALPHA[i]!] = i;
}

// Look up a single base64url char. Throws on chars outside the alphabet so
// corrupt / attacker-supplied auth payloads surface as an error rather than
// silently producing garbage bytes (NaN coercion through bit ops).
const decodeChar = (str: string, i: number): number => {
  const ch = str.charAt(i);
  const v = REVERSE[ch];
  if (v === undefined) {
    throw new Error('Invalid base64url character');
  }
  return v;
};

export const base64UrlDecode = (str: string): Uint8Array => {
  const len = str.length;
  if (len === 0) return new Uint8Array(0);
  const fullChunks = Math.floor(len / 4);
  const tail = len - fullChunks * 4;
  if (tail === 1) throw new Error('Invalid base64url length');
  const outLen = fullChunks * 3 + (tail === 0 ? 0 : tail - 1);
  const out = new Uint8Array(outLen);
  let oi = 0;
  let i = 0;
  for (let c = 0; c < fullChunks; c++) {
    const v0 = decodeChar(str, i++);
    const v1 = decodeChar(str, i++);
    const v2 = decodeChar(str, i++);
    const v3 = decodeChar(str, i++);
    out[oi++] = (v0 << 2) | (v1 >> 4);
    out[oi++] = ((v1 & 0x0f) << 4) | (v2 >> 2);
    out[oi++] = ((v2 & 0x03) << 6) | v3;
  }
  if (tail === 2) {
    const v0 = decodeChar(str, i++);
    const v1 = decodeChar(str, i++);
    out[oi++] = (v0 << 2) | (v1 >> 4);
  } else if (tail === 3) {
    const v0 = decodeChar(str, i++);
    const v1 = decodeChar(str, i++);
    const v2 = decodeChar(str, i++);
    out[oi++] = (v0 << 2) | (v1 >> 4);
    out[oi++] = ((v1 & 0x0f) << 4) | (v2 >> 2);
  }
  return out;
};
