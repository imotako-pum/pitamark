import { MAX_IMAGE_BYTES } from '@snap-share/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../../lib/error';
import { createRoomService } from '../../services/room-service';
import { createR2ImageStorage } from '../../storage/r2-image-storage';
import { createR2MetaStorage, metaKey } from '../../storage/r2-meta-storage';
import { createInMemoryR2WithControls } from '../helpers/in-memory-r2';

const FIXED_NOW = 1_714_435_200_000; // synthetic Unix epoch ms; not a real timestamp
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const buildService = () => {
  const { bucket, store } = createInMemoryR2WithControls();
  const service = createRoomService({
    images: createR2ImageStorage(bucket),
    meta: createR2MetaStorage(bucket),
    now: () => FIXED_NOW,
    ttlMs: TTL_MS,
  });
  return { service, bucket, store };
};

const makeFile = (bytes: number | Uint8Array, type: string, name = 'cat.png'): File => {
  const data = typeof bytes === 'number' ? new Uint8Array(bytes) : bytes;
  return new File([data], name, { type });
};

describe('roomService.create', () => {
  let context: ReturnType<typeof buildService>;

  beforeEach(() => {
    context = buildService();
  });

  it('stores image and meta with NanoID id', async () => {
    const file = makeFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'image/png');

    const room = await context.service.create(file);

    expect(room.id).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(room.createdAt).toBe(FIXED_NOW);
    expect(room.ttlMs).toBe(TTL_MS);
    expect(room.image).toEqual({
      key: `rooms/${room.id}/image.png`,
      contentType: 'image/png',
      size: 4,
    });
    expect(context.store.has(room.image.key)).toBe(true);
    expect(context.store.has(metaKey(room.id))).toBe(true);
  });

  it('uses correct extension per mime type', async () => {
    const cases: Array<[string, string]> = [
      ['image/jpeg', 'jpg'],
      ['image/webp', 'webp'],
      ['image/svg+xml', 'svg'],
    ];
    for (const [type, ext] of cases) {
      const ctx = buildService();
      const file = makeFile(new Uint8Array([1, 2, 3]), type);
      const room = await ctx.service.create(file);
      expect(room.image.key.endsWith(`.${ext}`)).toBe(true);
      expect(room.image.contentType).toBe(type);
    }
  });

  it('rejects empty file with AppError 400 INVALID_REQUEST', async () => {
    const file = makeFile(0, 'image/png');
    await expect(context.service.create(file)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('rejects unsupported content type with AppError 415', async () => {
    const file = makeFile(new Uint8Array([1]), 'text/plain', 'note.txt');
    await expect(context.service.create(file)).rejects.toMatchObject({
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('rejects oversized file with AppError 413', async () => {
    const file = makeFile(MAX_IMAGE_BYTES + 1, 'image/png');
    await expect(context.service.create(file)).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });

  it('accepts file exactly at MAX_IMAGE_BYTES', async () => {
    const file = makeFile(MAX_IMAGE_BYTES, 'image/png');
    const room = await context.service.create(file);
    expect(room.image.size).toBe(MAX_IMAGE_BYTES);
  });
});

describe('roomService.get', () => {
  it('returns room when meta exists', async () => {
    const { service } = buildService();
    const created = await service.create(makeFile(new Uint8Array([1, 2]), 'image/png'));
    const fetched = await service.get(created.id);
    expect(fetched).toEqual(created);
  });

  it('throws AppError 404 when meta missing', async () => {
    const { service } = buildService();
    await expect(service.get('VALIDr8_Z5jdHi6B-mYTa')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('wraps malformed meta JSON as AppError 500 INTERNAL', async () => {
    const { service, bucket } = buildService();
    const id = 'corruptIDABCDEFGHIJK1';
    await bucket.put(metaKey(id), 'not valid json', {
      httpMetadata: { contentType: 'application/json' },
    });
    await expect(service.get(id)).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL',
    });
  });

  it('wraps schema-invalid meta as AppError 500 INTERNAL with id context', async () => {
    const { service, bucket } = buildService();
    const id = 'schemabadIDEFGHIJK123';
    await bucket.put(metaKey(id), JSON.stringify({ id }), {
      httpMetadata: { contentType: 'application/json' },
    });
    await expect(service.get(id)).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL',
      logContext: { id },
    });
  });
});

describe('roomService.create — orphan rollback', () => {
  it('rolls back the image when meta put fails', async () => {
    const { bucket, store } = createInMemoryR2WithControls();

    const failingMeta = {
      async putMeta() {
        throw new AppError(500, 'INTERNAL', 'simulated meta failure');
      },
      async getMeta() {
        return null;
      },
    };

    const service = createRoomService({
      images: createR2ImageStorage(bucket),
      meta: failingMeta,
      now: () => FIXED_NOW,
      ttlMs: TTL_MS,
    });

    const file = makeFile(new Uint8Array([1, 2, 3]), 'image/png');
    await expect(service.create(file)).rejects.toMatchObject({ code: 'INTERNAL' });

    // No image keys should remain after rollback.
    const remaining = [...store.keys()].filter((k) => k.startsWith('rooms/'));
    expect(remaining).toEqual([]);
  });

  it('still throws the original meta error when rollback itself fails', async () => {
    const { bucket } = createInMemoryR2WithControls();
    const realImages = createR2ImageStorage(bucket);
    const sentinelError = new AppError(500, 'INTERNAL', 'simulated meta failure');

    // Force deleteImage to report failure so we exercise the escalated logger.error branch.
    const flakyImages: ReturnType<typeof createR2ImageStorage> = {
      ...realImages,
      async deleteImage() {
        return false;
      },
    };

    const service = createRoomService({
      images: flakyImages,
      meta: {
        async putMeta() {
          throw sentinelError;
        },
        async getMeta() {
          return null;
        },
      },
      now: () => FIXED_NOW,
      ttlMs: TTL_MS,
    });

    const file = makeFile(new Uint8Array([1, 2, 3]), 'image/png');
    // Original meta error must still propagate even if rollback fails.
    await expect(service.create(file)).rejects.toBe(sentinelError);
  });
});

describe('roomService.create — TTL configuration guard', () => {
  it('throws AppError 500 when ttlMs is NaN', async () => {
    const { bucket } = createInMemoryR2WithControls();
    const service = createRoomService({
      images: createR2ImageStorage(bucket),
      meta: createR2MetaStorage(bucket),
      now: () => FIXED_NOW,
      ttlMs: Number.NaN,
    });
    const file = makeFile(new Uint8Array([1]), 'image/png');
    await expect(service.create(file)).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL',
    });
  });

  it('throws AppError 500 when ttlMs is non-positive', async () => {
    const { bucket } = createInMemoryR2WithControls();
    const service = createRoomService({
      images: createR2ImageStorage(bucket),
      meta: createR2MetaStorage(bucket),
      now: () => FIXED_NOW,
      ttlMs: 0,
    });
    const file = makeFile(new Uint8Array([1]), 'image/png');
    await expect(service.create(file)).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL',
    });
  });
});
