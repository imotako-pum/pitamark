import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ROOM_ID_REGEX, RoomPublicSchema, toPublicRoom } from '@snap-share/shared';
import type { Bindings } from '../lib/bindings';
import { AppError, ErrorResponseSchema, errorEnvelope } from '../lib/error';
import { logger } from '../lib/logger';
import { createPasswordService } from '../services/password-service';
import { createRoomService } from '../services/room-service';
import { createTokenService } from '../services/token-service';
import { createR2ImageStorage } from '../storage/r2-image-storage';
import { createR2MetaStorage } from '../storage/r2-meta-storage';

const idParamSchema = z.object({
  id: z.string().regex(ROOM_ID_REGEX),
});

// File field is rendered as `string($binary)` in OpenAPI 3.1.
// `password` is optional — empty string or absent ⇒ unprotected room.
const uploadFormSchema = z.object({
  image: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
  password: z.string().max(256).optional().openapi({ type: 'string' }),
});

const authBodySchema = z.object({
  password: z.string().min(1).max(256),
});

const authResponseSchema = z.object({
  token: z.string(),
});

const buildPasswordService = () => createPasswordService();

const buildRoomService = (env: Bindings) =>
  createRoomService({
    images: createR2ImageStorage(env.IMAGES),
    meta: createR2MetaStorage(env.IMAGES),
    now: () => Date.now(),
    ttlMs: Number(env.ROOM_TTL_MS),
    password: buildPasswordService(),
  });

const buildTokenService = (env: Bindings) => createTokenService({ secret: env.ROOM_TOKEN_SECRET });

const createRoomRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['rooms'],
  request: {
    body: { content: { 'multipart/form-data': { schema: uploadFormSchema } } },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: RoomPublicSchema } },
      description: 'Room created',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Bad request (missing image, empty file, or password too long)',
    },
    413: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Image larger than the configured limit',
    },
    415: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unsupported image MIME type',
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

const authRoute = createRoute({
  method: 'post',
  path: '/{id}/auth',
  tags: ['rooms'],
  request: {
    params: idParamSchema,
    body: { content: { 'application/json': { schema: authBodySchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: authResponseSchema } },
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
  },
});

// Chain `.openapi()` calls so the export retains the merged route schema
// (required by `hc<AppType>` for end-to-end type inference).
export const roomsRoute = new OpenAPIHono<{ Bindings: Bindings }>()
  .openapi(
    createRoomRoute,
    async (c) => {
      const { image, password } = c.req.valid('form');
      const room = await buildRoomService(c.env).create(image, password);
      return c.json(toPublicRoom(room), 201);
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
        // Public message must not vary on failure mode (timing). Never log password.
        logger.warn('auth failed', { id });
        throw new AppError(401, 'UNAUTHORIZED', 'Invalid password', { id });
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
  );
