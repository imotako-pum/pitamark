// Pure helpers for hashing image bytes. Kept separate from Workers-specific
// glue so the unit tests can run on plain Node without polyfills (other than
// the WebCrypto global which Node 22 ships natively).

// Pre-computed lookup so the inner loop avoids `.toString(16) + padStart`
// allocations on every byte.
const HEX_CHARS: ReadonlyArray<string> = (() => {
  const out: string[] = [];
  for (let i = 0; i < 256; i++) out.push(i.toString(16).padStart(2, '0'));
  return out;
})();

export const bytesToHex = (buf: ArrayBuffer): string => {
  const view = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < view.length; i++) {
    out += HEX_CHARS[view[i] ?? 0];
  }
  return out;
};

export const sha256Hex = async (buf: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return bytesToHex(digest);
};
