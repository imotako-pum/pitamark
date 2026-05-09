import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// Toolbar の「画像をクリア」は実装上は注釈削除だけで、画像は API 側で保持され続ける。
// ラベルを実挙動に合わせて「注釈をすべて削除」に揃え、ダイアログタイトルも
// 「注釈をすべて削除しますか？」と整合させてある。
test.describe('room clear-annotations flow', () => {
  test('「注釈をすべて削除」ボタンで注釈は消えるが画像は残る', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      '注釈削除フローは chromium 1 プロジェクトで検証する',
    );

    await page.goto('/');
    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 20_000 });

    // RoomEditor が ready になり __SNAP_SHARE_ANNOTATIONS__ が出現するまで待つ
    await page.waitForFunction(
      () =>
        Array.isArray(
          (window as unknown as { __SNAP_SHARE_ANNOTATIONS__?: unknown[] })
            .__SNAP_SHARE_ANNOTATIONS__,
        ),
      null,
      { timeout: 10_000 },
    );

    // 矩形を 1 つ追加
    await page.getByRole('button', { name: '矩形' }).click();
    const stage = page.locator('.konvajs-content canvas').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('Konva canvas bounding box が取得できなかった');
    await page.mouse.move(box.x + 80, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });
    await page.mouse.up();

    await page.waitForFunction(
      () => {
        const arr = (window as unknown as { __SNAP_SHARE_ANNOTATIONS__?: unknown[] })
          .__SNAP_SHARE_ANNOTATIONS__;
        return Array.isArray(arr) && arr.length >= 1;
      },
      null,
      { timeout: 5_000 },
    );

    // ボタン名は新ラベル「注釈をすべて削除」で取得 — 旧ラベル「画像をクリア」では fail する
    await page.getByRole('button', { name: '注釈をすべて削除' }).click();

    // 確認ダイアログ → 削除する
    await expect(
      page.getByRole('heading', { name: 'ルーム内の注釈をすべて削除しますか？' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '削除する' }).click();

    // 注釈は 0 件になる
    await page.waitForFunction(
      () => {
        const arr = (window as unknown as { __SNAP_SHARE_ANNOTATIONS__?: unknown[] })
          .__SNAP_SHARE_ANNOTATIONS__;
        return Array.isArray(arr) && arr.length === 0;
      },
      null,
      { timeout: 5_000 },
    );

    // 画像は残っている = ツールバーの描画ツールが enabled のまま
    await expect(page.getByRole('button', { name: '矩形' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'PNG 保存' })).toBeEnabled();
    // URL もルームのまま (ランディングに戻っていない)
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/);
  });
});
