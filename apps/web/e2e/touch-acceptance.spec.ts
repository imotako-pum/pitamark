import { expect, test } from '@playwright/test';
import {
  type AcceptanceAnnotation,
  commitTextAnnotation,
  dragOnStage,
  readAnnotations,
  readFirstAnnotation,
  selectTool,
  setupEditor,
  tapShapeAndDelete,
  tapStage,
} from './fixtures/touch-helpers';

// Phase 10.I-4: 4 形状 (rectangle / arrow / highlight / text) × 3 操作 (add / move / delete)
// = 12 ケースを mobile-chrome (Pixel 5 emulation) で網羅する受入 spec。Phase 10.I の
// PRD Acceptance Criteria「基本機能パリティ」を CI で lock するための spec。
//
// 各 it は `page.goto('/') + dropImage` から始める test 独立性を最優先にし、
// Auto-next-A 連鎖 (矢印 → text 自動配置) や前 test の state リークを排除する。
//
// 本格的な実機 QA (誤操作率 / handle hit / mobile→PC 同期 / CWV) は
// `docs/qa/phase-10-i-touch-manual-qa.md` で著者が消費する。

const skipNonMobileChrome = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'mobile-chrome',
    'touch acceptance は mobile-chrome project のみ実行する',
  );

/** Stage の logical 座標 (annotation.x/y) を screen 座標に変換する。1×1 sample.png の
 *  fit-to-viewport で画像が viewport 中央に配置されるため、annotation.x/y はしばしば
 *  負値になる。shape を tap / drag する際は logical → screen 変換が必須。 */
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

/** 矩形 / 矢印 / ハイライト / テキスト の logical 中央座標を取得する。Stage transform
 *  と組み合わせて screen 座標に変換してから dragOnStage / tapStage に渡す。 */
const shapeLogicalCenter = (a: AcceptanceAnnotation): { x: number; y: number } => {
  if (a.type === 'arrow' && a.from && a.to) {
    return { x: (a.from.x + a.to.x) / 2, y: (a.from.y + a.to.y) / 2 };
  }
  if (
    (a.type === 'rectangle' || a.type === 'highlight') &&
    a.x !== undefined &&
    a.y !== undefined &&
    a.width !== undefined &&
    a.height !== undefined
  ) {
    return { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  }
  if (a.type === 'text' && a.x !== undefined && a.y !== undefined) {
    return { x: a.x + 8, y: a.y + 8 };
  }
  throw new Error(`shapeLogicalCenter: unsupported shape ${a.type}`);
};

const shapeScreenCenter = async (
  page: import('@playwright/test').Page,
  a: AcceptanceAnnotation,
): Promise<{ x: number; y: number }> => logicalToScreen(page, shapeLogicalCenter(a));

test.describe('Phase 10.I-4: touch acceptance — 4 shapes × 3 ops (12 cases)', () => {
  // ---- Add (4 ケース) ----

  test('add: 矩形を 1 本指 drag で追加できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, '矩形');
    await dragOnStage(page, { x: 60, y: 60 }, { x: 160, y: 160 });
    const after = await readAnnotations(page);
    expect(after).toHaveLength(1);
    expect(after[0]?.type).toBe('rectangle');
  });

  test('add: 矢印を 1 本指 drag で追加できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, '矢印');
    await dragOnStage(page, { x: 50, y: 50 }, { x: 200, y: 200 });
    const after = await readAnnotations(page);
    // arrow 確定直後に Auto-next-A で空 text annotation が自動配置されるため
    // 配列長は 2 になる (実装側の Phase 7.8 機能)。本 spec では最初の arrow が
    // 期待 type で存在することのみを assert する。
    expect(after.length).toBeGreaterThanOrEqual(1);
    expect(after[0]?.type).toBe('arrow');
  });

  test('add: ハイライトを 1 本指 drag で追加できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'ハイライト');
    await dragOnStage(page, { x: 70, y: 70 }, { x: 170, y: 170 });
    const after = await readAnnotations(page);
    expect(after).toHaveLength(1);
    expect(after[0]?.type).toBe('highlight');
  });

  test('add: テキストを tap で追加できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'テキスト');
    await tapStage(page, { x: 100, y: 100 });
    const after = await readAnnotations(page);
    expect(after).toHaveLength(1);
    expect(after[0]?.type).toBe('text');
    // text 配置後は IME で編集中になるため、後続テストへの干渉を防ぐため Esc で確定。
    await page.keyboard.press('Escape');
  });

  // ---- Move (4 ケース) ----
  // 各 it は Add と同じ手順で 1 形状を作ってから move する独立フロー。

  test('move: 矩形を select ツール + drag で移動できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, '矩形');
    await dragOnStage(page, { x: 60, y: 60 }, { x: 160, y: 160 });
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'rectangle') throw new Error('rectangle add 失敗');
    await selectTool(page, '選択');
    const center = await shapeScreenCenter(page, before);
    await dragOnStage(page, center, { x: center.x + 50, y: center.y + 50 });
    const after = await readFirstAnnotation(page);
    expect(after?.type).toBe('rectangle');
    expect(after?.x).not.toBe(before.x);
    expect(after?.y).not.toBe(before.y);
  });

  test('move: 矢印を select ツール + drag で移動できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, '矢印');
    await dragOnStage(page, { x: 50, y: 50 }, { x: 200, y: 200 });
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'arrow' || !before.from || !before.to) {
      throw new Error('arrow add 失敗');
    }
    await selectTool(page, '選択');
    const center = await shapeScreenCenter(page, before);
    await dragOnStage(page, center, { x: center.x + 60, y: center.y + 60 });
    const after = await readFirstAnnotation(page);
    expect(after?.type).toBe('arrow');
    // arrow は from/to の少なくとも一方が変化していれば移動成功
    const moved =
      after?.from?.x !== before.from.x ||
      after?.from?.y !== before.from.y ||
      after?.to?.x !== before.to.x ||
      after?.to?.y !== before.to.y;
    expect(moved).toBe(true);
  });

  test('move: ハイライトを select ツール + drag で移動できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'ハイライト');
    await dragOnStage(page, { x: 70, y: 70 }, { x: 170, y: 170 });
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'highlight') throw new Error('highlight add 失敗');
    await selectTool(page, '選択');
    const center = await shapeScreenCenter(page, before);
    await dragOnStage(page, center, { x: center.x + 50, y: center.y - 30 });
    const after = await readFirstAnnotation(page);
    expect(after?.type).toBe('highlight');
    expect(after?.x).not.toBe(before.x);
    expect(after?.y).not.toBe(before.y);
  });

  test('move: テキストを select ツール + drag で移動できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'テキスト');
    await tapStage(page, { x: 100, y: 100 });
    // Phase 10.J-4: 本物 touch event で textarea が正しく focus されるため、空文字 Esc では
    // handleTextCancel が annotation を remove する。後続 move のため non-empty content で commit。
    await commitTextAnnotation(page, 'move');
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'text') throw new Error('text add 失敗');
    await selectTool(page, '選択');
    const center = await shapeScreenCenter(page, before);
    await dragOnStage(page, center, { x: center.x + 70, y: center.y + 40 });
    const after = await readFirstAnnotation(page);
    expect(after?.type).toBe('text');
    // x または y のいずれかが変化していれば移動成功
    const moved = after?.x !== before.x || after?.y !== before.y;
    expect(moved).toBe(true);
  });

  // ---- Delete (4 ケース) ----

  test('delete: 矩形を選択 → 削除ボタンで削除できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, '矩形');
    await dragOnStage(page, { x: 60, y: 60 }, { x: 160, y: 160 });
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'rectangle') throw new Error('rectangle add 失敗');
    await tapShapeAndDelete(page, await shapeScreenCenter(page, before));
    expect(await readAnnotations(page)).toHaveLength(0);
  });

  test('delete: 矢印を選択 → 削除ボタンで削除できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, '矢印');
    await dragOnStage(page, { x: 50, y: 50 }, { x: 200, y: 200 });
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'arrow' || !before.from || !before.to) {
      throw new Error('arrow add 失敗');
    }
    // arrow add 後は Auto-next-A で空 text も配置される。両方削除する。
    const lengthBefore = (await readAnnotations(page)).length;
    expect(lengthBefore).toBeGreaterThanOrEqual(1);
    await tapShapeAndDelete(page, await shapeScreenCenter(page, before));
    // 1 削除後の残数。Auto-next-A で text もある場合は 1 件残る、ない場合は 0 件。
    const lengthAfter = (await readAnnotations(page)).length;
    expect(lengthAfter).toBe(lengthBefore - 1);
  });

  test('delete: ハイライトを選択 → 削除ボタンで削除できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'ハイライト');
    await dragOnStage(page, { x: 70, y: 70 }, { x: 170, y: 170 });
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'highlight') throw new Error('highlight add 失敗');
    await tapShapeAndDelete(page, await shapeScreenCenter(page, before));
    expect(await readAnnotations(page)).toHaveLength(0);
  });

  test('delete: テキストを選択 → 削除ボタンで削除できる', async ({ page }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'テキスト');
    await tapStage(page, { x: 100, y: 100 });
    // Phase 10.J-4: non-empty content で commit して text annotation を確定。
    await commitTextAnnotation(page, 'delete');
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'text') throw new Error('text add 失敗');
    await tapShapeAndDelete(page, await shapeScreenCenter(page, before));
    expect(await readAnnotations(page)).toHaveLength(0);
  });
});
