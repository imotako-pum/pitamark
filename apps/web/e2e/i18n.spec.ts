// Phase 10.E E2E: language toggle round-trip on the landing screen.
//
// What this guards:
// 1. The default UI language is JA (per playwright.config locale='ja-JP').
// 2. Clicking the EN button in the LangToggle switches all visible UI text.
// 3. `<html lang>` reflects the change.
// 4. The choice is persisted in localStorage under the contracted key.
//
// Notes:
// - This is the only E2E that asserts EN labels; the rest of the suite runs
//   under the JA pin from playwright.config.
// - We assert via `getByRole('toolbar', { name })` so the test is decoupled
//   from layout / styling — only the i18n value is checked.

import { expect, test } from '@playwright/test';

test.describe('i18n — LangToggle', () => {
  // Each test gets a fresh Playwright context (empty localStorage), so we
  // don't need explicit cleanup in beforeEach — the i18n auto-detect will
  // fall through to navigator.language (= ja-JP per playwright.config) and
  // pin the default to 'ja'. The "persisted on reload" case below relies on
  // localStorage being preserved across `page.reload()` within the same test.

  test('default lang is JA on landing (matches Playwright locale=ja-JP)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  });

  test('clicking EN toggle switches the toolbar group label, persists to localStorage, and updates <html lang>', async ({
    page,
  }) => {
    await page.goto('/');

    // Sanity: starts in JA.
    await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeVisible();

    // Click EN.
    await page
      .getByRole('group', { name: '言語' })
      .getByRole('button', { name: 'English' })
      .click();

    // Toolbar aria-label flips to the EN value.
    await expect(page.getByRole('toolbar', { name: 'Editing tools' })).toBeVisible();

    // <html lang> reflects.
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // localStorage persists.
    const stored = await page.evaluate(() => window.localStorage.getItem('pitamark-lang'));
    expect(stored).toBe('en');
  });

  test('switching back to JA restores the JA toolbar label', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('group', { name: '言語' })
      .getByRole('button', { name: 'English' })
      .click();
    await expect(page.getByRole('toolbar', { name: 'Editing tools' })).toBeVisible();

    await page
      .getByRole('group', { name: 'Language' })
      .getByRole('button', { name: '日本語' })
      .click();
    await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  });

  test('persisted lang is restored on full page reload', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('group', { name: '言語' })
      .getByRole('button', { name: 'English' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('toolbar', { name: 'Editing tools' })).toBeVisible();
  });
});
