import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from './logger';

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'INTERNAL';

export type ErrorEnvelope = {
  ok: false;
  error: { code: ErrorCode; message: string };
};

type AppErrorStatus = 400 | 401 | 404 | 413 | 415 | 500;

const PUBLIC_PATH_MAX = 80;
const sanitizePath = (path: string): string => {
  // Strip ASCII control bytes (0x00-0x1F and DEL 0x7F) so attacker-controlled paths
  // cannot smuggle log-injection sequences (e.g. fake `\n[api] admin logged in`) into
  // structured logs, then cap length to bound response/log size.
  // Using \xNN escapes (not literal control bytes) for source-code readability.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: deliberate stripping of ASCII control bytes.
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
   * @param status HTTP status to return.
   * @param code Machine-readable error code surfaced to clients.
   * @param publicMessage Safe, generic message returned to clients (no internal IDs / paths / user input).
   * @param logContext Optional structured details for server logs only.
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
  // Do not echo the raw request path back to the client; only log it server-side.
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
