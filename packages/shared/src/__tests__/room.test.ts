import { describe, expect, it } from 'vitest';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  DEFAULT_ROOM_TTL_MS,
  isExpired,
  MAX_IMAGE_BYTES,
  type Room,
  type RoomImage,
  RoomImageSchema,
  RoomSchema,
} from '../room';

const image: RoomImage = {
  key: 'rooms/abc/image.png',
  contentType: 'image/png',
  size: 1024,
};

const room: Room = { id: 'V1StGXR8_Z5jdHi6B-myT', createdAt: 1_000, ttlMs: 1_000, image };

describe('isExpired', () => {
  it('returns false when now equals createdAt', () => {
    expect(isExpired(room, 1_000)).toBe(false);
  });
  it('returns false when now is within ttlMs', () => {
    expect(isExpired(room, 1_500)).toBe(false);
  });
  it('returns true when now exceeds createdAt + ttlMs', () => {
    expect(isExpired(room, 2_500)).toBe(true);
  });
  it('uses 7 days as default ttl', () => {
    expect(DEFAULT_ROOM_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('ALLOWED_IMAGE_MIME_TYPES', () => {
  it('contains exactly png/jpeg/webp/svg+xml', () => {
    expect([...ALLOWED_IMAGE_MIME_TYPES].sort()).toEqual(
      ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'].sort(),
    );
  });
});

describe('RoomImageSchema', () => {
  it('parses a valid image meta', () => {
    const parsed = RoomImageSchema.parse(image);
    expect(parsed).toEqual(image);
  });

  it('parses each allowed mime type', () => {
    for (const contentType of ALLOWED_IMAGE_MIME_TYPES) {
      const parsed = RoomImageSchema.parse({ key: 'k', contentType, size: 1 });
      expect(parsed.contentType).toBe(contentType);
    }
  });

  it('rejects unknown content type', () => {
    expect(() => RoomImageSchema.parse({ key: 'k', contentType: 'text/plain', size: 1 })).toThrow();
  });

  it('rejects size exceeding MAX_IMAGE_BYTES', () => {
    expect(() =>
      RoomImageSchema.parse({
        key: 'k',
        contentType: 'image/png',
        size: MAX_IMAGE_BYTES + 1,
      }),
    ).toThrow();
  });

  it('accepts size exactly MAX_IMAGE_BYTES', () => {
    const parsed = RoomImageSchema.parse({
      key: 'k',
      contentType: 'image/png',
      size: MAX_IMAGE_BYTES,
    });
    expect(parsed.size).toBe(MAX_IMAGE_BYTES);
  });

  it('rejects non-positive size', () => {
    expect(() => RoomImageSchema.parse({ key: 'k', contentType: 'image/png', size: 0 })).toThrow();
    expect(() => RoomImageSchema.parse({ key: 'k', contentType: 'image/png', size: -1 })).toThrow();
  });

  it('rejects empty key', () => {
    expect(() => RoomImageSchema.parse({ key: '', contentType: 'image/png', size: 1 })).toThrow();
  });
});

describe('RoomSchema', () => {
  it('parses a valid Room input with image', () => {
    const parsed = RoomSchema.parse(room);
    expect(parsed).toEqual(room);
  });

  it('rejects empty id', () => {
    expect(() => RoomSchema.parse({ id: '', createdAt: 0, ttlMs: 1, image })).toThrow();
  });

  it('rejects ids that do not match the NanoID pattern', () => {
    expect(() => RoomSchema.parse({ id: 'too-short', createdAt: 0, ttlMs: 1, image })).toThrow();
    expect(() =>
      RoomSchema.parse({
        id: 'V1StGXR8_Z5jdHi6B-mYT2', // 22 chars
        createdAt: 0,
        ttlMs: 1,
        image,
      }),
    ).toThrow();
    expect(() =>
      RoomSchema.parse({
        id: '../../../etc/passwd',
        createdAt: 0,
        ttlMs: 1,
        image,
      }),
    ).toThrow();
  });

  it('rejects non-positive ttlMs (zero or negative)', () => {
    expect(() =>
      RoomSchema.parse({ id: 'V1StGXR8_Z5jdHi6B-myT', createdAt: 0, ttlMs: 0, image }),
    ).toThrow();
    expect(() =>
      RoomSchema.parse({ id: 'V1StGXR8_Z5jdHi6B-myT', createdAt: 0, ttlMs: -1, image }),
    ).toThrow();
  });

  it('rejects negative createdAt', () => {
    expect(() =>
      RoomSchema.parse({ id: 'V1StGXR8_Z5jdHi6B-myT', createdAt: -1, ttlMs: 1, image }),
    ).toThrow();
  });

  it('rejects non-integer numeric fields', () => {
    expect(() =>
      RoomSchema.parse({ id: 'V1StGXR8_Z5jdHi6B-myT', createdAt: 0.5, ttlMs: 1, image }),
    ).toThrow();
    expect(() =>
      RoomSchema.parse({ id: 'V1StGXR8_Z5jdHi6B-myT', createdAt: 0, ttlMs: 1.1, image }),
    ).toThrow();
  });

  it('rejects a room missing image', () => {
    expect(() =>
      RoomSchema.parse({ id: 'V1StGXR8_Z5jdHi6B-myT', createdAt: 0, ttlMs: 1 }),
    ).toThrow();
  });

  it('rejects a room with malformed image', () => {
    expect(() =>
      RoomSchema.parse({
        id: 'V1StGXR8_Z5jdHi6B-myT',
        createdAt: 0,
        ttlMs: 1,
        image: { key: 'k', contentType: 'text/plain', size: 1 },
      }),
    ).toThrow();
  });
});
