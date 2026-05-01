import { ROOM_ID_REGEX } from '@snap-share/shared';
import { Hono } from 'hono';
import { YDurableObjects, yRoute } from 'y-durableobjects';
import type { Bindings } from './lib/bindings';
import { errorEnvelope } from './lib/error';
import { logger } from './lib/logger';
import { createRoomService } from './services/room-service';
import { createR2ImageStorage } from './storage/r2-image-storage';
import { createR2MetaStorage } from './storage/r2-meta-storage';

// Re-export so wrangler can detect the DO class via the worker module's
// top-level named exports (class_name = "YDurableObjects" in wrangler.toml).
export { YDurableObjects };

// Validate that the room exists in R2 meta before letting yRoute upgrade the
// connection. ROOM_ID_REGEX rejects malformed paths (path-traversal etc.)
// before we touch storage.
export const syncRoute = new Hono<{ Bindings: Bindings }>()
  .use('/:id', async (c, next) => {
    const id = c.req.param('id');
    if (!ROOM_ID_REGEX.test(id)) {
      return c.json(errorEnvelope('INVALID_REQUEST', 'Invalid room ID'), 400);
    }
    const service = createRoomService({
      images: createR2ImageStorage(c.env.IMAGES),
      meta: createR2MetaStorage(c.env.IMAGES),
      now: () => Date.now(),
      ttlMs: Number(c.env.ROOM_TTL_MS),
    });
    try {
      await service.get(id);
    } catch {
      logger.warn('sync ws denied: room not found', { id });
      return c.json(errorEnvelope('NOT_FOUND', 'Room not found'), 404);
    }
    return next();
  })
  .route(
    '/',
    yRoute<{ Bindings: Bindings }>((env) => env.Y_ROOM),
  );
