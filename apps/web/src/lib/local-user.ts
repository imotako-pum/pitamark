import { AWARENESS_USER_PALETTE } from '../components/canvas/colors';
import { translateSync } from '../i18n';
import { generateId } from './id';

const STORAGE_KEY = 'pitamark/user-v1';
// snap-share 時代の旧 key。下で 1 回限りの migration を行い、既存 user の presence
// identity (userId + color) を維持する。利用が安定したら削除可。
const LEGACY_STORAGE_KEY = 'snap-share/user-v1';
// 初回作成時のロケール依存 prefix。displayName は localStorage に永続化するので、
// 後で言語切替しても既存 user の名前は変わらない (名前は安定 identifier として扱う)。
const getDefaultNamePrefix = (): string => translateSync('localUser.namePrefix');
// AWARENESS_USER_PALETTE が空になった場合の defensive fallback。
// `tokens.css --color-presence-1` と一致させて視覚 identity を保つ。
const FALLBACK_PRESENCE_COLOR = '#5b6dff';

export type LocalUser = Readonly<{
  userId: string;
  displayName: string;
  color: string;
}>;

// FNV-1a 32-bit。小さく決定論的、依存なし。palette index 選択に使う。
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
  // 1 回限りの migration: legacy → current にコピーして legacy を捨てる。失敗時は
  // 下の新規作成へフォールスルー — storage error で UX を止めない方針。
  const legacy = storage.getItem(LEGACY_STORAGE_KEY);
  if (legacy !== null) {
    try {
      storage.setItem(STORAGE_KEY, legacy);
      storage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // quota / privacy mode — 無視して legacy 値をメモリ上で使う。
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
      // 破損 JSON は黙って捨てる — 悪い state で UX を壊さない。
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
