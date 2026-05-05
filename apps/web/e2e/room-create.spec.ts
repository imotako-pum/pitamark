import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

test.describe('room creation flow', () => {
  test('画像ドロップでルームが作成され /r/:id に遷移し、エクスポートが有効化する', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Yjs 経由のルーム生成は chromium 1 プロジェクトで十分（モバイルは別 spec で screenshot 回帰）',
    );

    await page.goto('/');
    await dropImage(page);

    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });

    // 画像ロード後はツールバーのツールが enabled になる
    await expect(page.getByRole('button', { name: '矩形' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'PNG 保存' })).toBeEnabled();
    await expect(page.getByRole('button', { name: '注釈をすべて削除' })).toBeEnabled();
  });

  test('送信側で PNG 保存が成功し download が発火する (cross-origin 経路の sender 側)', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'cross-origin canvas 経路は chromium 1 プロジェクトで検証する',
    );

    // Phase 7.6 既知-1 補完: sender 側もルーム作成後は RoomEditor が
    // mount し直し、画像を API 経由で再フェッチする (= cross-origin)。
    // 受信側 spec (room-export-receiver.spec.ts) と対をなす形で、送信側
    // 経路の tainted canvas 回帰も CI でロックする。
    await page.goto('/');
    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });

    // RoomEditor が ready になり、Konva の <KonvaImage> が描画されるまで待つ
    await page.waitForFunction(
      () =>
        Array.isArray(
          (window as unknown as { __SNAP_SHARE_ANNOTATIONS__?: unknown[] })
            .__SNAP_SHARE_ANNOTATIONS__,
        ),
      null,
      { timeout: 10_000 },
    );
    await expect(page.locator('.konvajs-content canvas').first()).toBeVisible({
      timeout: 10_000,
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await page.getByRole('button', { name: 'PNG 保存' }).click();
    const download = await downloadPromise;

    await expect(page.getByText('PNG を保存しました')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('PNG の保存に失敗しました')).toBeHidden();
    expect(download.suggestedFilename()).toMatch(/^pitamark-[A-Za-z0-9_-]{21}-\d{8}-\d{6}\.png$/);
  });
});
