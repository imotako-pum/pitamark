import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetI18nForTesting, setLang } from '../../../i18n';
import { Logo } from '../Logo';

const renderLogo = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  act(() => {
    root?.render(<Logo />);
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

describe('Logo', () => {
  beforeEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    window.localStorage.setItem('pitamark-lang', 'ja');
    __resetI18nForTesting();
    setLang('ja');
  });

  afterEach(() => {
    window.localStorage.clear();
    __resetI18nForTesting();
  });

  it('renders the wordmark with "p" + arrow + "tamark"', () => {
    const m = renderLogo();
    // word は "p" + SVG + "tamark" の構造。textContent では SVG を除いた "ptamark" になる。
    const text = m.container.textContent ?? '';
    expect(text).toContain('p');
    expect(text).toContain('tamark');
    m.unmount();
  });

  it('exposes appName as accessible label on the heading', () => {
    const m = renderLogo();
    const heading = m.container.querySelector('h1');
    expect(heading).not.toBeNull();
    expect(heading?.getAttribute('aria-label')).toBe('pitamark');
    m.unmount();
  });

  it('embeds an arrow SVG in place of the "i" glyph', () => {
    const m = renderLogo();
    const svg = m.container.querySelector('svg[aria-hidden="true"]');
    expect(svg).not.toBeNull();
    // ↑ 矢印の shaft は path の M…L で始まる (M4 49 L4 -22)
    const path = svg?.querySelector('path');
    expect(path?.getAttribute('d')).toContain('M4');
    // ●ドット
    const circle = svg?.querySelector('circle');
    expect(circle).not.toBeNull();
    m.unmount();
  });
});
