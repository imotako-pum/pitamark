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
    // Phase 7.8-5: 「次手予測」セクションが描画されていること
    expect(document.body.textContent).toContain('次手予測');
    // 主要な kbd が表示されていること
    const kbds = Array.from(document.body.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(kbds).toContain('⌘');
    expect(kbds).toContain('Z');
    expect(kbds).toContain('?');
    expect(kbds).toContain('C');
    m.unmount();
  });

  it('lists the [ and ] shortcuts under "テキスト" section', () => {
    const m = renderModal({ open: true });
    expect(document.body.textContent).toContain('テキスト');
    expect(document.body.textContent).toContain('フォントサイズ +2');
    expect(document.body.textContent).toContain('フォントサイズ -2');
    const kbds = Array.from(document.body.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(kbds).toContain(']');
    expect(kbds).toContain('[');
    m.unmount();
  });

  // Phase 7.8-5: 次手予測 (矢印→テキスト / 矩形→矢印) のキー規約は HelpModal で
  // 発見できる必要がある。Enter (確定) と ⌫ (pending クリア) は新セクション
  // 固有のラベル — Esc は他セクションでも出現するので一意性は要求しない。
  it('lists the Auto-next predict section with Enter / Esc / ⌫ kbds', () => {
    const m = renderModal({ open: true });
    expect(document.body.textContent).toContain('次手予測');
    expect(document.body.textContent).toContain('サジェスト確定');
    expect(document.body.textContent).toContain('サジェスト破棄');
    expect(document.body.textContent).toContain('pending クリア');
    const kbds = Array.from(document.body.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(kbds).toContain('Enter');
    expect(kbds).toContain('⌫');
    m.unmount();
  });

  // Phase 7.8-5: DialogDescription 2 文目に Auto-next の確定/破棄キーが
  // 明文化されること。長文化したことで modal 内に説明が載る前提を守る。
  it('exposes Auto-next confirm/cancel keys in the dialog description', () => {
    const m = renderModal({ open: true });
    const desc = document.body.querySelector('[data-slot="dialog-description"]');
    expect(desc?.textContent).toContain('サジェスト');
    expect(desc?.textContent).toContain('Enter');
    expect(desc?.textContent).toContain('Esc');
    m.unmount();
  });
});
