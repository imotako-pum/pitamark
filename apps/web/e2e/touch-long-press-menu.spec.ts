import { expect, test } from '@playwright/test';
import {
  type AcceptanceAnnotation,
  dragOnStage,
  readAnnotations,
  readFirstAnnotation,
  selectTool,
  setupEditor,
  tapStage,
  touchSequence,
} from './fixtures/touch-helpers';

// Phase 10.J-2: 長押しコンテキストメニューが 500ms hold で開き、4 項目
// (削除 / 複製 / 前面 / 背面) すべてが annotation 操作を実施することを CI で lock-in。
//
// useLongPress (LONG_PRESS_DURATION_MS = 500ms) + ContextMenu (role="menu") の
// 結合動作を本物 touch event 経路で検証する。

const skipNonMobileChrome = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'mobile-chrome',
    'long-press menu spec は mobile-chrome project のみ実行する',
  );

const logicalToScreen = async (
  page: import('@playwright/test').Page,
  point: { x: number; y: number },
): Promise<{ x: number; y: number }> =>
  page.evaluate((p) => {
    const stages = (
      window as unknown as {
        Konva?: { stages: Array<{ scaleX: () => number; x: () => number; y: () => number }> };
      }
    ).Konva?.stages;
    const stage = stages?.[0];
    if (!stage) return p;
    return {
      x: p.x * stage.scaleX() + stage.x(),
      y: p.y * stage.scaleX() + stage.y(),
    };
  }, point);

const logicalToViewport = async (
  page: import('@playwright/test').Page,
  point: { x: number; y: number },
): Promise<{ x: number; y: number }> => {
  const screen = await logicalToScreen(page, point);
  const box = await page.locator('.konvajs-content canvas').first().boundingBox();
  if (!box) throw new Error('Stage canvas bounding box が取得できなかった');
  return { x: box.x + screen.x, y: box.y + screen.y };
};

const shapeCenterViewport = async (
  page: import('@playwright/test').Page,
  a: AcceptanceAnnotation,
): Promise<{ x: number; y: number }> => {
  if (
    (a.type === 'rectangle' || a.type === 'highlight') &&
    a.x !== undefined &&
    a.y !== undefined &&
    a.width !== undefined &&
    a.height !== undefined
  ) {
    return logicalToViewport(page, { x: a.x + a.width / 2, y: a.y + a.height / 2 });
  }
  throw new Error(`shapeCenterViewport: unsupported shape ${a.type}`);
};

/** 描画直後の auto-select を deselect。空エリア tap で onClick(null) を発火。 */
const deselectAll = async (page: import('@playwright/test').Page) => {
  await selectTool(page, '選択');
  await tapStage(page, { x: 10, y: 10 });
};

/** 矩形を 1 つ追加 → deselect → centerViewport を返す共通フロー。 */
const addRectangleAndGetCenter = async (
  page: import('@playwright/test').Page,
): Promise<{ annotation: AcceptanceAnnotation; center: { x: number; y: number } }> => {
  await selectTool(page, '矩形');
  await dragOnStage(page, { x: 60, y: 60 }, { x: 160, y: 160 });
  const annotation = await readFirstAnnotation(page);
  if (!annotation || annotation.type !== 'rectangle') throw new Error('rectangle add 失敗');
  await deselectAll(page);
  return { annotation, center: await shapeCenterViewport(page, annotation) };
};

test.describe('Phase 10.J-2: long-press context menu', () => {
  test('500ms 長押しで menu が開き 4 項目 (削除 / 複製 / 前面 / 背面) が出る', async ({
    page,
  }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    const { center } = await addRectangleAndGetCenter(page);
    // shape center で 600ms 長押し (LONG_PRESS_DURATION_MS = 500ms より余裕)
    await touchSequence(page, [
      { action: 'down', x: center.x, y: center.y },
      { action: 'wait', ms: 600 },
      { action: 'up' },
    ]);
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible({ timeout: 1_000 });
    const items = menu.locator('[role="menuitem"]');
    await expect(items).toHaveCount(4);
  });

  test('短い tap (< 500ms) では menu が開かない', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    const { center } = await addRectangleAndGetCenter(page);
    // 100ms hold は LONG_PRESS_DURATION_MS = 500ms に届かない → menu 開かない
    await touchSequence(page, [
      { action: 'down', x: center.x, y: center.y },
      { action: 'wait', ms: 100 },
      { action: 'up' },
    ]);
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeHidden({ timeout: 800 });
  });

  test('長押し → 「削除」を tap → annotation が消える', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    const { center } = await addRectangleAndGetCenter(page);
    expect(await readAnnotations(page)).toHaveLength(1);
    await touchSequence(page, [
      { action: 'down', x: center.x, y: center.y },
      { action: 'wait', ms: 600 },
      { action: 'up' },
    ]);
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible({ timeout: 1_000 });
    await menu.getByRole('menuitem', { name: '削除' }).click();
    await expect(menu).toBeHidden({ timeout: 1_000 });
    await expect.poll(async () => (await readAnnotations(page)).length).toBe(0);
  });

  test('長押し → 「複製」を tap → annotation が 2 個になる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    const { center } = await addRectangleAndGetCenter(page);
    expect(await readAnnotations(page)).toHaveLength(1);
    await touchSequence(page, [
      { action: 'down', x: center.x, y: center.y },
      { action: 'wait', ms: 600 },
      { action: 'up' },
    ]);
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible({ timeout: 1_000 });
    await menu.getByRole('menuitem', { name: '複製' }).click();
    await expect(menu).toBeHidden({ timeout: 1_000 });
    await expect.poll(async () => (await readAnnotations(page)).length).toBe(2);
    // 2 個とも rectangle で同 size (offset のみ異なる) であること
    const arr = await readAnnotations(page);
    expect(arr[0]?.type).toBe('rectangle');
    expect(arr[1]?.type).toBe('rectangle');
  });

  test('長押し → 「前面」/「背面」で z-order (createdAt 流用) が変わる', async ({
    page,
  }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    // 2 個の矩形を追加 (異なる位置)
    await selectTool(page, '矩形');
    await dragOnStage(page, { x: 50, y: 50 }, { x: 130, y: 130 });
    await selectTool(page, '矩形');
    await dragOnStage(page, { x: 150, y: 50 }, { x: 230, y: 130 });
    const arrInitial = await readAnnotations(page);
    expect(arrInitial.length).toBeGreaterThanOrEqual(2);
    const firstId = arrInitial[0]?.id;
    const secondId = arrInitial[1]?.id;
    if (!firstId || !secondId) throw new Error('rectangle 2 つ追加失敗');
    await deselectAll(page);
    // 1 つ目の矩形 (= 配列 index 0、最も背面) を長押し → 「前面」
    const firstAnnotation = arrInitial[0] as AcceptanceAnnotation;
    const firstCenter = await shapeCenterViewport(page, firstAnnotation);
    await touchSequence(page, [
      { action: 'down', x: firstCenter.x, y: firstCenter.y },
      { action: 'wait', ms: 600 },
      { action: 'up' },
    ]);
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible({ timeout: 1_000 });
    await menu.getByRole('menuitem', { name: '前面' }).click();
    await expect(menu).toBeHidden({ timeout: 1_000 });
    // 「前面」適用後: createdAt 更新で arr 末尾に移動 → 1 つ目の id が末尾になる
    await expect
      .poll(async () => {
        const arr = await readAnnotations(page);
        return arr[arr.length - 1]?.id;
      })
      .toBe(firstId);
  });
});
