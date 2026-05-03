import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

const PASSWORD = 'e2e-uploader-skip-XYZ';

// Phase 7.6 既知-5: protected room を作成した uploader は自分で password を
// 入力したのに、URL 遷移後に RoomGate で再度入力させられていた。
// 修正は POST /rooms の応答に access token を含めて、useImageSource が
// sessionStorage に保存してから URL push する形。本 spec は uploader 経路
// 単独で「ゲートを見ずにエディタに直接到達する」ことを CI でロックする。
// 受信者経路 (URL 共有された別 browser) は room-protected.spec.ts が担当。
test.describe('uploader gate skip for protected rooms', () => {
  test('password 入力 + D&D した本人は RoomGate を経由せずエディタに到達する', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'uploader 経路の RoomGate skip 検証は chromium 1 プロジェクトで実施',
    );

    await page.goto('/');

    const protectCheckbox = page.getByRole('checkbox', { name: /パスワードで保護する/ });
    await protectCheckbox.click();
    await page.getByLabel('ルームのパスワード').fill(PASSWORD);

    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });

    // 直接エディタに入れる = ツールバーが visible / RoomGate 見出しは出ない
    await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole('heading', { name: 'このルームはパスワードで保護されています' }),
    ).toBeHidden();

    // 描画ツールが enabled になっており、画像が読み込まれている (= 受信者用 fetch
    // ではなく自分で D&D した ObjectURL がそのまま表示されている) ことを確認。
    await expect(page.getByRole('button', { name: '矩形' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'PNG 保存' })).toBeEnabled();

    // sessionStorage に token が保存されていることを直接確認 (回帰検出の保険)。
    // キー名は apps/web/src/lib/auth-storage.ts の `roomToken:<id>` 形式に依存。
    const url = new URL(page.url());
    const roomId = url.pathname.split('/').pop();
    expect(roomId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    const token = await page.evaluate(
      (id) => window.sessionStorage.getItem(`roomToken:${id}`),
      roomId,
    );
    expect(typeof token).toBe('string');
    expect(token?.split('.').length).toBe(3); // JWT 3 segments
  });
});
