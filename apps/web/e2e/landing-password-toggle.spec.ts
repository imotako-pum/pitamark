import { expect, test } from '@playwright/test';

// Phase 7.6 既知-2 補完: ランディングの「パスワードで保護する」チェックボックスは
// Toolbar と同じ z-10 帯に重なっており、Playwright の actionability check が
// "intercepted by another element" として fail する状態だった。Phase 7.5 の
// room-protected.spec.ts は keyboard 経路 (focus + Space) で迂回したが、
// 実態は本物のバグ (UX 上もユーザーがクリックできない) で、Phase 7.6 の
// 既知-2 として上がった。本 spec は「直接 click が通る」ことを assertion して、
// pointer-events 遮断の回帰を CI で永続的にロックする。
test.describe('landing password toggle visibility', () => {
  test('画像未ロード時に password 保護パネルが見えて直接クリックできる', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'pointer-events 遮断の回帰は chromium 1 プロジェクトで検証する',
    );

    await page.goto('/');

    const checkbox = page.getByRole('checkbox', { name: /パスワードで保護する/ });
    await expect(checkbox).toBeVisible();
    // focus + Space ではなく直接 click — actionability check が通ることが
    // 既知-2 fix の本質。intercepted で fail するなら本物のバグ回帰。
    await checkbox.click();

    // チェック ON → パスワード入力欄が現れる
    await expect(page.getByLabel('ルームのパスワード')).toBeVisible();
    // 入力できる (input に focus が当たる)
    await page.getByLabel('ルームのパスワード').fill('test-password-XYZ');
    await expect(page.getByLabel('ルームのパスワード')).toHaveValue('test-password-XYZ');
  });
});
