import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { __resetI18nForTesting, setLang } from '../../../i18n';
import { COLOR_PALETTE } from '../../canvas/colors';
import { ColorPalette } from '../ColorPalette';

const swatchAria = (color: string) => `色: ${color}`;

const renderPalette = (props: {
  activeColor?: string;
  disabled?: boolean;
  onPickColor?: (color: string) => void;
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
        <ColorPalette
          activeColor={props.activeColor ?? COLOR_PALETTE[0] ?? '#000000'}
          disabled={props.disabled ?? false}
          onPickColor={props.onPickColor ?? (() => {})}
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

describe('ColorPalette', () => {
  beforeEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    // Pin language to JA so ARIA-label-based queries are deterministic.
    window.localStorage.setItem('pitamark-lang', 'ja');
    __resetI18nForTesting();
    setLang('ja');
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    __resetI18nForTesting();
  });

  it('renders one swatch button per palette color', () => {
    const m = renderPalette({});
    const swatches = m.container.querySelectorAll<HTMLButtonElement>('button[aria-label^="色:"]');
    expect(swatches.length).toBe(COLOR_PALETTE.length);
    m.unmount();
  });

  it('marks the active color as pressed', () => {
    const target = COLOR_PALETTE[2];
    if (!target) throw new Error('palette must have at least 3 colors');
    const m = renderPalette({ activeColor: target });
    const button = m.container.querySelector<HTMLButtonElement>(
      `button[aria-label="${swatchAria(target)}"]`,
    );
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    m.unmount();
  });

  it('calls onPickColor when a swatch is clicked', () => {
    const onPickColor = vi.fn();
    const m = renderPalette({ onPickColor });
    const target = COLOR_PALETTE[3];
    if (!target) throw new Error('palette must have at least 4 colors');
    const button = m.container.querySelector<HTMLButtonElement>(
      `button[aria-label="${swatchAria(target)}"]`,
    );
    act(() => {
      button?.click();
    });
    expect(onPickColor).toHaveBeenCalledWith(target);
    m.unmount();
  });

  it('disables every swatch when disabled prop is true (image not loaded)', () => {
    const m = renderPalette({ disabled: true });
    const buttons = m.container.querySelectorAll<HTMLButtonElement>('button');
    for (const b of buttons) {
      expect(b.disabled).toBe(true);
    }
    m.unmount();
  });
});
