import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// Phase 7.7-2 E2E: 7 色固定パレット + 2 適用ボタン UI が
//   (1) 新規注釈のデフォルト色を切り替えられる(sync と highlight が独立)
//   (2) 選択中の注釈に色を適用できる
// を最後までドラッグ＋クリックで踏んでロックする。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

const DEFAULT_SYNC_COLOR = '#e74c3c';
const DEFAULT_HIGHLIGHT_COLOR = '#f5d142';
const PICK_NON_DEFAULT_COLOR = '#3a86ff';
const APPLY_COLOR = '#9b59b6';

type AnnotationSnapshot = ReadonlyArray<Record<string, unknown>>;

const readAnnotations = async (page: import('@playwright/test').Page) =>
  page.evaluate(
    (k) =>
      ((window as unknown as Record<string, AnnotationSnapshot>)[k] ?? []) as AnnotationSnapshot,
    ANNOTATIONS_KEY,
  );

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
  await page.mouse.move(box.x + endOffset.x, box.y + endOffset.y, { steps: 8 });
  await page.mouse.up();
};

const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'chromium',
    'Color palette の hit-test は chromium 1 プロジェクトで検証する',
  );

const setupRoom = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await dropImage(page);
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
  await page.waitForFunction(
    (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
    ANNOTATIONS_KEY,
    { timeout: 10_000 },
  );
};

test.describe('annotation color — palette pick / set-default / apply-to-selected', () => {
  test('新規矩形のデフォルト色は赤(DEFAULT_SYNC_COLOR)', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    await page.getByRole('button', { name: '矩形' }).click();
    await dragOnStage(page, { x: 80, y: 80 }, { x: 200, y: 200 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    const a = (await readAnnotations(page))[0] as { color: string };
    expect(a.color).toBe(DEFAULT_SYNC_COLOR);
  });

  test('パレットで色を選択 → デフォルトに設定 → 新規矩形がその色になる', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    await page.getByRole('button', { name: '矩形' }).click();
    await page.getByRole('button', { name: `色: ${PICK_NON_DEFAULT_COLOR}` }).click();
    await page.getByRole('button', { name: '新規描画のデフォルト色に設定' }).click();

    await dragOnStage(page, { x: 80, y: 80 }, { x: 200, y: 200 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    const a = (await readAnnotations(page))[0] as { color: string };
    expect(a.color).toBe(PICK_NON_DEFAULT_COLOR);
  });

  test('選択中の注釈に色を適用すると更新される', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    await page.getByRole('button', { name: '矩形' }).click();
    await dragOnStage(page, { x: 80, y: 80 }, { x: 200, y: 200 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    // 矩形作成直後は selectedId が当該注釈になっている
    await page.getByRole('button', { name: `色: ${APPLY_COLOR}` }).click();
    await page.getByRole('button', { name: '選択中の注釈に色を適用' }).click();

    await expect
      .poll(async () => ((await readAnnotations(page))[0] as { color: string }).color)
      .toBe(APPLY_COLOR);
  });

  test('ハイライトのデフォルトは sync と独立(矩形 default を変えてもハイライトは黄のまま)', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    // 矩形ツールで sync default を青に変更
    await page.getByRole('button', { name: '矩形' }).click();
    await page.getByRole('button', { name: `色: ${PICK_NON_DEFAULT_COLOR}` }).click();
    await page.getByRole('button', { name: '新規描画のデフォルト色に設定' }).click();

    // ハイライトを描く → デフォルトの黄のまま
    await page.getByRole('button', { name: 'ハイライト' }).click();
    await dragOnStage(page, { x: 60, y: 240 }, { x: 280, y: 280 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    const a = (await readAnnotations(page))[0] as { color: string; type: string };
    expect(a.type).toBe('highlight');
    expect(a.color).toBe(DEFAULT_HIGHLIGHT_COLOR);
  });
});
