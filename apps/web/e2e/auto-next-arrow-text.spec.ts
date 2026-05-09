import { expect, test } from '@playwright/test';
import { buildSolidPng, dropImageBuffer } from './fixtures/upload';

// Auto-next-A 直対応の E2E。矢印 mouseup 直後に空 text + IME 即時起動が走り、
// commit / cancel いずれの経路でも tool='select' に復帰すること、Cmd+Z で
// text → 矢印 の順に独立巻き戻せること、通常の text ツールは Auto-next の影響を
// 受けないことを担保する。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';
const TOOL_KEY = '__SNAP_SHARE_TOOL__';

const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'chromium',
    'Auto-next E2E は chromium 1 プロジェクトで検証する',
  );

const SAMPLE = buildSolidPng(800, 600);

const setupRoomWithImage = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await dropImageBuffer(page, SAMPLE, 'auto-next.png');
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 20_000 });
  await page.waitForFunction(
    (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
    ANNOTATIONS_KEY,
    { timeout: 10_000 },
  );
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

const dragArrow = async (
  page: import('@playwright/test').Page,
  box: { x: number; y: number },
  fromOffset: { x: number; y: number },
  toOffset: { x: number; y: number },
) => {
  await page.keyboard.press('a');
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

test('矢印確定 → Auto-next で空 text + IME 起動 → 文字確定で tool=select', async ({
  page,
}, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);

  await dragArrow(page, box, { x: 100, y: 100 }, { x: 250, y: 200 });

  // 矢印 + 空 text の 2 件が即時に追加される
  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(2);

  // textarea が visible (Auto-next 経路で IME 起動済み)
  const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
  await expect(textarea).toBeVisible({ timeout: 5_000 });

  // tool は text に切り替わっている
  expect(await currentTool(page)).toBe('text');

  // 1 文字以上で Enter → 確定 + tool=select 復帰
  await textarea.type('OK');
  await textarea.press('Enter');

  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(2);
  await expect.poll(() => currentTool(page), { timeout: 5_000 }).toBe('select');
});

test('矢印確定 → 0 文字 Enter で text 自動削除 + 矢印は残る + tool=select', async ({
  page,
}, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);

  await dragArrow(page, box, { x: 100, y: 100 }, { x: 250, y: 200 });
  const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
  await expect(textarea).toBeVisible({ timeout: 5_000 });

  // 何も打鍵せず Enter
  await textarea.press('Enter');

  // text は削除されて annotation は矢印のみ、tool は select
  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(1);
  await expect.poll(() => currentTool(page), { timeout: 5_000 }).toBe('select');
});

test('矢印確定 → 編集中 Esc で text 中断 + 矢印は残る + tool=select', async ({
  page,
}, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);

  await dragArrow(page, box, { x: 100, y: 100 }, { x: 250, y: 200 });
  const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
  await expect(textarea).toBeVisible({ timeout: 5_000 });

  // 何も打鍵せず Escape
  await textarea.press('Escape');

  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(1);
  await expect.poll(() => currentTool(page), { timeout: 5_000 }).toBe('select');
});

test('Auto-next 確定後 Cmd+Z 連打で text → 矢印 の順に独立巻き戻し', async ({ page }, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);

  await dragArrow(page, box, { x: 100, y: 100 }, { x: 250, y: 200 });
  const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  await textarea.type('OK');
  await textarea.press('Enter');
  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(2);

  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(1);

  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(0);
});

test('通常の T ツールは Auto-next の select 復帰の影響を受けない (回帰)', async ({
  page,
}, testInfo) => {
  skipNonChromium(testInfo);
  const box = await setupRoomWithImage(page);

  // T → click → 通常の text 作成経路
  await page.keyboard.press('t');
  await page.mouse.click(box.x + 200, box.y + 200);
  const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  await textarea.type('Hi');
  await textarea.press('Enter');

  await expect.poll(() => annotationCount(page), { timeout: 5_000 }).toBe(1);
  // 通常 T ツール経路では tool='text' のまま (連続 text 作成モード継続)
  await expect.poll(() => currentTool(page), { timeout: 5_000 }).toBe('text');
});
