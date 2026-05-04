import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '../../../lib/fontSize';
import { FontSizeControl } from '../FontSizeControl';

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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the current font size', () => {
    const m = renderControl({ activeFontSize: 24 });
    expect(m.container.textContent).toContain('24px');
    m.unmount();
  });

  it('clicking + calls onIncrementFontSize', () => {
    const onIncrementFontSize = vi.fn();
    const m = renderControl({ onIncrementFontSize });
    const btn = m.container.querySelector<HTMLButtonElement>(
      'button[aria-label="フォントサイズを大きくする"]',
    );
    act(() => {
      btn?.click();
    });
    expect(onIncrementFontSize).toHaveBeenCalledOnce();
    m.unmount();
  });

  it('clicking − calls onDecrementFontSize', () => {
    const onDecrementFontSize = vi.fn();
    const m = renderControl({ onDecrementFontSize });
    const btn = m.container.querySelector<HTMLButtonElement>(
      'button[aria-label="フォントサイズを小さくする"]',
    );
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
      'button[aria-label="フォントサイズを小さくする"]',
    );
    const minInc = minM.container.querySelector<HTMLButtonElement>(
      'button[aria-label="フォントサイズを大きくする"]',
    );
    expect(minDec?.disabled).toBe(true);
    expect(minInc?.disabled).toBe(false);
    minM.unmount();

    const maxM = renderControl({ activeFontSize: MAX_FONT_SIZE });
    const maxDec = maxM.container.querySelector<HTMLButtonElement>(
      'button[aria-label="フォントサイズを小さくする"]',
    );
    const maxInc = maxM.container.querySelector<HTMLButtonElement>(
      'button[aria-label="フォントサイズを大きくする"]',
    );
    expect(maxDec?.disabled).toBe(false);
    expect(maxInc?.disabled).toBe(true);
    maxM.unmount();
  });
});
