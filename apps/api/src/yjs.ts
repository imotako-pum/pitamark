import { ROOM_ID_REGEX } from '@snap-share/shared';
import { Hono } from 'hono';
import { YDurableObjects, yRoute } from 'y-durableobjects';
import type { Bindings } from './lib/bindings';
import { errorEnvelope } from './lib/error';
import { extractClientIp, redactIp } from './lib/ip';
import { logger } from './lib/logger';
import { createPasswordService } from './services/password-service';
import { createRoomService } from './services/room-service';
import { createWsTicketService } from './services/ws-ticket-service';
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
      // Phase 8.x security review #13 H1: protected rooms now exchange a
      // 32-hex one-shot ticket here, not the long-lived JWT. The web client
      // calls `POST /rooms/:id/ws-ticket` first, then opens the WS with
      // `?ticket=<hex>`. The ticket is consumed (deleted from KV) on first
      // use so URL leaks (wrangler tail, Referer, browser history) cannot
      // be replayed beyond the 30s TTL window. Never log the ticket itself;
      // `ticketPresent` and the consume reason are sufficient for triage.
      const ticket = c.req.query('ticket');
      if (!ticket) {
        logger.warn('sync ws denied: missing ticket', { id, ticketPresent: false });
        return c.json(errorEnvelope('UNAUTHORIZED', 'Ticket required'), 401);
      }
      const wsTickets = createWsTicketService({ kv: c.env.WS_TICKETS });
      const consumed = await wsTickets.consume(ticket, id);
      if (!consumed.ok) {
        logger.warn('sync ws denied: invalid ticket', {
          id,
          reason: consumed.reason,
          ticketPresent: true,
        });
        return c.json(errorEnvelope('UNAUTHORIZED', 'Invalid ticket'), 401);
      }
    } else {
      // Phase 7: protected rooms already pay PBKDF2 + token verify, which is
      // an effective rate limit on its own. Unprotected rooms have no such
      // pacing, so apply RL_SYNC keyed on the visitor IP. Fail open if the
      // binding errors so a transient RL outage does not break collab.
      //
      // Phase 7.6: BYPASS_RATE_LIMIT="true" は dev/E2E 用エスケープハッチ。
      // `withRateLimit` middleware と挙動を揃える (未適用だと room-share の
      // Yjs 同期 spec が CI Linux で `sync ws denied: rate limit` のため
      // 3 retry 全敗していた既知の死角)。production は env 未設定 / "false" で
      // 通常の RL_SYNC が効く。
      const rl = c.env.BYPASS_RATE_LIMIT === 'true' ? undefined : c.env.RL_SYNC;
      if (rl) {
        const ip = extractClientIp(c.req.raw);
        try {
          const { success } = await rl.limit({ key: `sync:${ip}` });
          if (!success) {
            logger.warn('sync ws denied: rate limit', { id, ip: redactIp(ip) });
            return c.json(errorEnvelope('RATE_LIMITED', 'Too many requests'), 429);
          }
        } catch (err: unknown) {
          logger.error('sync rate limit binding error (fail-open)', {
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    return next();
  })
  .route(
    '/',
    yRoute<{ Bindings: Bindings }>((env) => env.Y_ROOM),
  );
