import { expect, test } from '@playwright/test';

test('landing page renders heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('snap-share');
});

test('landing page renders the editor toolbar with all five tools', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeVisible();

  for (const label of ['選択', '矩形', '矢印', 'テキスト', 'ハイライト']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
});

test('toolbar tools are disabled until an image is loaded', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: '矩形' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '画像をクリア' })).toBeDisabled();
});

test('drop zone shows the empty-state hint when no image is loaded', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '画像をドロップしてください' })).toBeVisible();
});
