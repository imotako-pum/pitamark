import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('landing page renders heading on desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'pitamark' })).toBeVisible();
});

// landing (source === null) では Toolbar を非表示にする。disabled tool button は
// 画像未ロード状態では情報価値ゼロで、landing 面を圧迫していた。`source !== null` に
// なった瞬間 Toolbar が mount され、それが implicit な「ここから編集できる」signal
// を兼ねる。
test('editor toolbar is hidden on landing (no image loaded)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeHidden();
});

test('drop zone shows the empty-state hint when no image is loaded', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '画像をドロップ' })).toBeVisible();
});

test('brand h1 stays reachable at tablet width (768px) — toolbar still hidden', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');

  // md breakpoint は 768px で発火するので brand title は visible のまま…
  await expect(page.locator('h1')).toBeVisible();
  // …が editor toolbar は landing では幅に関係なく hidden を保つ。
  await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeHidden();
});

test('h1 hides on narrow viewports below md breakpoint (480px)', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 });
  await page.goto('/');

  // Header h1 ("pitamark") は `md:block` で gate されている。
  await expect(page.locator('h1')).toBeHidden();
  // toolbar は landing では viewport に関係なく hidden を保つ。LangToggle は header
  // の隣に置いているので、狭い幅でも language 切替には到達できる。
  await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeHidden();
  await expect(page.getByRole('group', { name: '言語' })).toBeVisible();
});

// skip — `wrangler dev` と `vite` を両方起動する必要があり、CI 統合は別途。
// 手元では確認済。
test.skip('uploading an image transitions the URL to /r/:id (with API running)', async ({
  page,
}) => {
  await page.goto('/');
});

// landing 面の coverage。ja の Hero h2 は「このサイトは何か」の canonical メッセージ。
// 文字列を完全一致でマッチさせ、コピー変更が意図的に行われていることを担保する。

test('landing hero h2 shows the headline copy (ja)', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 2, name: '画像にサクッと注釈、URL で一瞬共有' }),
  ).toBeVisible();
});

test('landing surface renders features / howto / faq sections', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: 'できること' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '使い方は 3 ステップ' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'よくある質問' })).toBeVisible();
  // 4 つの FAQ <details> エントリがあり、default は closed。
  await expect(page.locator('details')).toHaveCount(4);
});

test('rail ad slots are visible on lg+ viewports with fixed pixel size (CLS guard)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const railLeft = page.getByTestId('ad-slot-rail-left');
  const railRight = page.getByTestId('ad-slot-rail-right');
  await expect(railLeft).toBeVisible();
  await expect(railRight).toBeVisible();
  // inline style に CLS-safe の min-height + width 契約が乗っていることを確認。
  await expect(railLeft).toHaveAttribute('style', /width:\s*160px/);
  await expect(railLeft).toHaveAttribute('style', /min-height:\s*600px/);
  await expect(railRight).toHaveAttribute('style', /width:\s*160px/);
});

test('rail ad slots are hidden below lg, bottom slot takes over', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto('/');
  // 両 rail は DOM 上に存在するが、lg 未満では display:none。
  await expect(page.getByTestId('ad-slot-rail-left')).toBeHidden();
  await expect(page.getByTestId('ad-slot-rail-right')).toBeHidden();
  // landing 面では画像未ロード時にも bottom AdSlot が emit される。
  const bottom = page.getByTestId('ad-slot-bottom');
  await expect(bottom).toBeVisible();
  await expect(bottom).toHaveAttribute('style', /min-height:\s*100px/);
});

test('landing surface has no axe violations (wcag 2.0/2.1/2.2 AA)', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
