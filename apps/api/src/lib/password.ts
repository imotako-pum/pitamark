// PBKDF2-SHA256 の hash utility。Web Crypto 上の pure 関数で platform-agnostic
// (Workers + Node 22 + Vitest jsdom)。service 層 (`services/password-service.ts`) が
// これを `RoomAuth` envelope と `AppError` mapping を持つ stateful API に wrap する。

// Cloudflare Workers (workerd) の Web Crypto API は PBKDF2 iterations の上限が
// 100,000。`>100k` で `NotSupportedError: Pbkdf2 failed: iteration counts above 100000
// are not supported` が出る。OWASP 2023 推奨の 600k はもちろん、初期設定の 210k でも
// unhandled exception で 500 化していた。`wrangler dev` (miniflare → Node Web Crypto)
// にはこの制限が無いため、本番でだけ落ちる典型的な runtime divergence。verify は
// `auth.iterations` を個別に読むので、過去 fixture (iterations: 210_000 など) との
// backwards 互換性は維持される。
export const PBKDF2_ITERATIONS = 100_000;
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
  // TS 6 で `BufferSource` が narrow になり、generic な `Uint8Array<ArrayBufferLike>`
  // が直接は満たせなくなった。call seam で `BufferSource` cast するのが最小修正で、
  // runtime bytes は変わらない。
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    keyMaterial,
    HASH_BITS,
  );
  return new Uint8Array(bits);
};

// length-stable な比較: length 不一致は安価に弾き、その後は全 byte を XOR してから
// check する。最初の byte 不一致で early return すると timing が漏れる。
export const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: index は a.length で bound されている
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
};

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const base64UrlEncode = (bytes: Uint8Array): string => {
  let out = '';
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    // biome-ignore lint/style/noNonNullAssertion: bounded loop で index は常に有効
    const a = bytes[i]!;
    // biome-ignore lint/style/noNonNullAssertion: bounded loop で index は常に有効
    const b = bytes[i + 1]!;
    // biome-ignore lint/style/noNonNullAssertion: bounded loop で index は常に有効
    const c = bytes[i + 2]!;
    // charAt は範囲外で空文字列を返すので、`noUncheckedIndexedAccess` の
    // `string | undefined` 拡張に引っかからない。
    out +=
      ALPHA.charAt(a >> 2) +
      ALPHA.charAt(((a & 0x03) << 4) | (b >> 4)) +
      ALPHA.charAt(((b & 0x0f) << 2) | (c >> 6)) +
      ALPHA.charAt(c & 0x3f);
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    // biome-ignore lint/style/noNonNullAssertion: rem === 1 で index 有効
    const a = bytes[i]!;
    out += ALPHA.charAt(a >> 2) + ALPHA.charAt((a & 0x03) << 4);
  } else if (rem === 2) {
    // biome-ignore lint/style/noNonNullAssertion: rem === 2 で index 有効
    const a = bytes[i]!;
    // biome-ignore lint/style/noNonNullAssertion: rem === 2 で index 有効
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
  // biome-ignore lint/style/noNonNullAssertion: index は ALPHA.length で bound
  REVERSE[ALPHA[i]!] = i;
}

// 単一の base64url char を lookup する。alphabet 外の char は throw する。corrupt /
// attacker-supplied な auth payload が silently に garbage bytes (bit op 経由の NaN
// 強制) を作るのを防ぎ、必ず error として浮上させる。
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
