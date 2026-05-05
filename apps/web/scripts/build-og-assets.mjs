// Phase 10.D: Generate og-image.png (1200x630) and apple-touch-icon.png (180x180)
// from inline HTML using Playwright's chromium. Run with:
//
//   pnpm -F @pitamark/web exec node scripts/build-og-assets.mjs
//
// Why HTML+chromium and not pure SVG → PNG: chromium is already installed for
// e2e and renders web fonts identically to production. The output PNGs are
// committed to `public/`; this script is the reproducible source-of-truth and
// can be re-run when the brand evolves.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// `@playwright/test` re-exports `chromium`; using it avoids a separate
// `playwright` install (the test package is already a dev dep).
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = resolve(__dirname, '..', 'public');

const BRAND_COLOR = '#5b6dff';
const TEXT_COLOR = '#ffffff';
const SUBTEXT_COLOR = '#dde2ff';

// 1200x630 OGP image: brand-colored background, logo glyph (matches favicon),
// app name + tagline. Composed in HTML so we keep typographic control.
const ogHtml = /* html */ `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1200px; height: 630px; overflow: hidden; }
      body {
        background: ${BRAND_COLOR};
        color: ${TEXT_COLOR};
        font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 48px;
        padding: 80px;
      }
      .logo {
        width: 200px; height: 200px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 36px;
      }
      .logo svg { width: 140px; height: 140px; }
      .text { display: flex; flex-direction: column; gap: 16px; }
      .name { font-size: 96px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
      .tagline {
        font-size: 36px; font-weight: 500; line-height: 1.4;
        color: ${SUBTEXT_COLOR};
      }
    </style>
  </head>
  <body>
    <div class="logo">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="7" fill="${BRAND_COLOR}" />
        <path d="M9 11h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z" stroke="${TEXT_COLOR}" stroke-width="1.75" />
        <circle cx="14" cy="9" r="2.5" stroke="${TEXT_COLOR}" stroke-width="1.75" fill="${BRAND_COLOR}" />
        <path d="M11 18l3-3 3 3 5-5" stroke="${TEXT_COLOR}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="text">
      <div class="name">pitamark</div>
      <div class="tagline">画像 URL 一発で<br />共同注釈</div>
    </div>
  </body>
</html>`;

// 180x180 apple-touch-icon: rounded-square brand background with the logo
// glyph centered. iOS auto-applies rounded corners so we don't need to
// pre-bake them, but a slight bg padding feels nicer.
const appleIconHtml = /* html */ `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 180px; height: 180px; overflow: hidden; }
      body {
        background: ${BRAND_COLOR};
        display: flex;
        align-items: center;
        justify-content: center;
      }
      svg { width: 132px; height: 132px; }
    </style>
  </head>
  <body>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
      <path d="M9 11h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z" stroke="${TEXT_COLOR}" stroke-width="1.75" />
      <circle cx="14" cy="9" r="2.5" stroke="${TEXT_COLOR}" stroke-width="1.75" fill="${BRAND_COLOR}" />
      <path d="M11 18l3-3 3 3 5-5" stroke="${TEXT_COLOR}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </body>
</html>`;

const renderToPng = async (browser, html, width, height, outPath) => {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const buf = await page.screenshot({ type: 'png', omitBackground: false });
  await ctx.close();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buf);
  console.log(`wrote ${outPath} (${width}x${height}, ${buf.byteLength} bytes)`);
};

const main = async () => {
  const browser = await chromium.launch();
  try {
    await renderToPng(browser, ogHtml, 1200, 630, resolve(PUBLIC_DIR, 'og-image.png'));
    await renderToPng(browser, appleIconHtml, 180, 180, resolve(PUBLIC_DIR, 'apple-touch-icon.png'));
  } finally {
    await browser.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
