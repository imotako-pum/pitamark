import { expect, test } from '@playwright/test';
import { buildSolidPng, dropImageBuffer } from './fixtures/upload';

// 「マウス無し golden path」success metric 直対応の E2E。
//
// 注釈の drag にマウスは必須なので「マウス 0 回」は実現不可能だが、metric の本意は
// 「ツール選択 / 色変更 / undo / 出力 をツールバーに戻らずに完遂できる」こと。
// 本 spec はツール切替 (V/R/A/T/H) / 色巡回 (C) / 出力 (⌘S) をすべてキーボードで
// 実行し、ツールバーボタンへの click 0 回で 4 種注釈配置 → PNG 保存まで通せること
// を担保する。

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
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 20_000 });
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

  // header の py / Logo / Toolbar 高さが visual 系の変更でしばしば動くため、座標は
  // 絶対 px ではなく box の比率で持つ。viewport 720 - header ~100 で組まれていた
  // 旧 absolute 座標 (100/250/400/500/540 など) を box.width / box.height に対する
  // % に置き換えただけで、形状ごとの相対配置 (rect 左上 / arrow 中央 / text 中央右 /
  // highlight 右下) は元のまま。
  const at = (fx: number, fy: number) => ({
    x: box.x + box.width * fx,
    y: box.y + box.height * fy,
  });

  // R: rectangle (左上)
  await page.keyboard.press('r');
  const rectFrom = at(0.1, 0.16);
  const rectTo = at(0.21, 0.3);
  await page.mouse.move(rectFrom.x, rectFrom.y);
  await page.mouse.down();
  await page.mouse.move(rectTo.x, rectTo.y, { steps: 5 });
  await page.mouse.up();

  // C で色を 1 つ進める (active 更新 + 選択中の rectangle にも適用される)。
  await page.keyboard.press('c');

  // A: arrow (中央)
  await page.keyboard.press('a');
  const arrowFrom = at(0.26, 0.4);
  const arrowTo = at(0.36, 0.5);
  await page.mouse.move(arrowFrom.x, arrowFrom.y);
  await page.mouse.down();
  await page.mouse.move(arrowTo.x, arrowTo.y, { steps: 5 });
  await page.mouse.up();
  // 矢印確定で Auto-next-A の空 text + IME 起動が走るため、Esc で text を破棄して
  // 矢印のみ残す。本 spec の主旨は 4 種注釈が独立に作れること + ⌘S 出力で、
  // Auto-next 連鎖は別 spec (auto-next-arrow-text.spec.ts) でカバー済。
  await page.keyboard.press('Escape');

  // T: text (中央右、1 文字打って Enter で commit)
  await page.keyboard.press('t');
  const textPoint = at(0.42, 0.62);
  await page.mouse.click(textPoint.x, textPoint.y);
  const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  await textarea.type('OK');
  await textarea.press('Enter');

  // H: highlight (右下、box の 80% 以内に収めて header 高さ変動でも viewport 内に残す)
  await page.keyboard.press('h');
  const hlFrom = at(0.52, 0.7);
  const hlTo = at(0.62, 0.82);
  await page.mouse.move(hlFrom.x, hlFrom.y);
  await page.mouse.down();
  await page.mouse.move(hlTo.x, hlTo.y, { steps: 5 });
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
  expect(download.suggestedFilename()).toMatch(/^pitamark-[A-Za-z0-9_-]{21}-\d{8}-\d{6}\.png$/);
});
