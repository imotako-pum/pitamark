// landing 画面における language toggle の round-trip を検証する E2E。
//
// 担保するもの:
// 1. デフォルト UI 言語は JA (playwright.config の locale='ja-JP' に従う)。
// 2. LangToggle の EN ボタンで visible な UI テキストが全部切り替わる。
// 3. `<html lang>` が更新される。
// 4. 選択結果が contract された key で localStorage に永続化される。
//
// メモ:
// - EN ラベルを assert する唯一の E2E。他の spec は playwright.config の JA pin で動く。
// - `getByRole('toolbar', { name })` 経由で assert することで、layout / styling から
//   独立に i18n 値だけを検証する。

import { expect, test } from '@playwright/test';

test.describe('i18n — LangToggle', () => {
  // 各 test は fresh な Playwright context (空 localStorage) を持つので、beforeEach での
  // 明示クリーンアップは不要。i18n の auto-detect は navigator.language
  // (= playwright.config の ja-JP) に fall through して 'ja' を pin する。下の
  // 「reload で永続」ケースは同一 test 内の `page.reload()` をまたぐ localStorage
  // が保たれることに依存する。

  // landing (source === null) では Toolbar が hidden なので、その i18n aria-label を
  // 探れない。DropZone heading が最もクリーンな代替で、翻訳済 + landing で常に
  // visible + 消えにくい signal。
  test('default lang is JA on landing (matches Playwright locale=ja-JP)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '画像をドロップしてください' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  });

  test('clicking EN toggle switches landing copy, persists to localStorage, and updates <html lang>', async ({
    page,
  }) => {
    await page.goto('/');

    // Sanity: starts in JA.
    await expect(page.getByRole('heading', { name: '画像をドロップしてください' })).toBeVisible();

    // Click EN.
    await page
      .getByRole('group', { name: '言語' })
      .getByRole('button', { name: 'English' })
      .click();

    // DropZone heading flips to the EN value.
    await expect(page.getByRole('heading', { name: 'Drop an image here' })).toBeVisible();

    // <html lang> reflects.
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // localStorage persists.
    const stored = await page.evaluate(() => window.localStorage.getItem('pitamark-lang'));
    expect(stored).toBe('en');
  });

  test('switching back to JA restores the JA landing copy', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('group', { name: '言語' })
      .getByRole('button', { name: 'English' })
      .click();
    await expect(page.getByRole('heading', { name: 'Drop an image here' })).toBeVisible();

    await page
      .getByRole('group', { name: 'Language' })
      .getByRole('button', { name: '日本語' })
      .click();
    await expect(page.getByRole('heading', { name: '画像をドロップしてください' })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Drop an image here' })).toBeVisible();
  });
});
