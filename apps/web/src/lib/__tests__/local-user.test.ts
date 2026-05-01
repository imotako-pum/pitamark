import { describe, expect, it } from 'vitest';
import { AWARENESS_USER_PALETTE } from '../../components/canvas/colors';
import { getOrCreateLocalUser } from '../local-user';

const STORAGE_KEY = 'snap-share/user-v1';

const makeStorage = (initial: Record<string, string> = {}): Storage => {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
};

describe('getOrCreateLocalUser', () => {
  it('persists a freshly generated user and returns the same identity on the second call', () => {
    const storage = makeStorage();
    const first = getOrCreateLocalUser(storage);
    const second = getOrCreateLocalUser(storage);
    expect(second).toEqual(first);
    expect(storage.getItem(STORAGE_KEY)).toContain(first.userId);
  });

  it('discards corrupted JSON and starts a new user', () => {
    const storage = makeStorage({ [STORAGE_KEY]: '{not-valid-json' });
    const user = getOrCreateLocalUser(storage);
    expect(user.userId).toBeTruthy();
    expect(user.displayName).toBeTruthy();
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      userId: user.userId,
    });
  });

  it('selects a color from the canvas palette deterministically per userId', () => {
    const storage = makeStorage();
    const user = getOrCreateLocalUser(storage);
    expect(AWARENESS_USER_PALETTE).toContain(user.color);
    expect(getOrCreateLocalUser(storage).color).toBe(user.color);
  });

  it('chooses different palette colors for distinct user IDs (statistical sanity)', () => {
    const colors = new Set<string>();
    for (let i = 0; i < 16; i++) {
      const storage = makeStorage();
      const user = getOrCreateLocalUser(storage);
      colors.add(user.color);
    }
    expect(colors.size).toBeGreaterThan(1);
  });
});
