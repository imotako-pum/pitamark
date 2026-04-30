import {
  ALLOWED_IMAGE_MIME_TYPES,
  type AllowedImageMimeType,
  MAX_IMAGE_BYTES,
  type Room,
} from '@snap-share/shared';
import { AppError } from '../lib/error';
import { generateRoomId } from '../lib/id';
import { logger } from '../lib/logger';
import type { ImageStorage } from '../storage/r2-image-storage';
import type { MetaStorage } from '../storage/r2-meta-storage';

export type RoomServiceDeps = {
  images: ImageStorage;
  meta: MetaStorage;
  now: () => number;
  ttlMs: number;
};

export type RoomService = {
  create(file: File): Promise<Room>;
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
    throw new AppError(500, 'INTERNAL', 'Server is misconfigured: invalid ROOM_TTL_MS', { ttlMs });
  }
};

export const createRoomService = (deps: RoomServiceDeps): RoomService => ({
  async create(file: File): Promise<Room> {
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

    const id = generateRoomId();
    const key = `rooms/${id}/image.${extOf(contentType)}`;

    await deps.images.putImage(key, file.stream(), contentType);

    const room: Room = {
      id,
      createdAt: deps.now(),
      ttlMs: deps.ttlMs,
      image: { key, contentType, size: file.size },
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

    logger.info('room created', { id, contentType, size: file.size });
    return room;
  },

  async get(id: string): Promise<Room> {
    const room = await deps.meta.getMeta(id);
    if (!room) throw new AppError(404, 'NOT_FOUND', 'Room not found', { id });
    return room;
  },
});
