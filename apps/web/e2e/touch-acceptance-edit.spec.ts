import { expect, test } from '@playwright/test';
import {
  type AcceptanceAnnotation,
  commitTextAnnotation,
  dblTapViewport,
  dragOnStage,
  dragViewport,
  readAnnotations,
  readFirstAnnotation,
  selectTool,
  setupEditor,
  tapStage,
} from './fixtures/touch-helpers';

// Phase 10.I post-review fix: 受入 spec (touch-acceptance.spec.ts) で網羅していなかった
// **リサイズ + テキスト再編集** を mobile-chrome で実証する spec。Phase A 検証先行で
// 何が動かないかを切り分け、Phase B で必要な修正を加える。
//
// ケース構成 (7):
//   resize-1: 矩形 Transformer anchor drag → width/height 変化
//   resize-2: ハイライト Transformer anchor drag → width/height 変化
//   endpoint-1: 矢印 from-handle Circle drag → annotation.from 変化
//   endpoint-2: 矢印 to-handle Circle drag → annotation.to 変化
//   dbltap-text: テキストをダブルタップ → TextEditorOverlay (textarea) 表示
//   edit-text: 編集中文字入力 → annotation.text 更新 (Enter/Esc 確定)
//   edit-text-cancel: 編集モード中に Esc → annotation.text 確定 (空のまま)
//
// すべて mobile-chrome project 限定 (touch fixtures が hasTouch:true 前提)。

const skipNonMobileChrome = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'mobile-chrome',
    'edit acceptance は mobile-chrome project のみ実行する',
  );

/** logical 座標 → Stage 内ローカル screen 座標 (Stage の transform を反映、box offset
 *  は **加算しない**)。touch-acceptance.spec.ts (10.I-4) と同仕様。dragOnStage / tapStage
 *  は内部で box offset を加算するためそのまま渡せるが、Transformer anchor / endpoint Circle
 *  のように `dragViewport` / `dblTapViewport` を直接呼ぶ経路では別途 box offset を足す必要がある。 */
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

/** viewport 座標を返す (logical → screen + box offset)。
 *  endpoint Circle drag / Transformer anchor drag のように `dragViewport` を直接呼ぶ経路で使う。 */
const logicalToViewport = async (
  page: import('@playwright/test').Page,
  point: { x: number; y: number },
): Promise<{ x: number; y: number }> => {
  const screen = await logicalToScreen(page, point);
  const box = await page.locator('.konvajs-content canvas').first().boundingBox();
  if (!box) throw new Error('Stage canvas bounding box が取得できなかった');
  return { x: box.x + screen.x, y: box.y + screen.y };
};

/** annotation の logical 中央 → screen 座標。touch-acceptance.spec.ts と同形式。 */
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

/** rectangle/highlight の bottom-right 角 → viewport 座標 (dragViewport 用)。 */
const shapeBottomRightViewport = async (
  page: import('@playwright/test').Page,
  a: AcceptanceAnnotation,
): Promise<{ x: number; y: number }> => {
  if (
    (a.type === 'rectangle' || a.type === 'highlight') &&
    a.x !== undefined &&
    a.y !== undefined &&
    a.width !== undefined &&
    a.height !== undefined
  ) {
    return logicalToViewport(page, { x: a.x + a.width, y: a.y + a.height });
  }
  throw new Error(`shapeBottomRightViewport: unsupported shape ${a.type}`);
};

/** arrow の from / to を viewport 座標で取得 (dragViewport 用)。 */
const arrowEndpointViewport = async (
  page: import('@playwright/test').Page,
  a: AcceptanceAnnotation,
  which: 'from' | 'to',
): Promise<{ x: number; y: number }> => {
  if (a.type !== 'arrow' || !a.from || !a.to) {
    throw new Error('arrowEndpointViewport: not an arrow');
  }
  return logicalToViewport(page, which === 'from' ? a.from : a.to);
};

test.describe('Phase 10.I post-review: touch resize + re-edit (Phase A verification)', () => {
  // ---- Resize (2 ケース) ----

  test('resize-1: 矩形を選択 → bottom-right Transformer anchor を drag → width/height 変化', async ({
    page,
  }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, '矩形');
    await dragOnStage(page, { x: 60, y: 60 }, { x: 160, y: 160 });
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'rectangle') throw new Error('rectangle add 失敗');
    expect(before.width).toBeGreaterThan(0);
    await selectTool(page, '選択');
    // shape を tap して Transformer を表示させる
    const center = await shapeScreenCenter(page, before);
    await tapStage(page, center);
    // bottom-right anchor (Transformer の右下) を screen 座標で計算 → +50,+50 方向に drag
    const br = await shapeBottomRightViewport(page, before);
    await dragViewport(page, br, { x: br.x + 60, y: br.y + 60 });
    const after = await readFirstAnnotation(page);
    expect(after?.type).toBe('rectangle');
    // width または height のどちらかが増えていれば resize 成功
    const resized =
      (after?.width ?? 0) > (before.width ?? 0) || (after?.height ?? 0) > (before.height ?? 0);
    expect(resized).toBe(true);
  });

  test('resize-2: ハイライトを選択 → Transformer anchor を drag → width/height 変化', async ({
    page,
  }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'ハイライト');
    await dragOnStage(page, { x: 70, y: 70 }, { x: 170, y: 170 });
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'highlight') throw new Error('highlight add 失敗');
    await selectTool(page, '選択');
    const center = await shapeScreenCenter(page, before);
    await tapStage(page, center);
    const br = await shapeBottomRightViewport(page, before);
    await dragViewport(page, br, { x: br.x + 60, y: br.y + 60 });
    const after = await readFirstAnnotation(page);
    expect(after?.type).toBe('highlight');
    const resized =
      (after?.width ?? 0) > (before.width ?? 0) || (after?.height ?? 0) > (before.height ?? 0);
    expect(resized).toBe(true);
  });

  // ---- Endpoint (2 ケース) ----

  test('endpoint-1: 矢印を選択 → from-handle Circle を drag → annotation.from 変化', async ({
    page,
  }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, '矢印');
    await dragOnStage(page, { x: 50, y: 50 }, { x: 200, y: 200 });
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'arrow' || !before.from || !before.to) {
      throw new Error('arrow add 失敗');
    }
    await selectTool(page, '選択');
    // 矢印を tap して endpoint Circle を表示させる
    const center = await shapeScreenCenter(page, before);
    await tapStage(page, center);
    // from-handle (始点 Circle) を drag
    const from = await arrowEndpointViewport(page, before, 'from');
    await dragViewport(page, from, { x: from.x + 80, y: from.y + 50 });
    const after = await readFirstAnnotation(page);
    expect(after?.type).toBe('arrow');
    const fromMoved = after?.from?.x !== before.from.x || after?.from?.y !== before.from.y;
    expect(fromMoved).toBe(true);
  });

  test('endpoint-2: 矢印を選択 → to-handle Circle を drag → annotation.to 変化', async ({
    page,
  }, testInfo) => {
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
    await tapStage(page, center);
    const to = await arrowEndpointViewport(page, before, 'to');
    await dragViewport(page, to, { x: to.x + 80, y: to.y + 50 });
    const after = await readFirstAnnotation(page);
    expect(after?.type).toBe('arrow');
    const toMoved = after?.to?.x !== before.to.x || after?.to?.y !== before.to.y;
    expect(toMoved).toBe(true);
  });

  // ---- Text re-edit (3 ケース) ----

  test('dbltap-text: テキストをダブルタップ → 編集モード (textarea 表示)', async ({
    page,
  }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'テキスト');
    await tapStage(page, { x: 100, y: 100 });
    // Phase 10.J-4: 本物 touch event で textarea が正しく focus されるため、空文字 Esc では
    // handleTextCancel が annotation を remove する。non-empty content で commit して text を確定。
    await commitTextAnnotation(page, 'src');
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'text') throw new Error('text add 失敗');
    await selectTool(page, '選択');
    // text shape を **ダブルタップ** で編集モードに。Phase 10.J-4: 本物の touchstart/end を
    // 2 連続発火する `dblTapViewport` を使う。Konva の `dbltap` 判定 (300ms 以内 + 同位置 2 連続 tap、
    // ADR-0007 D2 の DOUBLE_TAP_INTERVAL_MS) を踏み、TextShape の `onDblTap` 経路を CI で踏む。
    const center = await logicalToViewport(page, {
      x: (before.x ?? 0) + 8,
      y: (before.y ?? 0) + 8,
    });
    await dblTapViewport(page, center);
    // 編集モードに入ったら TextEditorOverlay の textarea が DOM に visible
    const overlay = page.locator('textarea[aria-label="注釈テキストを編集"]');
    await expect(overlay).toBeVisible({ timeout: 3_000 });
  });

  test('edit-text: 編集モード中に文字入力 → Enter で確定 → annotation.text 更新', async ({
    page,
  }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'テキスト');
    await tapStage(page, { x: 100, y: 100 });
    // 初回 placement で IME が立ち上がる。textarea にフォーカスを明示的に当てる必要が
    // あるため `overlay.fill()` を使う (内部で focus + clear + type を実行)。
    // `page.keyboard.type` を直接呼ぶと active element が textarea でない場合に消える。
    const overlay = page.locator('textarea[aria-label="注釈テキストを編集"]');
    await expect(overlay).toBeVisible({ timeout: 3_000 });
    await overlay.fill('Hello');
    // TextEditorOverlay の仕様: Enter (Shift なし) で確定 → onConfirm が走り
    // annotation.text が更新される。
    await overlay.press('Enter');
    await expect
      .poll(async () => (await readAnnotations(page))[0]?.type, {
        timeout: 5_000,
      })
      .toBe('text');
    const annotations = await readAnnotations(page);
    expect((annotations[0] as { text?: string })?.text).toBe('Hello');
  });

  test('edit-text-cancel: 既存 text 編集モード中に Esc → 元の text 残存', async ({
    page,
  }, testInfo) => {
    skipNonMobileChrome(testInfo);
    await setupEditor(page);
    await selectTool(page, 'テキスト');
    await tapStage(page, { x: 100, y: 100 });
    // Phase 10.J-4: text を 'keep' で確定 → dbltap で再編集 → Esc で cancel →
    // 既存 text 'keep' は (空文字でないため) handleTextCancel で削除されず残存する。
    // 旧テストは「空文字 + Esc で残存」を assert していたが、handleTextCancel の実装
    // (空文字なら remove) と矛盾していた既存バグ。本 plan で実装に合わせて assertion を修正。
    await commitTextAnnotation(page, 'keep');
    const before = await readFirstAnnotation(page);
    if (!before || before.type !== 'text') throw new Error('text add 失敗');
    await selectTool(page, '選択');
    const center = await logicalToViewport(page, {
      x: (before.x ?? 0) + 8,
      y: (before.y ?? 0) + 8,
    });
    await dblTapViewport(page, center);
    const overlay = page.locator('textarea[aria-label="注釈テキストを編集"]');
    await expect(overlay).toBeVisible({ timeout: 3_000 });
    // 編集中の text はそのまま (keep)、Esc で再編集を cancel
    await page.keyboard.press('Escape');
    const arr = await readAnnotations(page);
    expect(arr.length).toBe(1);
    expect(arr[0]?.type).toBe('text');
    expect((arr[0] as { text?: string })?.text).toBe('keep');
  });
});
