import type { Context, MiddlewareHandler } from 'hono';
import type { Bindings } from '../lib/bindings';
import { AppError } from '../lib/error';
import { extractClientIp, redactIp } from '../lib/ip';
import { logger } from '../lib/logger';

// Phase 7: thin Hono middleware around `RateLimit.limit({ key })`.
//
// Two intentional fail-open behaviours:
//   1. `binding === undefined` → passthrough. Tests that build env without
//      providing a stub still exercise the handler logic.
//   2. `binding.limit(...)` throws → passthrough. If Cloudflare's RL plane
//      glitches we would rather serve traffic than 500 every request.

export type RateLimitContext = Context<{ Bindings: Bindings }>;

export type RateLimitOptions = Readonly<{
  /** Resolves the binding from env (e.g. `(env) => env.RL_CREATE_ROOM`). */
  binding: (env: Bindings) => RateLimit | undefined;
  /** Builds the limiter key. Receives the Hono context for `param()` access. */
  keyFn: (c: RateLimitContext) => string;
  /** Identifier surfaced in logs (e.g. 'rooms-create'). */
  routeId: string;
}>;

export const withRateLimit = (
  opts: RateLimitOptions,
): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next) => {
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
      // RL binding errored. Fail open so the API stays usable, but log so the
      // outage is visible.
      logger.error('rate limit binding error (fail-open)', {
        route: opts.routeId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return next();
  };
};
