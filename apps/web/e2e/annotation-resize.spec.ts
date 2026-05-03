import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// Phase 7.7-1 E2E: 矩形 / ハイライトの Konva.Transformer 8 ハンドルリサイズと、
// 矢印の from / to 端点 Circle ハンドルによる伸縮をロックする。reducer / Yjs
// mutation 経路は既に存在するため、ここでは UI から実際のドラッグで起動して
// store snapshot に反映されるかを検証する。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';
const TRANSFORM_KEY = '__SNAP_SHARE_STAGE_TRANSFORM__';

type AnnotationSnapshot = ReadonlyArray<Record<string, unknown>>;

const readAnnotations = async (page: import('@playwright/test').Page) =>
  page.evaluate(
    (k) =>
      ((window as unknown as Record<string, AnnotationSnapshot>)[k] ?? []) as AnnotationSnapshot,
    ANNOTATIONS_KEY,
  );

// Phase 7.7-3: getRelativePointerPosition / Stage transform 導入により、注釈の
// x/y は logical 座標になった。ドラッグハンドルを掴むには screen 座標に変換
// する必要がある。fit-to-viewport が走る画像ではこの変換無しに座標がズレる。
const logicalToScreen = async (
  page: import('@playwright/test').Page,
  logical: { x: number; y: number },
) => {
  const t = await page.evaluate(
    (k) => (window as unknown as Record<string, { scale: number; x: number; y: number }>)[k],
    TRANSFORM_KEY,
  );
  if (!t) throw new Error('__SNAP_SHARE_STAGE_TRANSFORM__ が window に未公開');
  return { x: logical.x * t.scale + t.x, y: logical.y * t.scale + t.y };
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
    // ハンドルを描く。右下角(画面座標)を引っ張るため logical→screen 変換が必須。
    const stage = await stageOrigin(page);
    const corner = await logicalToScreen(page, {
      x: before.x + before.width,
      y: before.y + before.height,
    });
    const target = await logicalToScreen(page, {
      x: before.x + before.width + 60,
      y: before.y + before.height + 40,
    });
    await page.mouse.move(stage.x + corner.x, stage.y + corner.y);
    await page.mouse.down();
    await page.mouse.move(stage.x + target.x, stage.y + target.y, { steps: 8 });
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
    const corner = await logicalToScreen(page, {
      x: before.x + before.width,
      y: before.y + before.height,
    });
    const target = await logicalToScreen(page, {
      x: before.x + before.width + 60,
      y: before.y + before.height + 30,
    });
    await page.mouse.move(stage.x + corner.x, stage.y + corner.y);
    await page.mouse.down();
    await page.mouse.move(stage.x + target.x, stage.y + target.y, { steps: 8 });
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
    // Phase 7.8-1 Auto-next-A: 矢印確定で空 text + IME 起動が走るため、まず Esc で
    // text を破棄。Auto-next の text 削除に伴い selectedId は null になる
    // (annotation/remove reducer が selectedId クリア) ので、矢印中点を click して
    // 再選択し to 端点ハンドルを表示させてから操作する。
    await page.keyboard.press('Escape');
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    const before = (await readAnnotations(page))[0] as {
      from: { x: number; y: number };
      to: { x: number; y: number };
    };

    const stage = await stageOrigin(page);
    const midScreen = await logicalToScreen(page, {
      x: (before.from.x + before.to.x) / 2,
      y: (before.from.y + before.to.y) / 2,
    });
    await page.mouse.click(stage.x + midScreen.x, stage.y + midScreen.y);

    // to 端点 (画面座標) を別位置にドラッグ。logical→screen 変換が必要。
    const fromScreen = await logicalToScreen(page, before.to);
    const toScreen = await logicalToScreen(page, {
      x: before.to.x + 80,
      y: before.to.y - 50,
    });
    await page.mouse.move(stage.x + fromScreen.x, stage.y + fromScreen.y);
    await page.mouse.down();
    await page.mouse.move(stage.x + toScreen.x, stage.y + toScreen.y, { steps: 8 });
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
