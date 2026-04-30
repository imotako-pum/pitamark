import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_TTL_MS, isExpired, type Room, RoomSchema } from '../room';

const room: Room = { id: 'r1', createdAt: 1_000, ttlMs: 1_000 };

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

describe('RoomSchema', () => {
  it('parses a valid Room input', () => {
    const parsed = RoomSchema.parse({ id: 'abc', createdAt: 0, ttlMs: 1 });
    expect(parsed).toEqual({ id: 'abc', createdAt: 0, ttlMs: 1 });
  });

  it('rejects empty id', () => {
    expect(() => RoomSchema.parse({ id: '', createdAt: 0, ttlMs: 1 })).toThrow();
  });

  it('rejects non-positive ttlMs (zero or negative)', () => {
    expect(() => RoomSchema.parse({ id: 'r1', createdAt: 0, ttlMs: 0 })).toThrow();
    expect(() => RoomSchema.parse({ id: 'r1', createdAt: 0, ttlMs: -1 })).toThrow();
  });

  it('rejects negative createdAt', () => {
    expect(() => RoomSchema.parse({ id: 'r1', createdAt: -1, ttlMs: 1 })).toThrow();
  });

  it('rejects non-integer numeric fields', () => {
    expect(() => RoomSchema.parse({ id: 'r1', createdAt: 0.5, ttlMs: 1 })).toThrow();
    expect(() => RoomSchema.parse({ id: 'r1', createdAt: 0, ttlMs: 1.1 })).toThrow();
  });
});
