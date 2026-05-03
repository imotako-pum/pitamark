import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// Phase 7.6 E2E 拡充: 4 種注釈ツール (rectangle / arrow / text / highlight) と
// Delete / Undo / Redo のクリティカルパスを CI でロックする。
// 既存 spec は room-create で「ツールバー enabled」、room-share で
// 「矩形 1 個の同期」までしか踏んでおらず、各ツールが独立に作動するか・
// undo/redo が history を正しく辿るかは ZERO カバレッジだった。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

const readAnnotationCount = async (page: import('@playwright/test').Page): Promise<number> => {
  return page.evaluate(
    (k) =>
      ((window as unknown as Record<string, ReadonlyArray<unknown>>)[k]?.length ?? 0) as number,
    ANNOTATIONS_KEY,
  );
};

const dragOnStage = async (
  page: import('@playwright/test').Page,
  startOffset: { x: number; y: number },
  endOffset: { x: number; y: number },
) => {
  const stage = page.locator('.konvajs-content canvas').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('Konva canvas bounding box が取得できなかった');
  await page.mouse.move(box.x + startOffset.x, box.y + startOffset.y);
  await page.mouse.down();
  await page.mouse.move(box.x + endOffset.x, box.y + endOffset.y, { steps: 5 });
  await page.mouse.up();
};

// 既存 spec (room-share / room-protected / room-create) と同じく、
// chromium-only skip は各 test 内に inline で書く。
const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'chromium',
    'Konva ハンドリングは chromium 1 プロジェクトで検証する',
  );

test.describe('annotation tools — drawing / delete / undo / redo', () => {
  test('矩形 / 矢印 / ハイライトの 3 ドラッグ系ツールがそれぞれ 1 件追加できる', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, {
      timeout: 10_000,
    });
    await page.waitForFunction(
      (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
      ANNOTATIONS_KEY,
      { timeout: 10_000 },
    );

    // 矩形
    await page.getByRole('button', { name: '矩形' }).click();
    await dragOnStage(page, { x: 60, y: 60 }, { x: 160, y: 160 });
    await expect.poll(() => readAnnotationCount(page)).toBe(1);

    // 矢印 — Phase 7.8-1 Auto-next-A で空 text + IME 起動が走るため、Esc で text を
    // 破棄してから次の assert へ。矢印そのものが 1 件追加されることを確認する spec
    // なので、Auto-next 経路を抜けた状態で count を見る。
    await page.getByRole('button', { name: '矢印' }).click();
    await dragOnStage(page, { x: 200, y: 60 }, { x: 300, y: 160 });
    await page.keyboard.press('Escape');
    await expect.poll(() => readAnnotationCount(page)).toBe(2);

    // ハイライト
    await page.getByRole('button', { name: 'ハイライト' }).click();
    await dragOnStage(page, { x: 60, y: 200 }, { x: 300, y: 240 });
    await expect.poll(() => readAnnotationCount(page)).toBe(3);
  });

  test('テキストツールはクリック → textarea に入力 → Enter で commit', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, {
      timeout: 10_000,
    });
    await page.waitForFunction(
      (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
      ANNOTATIONS_KEY,
      { timeout: 10_000 },
    );

    await page.getByRole('button', { name: 'テキスト' }).click();
    const stage = page.locator('.konvajs-content canvas').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('canvas bounding box が取得できなかった');
    // テキストツールは mousedown だけで配置 → textarea がオーバーレイ表示
    await page.mouse.click(box.x + 120, box.y + 120);

    const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.fill('テスト注釈');
    // Enter で commit (Shift+Enter は改行で別経路)
    await textarea.press('Enter');

    await expect(textarea).toBeHidden();
    await expect.poll(() => readAnnotationCount(page)).toBe(1);
  });

  test('Delete ボタンで選択中の注釈が消える', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, {
      timeout: 10_000,
    });
    await page.waitForFunction(
      (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
      ANNOTATIONS_KEY,
      { timeout: 10_000 },
    );

    // 矩形 1 個追加 → 自動で選択状態になる (annotationsReducer の create が select も発火)
    await page.getByRole('button', { name: '矩形' }).click();
    await dragOnStage(page, { x: 80, y: 80 }, { x: 200, y: 200 });
    await expect.poll(() => readAnnotationCount(page)).toBe(1);

    // 削除ボタンが選択ありで enabled になる。exact: true で「注釈をすべて削除」(Eraser) と区別
    const deleteBtn = page.getByRole('button', { name: '削除', exact: true });
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();
    await expect.poll(() => readAnnotationCount(page)).toBe(0);
  });

  test('Undo / Redo で複数注釈の追加履歴を辿れる', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    // Y.UndoManager の captureTimeout は 500ms。500ms 以内の連続操作は
    // 1 グループに merge されるため、Undo の単位を明確にするには
    // 各操作の間に > 500ms の wait を入れる。
    // (yjs-annotations-context.ts:52)
    await page.goto('/');
    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, {
      timeout: 10_000,
    });
    await page.waitForFunction(
      (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
      ANNOTATIONS_KEY,
      { timeout: 10_000 },
    );

    // 1 個目: 矩形
    await page.getByRole('button', { name: '矩形' }).click();
    await dragOnStage(page, { x: 60, y: 60 }, { x: 160, y: 160 });
    await expect.poll(() => readAnnotationCount(page)).toBe(1);

    // captureTimeout を超える wait で undo group を分離
    await page.waitForTimeout(700);

    // 2 個目: 矢印 — Phase 7.8-1 Auto-next-A で空 text + IME 起動が走るため、Esc で
    // text を破棄してから次の assert へ。矢印確定が 1 step として undo に積まれる
    // ことを確認したい spec なので、Auto-next 由来の text は履歴に残さない。
    await page.getByRole('button', { name: '矢印' }).click();
    await dragOnStage(page, { x: 200, y: 60 }, { x: 300, y: 160 });
    await page.keyboard.press('Escape');
    await expect.poll(() => readAnnotationCount(page)).toBe(2);

    await page.waitForTimeout(700);

    // Undo で 2 個目を取り消し
    const undoBtn = page.getByRole('button', { name: '元に戻す' });
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();
    await expect.poll(() => readAnnotationCount(page)).toBe(1);

    // Redo で 2 個目を復元
    const redoBtn = page.getByRole('button', { name: 'やり直し' });
    await expect(redoBtn).toBeEnabled();
    await redoBtn.click();
    await expect.poll(() => readAnnotationCount(page)).toBe(2);
  });
});
