// i18n core。ADR-0004 Option B (lightweight self-hosted 辞書) を実装する:
// useTranslation hook + setLang + `<html lang>` sync + localStorage persistence、
// 外部依存なし。
//
// useSyncExternalStore を Context より選んだ理由: `t()` を使う全 component が
// 言語切替で再レンダーするが、global は read-mostly で切替頻度も低い。Context
// provider にすると毎回 subtree 全体を再レンダーさせる割にメリットが薄い。external
// store なら軽量で SSR 安全 (server snapshot が固定 lang を返せる) かつテストも
// 簡単 (`__resetI18nForTesting`)。

import { useEffect, useSyncExternalStore } from 'react';
import { en } from './en';
import { ja } from './ja';
import { type I18nKey, type Lang, SUPPORTED_LANGS } from './keys';

export { en } from './en';
export { ja } from './ja';
export type { I18nKey, Lang } from './keys';
export { SUPPORTED_LANGS } from './keys';

const STORAGE_KEY = 'pitamark-lang';
// snap-share 時代の旧 key。下で 1 回限りの migration を行い、既存 user の言語設定
// を維持する。利用が安定したら削除可。
const LEGACY_STORAGE_KEY = 'snap-share-lang';

const dicts: Record<Lang, Record<I18nKey, string>> = { ja, en };

const isLang = (v: unknown): v is Lang =>
  typeof v === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(v);

const readPersistedLang = (): Lang | null => {
  if (typeof window === 'undefined') return null;
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(current)) return current;
    // legacy → current key へ migrate して legacy を削除する。値が invalid でも
    // 削除はしておき、毎回 load で再チェックされないようにする。
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      if (isLang(legacy)) {
        window.localStorage.setItem(STORAGE_KEY, legacy);
        return legacy;
      }
    }
  } catch {
    // localStorage は privacy mode / sandboxed iframe で throw することがある。
  }
  return null;
};

const detectInitialLang = (): Lang => {
  if (typeof window === 'undefined') return 'ja';
  const persisted = readPersistedLang();
  if (persisted !== null) return persisted;
  const nav = window.navigator?.language?.slice(0, 2);
  return isLang(nav) ? nav : 'ja';
};

let currentLang: Lang = detectInitialLang();
const listeners = new Set<() => void>();

const writeLangToDom = (lang: Lang): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
};

// detect した lang を <html> に即時反映し、最初の paint から正しい値が出る状態にする
// (jsdom もブラウザもこの属性を尊重する)。
writeLangToDom(currentLang);

export const setLang = (next: Lang): void => {
  if (currentLang === next) return;
  currentLang = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // quota / privacy mode — persistence だけ silently skip し、in-memory state は切り替える。
    }
  }
  writeLangToDom(next);
  for (const cb of listeners) cb();
};

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const getSnapshot = (): Lang => currentLang;
const getServerSnapshot = (): Lang => 'ja';

// 非 React 文脈用の同期 accessor。`local-user.ts` 等、hook より前に走る module-level
// 初期化で使う。React tree 内の component は言語切替で再レンダーする `useCurrentLang()`
// を使うこと。
export const getLangSync = (): Lang => currentLang;

// 非 React 文脈用の同期 translator。`useTranslation()` より意図的に軽く、`<html lang>`
// 同期も subscription も持たない。module-load 時 / 切り離された async callback で
// React-bound な `t` を握ると lifecycle が絡むので、それを避けたい場面で使う。
export const translateSync = (key: I18nKey): string => {
  const dict = dicts[currentLang];
  return dict[key] ?? (key as string);
};

export const useCurrentLang = (): Lang =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

// 現在の lang に bind した翻訳関数を返す。useSyncExternalStore + useEffect は lang の
// 値に依存せず常に実行されるので、hook 順序は再レンダーをまたいで一定。
export const useTranslation = (): ((key: I18nKey) => string) => {
  const lang = useCurrentLang();
  // defense-in-depth: hydration / 言語切替後に外部 script で <html lang> が書き
  // 換えられても、ここで戻す。`setLang` は既に同期的に書いているので、ここの
  // effect は SSR → CSR 境界の edge case 対応。
  useEffect(() => {
    writeLangToDom(lang);
  }, [lang]);
  return (key: I18nKey): string => {
    const dict = dicts[lang];
    // dict[key] は Record 型では `string` だが、将来 dict shape が変わったり
    // 誤って delete された場合に備え、crash させずに key 文字列に fallback する。
    return dict[key] ?? (key as string);
  };
};

// テスト専用のヘルパ。in-memory lang を、その時点での localStorage / navigator から
// `detectInitialLang()` が返す値にリセットする。テストの `beforeEach` でケース間の
// module-level state 漏洩を遮断するために呼ぶ。production code は呼ばないこと。
export const __resetI18nForTesting = (): void => {
  currentLang = detectInitialLang();
  writeLangToDom(currentLang);
  for (const cb of listeners) cb();
};

// `{name}` 置換を持つ ja/en value 用のヘルパ (例: `toolbar.colorPalette.swatchAria`)。
// 依存ゼロを維持する — 数個の placeholder のために intl-messageformat / ICU を入れる
// のは overkill。
export const interpolate = (template: string, params: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : `{${name}}`,
  );
