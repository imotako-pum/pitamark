import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// Phase 10.I-3: Toolbar bottom 固定の smoke。mobile-chrome (Pixel 5 emulation) で
// Toolbar が viewport 下半分に存在し、その状態で「矩形」ツールを tap → canvas drag で
// annotation が 1 件追加できることを確認する。本格的な「4 形状 × 3 操作 = 12 ケース」の
// 受入は Phase 10.I-4 で別途追加。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

test.describe('Phase 10.I-3: toolbar bottom-fixed smoke', () => {
  test('mobile-chrome で Toolbar が画面下半分に位置し、ボタン tap → 矩形が描ける', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'toolbar bottom smoke は mobile-chrome project のみ実行する',
    );

    await page.goto('/');
    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
    await page.waitForFunction(
      (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
      ANNOTATIONS_KEY,
      { timeout: 10_000 },
    );

    // Toolbar の boundingBox を取得し、viewport 下半分に位置することを確認。
    const toolbar = page.getByRole('toolbar', { name: '編集ツール' });
    const tbBox = await toolbar.boundingBox();
    if (!tbBox) throw new Error('Toolbar bounding box が取得できなかった');
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('viewport size が取得できなかった');
    expect(tbBox.y).toBeGreaterThan(viewport.height / 2);

    // 矩形ツールを tap して矩形を描画。mobile-chrome は hasTouch:true のため tap が使える。
    await page.getByRole('button', { name: '矩形' }).tap();

    const stage = page.locator('.konvajs-content canvas').first();
    const stBox = await stage.boundingBox();
    if (!stBox) throw new Error('Konva canvas bounding box が取得できなかった');

    await page.mouse.move(stBox.x + 60, stBox.y + 60);
    await page.mouse.down();
    await page.mouse.move(stBox.x + 160, stBox.y + 160, { steps: 5 });
    await page.mouse.up();

    await expect
      .poll(
        async () =>
          page.evaluate(
            (k) =>
              ((window as unknown as Record<string, ReadonlyArray<unknown>>)[k]?.length ??
                0) as number,
            ANNOTATIONS_KEY,
          ),
        { timeout: 5_000 },
      )
      .toBe(1);
  });
});
