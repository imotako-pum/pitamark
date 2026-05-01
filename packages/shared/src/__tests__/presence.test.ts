import { describe, expect, it } from 'vitest';
import {
  MAX_DISPLAY_NAME_LENGTH,
  PRESENCE_COLOR_REGEX,
  type UserPresence,
  UserPresenceSchema,
} from '../presence';

const baseValid: UserPresence = {
  userId: 'user-1',
  displayName: 'ゲスト-abcd',
  color: '#5b6dff',
  cursor: { x: 10, y: 20 },
  selectedId: null,
};

describe('UserPresenceSchema', () => {
  it('parses a fully valid presence object', () => {
    const parsed = UserPresenceSchema.parse(baseValid);
    expect(parsed.userId).toBe('user-1');
    expect(parsed.cursor).toEqual({ x: 10, y: 20 });
    expect(parsed.selectedId).toBeNull();
  });

  it('accepts cursor: null (user not hovering on canvas)', () => {
    const result = UserPresenceSchema.safeParse({ ...baseValid, cursor: null });
    expect(result.success).toBe(true);
  });

  it('accepts selectedId set to a string id', () => {
    const result = UserPresenceSchema.safeParse({ ...baseValid, selectedId: 'a1' });
    expect(result.success).toBe(true);
  });

  it('rejects empty userId', () => {
    const result = UserPresenceSchema.safeParse({ ...baseValid, userId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty displayName', () => {
    const result = UserPresenceSchema.safeParse({ ...baseValid, displayName: '' });
    expect(result.success).toBe(false);
  });

  it(`rejects displayName longer than ${MAX_DISPLAY_NAME_LENGTH} chars`, () => {
    const result = UserPresenceSchema.safeParse({
      ...baseValid,
      displayName: 'a'.repeat(MAX_DISPLAY_NAME_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-hex color (e.g. CSS keyword)', () => {
    const result = UserPresenceSchema.safeParse({ ...baseValid, color: 'red' });
    expect(result.success).toBe(false);
  });

  it('rejects color with wrong length (#abc)', () => {
    const result = UserPresenceSchema.safeParse({ ...baseValid, color: '#abc' });
    expect(result.success).toBe(false);
  });

  it('rejects cursor with NaN coordinate', () => {
    const result = UserPresenceSchema.safeParse({
      ...baseValid,
      cursor: { x: Number.NaN, y: 0 },
    });
    expect(result.success).toBe(false);
  });
});

describe('PRESENCE_COLOR_REGEX', () => {
  it('matches 6-digit hex with hash prefix', () => {
    expect(PRESENCE_COLOR_REGEX.test('#5b6dff')).toBe(true);
    expect(PRESENCE_COLOR_REGEX.test('#FFFFFF')).toBe(true);
  });

  it('rejects values without hash prefix or wrong length', () => {
    expect(PRESENCE_COLOR_REGEX.test('5b6dff')).toBe(false);
    expect(PRESENCE_COLOR_REGEX.test('#ggg000')).toBe(false);
  });
});
