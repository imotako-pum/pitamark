import { z } from 'zod';
import { logger } from '../lib/logger';

// server-side の Turnstile siteverify wrapper。
//
// なぜ DI 化しているか: テストは絶対に live siteverify endpoint を叩かないこと、
// dev / CI 環境では実 secret に依存しない `bypass` short-circuit が必要なこと、
// が同居する。テストは `fetch` mock を渡し、production は global `fetch` を渡す。
// `bypass` フラグは secret 有無とは独立にしてあり、production で secret 欠落は
// fail-closed (安全側)、dev で `bypass=true` のときは secret 欠落でも意図的に
// fail-open になる。

export type TurnstileVerifyInput = Readonly<{
  token: string;
  /** siteverify の optional `remoteip` field に乗せる visitor IP。 */
  remoteIp?: string;
}>;

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'network' | 'misconfigured' };

export type TurnstileService = Readonly<{
  verify(input: TurnstileVerifyInput): Promise<TurnstileResult>;
}>;

export type TurnstileDeps = Readonly<{
  /** Cloudflare Turnstile widget の secret。 */
  secret: string;
  /** true のとき `verify` は Cloudflare に問い合わせず `{ ok: true }` を返す。 */
  bypass: boolean;
  /** テスト注入用。未指定なら global `fetch` に fallback。 */
  fetch?: typeof globalThis.fetch;
}>;

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// siteverify の 5s 上限。Cloudflare endpoint が遅延 / hung しても `POST /rooms` が
// Workers の wall-time 予算を食い潰さないようにする。timeout は既存の `network`
// reason として表面化し、client には統一の「verification failed」が返る。
const SITEVERIFY_TIMEOUT_MS = 5_000;

// inline TS 型を Zod schema に置き換える。旧来の `as SiteverifyResponse` cast は
// Cloudflare 由来の任意 shape を信頼してしまい、siteverify が `{ success: 'yes' }`
// など別形式を返したときに下の boolean チェックが silently fail-closed (安全側)
// に倒れ、原因がログから見えなくなっていた。
const SiteverifyResponseSchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).optional(),
});

export const createTurnstileService = (deps: TurnstileDeps): TurnstileService => ({
  async verify({ token, remoteIp }) {
    if (deps.bypass) return { ok: true };
    if (!deps.secret) {
      logger.error('turnstile misconfigured: empty secret');
      return { ok: false, reason: 'misconfigured' };
    }
    const fetchImpl = deps.fetch ?? globalThis.fetch;
    try {
      const body = new URLSearchParams({ secret: deps.secret, response: token });
      if (remoteIp) body.set('remoteip', remoteIp);
      const res = await fetchImpl(SITEVERIFY_URL, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
      });
      const raw: unknown = await res.json();
      const parsed = SiteverifyResponseSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('turnstile verify: unexpected siteverify shape', {
          issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })),
        });
        return { ok: false, reason: 'network' };
      }
      if (parsed.data.success) return { ok: true };
      // `error-codes` は user-controlled な bytes を含む可能性があるので、client には
      // 一切 echo せず、structured な server log にだけ残す。
      logger.warn('turnstile verify failed', {
        codes: parsed.data['error-codes'] ?? [],
      });
      return { ok: false, reason: 'invalid' };
    } catch (err: unknown) {
      logger.warn('turnstile verify network error', {
        err: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, reason: 'network' };
    }
  },
});
