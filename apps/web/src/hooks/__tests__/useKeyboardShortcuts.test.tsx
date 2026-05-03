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

  it('? (Shift+/) fires onShowHelp and prevents default when provided', () => {
    const onShowHelp = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onShowHelp })} />);
    const { prevented } = press({ key: '?', shiftKey: true });
    expect(onShowHelp).toHaveBeenCalledOnce();
    expect(prevented).toBe(true);
  });

  it('? does NOT preventDefault when onShowHelp is undefined', () => {
    mount.render(<Harness shortcuts={baseShortcuts()} />);
    const { prevented } = press({ key: '?', shiftKey: true });
    expect(prevented).toBe(false);
  });

  it('C (no shift) fires onCycleColorNext, not Prev', () => {
    const onCycleColorNext = vi.fn();
    const onCycleColorPrev = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onCycleColorNext, onCycleColorPrev })} />);
    const { prevented } = press({ key: 'c' });
    expect(onCycleColorNext).toHaveBeenCalledOnce();
    expect(onCycleColorPrev).not.toHaveBeenCalled();
    expect(prevented).toBe(true);
  });

  it('Shift+C fires onCycleColorPrev, not Next', () => {
    const onCycleColorNext = vi.fn();
    const onCycleColorPrev = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onCycleColorNext, onCycleColorPrev })} />);
    // Browsers raise key to upper-case when Shift is down; useKeyboardShortcuts
    // lower-cases internally so 'C' is matched as 'c'.
    const { prevented } = press({ key: 'C', shiftKey: true });
    expect(onCycleColorPrev).toHaveBeenCalledOnce();
    expect(onCycleColorNext).not.toHaveBeenCalled();
    expect(prevented).toBe(true);
  });

  it('Cmd+C does NOT trigger color cycle (browser copy must be preserved)', () => {
    const onCycleColorNext = vi.fn();
    const onCycleColorPrev = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onCycleColorNext, onCycleColorPrev })} />);
    press({ key: 'c', metaKey: true });
    expect(onCycleColorNext).not.toHaveBeenCalled();
    expect(onCycleColorPrev).not.toHaveBeenCalled();
  });

  it('does not fire ? or C when focus is in an input', () => {
    const onShowHelp = vi.fn();
    const onCycleColorNext = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onShowHelp, onCycleColorNext })} />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const helpEv = new KeyboardEvent('keydown', {
      key: '?',
      shiftKey: true,
      bubbles: true,
    });
    Object.defineProperty(helpEv, 'target', { value: input, writable: false });
    window.dispatchEvent(helpEv);
    const cEv = new KeyboardEvent('keydown', { key: 'c', bubbles: true });
    Object.defineProperty(cEv, 'target', { value: input, writable: false });
    window.dispatchEvent(cEv);
    expect(onShowHelp).not.toHaveBeenCalled();
    expect(onCycleColorNext).not.toHaveBeenCalled();
    input.remove();
  });
});
