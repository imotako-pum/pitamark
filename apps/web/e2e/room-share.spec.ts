import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

test.describe('room sync across contexts', () => {
  test('2 ブラウザコンテキスト間で矩形作成が同期される', async ({ browser }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Yjs 同期は chromium 1 プロジェクトでのみ検証する',
    );

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      await page1.goto('/');
      await dropImage(page1);
      await expect(page1).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 20_000 });
      const sharedUrl = page1.url();

      await page2.goto(sharedUrl);

      // page2 でも RoomEditor が立ち上がるまで待つ。useYjsAnnotationsStore が
      // 初期化されると window.__SNAP_SHARE_ANNOTATIONS__ が string[] (=Annotation[])
      // に解決される。配列が出現したら yjs ストアが ready。
      await page2.waitForFunction(
        () =>
          Array.isArray(
            (window as unknown as { __SNAP_SHARE_ANNOTATIONS__?: unknown[] })
              .__SNAP_SHARE_ANNOTATIONS__,
          ),
        null,
        { timeout: 10_000 },
      );

      // page1 で矩形を 1 つ作成: 矩形ツールを選び stage 上で mousedown→mousemove→mouseup
      await page1.getByRole('button', { name: '矩形' }).click();
      // CanvasStage の Konva canvas は stage コンテナ内に複数生成される。
      // first() で十分（hit detection は最上位 layer に流れる設計）。
      const stage1 = page1.locator('.konvajs-content canvas').first();
      const box = await stage1.boundingBox();
      if (!box) throw new Error('Konva canvas bounding box が取得できなかった');

      const startX = box.x + 80;
      const startY = box.y + 80;
      const endX = box.x + 200;
      const endY = box.y + 200;

      await page1.mouse.move(startX, startY);
      await page1.mouse.down();
      await page1.mouse.move(endX, endY, { steps: 5 });
      await page1.mouse.up();

      // page2 に矩形が伝播するのを window 露出した annotations 配列で確認
      await page2.waitForFunction(
        () => {
          const arr = (window as unknown as { __SNAP_SHARE_ANNOTATIONS__?: unknown[] })
            .__SNAP_SHARE_ANNOTATIONS__;
          return Array.isArray(arr) && arr.length >= 1;
        },
        null,
        { timeout: 5_000 },
      );

      const count = await page2.evaluate(
        () =>
          (
            window as unknown as {
              __SNAP_SHARE_ANNOTATIONS__?: ReadonlyArray<unknown>;
            }
          ).__SNAP_SHARE_ANNOTATIONS__?.length ?? 0,
      );
      expect(count).toBeGreaterThanOrEqual(1);
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
