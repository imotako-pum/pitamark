import { ROOM_ID_REGEX } from '@snap-share/shared';
import { Hono } from 'hono';
import { YDurableObjects, yRoute } from 'y-durableobjects';
import type { Bindings } from './lib/bindings';
import { errorEnvelope } from './lib/error';
import { logger } from './lib/logger';
import { createPasswordService } from './services/password-service';
import { createRoomService } from './services/room-service';
import { createTokenService } from './services/token-service';
import { createR2ImageStorage } from './storage/r2-image-storage';
import { createR2MetaStorage } from './storage/r2-meta-storage';

// `SnapShareYDO` subclasses `YDurableObjects` to wire up DO Alarms for TTL
// cleanup. The class is bound via `class_name = "SnapShareYDO"` in
// wrangler.toml; migration v2 renames v1's `YDurableObjects` to this class
// so existing live DOs survive the rollout.
export class SnapShareYDO extends YDurableObjects<{ Bindings: Bindings }> {
  protected override async onStart(): Promise<void> {
    // y-durableobjects' onStart bootstraps the inner Yjs doc + storage. Always
    // run super FIRST — accessing `this.doc` before super resolves is UB.
    await super.onStart();

    // Set the cleanup alarm exactly once per DO lifetime: subsequent restarts
    // (Hibernation wake) skip the setAlarm call since `getAlarm()` is non-null.
    const existing = await this.state.storage.getAlarm();
    if (existing != null) return;

    // `idFromName(roomId)` is what yRoute uses, so `state.id.name` carries
    // the roomId for any DO created via the WS upgrade path.
    const roomId = this.state.id.name;
    if (!roomId) return;

    const meta = createR2MetaStorage(this.env.IMAGES);
    const room = await meta.getMeta(roomId).catch(() => null);
    if (!room) return;

    await this.state.storage.setAlarm(room.createdAt + room.ttlMs);
  }

  override async alarm(): Promise<void> {
    const roomId = this.state.id.name ?? '<unknown>';
    logger.info('alarm fired, cleaning up room', { id: roomId });
    const images = createR2ImageStorage(this.env.IMAGES);
    const meta = createR2MetaStorage(this.env.IMAGES);
    // `getMeta` may throw on storage errors — non-fatal here, the DO storage
    // wipe at the end is the authoritative cleanup signal.
    const room = await meta.getMeta(roomId).catch(() => null);
    if (room) {
      await images.deleteImage(room.image.key);
    }
    await meta.deleteMeta(roomId);
    await this.state.storage.deleteAll();
  }
}

// Keep the original name available so any external tooling that still
// references `YDurableObjects` (legacy migrations, debug logs) keeps resolving.
export { YDurableObjects, yRoute };

const buildRoomService = (env: Bindings) =>
  createRoomService({
    images: createR2ImageStorage(env.IMAGES),
    meta: createR2MetaStorage(env.IMAGES),
    now: () => Date.now(),
    ttlMs: Number(env.ROOM_TTL_MS),
    password: createPasswordService(),
  });

// Validate room existence + (when protected) token authorization before
// letting yRoute upgrade the connection. ROOM_ID_REGEX rejects malformed
// paths (path-traversal etc.) before we touch storage.
export const syncRoute = new Hono<{ Bindings: Bindings }>()
  .use('/:id', async (c, next) => {
    const id = c.req.param('id');
    if (!ROOM_ID_REGEX.test(id)) {
      return c.json(errorEnvelope('INVALID_REQUEST', 'Invalid room ID'), 400);
    }
    const service = buildRoomService(c.env);
    let room: Awaited<ReturnType<typeof service.get>>;
    try {
      room = await service.get(id);
    } catch {
      logger.warn('sync ws denied: room not found', { id });
      return c.json(errorEnvelope('NOT_FOUND', 'Room not found'), 404);
    }
    if (room.auth) {
      // WebSocket cannot send Authorization headers — token rides as a query
      // param. Never log the token; only `tokenPresent`.
      const token = c.req.query('token');
      if (!token) {
        logger.warn('sync ws denied: missing token', { id, tokenPresent: false });
        return c.json(errorEnvelope('UNAUTHORIZED', 'Token required'), 401);
      }
      const tokenSvc = createTokenService({ secret: c.env.ROOM_TOKEN_SECRET });
      const result = await tokenSvc.verify(token, id);
      if (!result.ok) {
        logger.warn('sync ws denied: invalid token', {
          id,
          reason: result.reason,
          tokenPresent: true,
        });
        return c.json(errorEnvelope('UNAUTHORIZED', 'Invalid token'), 401);
      }
    }
    return next();
  })
  .route(
    '/',
    yRoute<{ Bindings: Bindings }>((env) => env.Y_ROOM),
  );
