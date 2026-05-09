import { expect, test } from '@playwright/test';
import { awaitUploadReady, dropImage, SAMPLE_IMAGE_PATH } from './fixtures/upload';

// DropZone validation の regression 検知 E2E。
//
// 単純な validation 分岐 (形式 / サイズ) は src/lib/__tests__/imageValidation.test.ts
// で unit レベル cover 済。本 spec は「ユーザから見た drop の振る舞い」を踏み、
// 旧 Turnstile 連携時の silently 失敗バグの regression を CI で固定する。
//
// **旧バグ: Turnstile 有効時に validation エラーが消えていた**
//
// 旧実装: `LocalEditor.onLoadFile = blockedByEmptyPassword || turnstileBlocking
// ? undefined : handleLoad` で、`handleLoad` 内の `turnstile.reset()` が無条件に走ると
// state が `pending` に戻り、`onLoadFile === undefined` 経路で EditorShell が
// 「画像を読み込んでいます…」の loading hint を出し、DropZone 自体が unmount されて
// error alert も消えていた。
//
// 修正後: `onLoadFile` を常に `handleLoad` にし、Turnstile / password 未入力の gate を
// `handleLoad` 内の早期 return + toast に閉じ込めた。DropZone は常駐し、validation
// 失敗時は `useImageSource.error` 経由で alert がそのまま表示される。

const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'chromium',
    'DropZone バリデーションは chromium 1 プロジェクトで検証する',
  );

test.describe('DropZone validation', () => {
  test('正常な PNG は drop 後にエラーが残らず room が作られる (baseline)', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    await dropImage(page, SAMPLE_IMAGE_PATH);

    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 20_000 });
    await expect(
      page.getByRole('alert').filter({ hasText: '画像ファイルをドロップしてください' }),
    ).toBeHidden();
  });

  test('既知-4 回帰: text/plain drop でも DropZone が残り validation エラーが見える', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    await awaitUploadReady(page);
    const dropZone = page.locator('section[aria-labelledby="dropzone-heading"]');
    await expect(dropZone).toBeVisible({ timeout: 5_000 });

    const dataTransfer = await page.evaluateHandle(() => {
      const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
      const dt = new DataTransfer();
      dt.items.add(file);
      return dt;
    });
    await dropZone.dispatchEvent('drop', { dataTransfer });

    // DropZone は常駐し、URL も landing のまま、validation alert が見えること。
    await expect(dropZone).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('alert').filter({ hasText: '画像ファイルをドロップしてください' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('画像を読み込んでいます…')).toBeHidden();
  });

  test('既知-4 回帰: 10MB 超 image/png drop でも DropZone が残りサイズエラーが見える', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    await awaitUploadReady(page);
    const dropZone = page.locator('section[aria-labelledby="dropzone-heading"]');
    await expect(dropZone).toBeVisible({ timeout: 5_000 });

    const dataTransfer = await page.evaluateHandle(() => {
      const oversized = new Uint8Array(11 * 1024 * 1024);
      const file = new File([oversized], 'big.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      return dt;
    });
    await dropZone.dispatchEvent('drop', { dataTransfer });

    await expect(dropZone).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('alert').filter({ hasText: '画像サイズが大きすぎます' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('画像を読み込んでいます…')).toBeHidden();
  });

  // 旧実装では Turnstile pending 中に `onLoadFile === undefined` になり、EditorShell が
  // 「画像を読み込んでいます…」を出して DropZone が一瞬ちらついていた。本テストは
  // 初回 mount 直後から DropZone が常駐し loading hint が一度も出ないことを保証する。
  test('hotfix #1: 初回マウント直後に loading hint がちらつかない', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '画像をドロップ' })).toBeVisible({
      timeout: 1_000,
    });
    await expect(page.getByText('画像を読み込んでいます…')).toBeHidden();
  });

  // DropZone クリックで <input type="file"> が伝播し、ファイルピッカー (Finder) が
  // 開く経路の構造を担保する。Playwright では OS のファイルピッカー自体は開けない
  // ため、`page.on('filechooser')` で <input type="file"> がトリガされる事実を検証する。
  test('hotfix #2: DropZone クリックでファイルピッカーが起動する', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    const button = page.getByRole('button', { name: '画像をドロップ' });
    await expect(button).toBeVisible();

    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5_000 });
    await button.click();
    const chooser = await fileChooserPromise;
    expect(chooser.isMultiple()).toBe(false);

    // 隠し input の accept 属性も確認 (production の MIME 制約と一致するか)
    const accept = await page.locator('input[type="file"]').first().getAttribute('accept');
    expect(accept).toBe('image/png,image/jpeg,image/webp,image/svg+xml');
  });

  // ファイルピッカー経由でも drag&drop と同じ経路 (handleLoad → loadFromFile) を
  // 通って /r/:id に遷移することを担保する。
  test('hotfix #2: ファイルピッカー選択でも room が作られる', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
    await awaitUploadReady(page);

    // setInputFiles は <input type="file"> に直接 file を流し込むので、
    // ファイルピッカーを経由しなくても production の onChange が走る。
    await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_IMAGE_PATH);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 20_000 });
  });
});
