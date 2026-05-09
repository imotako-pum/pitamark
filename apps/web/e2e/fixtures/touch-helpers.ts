// Phase 10.I-4: 12 ケース受入 spec が共通利用する helper 群。
// Phase 10.J-4 で本物 touch event 経路 (`dispatchTouchEvent` / `touchSequence`) を導入し、
// `tapStage` / `dragOnStage` を内部で touch 経路に書き換え (signature 不変)。
// これにより既存 19 spec が無編集で paired binding (`onTap`) / `onTouchStart` を CI で踏む。
//
// dropImage と並列に置く想定で、test 側からは `import { dragOnStage, ... } from './fixtures/touch-helpers';`。

import { expect, type Page } from '@playwright/test';
import { dropImage } from './upload';

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

/** viewport 座標 (x, y) で本物の Pointer + Touch event を pair で発火する (Phase 10.J-4 ADR-0007 D5)。
 * Chromium の `hasTouch:true` context (mobile-chrome project) で有効。
 *
 * **Pointer + Touch 両方** 発火が必須:
 * - Stage の描画 handler (`onPointerDown/Move/Up`) は Pointer Events 一本化 (ADR-0006) で PointerEvent を聞く
 * - Shape の paired binding (`onTap` / `onTouchStart`) は TouchEvent を聞く
 * - 実機 / DevTools emulation では 1 回の touch で **両方の event が連続発火** する (W3C Pointer Events 仕様)
 * - 単独 dispatch では片方のハンドラしか踏めない (旧実装の `page.mouse.*` は MouseEvent のみ → 描画は動くが `onTap` 未通過)
 *
 * 制約: `Event.isTrusted = false` だが、本 repo は `isTrusted` を参照しない (Phase 10.J-1 で grep ゼロ件確認済)。 */
export const dispatchTouchEvent = async (
  page: Page,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  x: number,
  y: number,
  identifier = 0,
) => {
  // 対応する Pointer Event を先に発火 (W3C 仕様の発火順)。
  const pointerType =
    type === 'touchstart'
      ? 'pointerdown'
      : type === 'touchmove'
        ? 'pointermove'
        : type === 'touchcancel'
          ? 'pointercancel'
          : 'pointerup';
  await page.evaluate(
    ({ touchType, pointerType, x, y, identifier }) => {
      const target = (document.elementFromPoint(x, y) ?? document.documentElement) as Element;
      // 1) PointerEvent 発火 (Stage `onPointerDown/Move/Up/Cancel` 経路用)
      const pointerEvent = new PointerEvent(pointerType, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        pointerType: 'touch',
        pointerId: identifier + 1,
        isPrimary: true,
        button: pointerType === 'pointerdown' || pointerType === 'pointerup' ? 0 : -1,
        buttons: pointerType === 'pointerdown' || pointerType === 'pointermove' ? 1 : 0,
      });
      target.dispatchEvent(pointerEvent);
      // 2) TouchEvent 発火 (Shape `onTap` / `onTouchStart` 経路用)
      const touch = new Touch({
        identifier,
        target,
        clientX: x,
        clientY: y,
        pageX: x,
        pageY: y,
        screenX: x,
        screenY: y,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        force: 1,
      });
      const isEnd = touchType === 'touchend' || touchType === 'touchcancel';
      const touchEvent = new TouchEvent(touchType, {
        bubbles: true,
        cancelable: true,
        composed: true,
        touches: isEnd ? [] : [touch],
        targetTouches: isEnd ? [] : [touch],
        changedTouches: [touch],
      });
      target.dispatchEvent(touchEvent);
    },
    { touchType: type, pointerType, x, y, identifier },
  );
};

export type TouchSequenceStep =
  | { action: 'down' | 'move'; x: number; y: number }
  | { action: 'up' }
  | { action: 'wait'; ms: number };

/** [{action, x, y, ms}] のシーケンスを本物 touch event で発火する。
 * - down: touchstart at (x, y)
 * - move: touchmove at (x, y) — 連続 move の中間点を生成する用途
 * - up: touchend at (前回の x, y) — 内部 last position を保持
 * - wait: ms 待つ (long-press の検証用、useLongPress 500ms 超過に使う) */
export const touchSequence = async (page: Page, steps: ReadonlyArray<TouchSequenceStep>) => {
  let lastX = 0;
  let lastY = 0;
  for (const s of steps) {
    if (s.action === 'down') {
      lastX = s.x;
      lastY = s.y;
      await dispatchTouchEvent(page, 'touchstart', s.x, s.y);
    } else if (s.action === 'move') {
      lastX = s.x;
      lastY = s.y;
      await dispatchTouchEvent(page, 'touchmove', s.x, s.y);
    } else if (s.action === 'up') {
      await dispatchTouchEvent(page, 'touchend', lastX, lastY);
    } else if (s.action === 'wait') {
      await page.waitForTimeout(s.ms);
    }
  }
};

/** 矩形 / 矢印 / ハイライト 共通: Stage 上を 1 本指 drag する。
 *  Phase 10.J-4: 内部を `touchSequence` に書き換え、本物の `touchstart`/`touchmove`/`touchend` を発火する
 *  (旧実装は `page.mouse.move/down/up` で MouseEvent のみ発火)。中間 5 点を生成して draft 描画パスを正確に再現。 */
export const dragOnStage = async (
  page: Page,
  startOffset: { x: number; y: number },
  endOffset: { x: number; y: number },
) => {
  const box = await getStageBox(page);
  const sx = box.x + startOffset.x;
  const sy = box.y + startOffset.y;
  const ex = box.x + endOffset.x;
  const ey = box.y + endOffset.y;
  const mid = (i: number): { x: number; y: number } => ({
    x: sx + ((ex - sx) * i) / 5,
    y: sy + ((ey - sy) * i) / 5,
  });
  await touchSequence(page, [
    { action: 'down', x: sx, y: sy },
    { action: 'move', ...mid(1) },
    { action: 'move', ...mid(2) },
    { action: 'move', ...mid(3) },
    { action: 'move', ...mid(4) },
    { action: 'move', x: ex, y: ey },
    { action: 'up' },
  ]);
};

/** テキスト追加 + select 系の単発 tap: Stage の指定座標を down → up する。
 *  Phase 10.J-4: 本物の `touchstart` → `touchend` で発火し、Konva の `tap` / `onTap` 経路を踏む。 */
export const tapStage = async (page: Page, offset: { x: number; y: number }) => {
  const box = await getStageBox(page);
  await touchSequence(page, [
    { action: 'down', x: box.x + offset.x, y: box.y + offset.y },
    { action: 'up' },
  ]);
};

/** viewport 座標 (= box.x + screen) で touch drag (Phase 10.J-4 で新設)。
 *  Transformer anchor / endpoint Circle のように logical → screen → viewport 変換が
 *  既に済んでいる経路で使う。中間 5 点で Konva の draft 描画を正確に再現。
 *  `dragOnStage` が「Stage 内 offset 起点 + box 加算」なのに対し、本 helper は viewport 直で受ける。 */
export const dragViewport = async (
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
) => {
  const mid = (i: number): { x: number; y: number } => ({
    x: start.x + ((end.x - start.x) * i) / 5,
    y: start.y + ((end.y - start.y) * i) / 5,
  });
  await touchSequence(page, [
    { action: 'down', x: start.x, y: start.y },
    { action: 'move', ...mid(1) },
    { action: 'move', ...mid(2) },
    { action: 'move', ...mid(3) },
    { action: 'move', ...mid(4) },
    { action: 'move', x: end.x, y: end.y },
    { action: 'up' },
  ]);
};

/** viewport 座標で 2 連続 tap (dbltap)。Konva の `dbltap` 検出仕様 (300ms 以内 + 同位置) に従う。
 *  Phase 10.J-4: TextShape の `onDblTap` 編集モード進入を CI で踏むために必要。 */
export const dblTapViewport = async (page: Page, point: { x: number; y: number }) => {
  await touchSequence(page, [
    { action: 'down', x: point.x, y: point.y },
    { action: 'up' },
    { action: 'wait', ms: 50 },
    { action: 'down', x: point.x, y: point.y },
    { action: 'up' },
  ]);
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

/** Phase 10.J-4: text 配置後の TextEditorOverlay にテキストを入力して Enter で確定する helper。
 * 旧 `page.mouse` 経路では textarea が正しく focus されず空文字 Esc で annotation が
 * 偶然残っていたが、本物 touch event 経路では textarea が focus → 空文字 Esc / Enter は
 * `handleTextCancel` / `handleTextCommit` で annotation を remove する正しい実装に当たる。
 * テスト後段で text annotation が必要な場合は本 helper で non-empty content を入れて commit する。 */
export const commitTextAnnotation = async (page: Page, text: string) => {
  const overlay = page.locator('textarea[aria-label="注釈テキストを編集"]');
  await overlay.waitFor({ state: 'visible', timeout: 3_000 });
  await overlay.fill(text);
  await overlay.press('Enter');
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

/** 共通の editor setup: home → dropImage → /r/<id> redirect 待ち → annotations ready 待ち。
 *  Phase 10.J-4: `touch-acceptance.spec.ts` / `touch-acceptance-edit.spec.ts` で重複していた
 *  ローカル定義を helper に集約。 */
export const setupEditor = async (page: Page) => {
  await page.goto('/');
  await dropImage(page);
  // 12+ ケース並列実行で webServer の API negotiation が遅延すると default 10s では
  // flaky になるため 20s に拡張。ローカル単発実行では 1-2s で通る。
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 20_000 });
  await waitForAnnotationsReady(page);
};
