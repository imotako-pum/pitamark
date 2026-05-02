import { expect, test } from '@playwright/test';
import { dropImage, SAMPLE_IMAGE_PATH } from './fixtures/upload';

// Phase 7.6 E2E 拡充 + **新発見バグ既知-4 の固定**:
//
// 単純な validation 分岐 (形式 / サイズ) は src/lib/__tests__/imageValidation.test.ts
// で unit レベルカバー済。本 spec は「ユーザーから見た drop の振る舞い」を踏み、
// その過程で見つかった以下のバグを CI で固定する。
//
// **既知-4. Turnstile 有効時、validation エラーが永久に表示されない**
//
// LocalEditor.handleLoad (apps/web/src/pages/LocalEditor.tsx:56-65) は
// `loadFromFile(...)` 後に **無条件で `turnstile.reset()`** を呼ぶ。
// reset で turnstile state が `pending` に戻ると、useTurnstileToken が export
// する `turnstileBlocking = true` になり、`onLoadFile = undefined` に切り替わる。
// EditorShell は `onLoadFile === undefined` のとき DropZone を render せず
// 「画像を読み込んでいます…」の loading hint を出す
// (EditorShell.tsx:231-237)。
//
// Cloudflare Turnstile の invisible widget は外部から `widget.reset()` を
// 呼ばない限り自動的に re-fire しないため、ユーザーは:
//   1) 不正なファイルを drop
//   2) validation がサイレント失敗 (DropZone がアンマウントされ error も消える)
//   3) "画像を読み込んでいます…" 表示のまま無限に固まる
// ことになる。**正常な PNG を drop した場合も同じ経路を踏むが、
//  loadFromFile 内で setSource が成功するため source 経路で CanvasStage に遷移し
//  「読み込み中」状態は通り抜ける**。
//
// 修正方針 (Phase 7.6 で別 task として扱う):
//   (a) handleLoad 内で `turnstile.reset()` を呼ぶ条件を「アップロード成功時のみ」に
//   (b) `turnstile.reset()` 内で `window.turnstile.reset(widgetId)` も呼んで
//       widget 側の token も再発行させる
//   (c) loading hint に「もう一度ドロップしてください」のフォールバック UI を追加

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

    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
    await expect(
      page.getByRole('alert').filter({ hasText: '画像ファイルをドロップしてください' }),
    ).toBeHidden();
  });

  test('既知-4 回帰: text/plain drop はサイレント失敗し loading hint で固まる', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    // バグが修正されたら本テストは失敗する。失敗したら以下のいずれかに書き換える:
    //   - 「validation エラーが画面に表示される」を assert
    //   - 「DropZone が再表示される」を assert
    await page.goto('/');
    const dropZone = page.locator('section[aria-labelledby="dropzone-heading"]');
    await expect(dropZone).toBeVisible({ timeout: 5_000 });

    const dataTransfer = await page.evaluateHandle(() => {
      const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
      const dt = new DataTransfer();
      dt.items.add(file);
      return dt;
    });
    await dropZone.dispatchEvent('drop', { dataTransfer });

    // 想定挙動 (バグ): 「画像を読み込んでいます…」が出てそのまま固まる
    await expect(page.getByText('画像を読み込んでいます…')).toBeVisible({ timeout: 5_000 });
    // URL は landing のまま
    await expect(page).toHaveURL(/\/$/);
    // DropZone (および error alert) は消えている
    await expect(dropZone).toBeHidden();
  });

  test('既知-4 回帰: 10MB 超 image/png drop も同様にサイレント失敗する', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await page.goto('/');
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

    await expect(page.getByText('画像を読み込んでいます…')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/$/);
    await expect(dropZone).toBeHidden();
  });
});
