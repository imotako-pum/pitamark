import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ROOM_ID_REGEX, RoomSchema } from '@snap-share/shared';
import type { Bindings } from '../lib/bindings';
import { errorEnvelope } from '../lib/error';
import { logger } from '../lib/logger';
import { createRoomService } from '../services/room-service';
import { createR2ImageStorage } from '../storage/r2-image-storage';
import { createR2MetaStorage } from '../storage/r2-meta-storage';

const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum([
      'INVALID_REQUEST',
      'UNSUPPORTED_MEDIA_TYPE',
      'PAYLOAD_TOO_LARGE',
      'NOT_FOUND',
      'INTERNAL',
    ]),
    message: z.string(),
  }),
});

const idParamSchema = z.object({
  id: z.string().regex(ROOM_ID_REGEX),
});

// File field is rendered as `string($binary)` in OpenAPI 3.1.
const uploadFormSchema = z.object({
  image: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
});

const buildService = (env: Bindings) =>
  createRoomService({
    images: createR2ImageStorage(env.IMAGES),
    meta: createR2MetaStorage(env.IMAGES),
    now: () => Date.now(),
    ttlMs: Number(env.ROOM_TTL_MS),
  });

const createRoomRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['rooms'],
  request: {
    body: { content: { 'multipart/form-data': { schema: uploadFormSchema } } },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: RoomSchema } },
      description: 'Room created',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Bad request (missing or empty image)',
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
      content: { 'application/json': { schema: RoomSchema } },
      description: 'Room found',
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

// Chain `.openapi()` calls so the export retains the merged route schema
// (required by `hc<AppType>` for end-to-end type inference).
export const roomsRoute = new OpenAPIHono<{ Bindings: Bindings }>()
  .openapi(
    createRoomRoute,
    async (c) => {
      const { image } = c.req.valid('form');
      const room = await buildService(c.env).create(image);
      return c.json(room, 201);
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
      const room = await buildService(c.env).get(id);
      return c.json(room, 200);
    },
    (result, c) => {
      if (!result.success) {
        return c.json(errorEnvelope('INVALID_REQUEST', 'Invalid room ID'), 400);
      }
      return undefined;
    },
  );
