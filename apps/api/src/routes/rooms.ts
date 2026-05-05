import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  AuthResponseSchema,
  RoomCreatedSchema,
  RoomPublicSchema,
  toPublicRoom,
  WsTicketResponseSchema,
} from '@pitamark/shared';
import type { Bindings } from '../lib/bindings';
import { AppError, ErrorResponseSchema, errorEnvelope } from '../lib/error';
import { extractClientIp } from '../lib/ip';
import { logger } from '../lib/logger';
import { idParamSchema } from '../lib/schemas';
import { extractBearerToken } from '../lib/token';
import { withRateLimit } from '../middleware/rate-limit';
import { createImageBlocklistService } from '../services/image-blocklist-service';
import { createPasswordService } from '../services/password-service';
import { createRoomService } from '../services/room-service';
import { createTokenService } from '../services/token-service';
import { createTurnstileService } from '../services/turnstile-service';
import { createWsTicketService } from '../services/ws-ticket-service';
import { createR2ImageStorage } from '../storage/r2-image-storage';
import { createR2MetaStorage } from '../storage/r2-meta-storage';

// File field is rendered as `string($binary)` in OpenAPI 3.1.
// `password` is optional — empty string or absent ⇒ unprotected room.
// `cf-turnstile-response` is required at the API surface; in dev/CI the
// runtime short-circuits via `BYPASS_TURNSTILE=true` so the field can be a
// dummy "ok" string.
// Phase 10.B: `ttlMs` (optional) — per-room TTL override in milliseconds.
// multipart/form-data carries it as a string; we validate the digit shape
// here and let `room-service` enforce the MAX cap as 400 INVALID_REQUEST.
const uploadFormSchema = z.object({
  image: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
  password: z.string().max(256).optional().openapi({ type: 'string' }),
  'cf-turnstile-response': z.string().min(1).max(2048).openapi({ type: 'string' }),
  ttlMs: z
    .string()
    .regex(/^\d+$/, { message: 'ttlMs must be a non-negative integer' })
    .optional()
    .openapi({ type: 'string' }),
});

const authBodySchema = z.object({
  password: z.string().min(1).max(256),
});

const buildPasswordService = () => createPasswordService();

const buildRoomService = (env: Bindings) =>
  createRoomService({
    images: createR2ImageStorage(env.IMAGES),
    meta: createR2MetaStorage(env.IMAGES),
    now: () => Date.now(),
    ttlMs: Number(env.ROOM_TTL_MS),
    password: buildPasswordService(),
    turnstile: createTurnstileService({
      secret: env.TURNSTILE_SECRET_KEY,
      bypass: env.BYPASS_TURNSTILE === 'true',
    }),
    blocklist: createImageBlocklistService({ kv: env.IMAGE_BLOCKLIST }),
  });

const buildTokenService = (env: Bindings) => createTokenService({ secret: env.ROOM_TOKEN_SECRET });

const createRoomRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['rooms'],
  middleware: [
    withRateLimit({
      binding: (env) => env.RL_CREATE_ROOM,
      keyFn: (c) => `rooms-create:${extractClientIp(c.req.raw)}`,
      routeId: 'rooms-create',
    }),
  ] as const,
  request: {
    body: { content: { 'multipart/form-data': { schema: uploadFormSchema } } },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: RoomCreatedSchema } },
      description:
        'Room created. For protected rooms (`protected: true`) the response also carries an access `token` so the uploader skips the gate on first redirect.',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description:
        'Bad request (missing image, empty file, password too long, or missing turnstile token)',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Turnstile verification failed',
    },
    413: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Image larger than the configured limit',
    },
    415: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unsupported image MIME type',
    },
    422: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Image rejected by the blocklist',
    },
    429: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Rate limit exceeded',
    },
  },
});

const getRoomRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['rooms'],
  request: { params: idParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: RoomPublicSchema } },
      description: 'Room found (image hidden when protected)',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid room ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Room not found',
    },
  },
});

// Phase 8.x security review #13 H1: clients call this AFTER they have a
// valid 24h JWT (from password auth or upload response) and BEFORE opening
// the WebSocket. The returned ticket is consumed by `/sync/:id` so the JWT
// itself never appears in the WS upgrade URL — and therefore never lands in
// `wrangler tail` or any L7 proxy access log. RL_AUTH is reused: a client
// that brute-forces ticket issuance would have already brute-forced the JWT.
const wsTicketRoute = createRoute({
  method: 'post',
  path: '/{id}/ws-ticket',
  tags: ['rooms'],
  middleware: [
    withRateLimit({
      binding: (env) => env.RL_AUTH,
      keyFn: (c) => `rooms-ws-ticket:${c.req.param('id')}:${extractClientIp(c.req.raw)}`,
      routeId: 'rooms-ws-ticket',
    }),
  ] as const,
  request: {
    params: idParamSchema,
    // `authorization` is intentionally `optional()` so a missing header maps
    // to `401 UNAUTHORIZED` from the handler rather than `400 INVALID_REQUEST`
    // from the Zod validator. The contract is "auth required" not
    // "header malformed".
    headers: z.object({
      authorization: z.string().optional().openapi({
        description: 'Bearer <jwt> — same JWT issued by `POST /rooms/:id/auth`.',
      }),
    }),
  },
  responses: {
    201: {
      content: { 'application/json': { schema: WsTicketResponseSchema } },
      description:
        '30s one-shot ticket bound to the room. Pass it as `?ticket=<hex>` on the WS upgrade.',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid room ID or unprotected room',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Missing or invalid bearer token',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Room not found',
    },
    429: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Rate limit exceeded',
    },
  },
});

const authRoute = createRoute({
  method: 'post',
  path: '/{id}/auth',
  tags: ['rooms'],
  middleware: [
    withRateLimit({
      binding: (env) => env.RL_AUTH,
      keyFn: (c) => `rooms-auth:${c.req.param('id')}:${extractClientIp(c.req.raw)}`,
      routeId: 'rooms-auth',
    }),
  ] as const,
  request: {
    params: idParamSchema,
    body: { content: { 'application/json': { schema: authBodySchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AuthResponseSchema } },
      description: 'Password accepted; JWT issued',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request, malformed ID, or unprotected room',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Wrong password',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Room not found',
    },
    429: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Rate limit exceeded',
    },
  },
});

// Chain `.openapi()` calls so the export retains the merged route schema
// (required by `hc<AppType>` for end-to-end type inference). Rate-limit
// middleware is declared inline on each route via `createRoute({ middleware })`
// rather than via `OpenAPIHono.use()` — chaining `.use()` collapses the typed
// route info to `any` and breaks the `hc` client.
export const roomsRoute = new OpenAPIHono<{ Bindings: Bindings }>()
  .openapi(
    createRoomRoute,
    async (c) => {
      const form = c.req.valid('form');
      const { image, password } = form;
      const turnstileToken = form['cf-turnstile-response'];
      // Phase 10.B: optional per-room TTL override. Empty / absent → undefined,
      // service falls back to `deps.ttlMs` (env default = 24h). The Number()
      // call is safe because the Zod schema already pinned the string shape
      // to /^\d+$/, so it cannot return NaN here.
      const ttlMs = form.ttlMs !== undefined ? Number(form.ttlMs) : undefined;
      const room = await buildRoomService(c.env).create(image, {
        password,
        turnstileToken,
        remoteIp: extractClientIp(c.req.raw),
        ...(ttlMs !== undefined ? { ttlMs } : {}),
      });
      // Phase 7.6 既知-5 fix: protected room を作成した uploader は自分で
      // password を入力したばかりなので、URL 遷移後に再度ゲートを出すのは
      // UX 的にバグ。room.auth が立っている場合のみ token を発行して
      // レスポンスに含め、クライアント側 (useImageSource) で sessionStorage
      // に保存する。GET /rooms/:id では token を返さず、protected ルームの
      // 受信者は従来通り authRoute (POST /rooms/:id/auth) で token 取得。
      const token = room.auth ? await buildTokenService(c.env).issue(room.id) : undefined;
      return c.json({ ...toPublicRoom(room), ...(token ? { token } : {}) }, 201);
    },
    (result, c) => {
      if (!result.success) {
        logger.warn('upload validation failed', {
          path: c.req.path,
          issues: result.error.issues.map((i) => ({ path: i.path, code: i.code })),
        });
        return c.json(errorEnvelope('INVALID_REQUEST', 'image field is required'), 400);
      }
      return undefined;
    },
  )
  .openapi(
    getRoomRoute,
    async (c) => {
      const { id } = c.req.valid('param');
      const room = await buildRoomService(c.env).get(id);
      return c.json(toPublicRoom(room), 200);
    },
    (result, c) => {
      if (!result.success) {
        return c.json(errorEnvelope('INVALID_REQUEST', 'Invalid room ID'), 400);
      }
      return undefined;
    },
  )
  .openapi(
    authRoute,
    async (c) => {
      const { id } = c.req.valid('param');
      const { password } = c.req.valid('json');
      const roomService = buildRoomService(c.env);
      const passwordService = buildPasswordService();
      const tokenService = buildTokenService(c.env);

      const room = await roomService.get(id); // throws AppError(404) if missing
      if (!room.auth) {
        throw new AppError(400, 'INVALID_REQUEST', 'Room is not password-protected', { id });
      }
      const ok = await passwordService.verify(password, room.auth);
      if (!ok) {
        // Phase 8.x error-envelope review #11 L2: rely on AppError's
        // logContext (warned once by `onAppError`) instead of a separate
        // explicit `logger.warn` that produced two ledger entries for one
        // event. Public message stays uniform regardless of failure mode
        // so it cannot leak timing.
        throw new AppError(401, 'UNAUTHORIZED', 'Invalid password', {
          id,
          event: 'auth_failed',
        });
      }
      const token = await tokenService.issue(id);
      logger.info('auth success', { id });
      return c.json({ token }, 200);
    },
    (result, c) => {
      if (!result.success) {
        return c.json(errorEnvelope('INVALID_REQUEST', 'Invalid request body or room ID'), 400);
      }
      return undefined;
    },
  )
  .openapi(
    wsTicketRoute,
    async (c) => {
      const { id } = c.req.valid('param');
      const room = await buildRoomService(c.env).get(id); // throws 404 if missing
      // Unprotected rooms hit RL_SYNC directly on the WS upgrade — they do
      // not need a ticket. Returning 400 keeps the contract narrow: web
      // clients only call this when `room.protected` is true.
      if (!room.auth) {
        throw new AppError(400, 'INVALID_REQUEST', 'Room is not password-protected', { id });
      }
      const bearer = extractBearerToken(c.req.header('authorization'));
      if (!bearer) {
        // Public message must not vary on bearer absence vs invalid format.
        logger.warn('ws-ticket denied: missing bearer', { id });
        throw new AppError(401, 'UNAUTHORIZED', 'Bearer token required', { id });
      }
      const tokenSvc = createTokenService({ secret: c.env.ROOM_TOKEN_SECRET });
      const verify = await tokenSvc.verify(bearer, id);
      if (!verify.ok) {
        logger.warn('ws-ticket denied: invalid bearer', { id, reason: verify.reason });
        throw new AppError(401, 'UNAUTHORIZED', 'Invalid bearer token', { id });
      }
      const ws = createWsTicketService({ kv: c.env.WS_TICKETS });
      const { ticket } = await ws.issue(id);
      // Never log the ticket — only an issued boolean.
      logger.info('ws-ticket issued', { id, issued: true });
      return c.json({ ticket }, 201);
    },
    (result, c) => {
      if (!result.success) {
        return c.json(errorEnvelope('INVALID_REQUEST', 'Invalid room ID or headers'), 400);
      }
      return undefined;
    },
  );
