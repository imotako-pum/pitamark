import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

const PASSWORD = 'e2e-test-password-XYZ';

test.describe('password-protected rooms', () => {
  test('誤答 → エラートースト、正答 → エディタ入室', async ({ browser }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'パスワード経路は chromium 1 プロジェクトで検証',
    );

    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.goto('/');

    // Phase 7.6 既知-2 fix 後: panel を Toolbar 直下 (top-16) に逃がした
    // ことで pointer-events が通るようになったため、Phase 7.5 の keyboard
    // 迂回をやめて直接 click に戻す。直接 click 経路は別 spec
    // (landing-password-toggle.spec.ts) で個別に actionability を担保している。
    const protectCheckbox = page1.getByRole('checkbox', { name: /パスワードで保護する/ });
    await protectCheckbox.click();
    await page1.getByLabel('ルームのパスワード').fill(PASSWORD);
    await dropImage(page1);
    await expect(page1).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
    const sharedUrl = page1.url();

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    try {
      await page2.goto(sharedUrl);

      // RoomGate 表示
      await expect(
        page2.getByRole('heading', { name: 'このルームはパスワードで保護されています' }),
      ).toBeVisible({ timeout: 10_000 });

      // 誤答 — getByLabel('パスワード') は form の aria-labelledby と
      // 衝突して strict-mode violation になるため textbox role で限定する。
      const passwordInput = page2.getByRole('textbox', { name: 'パスワード' });
      await passwordInput.fill('wrong');
      await page2.getByRole('button', { name: '入室' }).click();
      await expect(page2.getByText('パスワードが違います')).toBeVisible();

      // 正答 → ゲートが消えてエディタが現れる
      await passwordInput.fill(PASSWORD);
      await page2.getByRole('button', { name: '入室' }).click();
      await expect(page2.getByRole('toolbar', { name: '編集ツール' })).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
