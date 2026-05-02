import { expect, test } from '@playwright/test';

test.describe('mobile landing layout', () => {
  test('Pixel 5 viewport でランディングがレイアウト崩れせず描画される', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'mobile-chrome project でのみ実行する screenshot 回帰',
    );
    // OS 別に snapshot ファイル名が分岐する (Playwright デフォルト)。Phase 7.5
    // はローカル開発機 (darwin) で生成した snapshot のみコミットしており、
    // CI Linux 用 snapshot は Phase 8 follow-up で別途生成予定 (docs/observability.md)。
    test.skip(
      process.platform !== 'darwin',
      `screenshot snapshot は ${process.platform} 用が未生成。\`UPDATE_SNAPSHOTS=1 pnpm test:e2e --update-snapshots\` で生成し commit してください。`,
    );

    await page.goto('/');

    await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '画像をドロップしてください' })).toBeVisible();

    // 初回は `--update-snapshots` で生成し commit。
    // OS / レンダリングエンジンの揺れを 2% で吸収。
    await expect(page).toHaveScreenshot('landing-mobile.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
});
