// Phase 7: client IP utilities for rate limiting and observability.
//
// `redactIp` is mandatory before logging — full IPs are personal data under
// GDPR / Japanese PIPC, and the Cloudflare logs we surface in `wrangler tail`
// already carry enough geo signal without per-octet detail.

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export const redactIp = (ip: string | null | undefined): string => {
  if (!ip) return 'unknown';
  if (IPV4_RE.test(ip)) return ip.replace(/\.\d+$/, '.xxx');
  // IPv6 (or anything that contains ':'). Mask the last :-delimited group.
  if (ip.includes(':')) return ip.replace(/[^:]*$/, 'xxx');
  // Unknown / spoofed format — never let it reach logs untouched.
  return 'redacted';
};

// `cf-connecting-ip` is set by Cloudflare and impossible to spoof at the
// edge. `x-forwarded-for` is a fallback for `wrangler dev` (which does not
// inject the cf header). The final `127.0.0.1` keeps the rate-limit key
// stable in unit tests without a Request that has either header.
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
