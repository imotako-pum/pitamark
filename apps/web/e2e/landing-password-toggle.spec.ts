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

  // 旧実装は `top-16` 固定で Toolbar 直下に逃がしていたが、Toolbar が flex-wrap で
  // 2 行になる狭幅では Toolbar の後ろにパネルが隠れていた。EditorShell の belowHeader
  // slot 経由で動的 headerHeight に追従するように改めたので、狭幅でも actionability
  // check が通ることをロックする。
  test('狭幅 (Toolbar が wrap する viewport) でもパネルが Toolbar に隠れず直接クリックできる', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'wrap 時のレイアウト回帰は chromium 1 プロジェクトで検証する',
    );

    // iPhone 12-13 系の幅。Toolbar (5 ツール + Undo/Redo/Del + 6 色 + フォント
    // ±2 + Export/Clear + Help + LangToggle) は確実に 2 行以上になる。
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const checkbox = page.getByRole('checkbox', { name: /パスワードで保護する/ });
    await expect(checkbox).toBeVisible();
    // 狭幅でも直接 click が通る = Toolbar の wrap 後の高さに追従できている
    await checkbox.click();

    await expect(page.getByLabel('ルームのパスワード')).toBeVisible();
    await page.getByLabel('ルームのパスワード').fill('narrow-viewport-password');
    await expect(page.getByLabel('ルームのパスワード')).toHaveValue('narrow-viewport-password');
  });
});
