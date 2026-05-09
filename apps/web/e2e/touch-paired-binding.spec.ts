import { expect, test } from '@playwright/test';
import {
  type AcceptanceAnnotation,
  commitTextAnnotation,
  dragOnStage,
  readFirstAnnotation,
  selectTool,
  setupEditor,
  tapStage,
} from './fixtures/touch-helpers';

// Phase 10.J-1: paired binding (`onClick + onTap` / `onPointerDown + onTouchStart`) が
// 本物の touch event 経路で発火することを CI で lock-in。
// 既存 `touch-acceptance.spec.ts` の helper 書き換えで暗黙的に paired binding を
// 踏んでいるが、本 spec は **paired binding 自体の挙動** (= touch tap で選択 dispatch が走る) を
// 直接 assert する。
//
// 検証手段: 削除ボタンの `disabled={!hasSelection}` 状態を観察。tap 前は disabled、
// tap 後は enabled。これは「shape の onTap が発火 → onClick(annotation.id) → store dispatch
// → toolbar `hasSelection=true` → delete button enabled」のパス全体を証明する。

const skipNonMobileChrome = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'mobile-chrome',
    'paired binding spec は mobile-chrome project のみ実行する',
  );

const logicalToScreen = async (
  page: import('@playwright/test').Page,
  point: { x: number; y: number },
): Promise<{ x: number; y: number }> =>
  page.evaluate((p) => {
    const stages = (
      window as unknown as {
        Konva?: { stages: Array<{ scaleX: () => number; x: () => number; y: () => number }> };
      }
    ).Konva?.stages;
    const stage = stages?.[0];
    if (!stage) return p;
    return {
      x: p.x * stage.scaleX() + stage.x(),
      y: p.y * stage.scaleX() + stage.y(),
    };
  }, point);

const shapeScreenCenter = async (
  page: import('@playwright/test').Page,
  a: AcceptanceAnnotation,
): Promise<{ x: number; y: number }> => {
  if (a.type === 'arrow' && a.from && a.to) {
    return logicalToScreen(page, { x: (a.from.x + a.to.x) / 2, y: (a.from.y + a.to.y) / 2 });
  }
  if (
    (a.type === 'rectangle' || a.type === 'highlight') &&
    a.x !== undefined &&
    a.y !== undefined &&
    a.width !== undefined &&
    a.height !== undefined
  ) {
    return logicalToScreen(page, { x: a.x + a.width / 2, y: a.y + a.height / 2 });
  }
  if (a.type === 'text' && a.x !== undefined && a.y !== undefined) {
    return logicalToScreen(page, { x: a.x + 8, y: a.y + 8 });
  }
  throw new Error(`shapeScreenCenter: unsupported shape ${a.type}`);
};

test.describe('Phase 10.J-1: paired binding sanity (touch tap で onTap が発火する)', () => {
  test('矩形を tap で選択できる (onTap → store dispatch → delete button enabled)', async ({
    page,
  }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, '矩形');
    await dragOnStage(page, { x: 60, y: 60 }, { x: 160, y: 160 });
    const annotation = await readFirstAnnotation(page);
    if (!annotation || annotation.type !== 'rectangle') throw new Error('rectangle add 失敗');
    await selectTool(page, '選択');
    // 描画直後は新 shape が auto-select されているため、空エリア tap で deselect。
    // 画像の左上 (10, 10) は shape 範囲外。空 stage 領域 tap で onClick(null) → 選択解除。
    await tapStage(page, { x: 10, y: 10 });
    const deleteBtn = page.getByRole('button', { name: '削除', exact: true });
    await expect(deleteBtn).toBeDisabled();
    // tap で選択 → paired binding の onTap が発火するパスを通って selection state 更新
    await tapStage(page, await shapeScreenCenter(page, annotation));
    await expect(deleteBtn).toBeEnabled({ timeout: 3_000 });
  });

  test('矢印を tap で選択できる (onTap → 選択 → delete enabled)', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, '矢印');
    await dragOnStage(page, { x: 50, y: 50 }, { x: 200, y: 200 });
    const annotation = await readFirstAnnotation(page);
    if (!annotation || annotation.type !== 'arrow') throw new Error('arrow add 失敗');
    await selectTool(page, '選択');
    await tapStage(page, { x: 10, y: 10 });
    const deleteBtn = page.getByRole('button', { name: '削除', exact: true });
    await expect(deleteBtn).toBeDisabled();
    await tapStage(page, await shapeScreenCenter(page, annotation));
    await expect(deleteBtn).toBeEnabled({ timeout: 3_000 });
  });

  test('ハイライトを tap で選択できる (onTap → 選択 → delete enabled)', async ({
    page,
  }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'ハイライト');
    await dragOnStage(page, { x: 70, y: 70 }, { x: 170, y: 170 });
    const annotation = await readFirstAnnotation(page);
    if (!annotation || annotation.type !== 'highlight') throw new Error('highlight add 失敗');
    await selectTool(page, '選択');
    await tapStage(page, { x: 10, y: 10 });
    const deleteBtn = page.getByRole('button', { name: '削除', exact: true });
    await expect(deleteBtn).toBeDisabled();
    await tapStage(page, await shapeScreenCenter(page, annotation));
    await expect(deleteBtn).toBeEnabled({ timeout: 3_000 });
  });

  test('テキストを tap で選択できる (onTap → 選択 → delete enabled)', async ({
    page,
  }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'テキスト');
    await tapStage(page, { x: 100, y: 100 });
    await commitTextAnnotation(page, 'paired');
    const annotation = await readFirstAnnotation(page);
    if (!annotation || annotation.type !== 'text') throw new Error('text add 失敗');
    await selectTool(page, '選択');
    await tapStage(page, { x: 10, y: 10 });
    const deleteBtn = page.getByRole('button', { name: '削除', exact: true });
    await expect(deleteBtn).toBeDisabled();
    await tapStage(page, await shapeScreenCenter(page, annotation));
    await expect(deleteBtn).toBeEnabled({ timeout: 3_000 });
  });
});
