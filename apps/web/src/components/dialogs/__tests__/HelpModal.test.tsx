import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpModal } from '../HelpModal';

const renderModal = (props: { open?: boolean; onOpenChange?: (o: boolean) => void }) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  act(() => {
    root?.render(
      <HelpModal open={props.open ?? false} onOpenChange={props.onOpenChange ?? (() => {})} />,
    );
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
};

describe('HelpModal', () => {
  beforeEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('open=false renders nothing into the document body', () => {
    const m = renderModal({ open: false });
    expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull();
    m.unmount();
  });

  it('open=true renders the cheatsheet title and key kbd entries', () => {
    const m = renderModal({ open: true });
    const title = document.body.querySelector('[data-slot="dialog-title"]');
    expect(title?.textContent).toContain('キーボードショートカット');
    // 主要な行ラベルが描画されていること
    expect(document.body.textContent).toContain('選択');
    expect(document.body.textContent).toContain('次の色');
    // 主要な kbd が表示されていること
    const kbds = Array.from(document.body.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(kbds).toContain('⌘');
    expect(kbds).toContain('Z');
    expect(kbds).toContain('?');
    expect(kbds).toContain('C');
    m.unmount();
  });
});
