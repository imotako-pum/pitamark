// ContextMenu: 長押し成立時の menu (ADR-0007 D4)。
// open / anchor / item dispatch / 画面端 flip / destructive 色 / click-outside-close を検証。

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTEXT_MENU_ITEMS, ContextMenu } from '../ContextMenu';

describe('ContextMenu', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('open=false なら何も render しない', () => {
    act(() => {
      root.render(
        <ContextMenu
          open={false}
          anchor={{ x: 10, y: 10 }}
          onSelect={() => {}}
          onClose={() => {}}
        />,
      );
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('anchor=null なら何も render しない', () => {
    act(() => {
      root.render(<ContextMenu open={true} anchor={null} onSelect={() => {}} onClose={() => {}} />);
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('open=true + anchor で 4 menu item を全部 render', () => {
    act(() => {
      root.render(
        <ContextMenu
          open={true}
          anchor={{ x: 100, y: 100 }}
          onSelect={() => {}}
          onClose={() => {}}
        />,
      );
    });
    const menu = document.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    const items = document.querySelectorAll('[role="menuitem"]');
    expect(items).toHaveLength(CONTEXT_MENU_ITEMS.length);
    expect(items).toHaveLength(4);
  });

  it('item click で onSelect(id) と onClose() が両方呼ばれる', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(
        <ContextMenu
          open={true}
          anchor={{ x: 100, y: 100 }}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );
    });
    const items = document.querySelectorAll('[role="menuitem"]');
    const deleteIdx = CONTEXT_MENU_ITEMS.findIndex((i) => i.id === 'delete');
    const deleteButton = items[deleteIdx] as HTMLButtonElement;
    act(() => {
      deleteButton.click();
    });
    expect(onSelect).toHaveBeenCalledWith('delete');
    expect(onClose).toHaveBeenCalled();
  });

  it('destructive item (delete) に text-destructive クラスが付く', () => {
    act(() => {
      root.render(
        <ContextMenu
          open={true}
          anchor={{ x: 100, y: 100 }}
          onSelect={() => {}}
          onClose={() => {}}
        />,
      );
    });
    const items = document.querySelectorAll('[role="menuitem"]');
    const deleteIdx = CONTEXT_MENU_ITEMS.findIndex((i) => i.id === 'delete');
    const deleteButton = items[deleteIdx] as HTMLButtonElement;
    expect(deleteButton.className).toContain('text-destructive');
  });

  it('non-destructive item には text-destructive クラスが付かない', () => {
    act(() => {
      root.render(
        <ContextMenu
          open={true}
          anchor={{ x: 100, y: 100 }}
          onSelect={() => {}}
          onClose={() => {}}
        />,
      );
    });
    const items = document.querySelectorAll('[role="menuitem"]');
    const duplicateIdx = CONTEXT_MENU_ITEMS.findIndex((i) => i.id === 'duplicate');
    const duplicateButton = items[duplicateIdx] as HTMLButtonElement;
    expect(duplicateButton.className).not.toContain('text-destructive');
  });

  it('menu 外の pointerdown で onClose が呼ばれる (click-outside-to-close)', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(
        <ContextMenu
          open={true}
          anchor={{ x: 100, y: 100 }}
          onSelect={() => {}}
          onClose={onClose}
        />,
      );
    });
    // menu 外 (= document.body 上) で pointerdown 発火
    act(() => {
      const evt = new PointerEvent('pointerdown', { bubbles: true });
      document.body.dispatchEvent(evt);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('menu 内の pointerdown では onClose は呼ばれない (stopPropagation)', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(
        <ContextMenu
          open={true}
          anchor={{ x: 100, y: 100 }}
          onSelect={() => {}}
          onClose={onClose}
        />,
      );
    });
    const menu = document.querySelector('[role="menu"]') as HTMLDivElement;
    act(() => {
      const evt = new PointerEvent('pointerdown', { bubbles: true });
      menu.dispatchEvent(evt);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
