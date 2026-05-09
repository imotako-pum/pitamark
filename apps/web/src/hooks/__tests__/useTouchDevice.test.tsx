// useTouchDevice: window.matchMedia('(pointer: coarse)') の reactive ラッパ。
// happy-dom が matchMedia の最小実装を持つかは vitest 環境依存のため、各テストで
// vi.stubGlobal で完全制御可能な mock を渡してから hook を render する。

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTouchDevice } from '../useTouchDevice';

type ChangeListener = (e: MediaQueryListEvent) => void;

type MqlMock = {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  /** test 側から change を強制発火するためのフック */
  fire: (matches: boolean) => void;
};

const buildMqlMock = (initialMatches: boolean): MqlMock => {
  const listeners: ChangeListener[] = [];
  const mock: MqlMock = {
    matches: initialMatches,
    addEventListener: vi.fn((_event: string, fn: ChangeListener) => {
      listeners.push(fn);
    }),
    removeEventListener: vi.fn((_event: string, fn: ChangeListener) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    }),
    fire: (matches: boolean) => {
      mock.matches = matches;
      // MediaQueryListEvent は Constructor がブラウザ依存のため、
      // hook 内で参照する `matches` プロパティだけ持つ最小オブジェクトで代替。
      const evt = { matches } as MediaQueryListEvent;
      for (const fn of listeners.slice()) fn(evt);
    },
  };
  return mock;
};

const renderHookCapture = <T,>(useHook: () => T) => {
  let captured: T | null = null;
  let renderCount = 0;
  const Harness = () => {
    captured = useHook();
    renderCount += 1;
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
    get renderCount(): number {
      return renderCount;
    },
    cleanup: () => {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
};

describe('useTouchDevice', () => {
  let mql: MqlMock;
  let matchMediaMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mql = buildMqlMock(false);
    matchMediaMock = vi.fn().mockReturnValue(mql);
    vi.stubGlobal('matchMedia', matchMediaMock);
    // happy-dom が window.matchMedia を持っているケースに備えて window 側も override
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMediaMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns false initially when matchMedia matches:false', () => {
    const h = renderHookCapture(useTouchDevice);
    expect(h.current).toBe(false);
    expect(matchMediaMock).toHaveBeenCalledWith('(pointer: coarse)');
    h.cleanup();
  });

  it('returns true after mount when matchMedia matches:true', () => {
    mql.matches = true;
    const h = renderHookCapture(useTouchDevice);
    // 初回 render は false (SSR safe)、useEffect 後に true へ更新済
    expect(h.current).toBe(true);
    h.cleanup();
  });

  it('reactively updates when the media query change event fires', () => {
    const h = renderHookCapture(useTouchDevice);
    expect(h.current).toBe(false);
    act(() => {
      mql.fire(true);
    });
    expect(h.current).toBe(true);
    act(() => {
      mql.fire(false);
    });
    expect(h.current).toBe(false);
    h.cleanup();
  });

  it('removes the change listener on unmount', () => {
    const h = renderHookCapture(useTouchDevice);
    expect(mql.addEventListener).toHaveBeenCalledTimes(1);
    h.cleanup();
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
