import { AppError } from '../lib/error';
import { logger } from '../lib/logger';

export type ImageStorage = {
  putImage(
    key: string,
    body: ReadableStream | ArrayBuffer | Blob,
    contentType: string,
  ): Promise<void>;
  getImage(key: string): Promise<R2ObjectBody | null>;
  /** Returns `true` if the delete completed (or the object did not exist), `false` if R2 errored. */
  deleteImage(key: string): Promise<boolean>;
};

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Unknown R2 error';

export const createR2ImageStorage = (bucket: R2Bucket): ImageStorage => ({
  async putImage(key, body, contentType) {
    try {
      await bucket.put(key, body, {
        httpMetadata: { contentType, cacheControl: 'public, max-age=3600' },
      });
    } catch (err: unknown) {
      logger.error('R2 putImage failed', { key, contentType, err: getErrorMessage(err) });
      throw new AppError(500, 'INTERNAL', 'Failed to store image', { key });
    }
  },
  async getImage(key) {
    try {
      return await bucket.get(key);
    } catch (err: unknown) {
      logger.error('R2 getImage failed', { key, err: getErrorMessage(err) });
      throw new AppError(500, 'INTERNAL', 'Failed to read image', { key });
    }
  },
  async deleteImage(key) {
    try {
      await bucket.delete(key);
      return true;
    } catch (err: unknown) {
      // Best-effort: caller may need this for rollback; surface as warn (not throw)
      // so the original error is not masked. Return false so the call site can
      // escalate to ERROR severity if rollback actually failed.
      logger.warn('R2 deleteImage failed (non-fatal)', { key, err: getErrorMessage(err) });
      return false;
    }
  },
});
