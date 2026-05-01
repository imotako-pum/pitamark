import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool } from '../annotationsReducer';
import { type KeyboardShortcuts, useKeyboardShortcuts } from '../useKeyboardShortcuts';

const Harness = ({
  shortcuts,
  onMount,
}: {
  shortcuts: KeyboardShortcuts;
  onMount?: () => void;
}) => {
  useKeyboardShortcuts(shortcuts);
  useEffect(() => {
    onMount?.();
  }, [onMount]);
  return null;
};

const setupMount = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  return {
    container,
    render: (el: React.ReactElement) => {
      act(() => {
        root?.render(el);
      });
    },
    unmount: () => {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
};

const press = (init: KeyboardEventInit & { key: string }) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  // happy-dom respects preventDefault; track via a flag.
  let prevented = false;
  const orig = event.preventDefault.bind(event);
  event.preventDefault = () => {
    prevented = true;
    orig();
  };
  window.dispatchEvent(event);
  return { prevented };
};

const baseShortcuts = (overrides: Partial<KeyboardShortcuts> = {}): KeyboardShortcuts => ({
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onDelete: vi.fn(),
  onSetTool: vi.fn() as (tool: Tool) => void,
  onEscape: vi.fn(),
  ...overrides,
});

describe('useKeyboardShortcuts', () => {
  let mount: ReturnType<typeof setupMount>;

  beforeEach(() => {
    mount = setupMount();
  });

  afterEach(() => {
    mount.unmount();
  });

  it('cmd+s fires onExport and prevents the default save dialog when onExport is provided', () => {
    const onExport = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onExport })} />);
    const { prevented } = press({ key: 's', metaKey: true });
    expect(onExport).toHaveBeenCalledOnce();
    expect(prevented).toBe(true);
  });

  it('cmd+s does NOT preventDefault when onExport is undefined (image not loaded)', () => {
    mount.render(<Harness shortcuts={baseShortcuts({ onExport: undefined })} />);
    const { prevented } = press({ key: 's', metaKey: true });
    expect(prevented).toBe(false);
  });

  it('cmd+s with Shift does NOT trigger export', () => {
    const onExport = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onExport })} />);
    press({ key: 's', metaKey: true, shiftKey: true });
    expect(onExport).not.toHaveBeenCalled();
  });

  it('does not fire shortcuts when focus is in an input', () => {
    const onExport = vi.fn();
    const onUndo = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onExport, onUndo })} />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true });
    Object.defineProperty(event, 'target', { value: input, writable: false });
    window.dispatchEvent(event);
    expect(onExport).not.toHaveBeenCalled();
    input.remove();
  });

  it('cmd+z undo and cmd+shift+z redo still work alongside the new export shortcut', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onUndo, onRedo })} />);
    press({ key: 'z', metaKey: true });
    press({ key: 'z', metaKey: true, shiftKey: true });
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it('plain "v" sets the select tool', () => {
    const onSetTool = vi.fn() as (tool: Tool) => void;
    mount.render(<Harness shortcuts={baseShortcuts({ onSetTool })} />);
    press({ key: 'v' });
    expect(onSetTool).toHaveBeenCalledWith('select');
  });
});
