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
    await expect(page.getByRole('button', { name: '画像をクリア' })).toBeEnabled();
  });
});
