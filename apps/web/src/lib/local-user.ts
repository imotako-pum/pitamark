import { AWARENESS_USER_PALETTE } from '../components/canvas/colors';
import { translateSync } from '../i18n';
import { generateId } from './id';

const STORAGE_KEY = 'pitamark/user-v1';
// Phase 10.D: legacy key from snap-share era. One-shot migrated below so
// existing users keep their presence identity (userId + color). Safe to
// remove once adoption stabilizes (Phase 11+).
const LEGACY_STORAGE_KEY = 'snap-share/user-v1';
// Phase 10.E: localized prefix at first-creation time. The display name is
// persisted in localStorage so lang changes after the fact don't rename
// existing users — that's intentional, names are stable identifiers.
const getDefaultNamePrefix = (): string => translateSync('localUser.namePrefix');
// Defensive fallback if AWARENESS_USER_PALETTE is ever emptied. Matches
// `tokens.css --color-presence-1` so the visual identity is preserved.
const FALLBACK_PRESENCE_COLOR = '#5b6dff';

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
  if (AWARENESS_USER_PALETTE.length === 0) return FALLBACK_PRESENCE_COLOR;
  const idx = hashString(userId) % AWARENESS_USER_PALETTE.length;
  return AWARENESS_USER_PALETTE[idx] ?? FALLBACK_PRESENCE_COLOR;
};

const readPersistedRaw = (storage: Storage): string | null => {
  const current = storage.getItem(STORAGE_KEY);
  if (current !== null) return current;
  // One-shot migration: copy legacy → current, drop legacy. Failures fall
  // through to fresh user creation below — never block UX on storage errors.
  const legacy = storage.getItem(LEGACY_STORAGE_KEY);
  if (legacy !== null) {
    try {
      storage.setItem(STORAGE_KEY, legacy);
      storage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Quota / privacy modes — ignore, keep legacy value in memory.
    }
    return legacy;
  }
  return null;
};

export const getOrCreateLocalUser = (storage: Storage = window.localStorage): LocalUser => {
  const raw = readPersistedRaw(storage);
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
    displayName: `${getDefaultNamePrefix()}${userId.slice(0, 4)}`,
    color: colorForUser(userId),
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
};
