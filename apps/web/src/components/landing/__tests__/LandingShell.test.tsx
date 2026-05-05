import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetI18nForTesting, setLang } from '../../../i18n';
import { Faq } from '../Faq';
import { Features } from '../Features';
import { Hero } from '../Hero';
import { HowTo } from '../HowTo';
import { LandingShell } from '../LandingShell';

const setup = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: Root;
  act(() => {
    root = createRoot(container);
  });
  return { container, root };
};

const teardown = (container: HTMLDivElement, root: Root) => {
  act(() => {
    root.unmount();
  });
  document.body.removeChild(container);
};

describe('Landing components', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetI18nForTesting();
    setLang('ja');
  });

  afterEach(() => {
    window.localStorage.clear();
    __resetI18nForTesting();
  });

  describe('<Hero>', () => {
    it('renders headline / subhead and accepts a dropzone slot', () => {
      const { container, root } = setup();
      try {
        act(() => {
          root.render(<Hero dropzone={<div data-testid="dz">DZ</div>} />);
        });
        // h2 (not h1) — the header still owns the page's h1 "pitamark".
        const heading = container.querySelector('#landing-hero-heading');
        expect(heading?.tagName).toBe('H2');
        expect(heading?.textContent).toBe('画像にサクッと注釈、URL で一瞬共有');
        expect(container.textContent).toContain('ドラッグして注釈を書くだけ');
        expect(container.querySelector('[data-testid="dz"]')).not.toBeNull();
      } finally {
        teardown(container, root);
      }
    });

    it('emits a <picture> with eager hero image and explicit dimensions for CLS', () => {
      const { container, root } = setup();
      try {
        act(() => {
          root.render(<Hero dropzone={null} />);
        });
        const picture = container.querySelector('picture');
        expect(picture).not.toBeNull();
        const img = picture?.querySelector('img');
        // v1: SVG editor mock; Phase 11+ swaps in a real WebP screenshot.
        expect(img?.getAttribute('src')).toBe('/landing-hero.svg');
        expect(img?.getAttribute('width')).toBe('1200');
        expect(img?.getAttribute('height')).toBe('750');
        expect(img?.getAttribute('loading')).toBe('eager');
      } finally {
        teardown(container, root);
      }
    });
  });

  describe('<Features>', () => {
    it('renders three feature items with icons and i18n copy', () => {
      const { container, root } = setup();
      try {
        act(() => {
          root.render(<Features />);
        });
        const items = container.querySelectorAll('li');
        expect(items.length).toBe(3);
        expect(container.textContent).toContain('URL 一発共有');
        expect(container.textContent).toContain('共同編集');
        expect(container.textContent).toContain('ゆるい TTL');
      } finally {
        teardown(container, root);
      }
    });
  });

  describe('<HowTo>', () => {
    it('renders three numbered steps in order', () => {
      const { container, root } = setup();
      try {
        act(() => {
          root.render(<HowTo />);
        });
        const items = container.querySelectorAll('li');
        expect(items.length).toBe(3);
        expect(items[0]?.textContent).toContain('画像をドラッグ');
        expect(items[1]?.textContent).toContain('注釈を書く');
        expect(items[2]?.textContent).toContain('URL をコピーして送る');
      } finally {
        teardown(container, root);
      }
    });
  });

  describe('<Faq>', () => {
    it('renders four <details> Q&A entries', () => {
      const { container, root } = setup();
      try {
        act(() => {
          root.render(<Faq />);
        });
        const details = container.querySelectorAll('details');
        expect(details.length).toBe(4);
        // Closed by default — content is in the DOM but visibility is browser-managed.
        for (const el of details) {
          expect(el.hasAttribute('open')).toBe(false);
        }
      } finally {
        teardown(container, root);
      }
    });
  });

  describe('<LandingShell>', () => {
    it('renders Hero + Features + HowTo + Faq + bottom AdSlot, in order', () => {
      const { container, root } = setup();
      try {
        act(() => {
          root.render(<LandingShell dropzone={<div data-testid="dz">DZ</div>} />);
        });
        const sections = container.querySelectorAll('section');
        expect(sections.length).toBe(4);
        expect(sections[0]?.getAttribute('aria-labelledby')).toBe('landing-hero-heading');
        expect(sections[1]?.getAttribute('aria-labelledby')).toBe('landing-features-heading');
        expect(sections[2]?.getAttribute('aria-labelledby')).toBe('landing-howto-heading');
        expect(sections[3]?.getAttribute('aria-labelledby')).toBe('landing-faq-heading');
        // Bottom AdSlot is the last <aside>.
        expect(container.querySelector('[data-testid="ad-slot-bottom"]')).not.toBeNull();
        // DropZone slot is forwarded into Hero.
        expect(container.querySelector('[data-testid="dz"]')).not.toBeNull();
      } finally {
        teardown(container, root);
      }
    });
  });
});
