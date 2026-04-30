import { zValidator } from '@hono/zod-validator';
import { ROOM_ID_REGEX } from '@snap-share/shared';
import { Hono } from 'hono';
import * as z from 'zod';
import type { Bindings } from '../lib/bindings';
import { errorEnvelope } from '../lib/error';
import { logger } from '../lib/logger';
import { createRoomService } from '../services/room-service';
import { createR2ImageStorage } from '../storage/r2-image-storage';
import { createR2MetaStorage } from '../storage/r2-meta-storage';

const uploadSchema = z.object({
  image: z.instanceof(File),
});

const idParamSchema = z.object({ id: z.string().regex(ROOM_ID_REGEX) });

const buildService = (env: Bindings) =>
  createRoomService({
    images: createR2ImageStorage(env.IMAGES),
    meta: createR2MetaStorage(env.IMAGES),
    now: () => Date.now(),
    ttlMs: Number(env.ROOM_TTL_MS),
  });

export const roomsRoute = new Hono<{ Bindings: Bindings }>();

roomsRoute.post(
  '/',
  zValidator('form', uploadSchema, (result, c) => {
    if (!result.success) {
      logger.warn('upload validation failed', {
        path: c.req.path,
        issues: result.error.issues.map((i) => ({ path: i.path, code: i.code })),
      });
      return c.json(errorEnvelope('INVALID_REQUEST', 'image field is required'), 400);
    }
    return undefined;
  }),
  async (c) => {
    const { image } = c.req.valid('form');
    const room = await buildService(c.env).create(image);
    return c.json(room, 201);
  },
);

roomsRoute.get(
  '/:id',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) {
      return c.json(errorEnvelope('INVALID_REQUEST', 'Invalid room ID'), 400);
    }
    return undefined;
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const room = await buildService(c.env).get(id);
    return c.json(room);
  },
);
