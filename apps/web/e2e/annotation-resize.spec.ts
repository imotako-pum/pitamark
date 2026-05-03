import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// Phase 7.7-1 E2E: 矩形 / ハイライトの Konva.Transformer 8 ハンドルリサイズと、
// 矢印の from / to 端点 Circle ハンドルによる伸縮をロックする。reducer / Yjs
// mutation 経路は既に存在するため、ここでは UI から実際のドラッグで起動して
// store snapshot に反映されるかを検証する。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

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

const stageOrigin = async (page: import('@playwright/test').Page) => {
  const stage = page.locator('.konvajs-content canvas').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('Konva canvas bounding box が取得できなかった');
  return { x: box.x, y: box.y };
};

const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'chromium',
    'Konva Transformer / Circle handle のヒット検出は chromium 1 プロジェクトで検証する',
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

test.describe('annotation resize — Transformer (rect / highlight) と Arrow endpoint', () => {
  test('矩形を Transformer の右下ハンドルで拡大できる', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    await page.getByRole('button', { name: '矩形' }).click();
    await dragOnStage(page, { x: 80, y: 80 }, { x: 200, y: 200 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    const before = (await readAnnotations(page))[0] as {
      x: number;
      y: number;
      width: number;
      height: number;
    };

    // 矩形作成直後は selectedId が当該注釈になっており Transformer がアタッチ
    // 済み。Konva の Transformer は Shape の bounding box の各角・辺中央に
    // ハンドルを描く。右下角(画面座標)を 50,50 px 引っ張る。
    const stage = await stageOrigin(page);
    const cornerStageX = before.x + before.width;
    const cornerStageY = before.y + before.height;
    const targetStageX = cornerStageX + 60;
    const targetStageY = cornerStageY + 40;
    await page.mouse.move(stage.x + cornerStageX, stage.y + cornerStageY);
    await page.mouse.down();
    await page.mouse.move(stage.x + targetStageX, stage.y + targetStageY, { steps: 8 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const a = (await readAnnotations(page))[0] as { width: number; height: number };
        return a.width > before.width && a.height > before.height;
      })
      .toBe(true);
  });

  test('ハイライトを Transformer の右下ハンドルで拡大できる', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    await page.getByRole('button', { name: 'ハイライト' }).click();
    await dragOnStage(page, { x: 60, y: 240 }, { x: 280, y: 280 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    const before = (await readAnnotations(page))[0] as {
      x: number;
      y: number;
      width: number;
      height: number;
    };

    const stage = await stageOrigin(page);
    const cornerStageX = before.x + before.width;
    const cornerStageY = before.y + before.height;
    await page.mouse.move(stage.x + cornerStageX, stage.y + cornerStageY);
    await page.mouse.down();
    await page.mouse.move(stage.x + cornerStageX + 60, stage.y + cornerStageY + 30, {
      steps: 8,
    });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const a = (await readAnnotations(page))[0] as { width: number; height: number };
        return a.width > before.width && a.height > before.height;
      })
      .toBe(true);
  });

  test('矢印の to 端点ハンドルで終端を移動できる', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    await page.getByRole('button', { name: '矢印' }).click();
    await dragOnStage(page, { x: 100, y: 100 }, { x: 240, y: 240 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    const before = (await readAnnotations(page))[0] as {
      from: { x: number; y: number };
      to: { x: number; y: number };
    };

    // to 端点(画面座標で from の位置からドラッグした到達点)を別位置にドラッグ
    const stage = await stageOrigin(page);
    await page.mouse.move(stage.x + before.to.x, stage.y + before.to.y);
    await page.mouse.down();
    await page.mouse.move(stage.x + before.to.x + 80, stage.y + before.to.y - 50, {
      steps: 8,
    });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const a = (await readAnnotations(page))[0] as {
          from: { x: number; y: number };
          to: { x: number; y: number };
        };
        // from は変わらず、to だけが変わっている
        return (
          a.from.x === before.from.x &&
          a.from.y === before.from.y &&
          a.to.x !== before.to.x &&
          a.to.y !== before.to.y
        );
      })
      .toBe(true);
  });
});
