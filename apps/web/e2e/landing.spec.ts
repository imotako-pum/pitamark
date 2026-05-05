import { expect, test } from '@playwright/test';

test('landing page renders heading on desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('pitamark');
});

test('landing page renders the editor toolbar with all five tools', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeVisible();

  for (const label of ['選択', '矩形', '矢印', 'テキスト', 'ハイライト']) {
    // exact: true is required because the color palette adds a
    // "選択中の注釈に色を適用" button that would otherwise also match "選択".
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
});

test('toolbar tools are disabled until an image is loaded', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: '矩形' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '注釈をすべて削除' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'PNG 保存' })).toBeDisabled();
});

test('drop zone shows the empty-state hint when no image is loaded', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '画像をドロップしてください' })).toBeVisible();
});

test('toolbar stays reachable at tablet width (768px)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');

  // md breakpoint matches at 768px so the title remains visible.
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeVisible();
});

test('h1 hides on narrow viewports below md breakpoint (480px)', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 });
  await page.goto('/');

  await expect(page.locator('h1')).toBeHidden();
  await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeVisible();
});

// Skipped — needs both `wrangler dev` and `vite` running. Verified by hand
// in Phase 4; CI integration of the API workspace lands in Phase 7.
test.skip('uploading an image transitions the URL to /r/:id (with API running)', async ({
  page,
}) => {
  await page.goto('/');
});
