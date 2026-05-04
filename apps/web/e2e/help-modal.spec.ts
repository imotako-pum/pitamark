import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// Phase 7.7-4 E2E: HelpModal の起動経路 (`?` キー / Toolbar ❓ ボタン) と
// 閉じる経路 (Esc / 再 toggle) を担保する。chromium 1 プロジェクトに限定。
//
// `Shift+/` を `page.keyboard.press('Shift+/')` で発火させると、Playwright
// 環境では keydown の `e.key` が必ずしも `?` に解決されないため (zoom-pan
// spec の Meta+0/1 と同類の Playwright 制約)、合成 KeyboardEvent を
// window に dispatch して useKeyboardShortcuts の listener を直接踏む。
// これは「`?` キー → onShowHelp 発火 → setHelpOpen トグル」のパイプラインを
// 検証するもので、useKeyboardShortcuts のキー判別自体は unit test
// (apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx) でカバー済。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(testInfo.project.name !== 'chromium', 'HelpModal は chromium 1 プロジェクトで検証する');

const dispatchHelpKey = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '?',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });

// Phase 8.x perf review #10 H1: `EditorPage` was put behind `React.lazy()`
// to split the canvas/Yjs vendor chunks out of the initial bundle. As a
// side-effect, immediately dispatching keyboard events after `page.goto`
// can race the lazy chunk: the Suspense fallback is still mounted when the
// `?` event fires and the `useKeyboardShortcuts` listener (declared in
// `EditorShell`, which lives inside the lazy boundary) is not attached
// yet. Wait for the toolbar to appear — that guarantees `EditorShell` has
// mounted and its listeners are wired up.
const waitForEditorReady = (page: import('@playwright/test').Page) =>
  page.getByRole('toolbar', { name: '編集ツール' }).waitFor({ state: 'visible' });

test.describe('HelpModal', () => {
  test('? キーで開いて Esc で閉じる (画像未投入でも動く)', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    // 画像未投入でも `?` は効く設計 (キーボード discoverability の担保)。
    await waitForEditorReady(page);
    await dispatchHelpKey(page);
    await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('キーボードショートカット')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="dialog-content"]')).toBeHidden({ timeout: 5_000 });
  });

  test('Toolbar の ❓ ボタンで開いて、? 連打で toggle close する', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    await dropImage(page);
    await page.waitForFunction(
      (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
      ANNOTATIONS_KEY,
      { timeout: 10_000 },
    );

    const helpBtn = page.getByRole('button', { name: 'ショートカット一覧', exact: true });
    await helpBtn.click();
    await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible({ timeout: 5_000 });

    // ? 再 dispatch で toggle 閉じる。
    await dispatchHelpKey(page);
    await expect(page.locator('[data-slot="dialog-content"]')).toBeHidden({ timeout: 5_000 });
  });

  test('チートシートに主要ショートカット (?, ⌘, S, V, C) が記載されている', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    await waitForEditorReady(page);
    await dispatchHelpKey(page);
    const modal = page.locator('[data-slot="dialog-content"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    const kbds = modal.locator('kbd');
    await expect(kbds.filter({ hasText: '⌘' }).first()).toBeVisible();
    await expect(kbds.filter({ hasText: 'S' }).first()).toBeVisible();
    await expect(kbds.filter({ hasText: 'V' }).first()).toBeVisible();
    await expect(kbds.filter({ hasText: 'C' }).first()).toBeVisible();
    await expect(kbds.filter({ hasText: '?' }).first()).toBeVisible();
  });
});
