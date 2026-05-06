// i18n core の TDD spec。infrastructure (useTranslation + useCurrentLang + setLang +
// interpolate) を辞書中身から独立に検証することで、後続 contributor が翻訳を編集して
// も lang state を壊せない構造を保つ。
//
// hook テストは、本 workspace の依存に無い @testing-library/react を避け、既存の
// `renderHookCapture` パターン (React 19 の `act` + `createRoot`) を使う。

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../en';
import {
  __resetI18nForTesting,
  interpolate,
  setLang,
  useCurrentLang,
  useTranslation,
} from '../index';
import { ja } from '../ja';

const renderHookCapture = <T,>(useHook: () => T) => {
  let captured: T | null = null;
  const Harness = () => {
    captured = useHook();
    return null;
  };
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  act(() => {
    root?.render(<Harness />);
  });
  return {
    get current(): T {
      if (captured == null) throw new Error('hook never rendered');
      return captured;
    },
    cleanup: () => {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
};

const reset = (initial?: 'ja' | 'en') => {
  window.localStorage.clear();
  if (initial) window.localStorage.setItem('pitamark-lang', initial);
  __resetI18nForTesting();
};

describe('i18n — dict integrity', () => {
  it('ja and en cover exactly the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
  });

  it('ja has no empty values (every key is translated)', () => {
    const empties = Object.entries(ja).filter(([, v]) => v.length === 0);
    expect(empties).toEqual([]);
  });

  it('en has no empty values (every key is translated, even if draft) — except documented placeholders', () => {
    // `dropzone.instructionSuffix` は EN で意図的に空。JA template に末尾助詞があり
    // 英語に対応物が無いため、suffix slot を空文字で潰す形にしてある。ここで明示的に
    // 例外登録し、それ以外の場所での誤った空文字は今後も検知できるようにする。
    const intentionalEmpties = new Set(['dropzone.instructionSuffix']);
    const empties = Object.entries(en)
      .filter(([k, v]) => v.length === 0 && !intentionalEmpties.has(k))
      .map(([k]) => k);
    expect(empties).toEqual([]);
  });
});

describe('i18n — useTranslation', () => {
  beforeEach(() => reset('ja'));
  afterEach(() => reset('ja'));

  it('returns the JA value for a known key under default lang', () => {
    const handle = renderHookCapture(() => useTranslation());
    expect(handle.current('toolbar.tool.select')).toBe(ja['toolbar.tool.select']);
    handle.cleanup();
  });

  it('switches to EN when setLang("en") is called', () => {
    const handle = renderHookCapture(() => useTranslation());
    act(() => {
      setLang('en');
    });
    expect(handle.current('toolbar.tool.select')).toBe(en['toolbar.tool.select']);
    handle.cleanup();
  });

  it('persists the chosen lang in localStorage', () => {
    const handle = renderHookCapture(() => useTranslation());
    act(() => {
      setLang('en');
    });
    expect(window.localStorage.getItem('pitamark-lang')).toBe('en');
    handle.cleanup();
  });

  it('reads localStorage on init when present', () => {
    reset('en');
    const handle = renderHookCapture(() => useTranslation());
    expect(handle.current('toolbar.tool.select')).toBe(en['toolbar.tool.select']);
    handle.cleanup();
  });

  it('updates document.documentElement.lang on lang change', () => {
    const handle = renderHookCapture(() => useTranslation());
    act(() => {
      setLang('en');
    });
    expect(document.documentElement.lang).toBe('en');
    act(() => {
      setLang('ja');
    });
    expect(document.documentElement.lang).toBe('ja');
    handle.cleanup();
  });
});

describe('i18n — useCurrentLang', () => {
  beforeEach(() => reset('ja'));
  afterEach(() => reset('ja'));

  it('returns the value chosen via setLang', () => {
    const handle = renderHookCapture(() => useCurrentLang());
    act(() => {
      setLang('en');
    });
    expect(handle.current).toBe('en');
    act(() => {
      setLang('ja');
    });
    expect(handle.current).toBe('ja');
    handle.cleanup();
  });

  it('returns the persisted lang on init when localStorage holds a supported value', () => {
    reset('en');
    const handle = renderHookCapture(() => useCurrentLang());
    expect(handle.current).toBe('en');
    handle.cleanup();
  });
});

describe('i18n — legacy localStorage migration (Phase 10.D)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetI18nForTesting();
  });
  afterEach(() => {
    window.localStorage.clear();
    __resetI18nForTesting();
  });

  it('migrates a valid legacy `snap-share-lang` value to `pitamark-lang` and removes the legacy key', () => {
    window.localStorage.setItem('snap-share-lang', 'en');
    __resetI18nForTesting();
    const handle = renderHookCapture(() => useCurrentLang());
    expect(handle.current).toBe('en');
    expect(window.localStorage.getItem('pitamark-lang')).toBe('en');
    expect(window.localStorage.getItem('snap-share-lang')).toBeNull();
    handle.cleanup();
  });

  it('drops an invalid legacy value and falls back to navigator detection without re-checking', () => {
    window.localStorage.setItem('snap-share-lang', 'fr');
    __resetI18nForTesting();
    const handle = renderHookCapture(() => useCurrentLang());
    // 'fr' はサポート対象外なので新 key として永続化されてはいけない。
    expect(window.localStorage.getItem('pitamark-lang')).toBeNull();
    // legacy key も削除して、毎 load で再 visit しないようにする。
    expect(window.localStorage.getItem('snap-share-lang')).toBeNull();
    handle.cleanup();
  });

  it('prefers the new `pitamark-lang` key when both keys are present', () => {
    window.localStorage.setItem('snap-share-lang', 'ja');
    window.localStorage.setItem('pitamark-lang', 'en');
    __resetI18nForTesting();
    const handle = renderHookCapture(() => useCurrentLang());
    expect(handle.current).toBe('en');
    // この分岐では legacy key は触らない — `pitamark-lang` が無いときだけ migration
    // を走らせる。「新 key 無し + legacy あり」の将来 run で掃除されれば十分。
    expect(window.localStorage.getItem('snap-share-lang')).toBe('ja');
    handle.cleanup();
  });
});

describe('i18n — interpolate', () => {
  it('substitutes {name} placeholders with the provided value', () => {
    expect(interpolate('Color: {color}', { color: '#ff5722' })).toBe('Color: #ff5722');
  });

  it('leaves unknown placeholders intact (no silent drop)', () => {
    expect(interpolate('Hello {name}, {greeting}!', { name: 'World' })).toBe(
      'Hello World, {greeting}!',
    );
  });

  it('coerces numbers to strings', () => {
    expect(interpolate('count: {n}', { n: 42 })).toBe('count: 42');
  });
});
