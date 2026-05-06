import { MAX_IMAGE_BYTES, MAX_ROOM_TTL_MS } from '@pitamark/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../../lib/error';
import { createPasswordService } from '../../services/password-service';
import { createRoomService } from '../../services/room-service';
import { createR2ImageStorage } from '../../storage/r2-image-storage';
import { createR2MetaStorage, metaKey } from '../../storage/r2-meta-storage';
import { createInMemoryR2WithControls } from '../helpers/in-memory-r2';

const FIXED_NOW = 1_714_435_200_000; // synthetic Unix epoch ms; not a real timestamp
// テストは default で 7-day TTL (= MAX) を使い、surface area を最大化する。
// room ごとの override は下の節で別途検証する。
const TTL_MS = MAX_ROOM_TTL_MS;

const buildService = () => {
  const { bucket, store } = createInMemoryR2WithControls();
  const service = createRoomService({
    images: createR2ImageStorage(bucket),
    meta: createR2MetaStorage(bucket),
    now: () => FIXED_NOW,
    ttlMs: TTL_MS,
    password: createPasswordService(),
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
    // `image.sha256` は populate される。将来の field 追加にも壊れないよう、
    // field 単位で shape を assert する。
    expect(room.image.key).toBe(`rooms/${room.id}/image.png`);
    expect(room.image.contentType).toBe('image/png');
    expect(room.image.size).toBe(4);
    expect(room.image.sha256).toMatch(/^[a-f0-9]{64}$/);
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
      async deleteMeta() {
        return true;
      },
    };

    const service = createRoomService({
      images: createR2ImageStorage(bucket),
      meta: failingMeta,
      now: () => FIXED_NOW,
      ttlMs: TTL_MS,
      password: createPasswordService(),
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
        async deleteMeta() {
          return true;
        },
      },
      now: () => FIXED_NOW,
      ttlMs: TTL_MS,
      password: createPasswordService(),
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
      password: createPasswordService(),
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
      password: createPasswordService(),
    });
    const file = makeFile(new Uint8Array([1]), 'image/png');
    await expect(service.create(file)).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL',
    });
  });

  // env 変数名は logContext に載せるべきで、public response body に出してはいけない。
  // client は generic な「Internal server error」だけを受け取る契約を保つ。
  it('does not expose the env var name `ROOM_TTL_MS` in the public message', async () => {
    const { bucket } = createInMemoryR2WithControls();
    const service = createRoomService({
      images: createR2ImageStorage(bucket),
      meta: createR2MetaStorage(bucket),
      now: () => FIXED_NOW,
      ttlMs: Number.NaN,
      password: createPasswordService(),
    });
    const file = makeFile(new Uint8Array([1]), 'image/png');
    const error = await service.create(file).catch((e) => e);
    expect(error.message).not.toContain('ROOM_TTL_MS');
  });
});

// room ごとの TTL override の検証。default は server 側 `deps.ttlMs` (env 由来の 24h)
// が依然として保持し、caller は MAX_ROOM_TTL_MS までの範囲で長い TTL を要求できる。
// それ以外は 400。
describe('roomService.create — per-room ttlMs override', () => {
  const buildSvc = (ttlMs: number = TTL_MS) => {
    const { bucket } = createInMemoryR2WithControls();
    return createRoomService({
      images: createR2ImageStorage(bucket),
      meta: createR2MetaStorage(bucket),
      now: () => FIXED_NOW,
      ttlMs,
      password: createPasswordService(),
    });
  };

  it('accepts an explicit ttlMs within MAX and stores it on the room', async () => {
    const service = buildSvc(24 * 60 * 60 * 1000);
    const file = makeFile(new Uint8Array([1, 2, 3]), 'image/png');
    const requested = 3 * 24 * 60 * 60 * 1000; // 3 days
    const room = await service.create(file, { ttlMs: requested });
    expect(room.ttlMs).toBe(requested);
  });

  it('falls back to deps.ttlMs (env default) when ttlMs is omitted', async () => {
    const envDefault = 24 * 60 * 60 * 1000;
    const service = buildSvc(envDefault);
    const file = makeFile(new Uint8Array([1]), 'image/png');
    const room = await service.create(file);
    expect(room.ttlMs).toBe(envDefault);
  });

  it('accepts ttlMs exactly at MAX_ROOM_TTL_MS', async () => {
    const service = buildSvc();
    const file = makeFile(new Uint8Array([1]), 'image/png');
    const room = await service.create(file, { ttlMs: MAX_ROOM_TTL_MS });
    expect(room.ttlMs).toBe(MAX_ROOM_TTL_MS);
  });

  it('rejects ttlMs > MAX_ROOM_TTL_MS as 400 INVALID_REQUEST', async () => {
    const service = buildSvc();
    const file = makeFile(new Uint8Array([1]), 'image/png');
    await expect(service.create(file, { ttlMs: MAX_ROOM_TTL_MS + 1 })).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('rejects non-positive ttlMs as 400 INVALID_REQUEST', async () => {
    const service = buildSvc();
    const file = makeFile(new Uint8Array([1]), 'image/png');
    await expect(service.create(file, { ttlMs: 0 })).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });
    await expect(service.create(file, { ttlMs: -1 })).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('rejects non-integer / NaN ttlMs as 400 INVALID_REQUEST', async () => {
    const service = buildSvc();
    const file = makeFile(new Uint8Array([1]), 'image/png');
    await expect(service.create(file, { ttlMs: 1.5 })).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });
    await expect(service.create(file, { ttlMs: Number.NaN })).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('does not echo the requested ttlMs in the public 400 message', async () => {
    const service = buildSvc();
    const file = makeFile(new Uint8Array([1]), 'image/png');
    const sentinel = MAX_ROOM_TTL_MS + 999_999;
    const error = await service.create(file, { ttlMs: sentinel }).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(String(error.message)).not.toContain(String(sentinel));
  });
});
