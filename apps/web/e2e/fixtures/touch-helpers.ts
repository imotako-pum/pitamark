// Phase 10.I-4: 12 ケース受入 spec が共通利用する helper 群。10.I-1 / 10.I-2 / 10.I-3 の
// touch smoke 3 件で確立した page.mouse + page.tap + ANNOTATIONS_KEY 経路を集約する。
// dropImage と並列に置く想定で、test 側からは `import { dragOnStage, ... } from './fixtures/touch-helpers';`。

import type { Page } from '@playwright/test';

export const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

/** annotation に共通する位置情報の最小型。type 別に shape が異なるため optional で
 *  受ける (rectangle/highlight: x/y、arrow: from/to、text: x/y)。 */
export type AcceptanceAnnotation = Readonly<{
  id: string;
  type: 'rectangle' | 'arrow' | 'text' | 'highlight';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
}>;

/** Stage canvas の bounding box を取得。失敗時は明示的に投げて test のフレーキネスを抑える。 */
export const getStageBox = async (page: Page) => {
  const stage = page.locator('.konvajs-content canvas').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('Konva canvas bounding box が取得できなかった');
  return box;
};

/** 矩形 / 矢印 / ハイライト 共通: Stage 上を 1 本指 drag する。
 *  startOffset / endOffset は box 左上基準の座標。Konva の draft 描画が中間点で
 *  発火する必要があるため `steps: 5` で 中間 mouse move を生成する (既存 e2e と同値)。 */
export const dragOnStage = async (
  page: Page,
  startOffset: { x: number; y: number },
  endOffset: { x: number; y: number },
) => {
  const box = await getStageBox(page);
  await page.mouse.move(box.x + startOffset.x, box.y + startOffset.y);
  await page.mouse.down();
  await page.mouse.move(box.x + endOffset.x, box.y + endOffset.y, { steps: 5 });
  await page.mouse.up();
};

/** テキスト追加 + select 系の単発 tap: Stage の指定座標を down→up する。
 *  `page.tap` は要素中心で発火するため、canvas の任意座標を狙うときは mouse 経路を使う。 */
export const tapStage = async (page: Page, offset: { x: number; y: number }) => {
  const box = await getStageBox(page);
  await page.mouse.move(box.x + offset.x, box.y + offset.y);
  await page.mouse.down();
  await page.mouse.up();
};

/** annotation 配列を window 経由で取得。実装側 (`useAnnotationsStore`) が
 *  `useEffect` で `window[ANNOTATIONS_KEY]` を最新 array に同期する既存規約を流用。
 *  本 helper は型注釈で position 情報を取り出しやすくしている。 */
export const readAnnotations = (page: Page) =>
  page.evaluate(
    (k) =>
      ((window as unknown as Record<string, ReadonlyArray<unknown>>)[k] ?? []) as ReadonlyArray<{
        id: string;
        type: 'rectangle' | 'arrow' | 'text' | 'highlight';
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        from?: { x: number; y: number };
        to?: { x: number; y: number };
      }>,
    ANNOTATIONS_KEY,
  ) as Promise<ReadonlyArray<AcceptanceAnnotation>>;

/** 1 件目の annotation を取得 (本受入 spec の構造上、各 it は 1 形状のみ追加する)。 */
export const readFirstAnnotation = async (page: Page) => {
  const arr = await readAnnotations(page);
  return arr[0] ?? null;
};

/** ツール選択 (i18n aria-label 経由)。**mobile-chrome project 専用** — `tap()` は
 *  hasTouch:true の context でのみ動作する。desktop project から呼ぶと AssertionError
 *  になるので、本 helper を使う test は冒頭に `skipNonMobileChrome` 等の guard を
 *  必ず置くこと。Toolbar が touch 環境で bottom 固定でも desktop で header 内でも、
 *  aria-label さえ一致すれば同じ呼び出しで触れる (配置に依存しない設計)。 */
export const selectTool = async (page: Page, label: string) => {
  await page.getByRole('button', { name: label }).tap();
};

/** select ツールに切替 → Stage 上の指定座標 tap で shape を選択 → 「削除」ボタン tap で
 *  削除する一連の流れ。各形状の Add → Delete テストで使う。 */
export const tapShapeAndDelete = async (page: Page, shapeOffset: { x: number; y: number }) => {
  await selectTool(page, '選択');
  await tapStage(page, shapeOffset);
  // exact: true で「削除」と「注釈をすべて削除」が部分一致するのを防ぐ。
  await page.getByRole('button', { name: '削除', exact: true }).tap();
};

/** drop 後に annotations 配列が window に出るのを待つヘルパ。drop 直後は
 *  React effect の commit を待たないと配列が undefined のまま evaluate が返る。 */
export const waitForAnnotationsReady = async (page: Page) => {
  await page.waitForFunction(
    (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
    ANNOTATIONS_KEY,
    { timeout: 10_000 },
  );
};
