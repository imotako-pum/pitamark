import { describe, expect, it } from 'vitest';
import { generateRoomId, ROOM_ID_LENGTH } from '../../lib/id';

describe('generateRoomId', () => {
  it('returns a string of ROOM_ID_LENGTH (21) characters', () => {
    const id = generateRoomId();
    expect(id).toHaveLength(ROOM_ID_LENGTH);
    expect(ROOM_ID_LENGTH).toBe(21);
  });

  it('uses URL-safe alphabet (A-Z a-z 0-9 _ -)', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateRoomId()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique ids on successive calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      ids.add(generateRoomId());
    }
    expect(ids.size).toBe(100);
  });
});
