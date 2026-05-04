import { expect, test } from '@playwright/test';
import { buildSolidPng, dropImageBuffer } from './fixtures/upload';

// Phase 7.7-4 success metric「マウス無し golden path」直対応の E2E。
//
// 完全に「マウス 0 回」は注釈の drag に必要なため不可能だが、metric の本意は
// 「ツール選択 / 色変更 / undo / 出力 をツールバーに戻らずに完遂できる」点。
// 本 spec は ツール切替 (V/R/A/T/H) / 色巡回 (C) / 出力 (⌘S) をすべて
// キーボードで実行し、ツールバーボタンへの click 0 回で 4 種注釈配置から PNG
// 保存までを通せることを担保する。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';
const TRANSFORM_ACTIONS_KEY = '__SNAP_SHARE_TRANSFORM_ACTIONS__';

type Stored = ReadonlyArray<{ type: string; color: string }>;

const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'chromium',
    'golden path は chromium 1 プロジェクトで検証する',
  );

// 800×600 = viewport (Playwright Desktop Chrome 1280×720) に近いサイズ。
// fit はかかるが極端な縮小ではなく、注釈の hit-test も読みやすい。
const SAMPLE = buildSolidPng(800, 600);

test('キーボードのみで 4 種注釈配置 → 色変更 → PNG 出力まで完遂できる', async ({
  page,
}, testInfo) => {
  skipNonChromium(testInfo);

  await page.goto('/');
  await dropImageBuffer(page, SAMPLE, 'golden.png');
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
  await page.waitForFunction(
    (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
    ANNOTATIONS_KEY,
    { timeout: 10_000 },
  );
  await page.waitForFunction(
    (k) => typeof (window as unknown as Record<string, unknown>)[k] === 'object',
    TRANSFORM_ACTIONS_KEY,
    { timeout: 5_000 },
  );

  const stage = page.locator('.konvajs-content canvas').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('canvas bounding box が取得できなかった');

  // R: rectangle
  await page.keyboard.press('r');
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 180, { steps: 5 });
  await page.mouse.up();

  // C で色を 1 つ進める (active 更新 + 選択中の rectangle にも適用される)。
  await page.keyboard.press('c');

  // A: arrow
  await page.keyboard.press('a');
  await page.mouse.move(box.x + 250, box.y + 250);
  await page.mouse.down();
  await page.mouse.move(box.x + 350, box.y + 300, { steps: 5 });
  await page.mouse.up();
  // Phase 7.8-1 Auto-next-A: 矢印確定で空 text + IME 起動が走るため、Esc で text を
  // 破棄して矢印のみ残す。本 spec の主旨は 4 種注釈が独立に作れること + ⌘S 出力で、
  // Auto-next 連鎖は別 spec (auto-next-arrow-text.spec.ts) でカバー済。
  await page.keyboard.press('Escape');

  // T: text (1 文字打って Enter で commit)
  await page.keyboard.press('t');
  await page.mouse.click(box.x + 400, box.y + 400);
  const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  await textarea.type('OK');
  await textarea.press('Enter');

  // H: highlight
  await page.keyboard.press('h');
  await page.mouse.move(box.x + 500, box.y + 500);
  await page.mouse.down();
  await page.mouse.move(box.x + 580, box.y + 540, { steps: 5 });
  await page.mouse.up();

  // 注釈が 4 つ追加されたことを確認 (rect + arrow + text + highlight)。
  await expect
    .poll(
      async () =>
        page.evaluate(
          (k) => (window as unknown as Record<string, Stored>)[k]?.length ?? 0,
          ANNOTATIONS_KEY,
        ),
      { timeout: 5_000 },
    )
    .toBe(4);

  // ⌘S で PNG エクスポートが発火する (キーボードで download トリガ)。
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await page.keyboard.press(`${modifier}+s`);
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^snap-share-[A-Za-z0-9_-]{21}-\d{8}-\d{6}\.png$/);
});
