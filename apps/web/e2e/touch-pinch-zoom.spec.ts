import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

// Phase 10.I-2: 2-finger pinch / pan の smoke。mobile-chrome (Pixel 5 emulation) で
// 2 本指を distance 拡大方向に動かすと Stage の transform.scale が増えることを確認する。
//
// 実装メモ: Playwright の page.touchscreen.tap() は単発のみで multi-finger drag できない。
// CDPSession 経由 Input.dispatchTouchEvent で 2 本指 touchstart→touchmove×N→touchend を
// 直接送る。mobile-chrome (hasTouch: true) では Input.dispatchTouchEvent が
// TouchEvent + PointerEvent の両方を発火するため、Konva 公式 multi-touch 経路
// (CanvasStage の onTouchMove) が反応する。本格 12 ケース受入は Phase 10.I-4。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

test.describe('Phase 10.I-2: pinch zoom smoke', () => {
  test('mobile-chrome で 2-finger pinch を行うと Stage の scale が増加する', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'pinch smoke は mobile-chrome project のみ実行する',
    );

    await page.goto('/');
    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
    await page.waitForFunction(
      (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
      ANNOTATIONS_KEY,
      { timeout: 10_000 },
    );

    const stage = page.locator('.konvajs-content canvas').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('Konva canvas bounding box が取得できなかった');

    const beforeScale = await page.evaluate(() => {
      const stages = (window as unknown as { Konva?: { stages: Array<{ scaleX: () => number }> } })
        .Konva?.stages;
      return stages?.[0]?.scaleX() ?? null;
    });
    expect(beforeScale).not.toBeNull();

    const cdp = await context.newCDPSession(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // touchStart: 2 本指を中点から半径 60px の対称位置に置く
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: cx - 60, y: cy, id: 0 },
        { x: cx + 60, y: cy, id: 1 },
      ],
    });

    // 段階的に距離を 2 倍まで広げる (jitter 防止のため複数 frame に分割)
    for (let i = 1; i <= 5; i += 1) {
      const offset = 60 + i * 20; // 80, 100, 120, 140, 160 → 最終的に距離 2.66x
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: cx - offset, y: cy, id: 0 },
          { x: cx + offset, y: cy, id: 1 },
        ],
      });
    }

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    // scale が増加していることを確認 (誤差吸収のため厳密な値ではなく > beforeScale で判定)
    await expect
      .poll(
        async () => {
          const next = await page.evaluate(() => {
            const stages = (
              window as unknown as { Konva?: { stages: Array<{ scaleX: () => number }> } }
            ).Konva?.stages;
            return stages?.[0]?.scaleX() ?? null;
          });
          return next;
        },
        { timeout: 5_000 },
      )
      .toBeGreaterThan(beforeScale as number);
  });
});
