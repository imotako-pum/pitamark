import { expect, test } from '@playwright/test';

test('landing page renders heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('snap-share');
});
