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

// File field は OpenAPI 3.1 で `string($binary)` として描画される。
// `password` は optional — 空文字列 / 欠落で unprotected room になる。
// `cf-turnstile-response` は API 表面では required だが、dev / CI 環境では
// `BYPASS_TURNSTILE=true` の runtime short-circuit が走るので dummy "ok" 文字列で良い。
// `ttlMs` は optional な room ごとの TTL override (ms)。multipart/form-data なので
// 文字列として届く。ここでは数字 shape のみ validate し、MAX 超過は
// `room-service` が 400 INVALID_REQUEST を返す。
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
        'Room を作成。protected room (`protected: true`) のときは uploader が初回 redirect で gate を skip できるよう access `token` も同梱する。',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description:
        'Bad request (image 欠落、空 file、password が長すぎる、turnstile token 欠落 など)',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Turnstile 検証失敗',
    },
    413: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: '画像が設定上限を超えている',
    },
    415: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'サポート外の画像 MIME type',
    },
    422: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'blocklist で拒否された画像',
    },
    429: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'rate limit 超過',
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
      description: 'room を発見 (protected のときは image を hide)',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: '不正な room ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'room が見つからない',
    },
  },
});

// 有効な 24h JWT (password auth / upload response 由来) を持つ client が WebSocket を
// 開く **前** に叩く endpoint。返される ticket は `/sync/:id` で consume されるので、
// JWT 自体は WS upgrade URL に乗らず、`wrangler tail` や L7 proxy の access log にも
// 残らない。`RL_AUTH` を再利用するのは、ticket issuance を brute-force できる client
// は既に JWT も brute-force できているはずだから。
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
    // `authorization` は意図的に `optional()` にしている。header 欠落を Zod validator
    // の `400 INVALID_REQUEST` ではなく handler 側の `401 UNAUTHORIZED` に落とす契約
    // にするため (「header malformed」ではなく「auth required」が contract)。
    headers: z.object({
      authorization: z.string().optional().openapi({
        description: '`Bearer <jwt>` — `POST /rooms/:id/auth` で発行された JWT と同一。',
      }),
    }),
  },
  responses: {
    201: {
      content: { 'application/json': { schema: WsTicketResponseSchema } },
      description:
        'room に bind された 30 秒 one-shot ticket。WS upgrade で `?ticket=<hex>` として渡す。',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: '不正な room ID または unprotected room',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'bearer token が欠落 / 不正',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'room が見つからない',
    },
    429: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'rate limit 超過',
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
      description: 'password OK、JWT を発行',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: '不正な request / malformed ID / unprotected room',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'password 不一致',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'room が見つからない',
    },
    429: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'rate limit 超過',
    },
  },
});

// `.openapi()` を chain することで、export が merge 済 route schema を保つ
// (`hc<AppType>` の end-to-end 型推論に必要)。rate-limit middleware は
// `OpenAPIHono.use()` ではなく `createRoute({ middleware })` で各 route に inline 宣言
// する — `.use()` chain は typed route info を `any` に潰して `hc` client を壊すため。
export const roomsRoute = new OpenAPIHono<{ Bindings: Bindings }>()
  .openapi(
    createRoomRoute,
    async (c) => {
      const form = c.req.valid('form');
      const { image, password } = form;
      const turnstileToken = form['cf-turnstile-response'];
      // optional な room ごとの TTL override。空 / 欠落なら undefined を渡し、service
      // が `deps.ttlMs` (env default = 24h) に fallback する。`Number()` は Zod schema
      // が `/^\d+$/` で string 形を確定させているので NaN にはならない。
      const ttlMs = form.ttlMs !== undefined ? Number(form.ttlMs) : undefined;
      const room = await buildRoomService(c.env).create(image, {
        password,
        turnstileToken,
        remoteIp: extractClientIp(c.req.raw),
        ...(ttlMs !== undefined ? { ttlMs } : {}),
      });
      // protected room を作成した uploader は直前に自分で password を入力している
      // ため、URL 遷移後に再度 gate を出すのは UX 上のバグ。`room.auth` が立つ場合
      // だけ token を発行して response に含め、client 側 (useImageSource) で
      // sessionStorage に保存する。GET /rooms/:id では token を返さず、protected room
      // の受信者は従来通り authRoute (POST /rooms/:id/auth) で token を取得する。
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

      const room = await roomService.get(id); // 見つからないとき AppError(404) を throw
      if (!room.auth) {
        throw new AppError(400, 'INVALID_REQUEST', 'Room is not password-protected', { id });
      }
      const ok = await passwordService.verify(password, room.auth);
      if (!ok) {
        // 明示的な `logger.warn` を別に出さず、AppError の `logContext` に乗せて
        // `onAppError` が一度だけ warn 出力する形にする (以前は 1 イベントに対して
        // ledger エントリが 2 行出ていた)。公開 message は failure mode に関係なく
        // uniform に保ち、timing も漏れないようにする。
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
      const room = await buildRoomService(c.env).get(id); // 見つからないとき 404 を throw
      // unprotected room は WS upgrade で直接 RL_SYNC を踏むので ticket 不要。ここで
      // 400 を返すことで contract が narrow に保たれる (web client は `room.protected`
      // が true のときだけここを叩く想定)。
      if (!room.auth) {
        throw new AppError(400, 'INVALID_REQUEST', 'Room is not password-protected', { id });
      }
      const bearer = extractBearerToken(c.req.header('authorization'));
      if (!bearer) {
        // 公開 message を bearer 欠落 / 形式不正で出し分けない (timing leak を防ぐ)。
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
      // ticket 自体は log に出さない — 発行成否の boolean だけを残す。
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
