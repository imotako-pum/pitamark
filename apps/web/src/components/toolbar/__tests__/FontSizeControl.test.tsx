import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { __resetI18nForTesting, setLang } from '../../../i18n';
import { ja } from '../../../i18n/ja';
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '../../../lib/fontSize';
import { FontSizeControl } from '../FontSizeControl';

const INC_ARIA = ja['toolbar.fontSize.increaseAria'];
const DEC_ARIA = ja['toolbar.fontSize.decreaseAria'];

const renderControl = (props: {
  activeFontSize?: number;
  disabled?: boolean;
  onIncrementFontSize?: () => void;
  onDecrementFontSize?: () => void;
}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  act(() => {
    root?.render(
      <TooltipProvider>
        <FontSizeControl
          activeFontSize={props.activeFontSize ?? 18}
          disabled={props.disabled ?? false}
          onIncrementFontSize={props.onIncrementFontSize ?? (() => {})}
          onDecrementFontSize={props.onDecrementFontSize ?? (() => {})}
        />
      </TooltipProvider>,
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

describe('FontSizeControl', () => {
  beforeEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    window.localStorage.setItem('snap-share-lang', 'ja');
    __resetI18nForTesting();
    setLang('ja');
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    __resetI18nForTesting();
  });

  it('renders the current font size', () => {
    const m = renderControl({ activeFontSize: 24 });
    expect(m.container.textContent).toContain('24px');
    m.unmount();
  });

  it('clicking + calls onIncrementFontSize', () => {
    const onIncrementFontSize = vi.fn();
    const m = renderControl({ onIncrementFontSize });
    const btn = m.container.querySelector<HTMLButtonElement>(`button[aria-label="${INC_ARIA}"]`);
    act(() => {
      btn?.click();
    });
    expect(onIncrementFontSize).toHaveBeenCalledOnce();
    m.unmount();
  });

  it('clicking − calls onDecrementFontSize', () => {
    const onDecrementFontSize = vi.fn();
    const m = renderControl({ onDecrementFontSize });
    const btn = m.container.querySelector<HTMLButtonElement>(`button[aria-label="${DEC_ARIA}"]`);
    act(() => {
      btn?.click();
    });
    expect(onDecrementFontSize).toHaveBeenCalledOnce();
    m.unmount();
  });

  it('disables both buttons when disabled prop is true', () => {
    const m = renderControl({ disabled: true });
    const buttons = m.container.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b.disabled).toBe(true);
    m.unmount();
  });

  it('disables − at MIN_FONT_SIZE and disables + at MAX_FONT_SIZE', () => {
    const minM = renderControl({ activeFontSize: MIN_FONT_SIZE });
    const minDec = minM.container.querySelector<HTMLButtonElement>(
      `button[aria-label="${DEC_ARIA}"]`,
    );
    const minInc = minM.container.querySelector<HTMLButtonElement>(
      `button[aria-label="${INC_ARIA}"]`,
    );
    expect(minDec?.disabled).toBe(true);
    expect(minInc?.disabled).toBe(false);
    minM.unmount();

    const maxM = renderControl({ activeFontSize: MAX_FONT_SIZE });
    const maxDec = maxM.container.querySelector<HTMLButtonElement>(
      `button[aria-label="${DEC_ARIA}"]`,
    );
    const maxInc = maxM.container.querySelector<HTMLButtonElement>(
      `button[aria-label="${INC_ARIA}"]`,
    );
    expect(maxDec?.disabled).toBe(false);
    expect(maxInc?.disabled).toBe(true);
    maxM.unmount();
  });
});
