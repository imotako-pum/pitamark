import { z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from './logger';

// error code の SSOT。下の Zod enum がこの tuple から派生するので、新 code を
// 追加すると OpenAPI / hc client にも自動伝搬する。
export const ERROR_CODES = [
  'INVALID_REQUEST',
  'UNSUPPORTED_MEDIA_TYPE',
  'PAYLOAD_TOO_LARGE',
  'NOT_FOUND',
  'UNAUTHORIZED',
  // image blocklist hit は generic 400 と区別して 422 を割り当てる。client 側 toast
  // を「画像が使えない」と「リクエスト不正」で出し分けるため。
  'UNPROCESSABLE_ENTITY',
  // rate-limit hit。auth failure と混同せず UI で固有の cooldown ヒントを出せる
  // ように別 code にしている。
  'RATE_LIMITED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ErrorEnvelope = {
  ok: false;
  error: { code: ErrorCode; message: string };
};

type AppErrorStatus = 400 | 401 | 404 | 413 | 415 | 422 | 429 | 500;

// OpenAPI / hc 共通の error response schema。各 route の response schema が新 code
// を自動的に拾えるように、`routes/` ではなくここに置く。
export const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
  }),
});

const PUBLIC_PATH_MAX = 80;
const sanitizePath = (path: string): string => {
  // ASCII control byte (0x00-0x1F + DEL 0x7F) を除去する。attacker-controlled な
  // path から偽の `\n[api] admin logged in` のような log-injection sequence が
  // structured log に混入するのを防ぐため。その後 length も cap して response /
  // log size を抑える。可読性のため literal control byte ではなく \xNN escape を使う。
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ASCII control byte を意図的に除去するため
  const stripped = path.replace(/[\x00-\x1f\x7f]/g, '');
  return stripped.length > PUBLIC_PATH_MAX
    ? `${stripped.slice(0, PUBLIC_PATH_MAX - 1)}…`
    : stripped;
};

export const errorEnvelope = (code: ErrorCode, message: string): ErrorEnvelope => ({
  ok: false,
  error: { code, message },
});

export class AppError extends HTTPException {
  readonly code: ErrorCode;
  /**
   * @param status 返す HTTP status。
   * @param code client に出す machine-readable な error code。
   * @param publicMessage client に返す安全な generic message (internal ID / path / user 入力を含めない)。
   * @param logContext server log だけに残す optional な structured 詳細。
   */
  readonly logContext?: Record<string, unknown>;
  constructor(
    status: AppErrorStatus,
    code: ErrorCode,
    publicMessage: string,
    logContext?: Record<string, unknown>,
  ) {
    super(status, { message: publicMessage });
    this.code = code;
    this.logContext = logContext;
  }
}

export const onAppNotFound = (c: Context) => {
  // raw な request path を client に返さない。server-side log にだけ残す。
  logger.warn('route not found', { path: sanitizePath(c.req.path), method: c.req.method });
  return c.json(errorEnvelope('NOT_FOUND', 'Route not found'), 404);
};

export const onAppError = (err: Error, c: Context) => {
  if (err instanceof AppError) {
    if (err.logContext) {
      logger.warn('app error', {
        code: err.code,
        status: err.status,
        path: sanitizePath(c.req.path),
        ...err.logContext,
      });
    }
    return c.json(errorEnvelope(err.code, err.message), err.status as AppErrorStatus);
  }
  logger.error('unhandled', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: sanitizePath(c.req.path),
  });
  return c.json(errorEnvelope('INTERNAL', 'Internal Server Error'), 500);
};
