import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type UseTurnstileTokenResult, useTurnstileToken } from '../useTurnstileToken';

// hook の返り値を outer ref にキャプチャして、@testing-library/react に頼らずに
// テストから操作する (本 repo は raw react-dom/client + happy-dom 構成 —
// useKeyboardShortcuts.test.tsx 参照)。
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

describe('useTurnstileToken', () => {
  let handle: ReturnType<typeof renderHookCapture<UseTurnstileTokenResult>>;
  afterEach(() => handle?.cleanup());

  describe("starts in 'disabled' when site key is undefined", () => {
    beforeEach(() => {
      handle = renderHookCapture(() => useTurnstileToken(undefined));
    });
    it('exposes disabled state and consumeToken returns empty string', () => {
      expect(handle.current.state).toEqual({ status: 'disabled' });
      expect(handle.current.consumeToken()).toBe('');
    });
  });

  describe("starts in 'pending' when a site key is provided", () => {
    beforeEach(() => {
      handle = renderHookCapture(() => useTurnstileToken('1x00...AA'));
    });
    it('exposes pending state', () => {
      expect(handle.current.state).toEqual({ status: 'pending' });
      expect(handle.current.consumeToken()).toBe('');
    });
  });

  describe("setToken transitions to 'ready'", () => {
    beforeEach(() => {
      handle = renderHookCapture(() => useTurnstileToken('1x00...AA'));
    });
    it('exposes the token via consumeToken', () => {
      act(() => {
        handle.current.setToken('abc123');
      });
      expect(handle.current.state).toEqual({ status: 'ready', token: 'abc123' });
      expect(handle.current.consumeToken()).toBe('abc123');
    });
  });

  describe("setError transitions to 'error'", () => {
    beforeEach(() => {
      handle = renderHookCapture(() => useTurnstileToken('1x00...AA'));
    });
    it('clears the consumable token', () => {
      act(() => {
        handle.current.setError();
      });
      expect(handle.current.state).toEqual({ status: 'error' });
      expect(handle.current.consumeToken()).toBe('');
    });
  });

  describe("reset returns to 'pending' when site key is set", () => {
    beforeEach(() => {
      handle = renderHookCapture(() => useTurnstileToken('1x00...AA'));
    });
    it('clears the previous token', () => {
      act(() => handle.current.setToken('abc'));
      act(() => handle.current.reset());
      expect(handle.current.state).toEqual({ status: 'pending' });
      expect(handle.current.consumeToken()).toBe('');
    });
  });

  describe("reset returns to 'disabled' when site key is undefined", () => {
    beforeEach(() => {
      handle = renderHookCapture(() => useTurnstileToken(undefined));
    });
    it('stays disabled even after reset', () => {
      act(() => handle.current.reset());
      expect(handle.current.state).toEqual({ status: 'disabled' });
    });
  });
});
