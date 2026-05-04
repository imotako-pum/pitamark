// Phase 10.E: i18n core. Implements the lightweight self-hosted dict
// strategy from ADR-0004 Option B — useTranslation hook + setLang +
// `<html lang>` sync + localStorage persistence. No external dependency.
//
// Why useSyncExternalStore (vs Context): every component using `t()`
// re-renders on lang change. The single global is read-mostly + rarely
// switched, so a Context provider would force the entire subtree to
// re-render every time but offers no other benefit. The external store
// is leaner, SSR-safe (server snapshot returns a fixed lang), and
// trivially testable (`__resetI18nForTesting`).

import { useEffect, useSyncExternalStore } from 'react';
import { en } from './en';
import { ja } from './ja';
import { type I18nKey, type Lang, SUPPORTED_LANGS } from './keys';

export { en } from './en';
export { ja } from './ja';
export type { I18nKey, Lang } from './keys';
export { SUPPORTED_LANGS } from './keys';

const STORAGE_KEY = 'snap-share-lang';

const dicts: Record<Lang, Record<I18nKey, string>> = { ja, en };

const isLang = (v: unknown): v is Lang =>
  typeof v === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(v);

const detectInitialLang = (): Lang => {
  if (typeof window === 'undefined') return 'ja';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // localStorage may throw in privacy modes / sandboxed iframes — fall
    // through to navigator.language.
  }
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

// Eagerly reflect the detected lang on the <html> element so the very first
// paint shows the right value (jsdom in tests + real browser both honor this).
writeLangToDom(currentLang);

export const setLang = (next: Lang): void => {
  if (currentLang === next) return;
  currentLang = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Quota / privacy modes — silently skip persistence; in-memory state still flips.
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

// Phase 10.E: synchronous accessor for non-React contexts (e.g. one-time
// module-level initializers like `local-user.ts` that run before any hook).
// Components inside the React tree should prefer `useCurrentLang()` so they
// re-render on lang change.
export const getLangSync = (): Lang => currentLang;

// Phase 10.E: synchronous translator for non-React contexts. Intentionally
// lighter than `useTranslation()` — no `<html lang>` sync, no subscription.
// Use only at module-load time or in detached async callbacks where holding
// onto a React-bound `t` would couple lifetimes.
export const translateSync = (key: I18nKey): string => {
  const dict = dicts[currentLang];
  return dict[key] ?? (key as string);
};

export const useCurrentLang = (): Lang =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

// Returns a translation function bound to the current lang. Hooks order is
// preserved across re-renders because useSyncExternalStore + useEffect always
// run regardless of the lang value.
export const useTranslation = (): ((key: I18nKey) => string) => {
  const lang = useCurrentLang();
  // Defense-in-depth: keep the DOM in sync after hydration / lang change,
  // in case the DOM was reset by an external script. `setLang` already does
  // this eagerly; the effect handles the SSR → CSR boundary edge case.
  useEffect(() => {
    writeLangToDom(lang);
  }, [lang]);
  return (key: I18nKey): string => {
    const dict = dicts[lang];
    // dict[key] is `string` from the Record type, but in case of future
    // dict-shape changes (or accidental delete), fall back to the key for
    // safe rendering rather than crashing.
    return dict[key] ?? (key as string);
  };
};

// Phase 10.E: helper for tests only — resets the in-memory lang to whatever
// `detectInitialLang()` produces from the **current** localStorage / navigator
// state. Tests call this in `beforeEach` to defeat module-level state leaks
// between cases. Production code MUST NOT call this.
export const __resetI18nForTesting = (): void => {
  currentLang = detectInitialLang();
  writeLangToDom(currentLang);
  for (const cb of listeners) cb();
};

// String-with-placeholder helper. Used for keys whose ja/en value contains
// `{name}` substitutions (e.g. `toolbar.colorPalette.swatchAria`). Keep this
// dependency-free; intl-messageformat / icu syntax is overkill for the
// handful of params we have.
export const interpolate = (template: string, params: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : `{${name}}`,
  );
