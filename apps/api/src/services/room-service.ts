import {
  ALLOWED_IMAGE_MIME_TYPES,
  type AllowedImageMimeType,
  MAX_IMAGE_BYTES,
  MAX_ROOM_TTL_MS,
  type Room,
} from '@snap-share/shared';
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
   * Phase 7: optional Turnstile verification. Tests + legacy callers may
   * omit it; in that case `create` skips the token check.
   */
  turnstile?: TurnstileService;
  /**
   * Phase 7: optional SHA-256 blocklist. When omitted, every image passes.
   */
  blocklist?: ImageBlocklistService;
  /**
   * Phase 7: hash function override for tests that need a deterministic
   * digest without recomputing on each call. Defaults to the real Web Crypto
   * `sha256Hex` helper.
   */
  sha256?: (buf: ArrayBuffer) => Promise<string>;
};

export type RoomCreateOptions = Readonly<{
  password?: string;
  /** Token from the Turnstile widget. Required when `deps.turnstile` is set. */
  turnstileToken?: string;
  /** Visitor IP forwarded to siteverify. Optional. */
  remoteIp?: string;
  /**
   * Phase 10.B: per-room TTL override (milliseconds). When omitted, the
   * server falls back to `deps.ttlMs` (env-supplied default = 24h). Must be
   * a positive integer ≤ `MAX_ROOM_TTL_MS` (= 7 days). Anything else is a
   * 400 INVALID_REQUEST.
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
    // Public message must not echo user-controlled `type`; keep it in logContext.
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type', {
      receivedType: type,
    });
  }
  return type;
};

const assertValidTtlMs = (ttlMs: number): void => {
  if (!Number.isFinite(ttlMs) || !Number.isInteger(ttlMs) || ttlMs <= 0) {
    // Public message stays generic — env var name belongs in logContext, not
    // in the response body. Phase 8.x security review #13 M1 / #11 M1.
    throw new AppError(500, 'INTERNAL', 'Internal server error', {
      cause: 'invalid ROOM_TTL_MS',
      ttlMs,
    });
  }
};

// Phase 10.B: client-supplied ttlMs validation. Distinct from
// `assertValidTtlMs` because this one is a client error (400), not a server
// misconfiguration (500). The requested value never appears in the public
// message — only in logContext for ops triage.
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

// Empty / whitespace-only password is treated as "no password" so the upload
// form can include the field unconditionally without flipping unprotected
// rooms into protected ones.
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
    // Per-room TTL override (Phase 10.B). When `opts.ttlMs` is provided we
    // validate against MAX before doing any storage work, so callers cannot
    // create orphan R2 objects via a bad ttlMs.
    if (opts.ttlMs !== undefined) assertValidRequestedTtlMs(opts.ttlMs);
    const effectiveTtlMs = opts.ttlMs ?? deps.ttlMs;

    // Phase 7: Turnstile verification BEFORE we touch R2. Skipped when no
    // service is wired (test fixtures, legacy paths). The token must be a
    // non-empty string when verification is required — empty strings come
    // from the `disabled` widget state and should not contact siteverify.
    if (deps.turnstile) {
      const token = opts.turnstileToken ?? '';
      if (token.length === 0) {
        throw new AppError(401, 'UNAUTHORIZED', 'Turnstile token required');
      }
      const verdict = await deps.turnstile.verify({ token, remoteIp: opts.remoteIp });
      if (!verdict.ok) {
        // Public message stays uniform across reasons; the reason ends up in logs.
        throw new AppError(401, 'UNAUTHORIZED', 'Turnstile verification failed', {
          reason: verdict.reason,
        });
      }
    }

    // Phase 7: hash the bytes BEFORE writing to R2, so blocklist hits never
    // create orphan objects. Stream-to-hash is not viable since `subtle.digest`
    // requires the whole buffer; the 10 MiB ceiling keeps memory bounded well
    // within the 128 MB Workers limit.
    const buffer = await file.arrayBuffer();
    const hash = deps.sha256 ?? sha256Hex;
    const sha = await hash(buffer);

    if (deps.blocklist && (await deps.blocklist.isBlocked(sha))) {
      // Public message must not echo the hash; only the prefix lands in logs.
      throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'This image cannot be uploaded', {
        sha256Prefix: sha.slice(0, 8),
      });
    }

    // Hash the password BEFORE writing the image — failure here must not leave
    // an orphan image in R2. PasswordService throws AppError(400) on bad input.
    const auth = isProtectingPassword(opts.password)
      ? // biome-ignore lint/style/noNonNullAssertion: isProtectingPassword narrows
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
      // Best-effort rollback: image was already written, but meta write failed.
      // Without rollback the bucket would accumulate orphan objects.
      logger.warn('meta put failed, attempting image rollback', { id, key });
      const rollbackOk = await deps.images.deleteImage(key);
      if (!rollbackOk) {
        // Escalate: orphan object now persists in R2 with no meta — operator action required.
        logger.error('image rollback failed — orphan object remains in R2', { id, key });
      }
      throw metaErr;
    }

    // Never log the auth payload itself — only a boolean flag. SHA prefix is
    // safe to log (truncated to 8 chars; not enough to reconstruct).
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
