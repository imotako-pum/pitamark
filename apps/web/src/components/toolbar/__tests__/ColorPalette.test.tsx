import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { COLOR_PALETTE } from '../../canvas/colors';
import { ColorPalette } from '../ColorPalette';

const renderPalette = (props: {
  pickedColor?: string;
  hasSelection?: boolean;
  disabled?: boolean;
  onPickColor?: (color: string) => void;
  onApplyAsDefault?: (color: string) => void;
  onApplyToSelected?: (color: string) => void;
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
          pickedColor={props.pickedColor ?? COLOR_PALETTE[0] ?? '#000000'}
          hasSelection={props.hasSelection ?? false}
          disabled={props.disabled ?? false}
          onPickColor={props.onPickColor ?? (() => {})}
          onApplyAsDefault={props.onApplyAsDefault ?? (() => {})}
          onApplyToSelected={props.onApplyToSelected ?? (() => {})}
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders one swatch button per palette color', () => {
    const m = renderPalette({});
    const swatches = m.container.querySelectorAll<HTMLButtonElement>('button[aria-label^="色:"]');
    expect(swatches.length).toBe(COLOR_PALETTE.length);
    m.unmount();
  });

  it('marks the picked color as pressed', () => {
    const target = COLOR_PALETTE[2];
    if (!target) throw new Error('palette must have at least 3 colors');
    const m = renderPalette({ pickedColor: target });
    const button = m.container.querySelector<HTMLButtonElement>(
      `button[aria-label="色: ${target}"]`,
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
      `button[aria-label="色: ${target}"]`,
    );
    act(() => {
      button?.click();
    });
    expect(onPickColor).toHaveBeenCalledWith(target);
    m.unmount();
  });

  it('calls onApplyAsDefault with picked color when default button is clicked', () => {
    const onApplyAsDefault = vi.fn();
    const target = COLOR_PALETTE[1];
    if (!target) throw new Error('palette must have at least 2 colors');
    const m = renderPalette({ pickedColor: target, onApplyAsDefault });
    const button = m.container.querySelector<HTMLButtonElement>(
      'button[aria-label="新規描画のデフォルト色に設定"]',
    );
    act(() => {
      button?.click();
    });
    expect(onApplyAsDefault).toHaveBeenCalledWith(target);
    m.unmount();
  });

  it('calls onApplyToSelected with picked color when apply button is clicked', () => {
    const onApplyToSelected = vi.fn();
    const target = COLOR_PALETTE[4];
    if (!target) throw new Error('palette must have at least 5 colors');
    const m = renderPalette({ pickedColor: target, hasSelection: true, onApplyToSelected });
    const button = m.container.querySelector<HTMLButtonElement>(
      'button[aria-label="選択中の注釈に色を適用"]',
    );
    act(() => {
      button?.click();
    });
    expect(onApplyToSelected).toHaveBeenCalledWith(target);
    m.unmount();
  });

  it('disables apply-to-selected when no selection exists', () => {
    const m = renderPalette({ hasSelection: false });
    const button = m.container.querySelector<HTMLButtonElement>(
      'button[aria-label="選択中の注釈に色を適用"]',
    );
    expect(button?.disabled).toBe(true);
    m.unmount();
  });

  it('disables every button when disabled prop is true (image not loaded)', () => {
    const m = renderPalette({ disabled: true, hasSelection: true });
    const buttons = m.container.querySelectorAll<HTMLButtonElement>('button');
    for (const b of buttons) {
      expect(b.disabled).toBe(true);
    }
    m.unmount();
  });
});
