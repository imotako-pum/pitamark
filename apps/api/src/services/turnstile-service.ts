import { z } from 'zod';
import { logger } from '../lib/logger';

// Phase 7: server-side Turnstile siteverify wrapper.
//
// Why DI'd: tests must never hit the live siteverify endpoint, and dev/CI
// environments need a `bypass` short-circuit that does not rely on the real
// secret. Test code passes a `fetch` mock; production passes the global
// `fetch`. The `bypass` flag exists separately from secret presence so a
// missing secret in production fails closed, while a missing secret in dev
// (with `bypass=true`) fails open intentionally.

export type TurnstileVerifyInput = Readonly<{
  token: string;
  /** Visitor IP for the optional `remoteip` siteverify field. */
  remoteIp?: string;
}>;

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'network' | 'misconfigured' };

export type TurnstileService = Readonly<{
  verify(input: TurnstileVerifyInput): Promise<TurnstileResult>;
}>;

export type TurnstileDeps = Readonly<{
  /** Cloudflare Turnstile widget secret. */
  secret: string;
  /** When true, `verify` returns `{ ok: true }` without contacting Cloudflare. */
  bypass: boolean;
  /** Injected for tests; falls back to the global `fetch`. */
  fetch?: typeof globalThis.fetch;
}>;

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// 5s ceiling for siteverify so a slow / hung Cloudflare endpoint cannot drag
// `POST /rooms` past the Workers wall-time budget. Timeouts surface as the
// existing `network` reason; clients see a uniform "verification failed".
const SITEVERIFY_TIMEOUT_MS = 5_000;

// Phase 8.x typesafety review #6 M1: replace the inline TS-only type with
// a Zod schema. The previous `as SiteverifyResponse` cast trusted any
// shape from Cloudflare; if siteverify ever returned `{ success: 'yes' }`
// or a different field, the boolean check below would silently degrade
// to fail-closed (safe) but obscure the actual cause from logs.
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
      // `error-codes` may include user-controlled bytes; never echo it to clients,
      // only into structured server logs.
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
