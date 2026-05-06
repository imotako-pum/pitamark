// rate limit / observability 用の client IP utility。
//
// `redactIp` は logging 前に必ず通すこと。full IP は GDPR / 個人情報保護法 (PIPC) で
// 個人データ扱いであり、`wrangler tail` で見える Cloudflare 側 log にも既に十分な
// geo 情報があるため、octet 単位の詳細は不要。

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export const redactIp = (ip: string | null | undefined): string => {
  if (!ip) return 'unknown';
  if (IPV4_RE.test(ip)) return ip.replace(/\.\d+$/, '.xxx');
  // IPv6 (`:` を含む形式)。`:` 区切りの最後のグループを mask する。
  if (ip.includes(':')) return ip.replace(/[^:]*$/, 'xxx');
  // 未知 / spoofed 形式 — そのまま log に到達させない。
  return 'redacted';
};

// `cf-connecting-ip` は Cloudflare が edge で設定するので、edge で spoof 不能。
// `x-forwarded-for` は cf header を inject しない `wrangler dev` 用の fallback。
// 最終 `127.0.0.1` は header を持たない Request の unit test 用 (rate-limit key を
// 安定させる)。
export const extractClientIp = (req: Request): string => {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf && cf.length > 0) return cf;
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return '127.0.0.1';
};
