import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetI18nForTesting, setLang } from '../../../i18n';
import { ja } from '../../../i18n/ja';
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
    window.localStorage.setItem('pitamark-lang', 'ja');
    __resetI18nForTesting();
    setLang('ja');
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    __resetI18nForTesting();
  });

  it('open=false renders nothing into the document body', () => {
    const m = renderModal({ open: false });
    expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull();
    m.unmount();
  });

  it('open=true renders the cheatsheet title and key kbd entries', () => {
    const m = renderModal({ open: true });
    const title = document.body.querySelector('[data-slot="dialog-title"]');
    expect(title?.textContent).toContain(ja['help.title']);
    // 主要な行ラベルが描画されていること
    expect(document.body.textContent).toContain(ja['help.row.select']);
    expect(document.body.textContent).toContain(ja['help.row.nextColor']);
    // 「次手予測」セクションが描画されていること
    expect(document.body.textContent).toContain(ja['help.section.predict']);
    // 主要な kbd が表示されていること
    const kbds = Array.from(document.body.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(kbds).toContain('⌘');
    expect(kbds).toContain('Z');
    expect(kbds).toContain('?');
    expect(kbds).toContain('C');
    m.unmount();
  });

  it('lists the [ and ] shortcuts under the text section', () => {
    const m = renderModal({ open: true });
    expect(document.body.textContent).toContain(ja['help.section.text']);
    expect(document.body.textContent).toContain(ja['help.row.fontSizeIncrease']);
    expect(document.body.textContent).toContain(ja['help.row.fontSizeDecrease']);
    const kbds = Array.from(document.body.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(kbds).toContain(']');
    expect(kbds).toContain('[');
    m.unmount();
  });

  // 次手予測 (矢印→テキスト / 矩形→矢印) のキー規約は HelpModal で発見できる必要が
  // ある。Enter (確定) と ⌫ (pending クリア) は新セクション固有のラベル — Esc は他
  // セクションにも出るので一意性までは要求しない。
  it('lists the Auto-next predict section with Enter / Esc / ⌫ kbds', () => {
    const m = renderModal({ open: true });
    expect(document.body.textContent).toContain(ja['help.section.predict']);
    expect(document.body.textContent).toContain(ja['help.row.suggestionAccept']);
    expect(document.body.textContent).toContain(ja['help.row.suggestionDismiss']);
    expect(document.body.textContent).toContain(ja['help.row.pendingClear']);
    const kbds = Array.from(document.body.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(kbds).toContain('Enter');
    expect(kbds).toContain('⌫');
    m.unmount();
  });

  // DialogDescription 2 文目に Auto-next の確定/破棄キーが明文化されること。modal を
  // 開いた時点で説明が読める前提を守る。
  it('exposes Auto-next confirm/cancel keys in the dialog description', () => {
    const m = renderModal({ open: true });
    const desc = document.body.querySelector('[data-slot="dialog-description"]');
    expect(desc?.textContent).toContain('サジェスト');
    expect(desc?.textContent).toContain('Enter');
    expect(desc?.textContent).toContain('Esc');
    m.unmount();
  });
});
