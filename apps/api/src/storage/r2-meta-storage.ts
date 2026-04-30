import { type Room, RoomSchema } from '@snap-share/shared';
import { AppError } from '../lib/error';
import { logger } from '../lib/logger';

export type MetaStorage = {
  putMeta(room: Room): Promise<void>;
  getMeta(id: string): Promise<Room | null>;
};

export const metaKey = (id: string): string => `rooms/${id}/meta.json`;

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Unknown error';

export const createR2MetaStorage = (bucket: R2Bucket): MetaStorage => ({
  async putMeta(room) {
    try {
      await bucket.put(metaKey(room.id), JSON.stringify(room), {
        httpMetadata: { contentType: 'application/json' },
      });
    } catch (err: unknown) {
      logger.error('R2 putMeta failed', { id: room.id, err: getErrorMessage(err) });
      throw new AppError(500, 'INTERNAL', 'Failed to store room metadata', { id: room.id });
    }
  },
  async getMeta(id) {
    let obj: R2ObjectBody | null;
    try {
      obj = await bucket.get(metaKey(id));
    } catch (err: unknown) {
      logger.error('R2 getMeta read failed', { id, err: getErrorMessage(err) });
      throw new AppError(500, 'INTERNAL', 'Failed to read room metadata', { id });
    }
    if (!obj) return null;

    let json: unknown;
    try {
      json = await obj.json();
    } catch (err: unknown) {
      logger.error('R2 meta JSON parse failed', { id, err: getErrorMessage(err) });
      throw new AppError(500, 'INTERNAL', 'Stored room metadata is not valid JSON', { id });
    }

    const result = RoomSchema.safeParse(json);
    if (!result.success) {
      logger.error('R2 meta schema validation failed', {
        id,
        issues: result.error.issues.map((i) => ({ path: i.path, code: i.code })),
      });
      throw new AppError(500, 'INTERNAL', 'Stored room metadata is corrupt', { id });
    }
    return result.data;
  },
});
