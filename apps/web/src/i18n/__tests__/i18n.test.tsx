// Phase 10.E: i18n core TDD specs. The infrastructure (useTranslation +
// useCurrentLang + setLang + interpolate) must be exercised independently
// from the dict contents so future contributors can edit translations
// without breaking lang state.
//
// Hook tests use the project's existing `renderHookCapture` pattern (React
// 19's `act` + `createRoot`) rather than @testing-library/react which is
// not a dep of this workspace.

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
  if (initial) window.localStorage.setItem('snap-share-lang', initial);
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
    // `dropzone.instructionSuffix` is intentionally empty in EN because the
    // Japanese template has a trailing particle that has no English analogue;
    // the suffix slot collapses cleanly. Mark and exempt it explicitly so
    // accidental empties elsewhere still fail.
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
    expect(window.localStorage.getItem('snap-share-lang')).toBe('en');
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
