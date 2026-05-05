import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { __resetI18nForTesting, setLang } from '../../../i18n';
import { ja } from '../../../i18n/ja';
import { COLOR_PALETTE } from '../../canvas/colors';
import { Toolbar } from '../Toolbar';

type ToolbarProps = Parameters<typeof Toolbar>[0];

const renderToolbar = (overrides: Partial<ToolbarProps> = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  const props: ToolbarProps = {
    tool: 'select',
    canUndo: false,
    canRedo: false,
    hasSelection: false,
    imageLoaded: true,
    canExport: true,
    // biome-ignore lint/style/noNonNullAssertion: palette has fixed length > 0
    activeColor: COLOR_PALETTE[0]!,
    activeFontSize: 18,
    onSetTool: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onDelete: vi.fn(),
    onClearImage: vi.fn(),
    onExport: vi.fn(),
    onPickColor: vi.fn(),
    onIncrementFontSize: vi.fn(),
    onDecrementFontSize: vi.fn(),
    onShowHelp: vi.fn(),
    ...overrides,
  };
  act(() => {
    root?.render(
      <TooltipProvider>
        <Toolbar {...props} />
      </TooltipProvider>,
    );
  });
  return {
    container,
    props,
    unmount: () => {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
};

describe('Toolbar', () => {
  beforeEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    // Pin language to JA so query selectors against `ja[...]` aria-labels match.
    window.localStorage.setItem('pitamark-lang', 'ja');
    __resetI18nForTesting();
    setLang('ja');
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    __resetI18nForTesting();
  });

  it('renders a Help button with the i18n action.help label', () => {
    const m = renderToolbar({});
    const btn = m.container.querySelector(`button[aria-label="${ja['toolbar.action.help']}"]`);
    expect(btn).not.toBeNull();
    m.unmount();
  });

  it('clicking the Help button calls onShowHelp', () => {
    const onShowHelp = vi.fn();
    const m = renderToolbar({ onShowHelp });
    const btn = m.container.querySelector<HTMLButtonElement>(
      `button[aria-label="${ja['toolbar.action.help']}"]`,
    );
    act(() => {
      btn?.click();
    });
    expect(onShowHelp).toHaveBeenCalledOnce();
    m.unmount();
  });

  it('Help button stays enabled even when image is not loaded', () => {
    const m = renderToolbar({ imageLoaded: false, canExport: false });
    const btn = m.container.querySelector<HTMLButtonElement>(
      `button[aria-label="${ja['toolbar.action.help']}"]`,
    );
    expect(btn?.disabled).toBe(false);
    m.unmount();
  });

  it('renders FontSizeControl with the active font size', () => {
    const m = renderToolbar({ activeFontSize: 24 });
    expect(m.container.textContent).toContain('24px');
    m.unmount();
  });

  it('renders FontSizeControl A+ button with aria-label', () => {
    const m = renderToolbar({});
    const btn = m.container.querySelector<HTMLButtonElement>(
      `button[aria-label="${ja['toolbar.fontSize.increaseAria']}"]`,
    );
    expect(btn).not.toBeNull();
    m.unmount();
  });
});
