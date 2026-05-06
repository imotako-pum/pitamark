import type { Context, MiddlewareHandler } from 'hono';
import type { Bindings } from '../lib/bindings';
import { AppError } from '../lib/error';
import { extractClientIp, redactIp } from '../lib/ip';
import { logger } from '../lib/logger';

// `RateLimit.limit({ key })` を薄く wrap した Hono middleware。
//
// 意図的な fail-open は 2 つ:
//   1. `binding === undefined` → passthrough。stub を渡さずに env を組むテストでも
//      handler ロジックを exercise できる。
//   2. `binding.limit(...)` が throw → passthrough。Cloudflare の RL plane が glitch
//      したときに毎 request 500 を返すよりも、traffic を流し続ける方が望ましい。

export type RateLimitContext = Context<{ Bindings: Bindings }>;

export type RateLimitOptions = Readonly<{
  /** env から binding を解決する (例: `(env) => env.RL_CREATE_ROOM`)。 */
  binding: (env: Bindings) => RateLimit | undefined;
  /** limiter key を組む。`param()` を叩くため Hono context を受け取る。 */
  keyFn: (c: RateLimitContext) => string;
  /** log に出す識別子 (例: 'rooms-create')。 */
  routeId: string;
}>;

export const withRateLimit = (
  opts: RateLimitOptions,
): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
    // BYPASS_RATE_LIMIT="true" は dev / E2E 用の escape hatch。production の上限
    // (RL_CREATE_ROOM の 5/60s) が、14+ rooms を並列作成する Playwright suite を
    // 壊さないようにするため。production env では未設定 / "false" を維持して、
    // 実 RL が効くようにする。
    if (c.env.BYPASS_RATE_LIMIT === 'true') {
      return next();
    }
    const binding = opts.binding(c.env);
    if (!binding) {
      return next();
    }
    const key = opts.keyFn(c);
    try {
      const { success } = await binding.limit({ key });
      if (!success) {
        const ip = extractClientIp(c.req.raw);
        logger.warn('rate limit hit', {
          route: opts.routeId,
          ip: redactIp(ip),
        });
        throw new AppError(429, 'RATE_LIMITED', 'Too many requests');
      }
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      // RL binding が error。API を使える状態に保つため fail-open するが、障害が
      // 観測できるよう log には残す。
      logger.error('rate limit binding error (fail-open)', {
        route: opts.routeId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return next();
  };
};
