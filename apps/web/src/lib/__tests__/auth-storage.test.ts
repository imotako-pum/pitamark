import { describe, expect, it } from 'vitest';
import { clearRoomToken, getRoomToken, setRoomToken } from '../auth-storage';

const ROOM = 'V1StGXR8_Z5jdHi6B-mYT';
const TOKEN = 'header.payload.signature'; // synthetic JWT shape only

const makeStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
  };
};

const makeThrowingStorage = (): Storage => ({
  get length() {
    return 0;
  },
  clear: () => {
    throw new Error('boom');
  },
  getItem: () => {
    throw new Error('boom');
  },
  setItem: () => {
    throw new Error('boom');
  },
  removeItem: () => {
    throw new Error('boom');
  },
  key: () => {
    throw new Error('boom');
  },
});

describe('auth-storage round-trip', () => {
  it('returns null when nothing is stored for the room', () => {
    const s = makeStorage();
    expect(getRoomToken(ROOM, s)).toBeNull();
  });

  it('persists a token under a room-bound key and reads it back', () => {
    const s = makeStorage();
    setRoomToken(ROOM, TOKEN, s);
    expect(getRoomToken(ROOM, s)).toBe(TOKEN);
  });

  it('namespaces tokens by roomId', () => {
    const s = makeStorage();
    setRoomToken(ROOM, TOKEN, s);
    setRoomToken('OtherR8_Z5jdHi6B-myZ', 'other.token.here', s);
    expect(getRoomToken(ROOM, s)).toBe(TOKEN);
    expect(getRoomToken('OtherR8_Z5jdHi6B-myZ', s)).toBe('other.token.here');
  });

  it('clears only the targeted room', () => {
    const s = makeStorage();
    setRoomToken(ROOM, TOKEN, s);
    setRoomToken('OtherR8_Z5jdHi6B-myZ', 'other.token.here', s);
    clearRoomToken(ROOM, s);
    expect(getRoomToken(ROOM, s)).toBeNull();
    expect(getRoomToken('OtherR8_Z5jdHi6B-myZ', s)).toBe('other.token.here');
  });
});

describe('auth-storage resilience', () => {
  it('returns null on getItem failure', () => {
    expect(getRoomToken(ROOM, makeThrowingStorage())).toBeNull();
  });

  it('does not throw on setItem failure', () => {
    expect(() => setRoomToken(ROOM, TOKEN, makeThrowingStorage())).not.toThrow();
  });

  it('does not throw on removeItem failure', () => {
    expect(() => clearRoomToken(ROOM, makeThrowingStorage())).not.toThrow();
  });
});
