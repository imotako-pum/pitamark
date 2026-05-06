import {
  ALLOWED_IMAGE_MIME_TYPES,
  type AllowedImageMimeType,
  MAX_IMAGE_BYTES,
  MAX_ROOM_TTL_MS,
  type Room,
} from '@pitamark/shared';
import { AppError } from '../lib/error';
import { generateRoomId } from '../lib/id';
import { logger } from '../lib/logger';
import { sha256Hex } from '../lib/sha256';
import type { ImageStorage } from '../storage/r2-image-storage';
import type { MetaStorage } from '../storage/r2-meta-storage';
import type { ImageBlocklistService } from './image-blocklist-service';
import type { PasswordService } from './password-service';
import type { TurnstileService } from './turnstile-service';

export type RoomServiceDeps = {
  images: ImageStorage;
  meta: MetaStorage;
  now: () => number;
  ttlMs: number;
  password: PasswordService;
  /**
   * Turnstile 検証 (任意)。テストや legacy caller は省略可で、その場合 `create` は
   * token check を skip する。
   */
  turnstile?: TurnstileService;
  /** SHA-256 blocklist (任意)。省略時は全画像が pass する。 */
  blocklist?: ImageBlocklistService;
  /**
   * テスト用の hash 関数 override。call ごとに digest を再計算したくないテスト向け。
   * 既定は実 Web Crypto の `sha256Hex` ヘルパ。
   */
  sha256?: (buf: ArrayBuffer) => Promise<string>;
};

export type RoomCreateOptions = Readonly<{
  password?: string;
  /** Turnstile widget からの token。`deps.turnstile` が設定されているとき必須。 */
  turnstileToken?: string;
  /** siteverify に転送する visitor IP。任意。 */
  remoteIp?: string;
  /**
   * room ごとの TTL override (ms)。省略時は server が `deps.ttlMs` (env 由来の
   * default = 24h) に fallback する。正の integer かつ `MAX_ROOM_TTL_MS` (7 日) 以下
   * でなければならず、それ以外は 400 INVALID_REQUEST。
   */
  ttlMs?: number;
}>;

export type RoomService = {
  create(file: File, opts?: RoomCreateOptions): Promise<Room>;
  get(id: string): Promise<Room>;
};

const extOf = (contentType: AllowedImageMimeType): string => {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
  }
};

const isAllowedMime = (type: string): type is AllowedImageMimeType =>
  (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(type);

const assertAllowedMime = (type: string): AllowedImageMimeType => {
  if (!isAllowedMime(type)) {
    // 公開 message に user-controlled な `type` を echo しない (logContext にだけ残す)。
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type', {
      receivedType: type,
    });
  }
  return type;
};

const assertValidTtlMs = (ttlMs: number): void => {
  if (!Number.isFinite(ttlMs) || !Number.isInteger(ttlMs) || ttlMs <= 0) {
    // 公開 message は generic に保つ — env 変数名は response body ではなく
    // logContext に置く。
    throw new AppError(500, 'INTERNAL', 'Internal server error', {
      cause: 'invalid ROOM_TTL_MS',
      ttlMs,
    });
  }
};

// client 指定 ttlMs の validation。`assertValidTtlMs` と分けているのは、これが
// server 側の設定不良 (500) ではなく client error (400) だから。要求値は公開 message
// に出さず、ops triage 用に logContext にだけ載せる。
const assertValidRequestedTtlMs = (ttlMs: number): void => {
  if (
    !Number.isFinite(ttlMs) ||
    !Number.isInteger(ttlMs) ||
    ttlMs <= 0 ||
    ttlMs > MAX_ROOM_TTL_MS
  ) {
    throw new AppError(400, 'INVALID_REQUEST', 'Invalid ttlMs', {
      requestedTtlMs: ttlMs,
      maxTtlMs: MAX_ROOM_TTL_MS,
    });
  }
};

// 空 / 空白だけの password は「password なし」扱いにする。upload form 側で password
// フィールドを無条件に含めても、unprotected room が誤って protected になることを防ぐ。
const isProtectingPassword = (password: string | undefined): boolean =>
  typeof password === 'string' && password.length > 0;

export const createRoomService = (deps: RoomServiceDeps): RoomService => ({
  async create(file: File, opts: RoomCreateOptions = {}): Promise<Room> {
    if (file.size === 0) {
      throw new AppError(400, 'INVALID_REQUEST', 'Empty file');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'File too large', {
        actualSize: file.size,
        maxBytes: MAX_IMAGE_BYTES,
      });
    }
    const contentType = assertAllowedMime(file.type);
    assertValidTtlMs(deps.ttlMs);
    // room ごとの TTL override。`opts.ttlMs` が来たときは storage 操作前に MAX で
    // validate して、bad ttlMs で R2 に orphan object を作らせない。
    if (opts.ttlMs !== undefined) assertValidRequestedTtlMs(opts.ttlMs);
    const effectiveTtlMs = opts.ttlMs ?? deps.ttlMs;

    // R2 に触る前に Turnstile を verify する。service 未配線 (テスト fixture / legacy
    // path) では skip。検証要件があるとき token は non-empty string でなければならず、
    // 空文字列は `disabled` widget の state なので siteverify に投げない。
    if (deps.turnstile) {
      const token = opts.turnstileToken ?? '';
      if (token.length === 0) {
        throw new AppError(401, 'UNAUTHORIZED', 'Turnstile token required');
      }
      const verdict = await deps.turnstile.verify({ token, remoteIp: opts.remoteIp });
      if (!verdict.ok) {
        // 公開 message は reason に依存せず uniform に保ち、reason は log だけに残す。
        throw new AppError(401, 'UNAUTHORIZED', 'Turnstile verification failed', {
          reason: verdict.reason,
        });
      }
    }

    // R2 に書く前に bytes を hash する。blocklist hit で R2 に orphan object を作らない
    // ため。`subtle.digest` は buffer 全体を要求するので stream-to-hash は使えないが、
    // 上限 10 MiB なら Workers の 128 MB 上限に対して十分余裕がある。
    const buffer = await file.arrayBuffer();
    const hash = deps.sha256 ?? sha256Hex;
    const sha = await hash(buffer);

    if (deps.blocklist && (await deps.blocklist.isBlocked(sha))) {
      // 公開 message に hash は echo しない。prefix だけを log に残す。
      throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'This image cannot be uploaded', {
        sha256Prefix: sha.slice(0, 8),
      });
    }

    // 画像書き込み前に password を hash する。ここで失敗しても R2 に orphan image が
    // 残らないため。`PasswordService` は bad input で AppError(400) を投げる。
    const auth = isProtectingPassword(opts.password)
      ? // biome-ignore lint/style/noNonNullAssertion: isProtectingPassword で narrow 済
        await deps.password.hash(opts.password!)
      : undefined;

    const id = generateRoomId();
    const key = `rooms/${id}/image.${extOf(contentType)}`;

    await deps.images.putImage(key, buffer, contentType);

    const room: Room = {
      id,
      createdAt: deps.now(),
      ttlMs: effectiveTtlMs,
      image: { key, contentType, size: file.size, sha256: sha },
      ...(auth ? { auth } : {}),
    };

    try {
      await deps.meta.putMeta(room);
    } catch (metaErr: unknown) {
      // best-effort rollback: image は既に書かれているが meta が失敗した。rollback
      // しないと bucket に orphan object が累積する。
      logger.warn('meta put failed, attempting image rollback', { id, key });
      const rollbackOk = await deps.images.deleteImage(key);
      if (!rollbackOk) {
        // escalate: meta なしの orphan object が R2 に残った状態 — 運用者対応が必要。
        logger.error('image rollback failed — orphan object remains in R2', { id, key });
      }
      throw metaErr;
    }

    // auth payload 自体は決して log に出さない (boolean flag だけ)。SHA prefix は
    // 8 文字に truncate してあるので reconstruct できず、log 可。
    logger.info('room created', {
      id,
      contentType,
      size: file.size,
      protected: !!auth,
      sha256Prefix: sha.slice(0, 8),
    });
    return room;
  },

  async get(id: string): Promise<Room> {
    const room = await deps.meta.getMeta(id);
    if (!room) throw new AppError(404, 'NOT_FOUND', 'Room not found', { id });
    return room;
  },
});
