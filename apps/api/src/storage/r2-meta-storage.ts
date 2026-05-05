import { type Room, RoomSchema } from '@pitamark/shared';
import { AppError } from '../lib/error';
import { logger } from '../lib/logger';

export type MetaStorage = {
  putMeta(room: Room): Promise<void>;
  getMeta(id: string): Promise<Room | null>;
  /** Returns `true` if the delete succeeded (or the object did not exist), `false` if R2 errored. */
  deleteMeta(id: string): Promise<boolean>;
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
  async deleteMeta(id) {
    try {
      await bucket.delete(metaKey(id));
      return true;
    } catch (err: unknown) {
      // Best-effort: alarm-driven cleanup tolerates missing/failed deletes; the
      // caller can escalate to ERROR severity if rollback semantics require it.
      logger.warn('R2 deleteMeta failed (non-fatal)', { id, err: getErrorMessage(err) });
      return false;
    }
  },
});
