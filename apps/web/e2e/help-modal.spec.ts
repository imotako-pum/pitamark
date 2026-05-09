import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// HelpModal の起動経路 (`?` キー / Toolbar ❓ ボタン) と閉じる経路 (Esc / 再 toggle)
// を担保する E2E。chromium 1 プロジェクトに限定。
//
// `Shift+/` を `page.keyboard.press('Shift+/')` で発火させても Playwright 環境では
// keydown の `e.key` が必ずしも `?` に解決されないため (Meta+0/1 と同類の制約)、
// 合成 KeyboardEvent を window に dispatch して useKeyboardShortcuts の listener
// を直接踏む。本 spec は「`?` キー → onShowHelp 発火 → setHelpOpen toggle」の
// パイプライン検証で、key 判別自体は unit test
// (apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx) で別途カバー。

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

// `EditorPage` を `React.lazy()` boundary に分割して canvas/Yjs vendor chunk を
// 初期 bundle から外している副作用で、`page.goto` 直後に keyboard event を発火
// すると lazy chunk と race する: Suspense fallback がまだ mount されている状態で
// `?` event が走ると、`EditorShell` (lazy boundary 内) 側の useKeyboardShortcuts
// listener が未 attach。DropZone heading は EditorShell 内に出るので、これを待てば
// mount + keyboard listener 配線が完了している。toolbar は landing
// (source === null) では hidden なので、heading の方が安定した signal。
const waitForEditorReady = (page: import('@playwright/test').Page) =>
  page.getByRole('heading', { name: '画像をドロップ' }).waitFor({ state: 'visible' });

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
