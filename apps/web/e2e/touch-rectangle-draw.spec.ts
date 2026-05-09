import { expect, test } from '@playwright/test';
import { ANNOTATIONS_KEY } from './fixtures/touch-helpers';
import { dropImage } from './fixtures/upload';

// Phase 10.I-1: Pointer Events 一本化 + 描画系復旧の smoke。本 spec は mobile-chrome
// (Pixel 5 emulation) project でのみ実行し、Stage が onPointerDown 経路を介して矩形を
// 1 件描画できることを確認する。本格的な「4 形状 × 3 操作 = 12 ケース」の受入 spec は
// Phase 10.I-4 で別途追加する。
//
// 実装メモ: mobile-chrome project は hasTouch: true / isMobile: true の Pixel 5 device。
// Chromium は実機相当に native input を pointer event に正規化するため、page.mouse で
// 操作しても Konva 側の onPointerDown は発火する (Pointer Events 一本化の検証としては
// この経路で十分)。touch-only 固有のジェスチャ (multi-touch / palm rejection) は
// 10.I-2 / 10.I-4 で個別検証。

const readAnnotationCount = (page: import('@playwright/test').Page): Promise<number> =>
  page.evaluate(
    (k) =>
      ((window as unknown as Record<string, ReadonlyArray<unknown>>)[k]?.length ?? 0) as number,
    ANNOTATIONS_KEY,
  );

test.describe('Phase 10.I-1: pointer events smoke', () => {
  test('mobile-chrome で矩形ツールを選んで drag で 1 件 annotation を追加できる', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'pointer events smoke は mobile-chrome project のみ実行する',
    );

    await page.goto('/');
    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, {
      timeout: 10_000,
    });
    await page.waitForFunction(
      (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
      ANNOTATIONS_KEY,
      { timeout: 10_000 },
    );

    await page.getByRole('button', { name: '矩形' }).click();

    const stage = page.locator('.konvajs-content canvas').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('Konva canvas bounding box が取得できなかった');

    // page.mouse 経由でも Pixel 5 emulation 配下では native input が pointer event に
    // 変換されて Stage の onPointerDown に到達する。本 smoke では実機の touch ジェスチャ
    // 完全再現ではなく「Pointer Events 化により描画経路が破綻していない」ことを確認する。
    await page.mouse.move(box.x + 60, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 160, { steps: 5 });
    await page.mouse.up();

    await expect.poll(() => readAnnotationCount(page), { timeout: 5_000 }).toBe(1);
  });
});
