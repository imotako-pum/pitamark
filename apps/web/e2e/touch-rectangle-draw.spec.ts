import { expect, test } from '@playwright/test';
import { ANNOTATIONS_KEY, dragOnStage, selectTool, setupEditor } from './fixtures/touch-helpers';

// Phase 10.I-1: Pointer Events 一本化 + 描画系復旧の smoke。本 spec は mobile-chrome
// (Pixel 5 emulation) project でのみ実行し、Stage が onPointerDown 経路を介して矩形を
// 1 件描画できることを確認する。本格的な「4 形状 × 3 操作 = 12 ケース」の受入 spec は
// Phase 10.I-4 で別途追加する。
//
// Phase 10.J-4: 本物 touch event 経路 (`dragOnStage` 内部の touchSequence) で再書き換え。
// `setupEditor` を helper に統一して 20s timeout (並列負荷の flaky 対応) に揃える。

const readAnnotationCount = (page: import('@playwright/test').Page): Promise<number> =>
  page.evaluate(
    (k) =>
      ((window as unknown as Record<string, ReadonlyArray<unknown>>)[k]?.length ?? 0) as number,
    ANNOTATIONS_KEY,
  );

test.describe('Phase 10.I-1: pointer events smoke', () => {
  test('mobile-chrome で矩形ツールを選んで drag で 1 件 annotation を追加できる', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'pointer events smoke は mobile-chrome project のみ実行する',
    );

    await setupEditor(page);
    await selectTool(page, '矩形');
    await dragOnStage(page, { x: 60, y: 60 }, { x: 160, y: 160 });
    await expect.poll(() => readAnnotationCount(page), { timeout: 5_000 }).toBe(1);
  });
});
