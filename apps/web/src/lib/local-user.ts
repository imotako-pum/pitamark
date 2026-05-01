import { AWARENESS_USER_PALETTE } from '../components/canvas/colors';
import { generateId } from './id';

const STORAGE_KEY = 'snap-share/user-v1';
const DEFAULT_NAME_PREFIX = 'ゲスト-';

export type LocalUser = Readonly<{
  userId: string;
  displayName: string;
  color: string;
}>;

// FNV-1a 32-bit — small, deterministic, no deps. Used to pick a palette index.
const hashString = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const colorForUser = (userId: string): string => {
  const idx = hashString(userId) % AWARENESS_USER_PALETTE.length;
  return AWARENESS_USER_PALETTE[idx] ?? AWARENESS_USER_PALETTE[0]!;
};

export const getOrCreateLocalUser = (storage: Storage = window.localStorage): LocalUser => {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<LocalUser>;
      if (parsed.userId && parsed.displayName) {
        return {
          userId: parsed.userId,
          displayName: parsed.displayName,
          color: parsed.color ?? colorForUser(parsed.userId),
        };
      }
    } catch {
      // Corrupted JSON is silently discarded — UX must not break on bad state.
    }
  }
  const userId = generateId();
  const user: LocalUser = {
    userId,
    displayName: `${DEFAULT_NAME_PREFIX}${userId.slice(0, 4)}`,
    color: colorForUser(userId),
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
};
