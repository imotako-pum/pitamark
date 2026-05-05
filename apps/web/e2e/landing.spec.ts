import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('landing page renders heading on desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('pitamark');
});

// Phase 10.H: Toolbar is hidden on landing (source === null). The disabled
// tool buttons added no value before an image was loaded and crowded the
// landing surface. The Toolbar mounts as soon as `source !== null`, which
// is also the implicit "now you can edit" affordance.
test('editor toolbar is hidden on landing (no image loaded)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeHidden();
});

test('drop zone shows the empty-state hint when no image is loaded', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '画像をドロップしてください' })).toBeVisible();
});

test('brand h1 stays reachable at tablet width (768px) — toolbar still hidden', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');

  // md breakpoint matches at 768px so the brand title remains visible…
  await expect(page.locator('h1')).toBeVisible();
  // …but the editor toolbar stays hidden on landing regardless of width.
  await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeHidden();
});

test('h1 hides on narrow viewports below md breakpoint (480px)', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 });
  await page.goto('/');

  // Header h1 ("pitamark") is gated behind `md:block`.
  await expect(page.locator('h1')).toBeHidden();
  // Phase 10.H: toolbar stays hidden on landing regardless of viewport;
  // the LangToggle now sits next to the header so language switching is
  // still reachable from narrow widths.
  await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeHidden();
  await expect(page.getByRole('group', { name: '言語' })).toBeVisible();
});

// Skipped — needs both `wrangler dev` and `vite` running. Verified by hand
// in Phase 4; CI integration of the API workspace lands in Phase 7.
test.skip('uploading an image transitions the URL to /r/:id (with API running)', async ({
  page,
}) => {
  await page.goto('/');
});

// Phase 10.H: landing surface coverage. The ja Hero h2 is the canonical
// "what this site is" message; matching the exact string keeps copy
// changes intentional.

test('landing hero h2 shows the headline copy (ja)', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 2, name: '画像にサクッと注釈、URL で一瞬共有' }),
  ).toBeVisible();
});

test('landing surface renders features / howto / faq sections', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: 'できること' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '使い方は 3 ステップ' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'よくある質問' })).toBeVisible();
  // 4 FAQ <details> entries are present (closed by default).
  await expect(page.locator('details')).toHaveCount(4);
});

test('rail ad slots are visible on lg+ viewports with fixed pixel size (CLS guard)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const railLeft = page.getByTestId('ad-slot-rail-left');
  const railRight = page.getByTestId('ad-slot-rail-right');
  await expect(railLeft).toBeVisible();
  await expect(railRight).toBeVisible();
  // Inline styles encode the CLS-safe min-height + width contract.
  await expect(railLeft).toHaveAttribute('style', /width:\s*160px/);
  await expect(railLeft).toHaveAttribute('style', /min-height:\s*600px/);
  await expect(railRight).toHaveAttribute('style', /width:\s*160px/);
});

test('rail ad slots are hidden below lg, bottom slot takes over', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto('/');
  // Both rails exist in the DOM but are display:none below lg.
  await expect(page.getByTestId('ad-slot-rail-left')).toBeHidden();
  await expect(page.getByTestId('ad-slot-rail-right')).toBeHidden();
  // The landing surface emits the bottom AdSlot when image is unloaded.
  const bottom = page.getByTestId('ad-slot-bottom');
  await expect(bottom).toBeVisible();
  await expect(bottom).toHaveAttribute('style', /min-height:\s*100px/);
});

test('landing surface has no axe violations (wcag 2.0/2.1/2.2 AA)', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
