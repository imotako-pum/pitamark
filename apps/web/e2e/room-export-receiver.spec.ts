import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// cross-origin PNG export の regression 検知:
//
// 公開ルームの受信側 (画像を upload した本人ではない別ブラウザ context) で PNG export
// を踏んだとき、`<img>` の crossOrigin が anonymous でないと canvas が tainted 化して
// `stage.toCanvas().toBlob()` が `SecurityError` を投げ、error toast が出て download
// が発生しない。
//
// localhost:5173 (web) ↔ localhost:8787 (api) は port が異なる別 origin なので、本 spec
// は本番 (pitamark.app ↔ api.pitamark.app) と同じ cross-origin 経路を踏める。
// `useImage(src, 'anonymous')` が再投入され、API の CORS middleware が ACAO + Vary:
// Origin を返している限り、受信側でも PNG export が success toast → download 発火に
// 到達することを担保する。
test.describe('cross-origin PNG export from a receiver context', () => {
  test('受信側で PNG 保存が成功し download が発火する', async ({ browser }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'cross-origin canvas 経路は chromium 1 プロジェクトで検証する',
    );

    const sender = await browser.newContext();
    const receiver = await browser.newContext({ acceptDownloads: true });
    const senderPage = await sender.newPage();
    const receiverPage = await receiver.newPage();

    try {
      // 送信側: 画像 D&D → /r/:id 遷移
      await senderPage.goto('/');
      await dropImage(senderPage);
      await expect(senderPage).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
      const sharedUrl = senderPage.url();

      // 受信側: 別 context で同じ URL を開く（cross-origin の <img> 経路を踏む）
      await receiverPage.goto(sharedUrl);

      // RoomEditor が ready になるまで待つ — useYjsAnnotationsStore が
      // ProtocolStore を初期化すると window.__SNAP_SHARE_ANNOTATIONS__ が
      // string[] (=Annotation[]) に解決される（既存 room-share spec と同パターン）。
      await receiverPage.waitForFunction(
        () =>
          Array.isArray(
            (window as unknown as { __SNAP_SHARE_ANNOTATIONS__?: unknown[] })
              .__SNAP_SHARE_ANNOTATIONS__,
          ),
        null,
        { timeout: 10_000 },
      );

      // ImageLayer の <KonvaImage> がマウントされる前に export を踏むと
      // 空 canvas を export してしまうので、Konva canvas の bounding box を
      // 待って画像が描画されたタイミングを確実に踏む。
      const stage = receiverPage.locator('.konvajs-content canvas').first();
      await expect(stage).toBeVisible({ timeout: 10_000 });

      // PNG 保存ボタンをクリック → download event を待つ
      const downloadPromise = receiverPage.waitForEvent('download', { timeout: 10_000 });
      await receiverPage.getByRole('button', { name: 'PNG 保存' }).click();
      const download = await downloadPromise;

      // success toast が出ること（tainted canvas 例外が catch されたなら
      // 「PNG の保存に失敗しました」エラー toast が出る → 失敗を assert で検出）
      await expect(receiverPage.getByText('PNG を保存しました')).toBeVisible({
        timeout: 5_000,
      });
      await expect(receiverPage.getByText('PNG の保存に失敗しました')).toBeHidden();

      // ファイル名が pitamark-<roomId>-<ts>.png のパターンであること
      expect(download.suggestedFilename()).toMatch(/^pitamark-[A-Za-z0-9_-]{21}-\d{8}-\d{6}\.png$/);
    } finally {
      await sender.close();
      await receiver.close();
    }
  });
});
