import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetI18nForTesting, setLang } from '../../../i18n';
import { AdSlot, BOTTOM_HEIGHT_PX, RAIL_MIN_HEIGHT_PX, RAIL_WIDTH_PX } from '../AdSlot';

describe('AdSlot', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // 他 suite で setLang('en') が呼ばれた等の localStorage / lang state 漏洩を遮断する。
    // __resetI18nForTesting は reset 時に localStorage を読むので、clear → reset の順。
    // happy-dom の navigator.language は en-US default のため、テストでは
    // detectInitialLang に頼らず 'ja' を明示的に pin する。
    window.localStorage.clear();
    __resetI18nForTesting();
    setLang('ja');
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
    document.body.removeChild(container);
    window.localStorage.clear();
    __resetI18nForTesting();
  });

  it('rail variant (left) reserves fixed pixel size and is hidden below lg', () => {
    act(() => {
      root.render(<AdSlot variant="rail" side="left" />);
    });
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside?.getAttribute('aria-label')).toBe('Sponsored placeholder');
    expect(aside?.className).toContain('hidden');
    expect(aside?.className).toContain('lg:flex');
    expect(aside?.className).toContain('left-0');
    const style = aside?.getAttribute('style') ?? '';
    expect(style).toContain(`width: ${RAIL_WIDTH_PX}px`);
    expect(style).toContain(`min-height: ${RAIL_MIN_HEIGHT_PX}px`);
  });

  it('rail variant (right) anchors to the right side', () => {
    act(() => {
      root.render(<AdSlot variant="rail" side="right" />);
    });
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('right-0');
    expect(aside?.className).not.toContain('left-0');
  });

  it('bottom variant has lg:hidden and fixed height', () => {
    act(() => {
      root.render(<AdSlot variant="bottom" />);
    });
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain('lg:hidden');
    const style = aside?.getAttribute('style') ?? '';
    expect(style).toContain(`min-height: ${BOTTOM_HEIGHT_PX}px`);
    expect(style).toContain(`height: ${BOTTOM_HEIGHT_PX}px`);
  });

  it('renders the localized label (ja default)', () => {
    act(() => {
      root.render(<AdSlot variant="bottom" />);
    });
    expect(container.textContent).toContain('広告枠');
    expect(container.textContent).toContain('将来配信予定');
  });

  it('updates label when language switches to en', () => {
    act(() => {
      root.render(<AdSlot variant="bottom" />);
    });
    act(() => {
      setLang('en');
    });
    expect(container.textContent).toContain('Sponsored');
    expect(container.textContent).toContain('Reserved for future ads');
  });
});
