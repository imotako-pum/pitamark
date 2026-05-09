import { expect, test } from '@playwright/test';
import { setupEditorViaApi } from './fixtures/editor-fixture';
import { buildSolidPng } from './fixtures/upload';

// Auto-next-B 直対応の E2E。矩形 mouseup 直後に既定矢印プレビューが立ち、Enter で
// 確定 → Auto-next-A に連鎖して text 編集が起動する。BS / Esc / 別ツールキー / マウス
// mousedown のいずれでもキャンセルでき、Cmd+Z 連打で text → 矢印 → 矩形 の 3 段巻き
// 戻しになる。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';
const TOOL_KEY = '__SNAP_SHARE_TOOL__';
const PENDING_KEY = '__SNAP_SHARE_PENDING_AUTO_ARROW__';

const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'chromium',
    'Auto-next-B E2E は chromium 1 プロジェクトで検証する',
  );

const SAMPLE = buildSolidPng(800, 600);

const setupRoomWithImage = async (page: import('@playwright/test').Page) => {
  await setupEditorViaApi(page, { buffer: SAMPLE, fileName: 'auto-next-rect.png' });
  await page.waitForFunction(
    (k) => typeof (window as unknown as Record<string, unknown>)[k] === 'string',
    TOOL_KEY,
    { timeout: 5_000 },
  );
  const stage = page.locator('.konvajs-content canvas').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('canvas bounding box が取得できなかった');
  return box;
};

const dragRectangle = async (
  page: import('@playwright/test').Page,
  box: { x: number; y: number },
  fromOffset: { x: number; y: number },
  toOffset: { x: number; y: number },
) => {
  await page.keyboard.press('r');
  await page.mouse.move(box.x + fromOffset.x, box.y + fromOffset.y);
  await page.mouse.down();
  await page.mouse.move(box.x + toOffset.x, box.y + toOffset.y, { steps: 5 });
  await page.mouse.up();
};

const annotationCount = async (page: import('@playwright/test').Page) =>
  page.evaluate(
    (k) =>
      ((window as unknown as Record<string, unknown>)[k] as ReadonlyArray<unknown> | undefined)
        ?.length ?? 0,
    ANNOTATIONS_KEY,
  );

const currentTool = async (page: import('@playwright/test').Page) =>
  page.evaluate(
    (k) => ((window as unknown as Record<string, unknown>)[k] as string | undefined) ?? null,
    TOOL_KEY,
  );

const pendingPreview = async (page: import('@playwright/test').Page) =>
  page.evaluate((k) => (window as unknown as Record<string, unknown>)[k], PENDING_KEY);

test('矩形確定 → pending 矢印プレビュー立つ + tool=rectangle のまま', async ({
  page,
}, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);
  await dragRectangle(page, box, { x: 80, y: 80 }, { x: 200, y: 180 });

  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(1);
  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).not.toBeNull();
  expect(await currentTool(page)).toBe('rectangle');
});

test('Enter → 矢印 + 空 text 即時編集 + tool=text', async ({ page }, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);
  await dragRectangle(page, box, { x: 80, y: 80 }, { x: 200, y: 180 });
  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).not.toBeNull();

  await page.keyboard.press('Enter');

  // 矩形 + 矢印 + 空 text = 3 件、textarea visible、tool=text
  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(3);
  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).toBeNull();
  await expect(page.getByRole('textbox', { name: '注釈テキストを編集' })).toBeVisible({
    timeout: 5_000,
  });
  expect(await currentTool(page)).toBe('text');
});

test('Enter → text "OK" 確定 → tool=select', async ({ page }, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);
  await dragRectangle(page, box, { x: 80, y: 80 }, { x: 200, y: 180 });
  await page.keyboard.press('Enter');

  const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  await textarea.type('OK');
  await textarea.press('Enter');

  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(3);
  await expect.poll(() => currentTool(page), { timeout: 5_000 }).toBe('select');
});

test('BS で pending キャンセル → 矩形は残る + tool=rectangle のまま', async ({
  page,
}, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);
  await dragRectangle(page, box, { x: 80, y: 80 }, { x: 200, y: 180 });
  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).not.toBeNull();

  await page.keyboard.press('Backspace');

  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).toBeNull();
  expect(await annotationCount(page)).toBe(1);
  expect(await currentTool(page)).toBe('rectangle');
});

test('Esc で pending キャンセル → 矩形は残る + tool=rectangle のまま', async ({
  page,
}, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);
  await dragRectangle(page, box, { x: 80, y: 80 }, { x: 200, y: 180 });
  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).not.toBeNull();

  await page.keyboard.press('Escape');

  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).toBeNull();
  expect(await annotationCount(page)).toBe(1);
  expect(await currentTool(page)).toBe('rectangle');
});

test('別ツールキー V で pending キャンセル + tool=select', async ({ page }, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);
  await dragRectangle(page, box, { x: 80, y: 80 }, { x: 200, y: 180 });
  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).not.toBeNull();

  await page.keyboard.press('v');

  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).toBeNull();
  await expect.poll(() => currentTool(page), { timeout: 5_000 }).toBe('select');
  expect(await annotationCount(page)).toBe(1);
});

test('mousedown (任意座標) で pending キャンセル + 矩形は残る', async ({ page }, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);
  await dragRectangle(page, box, { x: 80, y: 80 }, { x: 200, y: 180 });
  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).not.toBeNull();

  // 矩形と離れた位置 (右下の空白) を click。tool=rectangle のままだと新たな矩形 drag が
  // 始まる可能性があるため V キーで select に切替えてから click... ではなく、
  // pending クリア後の click は通常の tool=rectangle 経路に入るが、drag では
  // ない単発 click なので新矩形は生まれない (MIN_DRAG_PIXELS=4 未満)。
  await page.mouse.click(box.x + 500, box.y + 500);

  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).toBeNull();
  expect(await annotationCount(page)).toBe(1);
});

test('Cmd+Z 連打で text → 矢印 → 矩形 の 3 段巻き戻し', async ({ page }, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);
  await dragRectangle(page, box, { x: 80, y: 80 }, { x: 200, y: 180 });
  await page.keyboard.press('Enter');

  const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  await textarea.type('OK');
  await textarea.press('Enter');

  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(3);
  await expect.poll(() => currentTool(page), { timeout: 5_000 }).toBe('select');

  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(2); // text 消失

  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(1); // 矢印消失

  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(0); // 矩形消失
});

test('連続 Auto-next-B: 矩形 → Enter → 別矩形でも pending 立つ', async ({ page }, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);

  // 1 サイクル目
  await dragRectangle(page, box, { x: 80, y: 80 }, { x: 200, y: 180 });
  await page.keyboard.press('Enter');
  const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  await textarea.press('Enter'); // 0 文字 Enter で text 自動削除、tool=select

  // 1 サイクル後の状態確認: 矩形 + 矢印 = 2 件
  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(2);

  // 2 サイクル目: 別矩形を描く → pending が再度立つ
  await dragRectangle(page, box, { x: 300, y: 250 }, { x: 450, y: 380 });
  await expect.poll(() => pendingPreview(page), { timeout: 5_000 }).not.toBeNull();
  expect(await annotationCount(page)).toBe(3);
});
