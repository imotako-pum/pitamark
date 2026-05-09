import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// キーボードショートカットの作動を CI で lock する E2E。主なリスク領域は
// useKeyboardShortcuts (apps/web/src/hooks/useKeyboardShortcuts.ts) で window 全体の
// keydown を捕捉する一方、isEditableTarget が input/textarea にフォーカスがあるとき
// shortcut を無効化する点。本 spec は両経路を踏んで regression を防ぐ。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

const waitForRoom = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await dropImage(page);
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 20_000 });
  await page.waitForFunction(
    (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
    ANNOTATIONS_KEY,
    { timeout: 10_000 },
  );
};

const isPressed = async (page: import('@playwright/test').Page, label: string): Promise<boolean> =>
  // exact: true keeps "選択" from also matching "選択中の注釈に色を適用".
  (await page.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed')) ===
  'true';

const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'chromium',
    'グローバル keydown 捕捉は chromium 1 プロジェクトで検証する',
  );

test.describe('keyboard shortcuts', () => {
  test('V / R / A / T / H で各ツールが選択される', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await waitForRoom(page);

    // V (select)
    await page.keyboard.press('v');
    await expect.poll(() => isPressed(page, '選択')).toBe(true);

    // R (rectangle)
    await page.keyboard.press('r');
    await expect.poll(() => isPressed(page, '矩形')).toBe(true);

    // A (arrow)
    await page.keyboard.press('a');
    await expect.poll(() => isPressed(page, '矢印')).toBe(true);

    // T (text)
    await page.keyboard.press('t');
    await expect.poll(() => isPressed(page, 'テキスト')).toBe(true);

    // H (highlight)
    await page.keyboard.press('h');
    await expect.poll(() => isPressed(page, 'ハイライト')).toBe(true);
  });

  test('Esc キーで選択が解除される', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await waitForRoom(page);

    // 矩形を 1 つ追加 → 自動選択 → 削除ボタンが enabled
    await page.keyboard.press('r');
    const stage = page.locator('.konvajs-content canvas').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('canvas bounding box が取得できなかった');
    await page.mouse.move(box.x + 80, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });
    await page.mouse.up();

    // 矩形 mouseup 直後に pending Auto-arrow が立つ。Esc は最初に pending クリアを
    // 優先するため、本 spec の「Esc で選択解除」を lock するには Esc を 2 回押す
    // (1 回目: pending クリア、2 回目: 選択解除)。
    await page.keyboard.press('Escape');

    // exact: true で「注釈をすべて削除」(Eraser) と区別
    const deleteBtn = page.getByRole('button', { name: '削除', exact: true });
    await expect(deleteBtn).toBeEnabled({ timeout: 5_000 });

    // Esc → 選択解除 → 削除ボタンが disabled に戻る
    await page.keyboard.press('Escape');
    await expect(deleteBtn).toBeDisabled({ timeout: 2_000 });
  });

  test('⌘S / Ctrl+S で PNG export が発火する', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    // Modifier key は OS によって異なる。Mac なら Meta+S / 他は Control+S。
    // Playwright の chromium は実 OS に従うため process.platform で分岐。
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

    await waitForRoom(page);
    await expect(page.locator('.konvajs-content canvas').first()).toBeVisible({
      timeout: 10_000,
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await page.keyboard.press(`${modifier}+s`);
    const download = await downloadPromise;

    await expect(page.getByText('PNG を保存しました')).toBeVisible({ timeout: 5_000 });
    expect(download.suggestedFilename()).toMatch(/^pitamark-[A-Za-z0-9_-]{21}-\d{8}-\d{6}\.png$/);
  });

  test('input フォーカス中はツールショートカットが発火しない (isEditableTarget ガード)', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    // text annotation の textarea 編集中に "v" を押しても select ツールに切り替わ
    // ってはいけない (= ユーザが入力したい "v" 文字がそのまま入る)。
    // useKeyboardShortcuts の isEditableTarget が機能していることを確認。
    await waitForRoom(page);

    // テキストツールで textarea を起動
    await page.keyboard.press('t');
    const stage = page.locator('.konvajs-content canvas').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('canvas bounding box が取得できなかった');
    await page.mouse.click(box.x + 120, box.y + 120);

    const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    // 入力中に "v" を打つ → ツール切り替わらない (テキストに "v" が入る)
    await textarea.type('vrh');

    // 選択ツール button は pressed=false のまま (text ツールが pressed のまま)
    expect(await isPressed(page, '選択')).toBe(false);
    expect(await isPressed(page, 'テキスト')).toBe(true);

    // commit して終了
    await textarea.press('Enter');
    await expect(textarea).toBeHidden();
  });
});
