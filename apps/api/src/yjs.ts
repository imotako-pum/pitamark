import { ROOM_ID_REGEX } from '@pitamark/shared';
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

// `SnapShareYDO` は `YDurableObjects` を継承し、TTL クリーンアップ用 DO Alarm を
// 配線する。class は `wrangler.toml` の `class_name = "SnapShareYDO"` で bind され、
// migration v2 で v1 の `YDurableObjects` をこの class に rename することで、稼働中の
// DO が rollout を生き延びる。
export class SnapShareYDO extends YDurableObjects<{ Bindings: Bindings }> {
  protected override async onStart(): Promise<void> {
    // y-durableobjects の onStart が内側の Yjs doc + storage を初期化する。super
    // を必ず先に呼ぶこと — super 解決前に `this.doc` にアクセスすると UB。
    await super.onStart();

    // クリーンアップ alarm は DO 1 lifecycle に 1 回だけ設定する。Hibernation
    // wake などの再起動時は `getAlarm()` が non-null なので setAlarm を skip。
    const existing = await this.state.storage.getAlarm();
    if (existing != null) return;

    // yRoute が `idFromName(roomId)` を使うので、WS upgrade 経由で作られた DO は
    // `state.id.name` に roomId が乗っている。
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
    // `getMeta` は storage error で throw することがあるが、ここでは致命的扱いにし
    // ない (最終の DO storage wipe が cleanup の正本)。
    const room = await meta.getMeta(roomId).catch(() => null);
    if (room) {
      await images.deleteImage(room.image.key);
    }
    await meta.deleteMeta(roomId);
    await this.state.storage.deleteAll();
  }
}

// 元の名前を残しておくことで、`YDurableObjects` を参照する外部 tooling (legacy
// migration / debug log 等) が壊れずに resolve できる。
export { YDurableObjects, yRoute };

// WS 側の read-only factory。`turnstile` / `blocklist` 依存は持たない (この経路から
// `create` することはないため)。`rooms.ts` 側の factory は full-featured で別名。
const buildRoomReadService = (env: Bindings) =>
  createRoomService({
    images: createR2ImageStorage(env.IMAGES),
    meta: createR2MetaStorage(env.IMAGES),
    now: () => Date.now(),
    ttlMs: Number(env.ROOM_TTL_MS),
    password: createPasswordService(),
  });

// yRoute に upgrade を渡す前に、room の存在 + (protected なら) token authorization
// を検証する。`ROOM_ID_REGEX` は storage に触れる前に malformed path
// (path-traversal 等) を弾く。
//
// `syncRoute` は OpenAPIHono + `createRoute({ middleware })` ではなく、plain `Hono` +
// `.use()` チェーンのまま。WebSocket upgrade path で、`y-websocket` の
// `WebsocketProvider` (apps/web/src/hooks/useYjsAnnotationsStore.ts) からのみ叩かれる。
// `apps/api/src/index.ts` で `routed` ではなく `app` に mount しているので `AppType` に
// 漏れず、「.use() chain 禁止」policy は AppType 公開 route (= typed `hc<AppType>`
// shape を要求するもの) にだけ適用される構造を保つ。
export const syncRoute = new Hono<{ Bindings: Bindings }>()
  .use('/:id', async (c, next) => {
    const id = c.req.param('id');
    if (!ROOM_ID_REGEX.test(id)) {
      return c.json(errorEnvelope('INVALID_REQUEST', 'Invalid room ID'), 400);
    }
    const service = buildRoomReadService(c.env);
    let room: Awaited<ReturnType<typeof service.get>>;
    try {
      room = await service.get(id);
    } catch {
      logger.warn('sync ws denied: room not found', { id });
      return c.json(errorEnvelope('NOT_FOUND', 'Room not found'), 404);
    }
    if (room.auth) {
      // protected room はここで 32 hex の one-shot ticket を交換する (long-lived JWT
      // ではない)。web client は先に `POST /rooms/:id/ws-ticket` を叩き、その後
      // `?ticket=<hex>` で WS を開く。ticket は初回 use で KV から削除されるので、
      // URL 漏洩 (wrangler tail / Referer / browser history) を 30s TTL を超えて
      // replay できない。ticket 自体は決して log に出さない — `ticketPresent` と
      // consume 失敗 reason だけで triage は十分。
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
      // protected room は既に PBKDF2 + token verify のコストを払っており、それ自体
      // が実質的な rate limit になっている。unprotected room はそれが無いので、
      // visitor IP をキーに RL_SYNC を適用する。binding が error を返したときは
      // fail-open: 一時的な RL 障害で collab が壊れないようにする。
      //
      // BYPASS_RATE_LIMIT="true" は dev / E2E 用 escape hatch。`withRateLimit`
      // middleware と挙動を揃えていないと、CI Linux で room-share の Yjs 同期 spec
      // が `sync ws denied: rate limit` で 3 retry 全敗する死角があった。production
      // では env 未設定 / "false" で通常の RL_SYNC が効く。
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
