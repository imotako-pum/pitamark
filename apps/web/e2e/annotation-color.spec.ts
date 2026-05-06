import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// 色まわりの仕様確認 E2E:
// - swatch クリック 1 回 = active color 更新 + 選択中があれば適用
// - active color は全注釈タイプ共通 (レーン分離は撤廃済)
// - stage の空白部分クリックは全ツール共通で選択解除

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

const DEFAULT_SYNC_COLOR = '#e74c3c';
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

const clickStageAt = async (
  page: import('@playwright/test').Page,
  offset: { x: number; y: number },
) => {
  const stage = page.locator('.konvajs-content canvas').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('Konva canvas bounding box が取得できなかった');
  await page.mouse.click(box.x + offset.x, box.y + offset.y);
};

const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'chromium',
    'Color palette / stage hit-test は chromium 1 プロジェクトで検証する',
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

test.describe('annotation color — single active color (1-click pick)', () => {
  test('新規矩形のデフォルト色は赤(初期 activeColor)', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    await page.getByRole('button', { name: '矩形' }).click();
    await dragOnStage(page, { x: 80, y: 80 }, { x: 200, y: 200 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    const a = (await readAnnotations(page))[0] as { color: string };
    expect(a.color).toBe(DEFAULT_SYNC_COLOR);
  });

  test('色をクリック → 新規矩形がその色になる(選択無し時はアクティブカラー更新のみ)', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    // 何も選択していない状態で青を pick
    await page.getByRole('button', { name: `色: ${PICK_NON_DEFAULT_COLOR}` }).click();

    // 矩形を描く → 青で描かれる
    await page.getByRole('button', { name: '矩形' }).click();
    await dragOnStage(page, { x: 80, y: 80 }, { x: 200, y: 200 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    const a = (await readAnnotations(page))[0] as { color: string };
    expect(a.color).toBe(PICK_NON_DEFAULT_COLOR);
  });

  test('選択中の状態で色をクリックすると注釈に適用 + アクティブも同色になる', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    // 矩形 1 個描画 → 自動選択
    await page.getByRole('button', { name: '矩形' }).click();
    await dragOnStage(page, { x: 80, y: 80 }, { x: 200, y: 200 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    // 紫を pick → 既存矩形の色も紫になる
    await page.getByRole('button', { name: `色: ${APPLY_COLOR}` }).click();
    await expect
      .poll(async () => ((await readAnnotations(page))[0] as { color: string }).color)
      .toBe(APPLY_COLOR);

    // 選択を解除して新規矩形 → やはり紫(アクティブカラー継続)
    await clickStageAt(page, { x: 350, y: 50 });
    await dragOnStage(page, { x: 250, y: 250 }, { x: 350, y: 350 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(2);
    const next = (await readAnnotations(page))[1] as { color: string };
    expect(next.color).toBe(APPLY_COLOR);
  });

  test('アクティブカラーはハイライトにも適用される(レーン分離撤廃の確認)', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    // 青を pick(選択無しなので active のみ更新)
    await page.getByRole('button', { name: `色: ${PICK_NON_DEFAULT_COLOR}` }).click();

    // ハイライトを描く → 青で描かれる(以前は黄色独立だった)
    await page.getByRole('button', { name: 'ハイライト' }).click();
    await dragOnStage(page, { x: 60, y: 240 }, { x: 280, y: 280 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    const a = (await readAnnotations(page))[0] as { color: string; type: string };
    expect(a.type).toBe('highlight');
    expect(a.color).toBe(PICK_NON_DEFAULT_COLOR);
  });

  test('select tool で stage の空白クリックすると selectedId が null になる', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    // 矩形を 1 つ作って選択状態にする
    await page.getByRole('button', { name: '矩形' }).click();
    await dragOnStage(page, { x: 80, y: 80 }, { x: 200, y: 200 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    // 削除ボタンが enabled = 何か選択されている
    const deleteBtn = page.getByRole('button', { name: '削除', exact: true });
    await expect(deleteBtn).toBeEnabled();

    // V キー(select tool) + 空白クリック → 選択解除 → 削除ボタン disabled
    await page.keyboard.press('v');
    await clickStageAt(page, { x: 350, y: 350 });
    await expect(deleteBtn).toBeDisabled({ timeout: 2_000 });
  });

  test('描画ツール選択中でも stage の空白クリックで選択解除される(全ツール共通)', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    // 矩形を 1 つ作る → 自動選択
    await page.getByRole('button', { name: '矩形' }).click();
    await dragOnStage(page, { x: 80, y: 80 }, { x: 200, y: 200 });
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    const deleteBtn = page.getByRole('button', { name: '削除', exact: true });
    await expect(deleteBtn).toBeEnabled();

    // 矩形ツールのまま、stage の遠い空白部分をクリック(ドラッグなし)
    // → 選択解除されるが、新規矩形は生成されない(MIN_DRAG_PIXELS 未満)
    await clickStageAt(page, { x: 400, y: 400 });
    await expect(deleteBtn).toBeDisabled({ timeout: 2_000 });

    // 注釈数は変わらず 1 のまま(空クリックで矩形が増えていないこと)
    expect((await readAnnotations(page)).length).toBe(1);
  });
});
