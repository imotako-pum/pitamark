// regression test: useStageSize は `window.resize` listener を登録してはいけない
// (EditorShell の resize handler と二重発火して再レンダー数を倍増させていた)。
// 代わりに `document.documentElement` を ResizeObserver で監視する仕様。

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStageSize } from '../useStageSize';

type Observer = {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

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

let observers: Observer[] = [];

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    'ResizeObserver',
    class StubResizeObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      constructor(_cb: ResizeObserverCallback) {
        observers.push(this as unknown as Observer);
      }
    },
  );
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useStageSize', () => {
  it('returns initial viewport size synchronously', () => {
    const handle = renderHookCapture(() => useStageSize());
    expect(handle.current).toEqual({ width: 1280, height: 800 });
    handle.cleanup();
  });

  it('observes document.documentElement (not window) so it does not stack with other resize listeners', () => {
    const handle = renderHookCapture(() => useStageSize());
    expect(observers).toHaveLength(1);
    expect(observers[0]?.observe).toHaveBeenCalledWith(document.documentElement);
    handle.cleanup();
  });

  it('does not register a window.resize listener', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const handle = renderHookCapture(() => useStageSize());
    const resizeRegistrations = addEventListener.mock.calls.filter(
      ([type]) => String(type) === 'resize',
    );
    expect(resizeRegistrations).toHaveLength(0);
    handle.cleanup();
  });

  it('disconnects the observer on unmount', () => {
    const handle = renderHookCapture(() => useStageSize());
    expect(observers[0]?.observe).toHaveBeenCalled();
    handle.cleanup();
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });
});
