# Plan: Phase 10.J-1 — paired binding 規約適用 + タイミング定数 SSOT

## Summary

snap-share の全 4 Shape (`RectangleShape` / `ArrowShape` / `HighlightShape` / `TextShape`) の Konva event handler に `onTap` を追加し、ADR-0007 D1 で確立した **paired event binding 規約 (`onClick + onTap` / `onDblClick + onDblTap`)** を全面適用する。同時に `apps/web/src/lib/touch-thresholds.ts` を新設し、`LONG_PRESS_DURATION_MS` / `DOUBLE_TAP_INTERVAL_MS` / `DRAG_SLOP_PX_FINE` / `DRAG_SLOP_PX_COARSE` / `DOUBLE_TAP_POSITION_THRESHOLD_PX` の 5 定数を業界標準値で SSOT 化する。`ArrowShape` の Circle handle (resize endpoint) には既存 `onPointerDown` に加えて `onTouchStart` を追加し、Phase 10.I-2 で導入した multi-touch (`onTouchMove`) 経路でも `cancelBubble` が確実に効くように補強する。本サブフェーズは「実機 iOS Safari でシングルタップ shape 選択が動かない」破綻の解消を中核とし、長押しコンテキストメニュー (10.J-2) / Transformer 再調整 (10.J-3) / E2E migration + 実機 QA (10.J-4) は対象外。

## User Story

As **a snap-share mobile user (iPhone Safari / Android Chrome)**, I want **既存の shape を指で 1 回タップして選択状態にできる**, so that **Transformer が出てリサイズできる / テキストならダブルタップで編集モードに進める / 削除や移動の起点にできる**.

## Problem → Solution

**Current state**: Phase 10.I で機能パリティ (描画 / 移動 / pinch zoom) は達成したが、全 4 Shape の `onClick` ハンドラ (`Rectangle:63 / Arrow:69 / Highlight:63 / Text:41`) が **mouse event 専用** で、touch では `onTap` が別経路で発火する Konva 公式規約 (Desktop_and_Mobile.mdx) に準拠していない。実機 iOS Safari でシングルタップしても shape 選択 dispatch が呼ばれず、Transformer が出ず、リサイズ / テキスト再編集 / コンテキスト操作 のすべてが起点を失う。さらに、長押し menu (10.J-2) / 双 tap 検知 / drag slop 等で必要なタイミング定数が未定義のため、10.J-2 以降の実装が定数の根拠なき決定を強いられる。

**Desired state**: 全 4 Shape で `onTap` が `onClick` と同じ body で配線され、touch でも mouse でも shape 選択 dispatch が同じコードパスで発火する。`apps/web/src/lib/touch-thresholds.ts` に Excalidraw / tldraw / iOS HIG / Android `ViewConfiguration` の業界標準値が SSOT として集約され、10.J-2 以降の `useLongPress` 等の実装が import 1 行で正しい数値を取得できる。`ArrowShape` Circle handle の `onPointerDown + onTouchStart` ペアにより、Stage の multi-touch (`onTouchMove`) 経路でも resize handle drag が pinch に奪われない。

## Metadata

- **Complexity**: Small (5-7 files、推定 100〜180 行の差分)
- **Source PRD**: `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md`
- **PRD Phase**: 10.J-1 (paired binding 規約適用 + タイミング定数 SSOT)
- **Estimated Files**: 7 (touch-thresholds.ts 新設 / 4 Shape 修正 / 4 Shape test 修正 / PRD 更新)
- **ADR Reference**: ADR-0007 D1 (paired binding) + D2 (タイミング定数 SSOT)

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | 63-67 | `onClick` 配線のパターン (`e.cancelBubble = true` + `onClick(annotation.id)`)。`onTap` も同じ body で配線する |
| **P0** | `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | 69-72, 91-94, 108-111 | shape 本体の `onClick` (line 69) + Circle handle 2 箇所の `onPointerDown` cancelBubble (line 91, 108)。Circle handle に `onTouchStart` を追加する |
| **P0** | `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | 63-67 | RectangleShape と同型 |
| **P0** | `apps/web/src/components/canvas/shapes/TextShape.tsx` | 41-58 | `onClick` (line 41) + `onDblClick` (line 45) + `onDblTap` (line 53) — `onDblTap` は post-review fix で追加済。`onTap` を追加 |
| **P0** | `docs/adr/ADR-0007-touch-ux-standards.md` | D1, D2 | 本 plan の規約根拠 (paired binding / タイミング定数) |
| **P1** | `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx` | 全体 | `vi.hoisted()` + `react-konva` mock パターン。`onClick` capture を確認しているなら `onTap` capture も同一 mock で並列に確認可 |
| **P1** | `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | 全体 | 同上、Circle handle 関連の assert があれば `onTouchStart` 追加に応じて拡張 |
| **P1** | `apps/web/src/components/canvas/__tests__/HighlightShape.test.tsx` | 全体 | 同上 |
| **P2** | `apps/web/src/components/canvas/colors.ts` | 全体 | Phase 10.I-2 で `HANDLE_RADIUS_TOUCH` / `ANCHOR_SIZE_TOUCH` / `HIT_STROKE_WIDTH_TOUCH` を追加済み。`touch-thresholds.ts` を colors.ts と並列の lib として新設する場所の参考 |
| **P2** | `apps/web/src/hooks/useTouchDevice.ts` | 全体 | 10.I-2 で導入。fine / coarse 切替の参照点。10.J-1 では使わないが、10.J-2 以降で `LONG_PRESS_DURATION_MS` を runtime 切替する場合に併用 |
| **P2** | ADR-0006 Status Update セクション | line 87-130 | 10.I-2 multi-touch 経路 (`onTouchMove`) と shape Circle handle の cancelBubble 関係 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Konva paired event binding | [Konva — Desktop_and_Mobile.mdx](https://konvajs.org/docs/events/Desktop_and_Mobile.html) | `click` / `dblclick` は **mouse 専用**、touch では `tap` / `dbltap` が別発火。**両方 bind が canonical** |
| Konva mobile events 詳細 | [Konva — Mobile_Events.mdx](https://konvajs.org/docs/events/Mobile_Events.html) | `tap` / `dbltap` / `touchstart` / `touchmove` / `touchend` の発火条件 |
| Excalidraw タイミング定数 | [Excalidraw constants.ts](https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts) | `TOUCH_CTX_MENU_TIMEOUT = 500` / `TAP_TWICE_TIMEOUT = 300` / `DOUBLE_TAP_POSITION_THRESHOLD = 35` |
| tldraw タイミング / サイズ定数 | [tldraw options.ts](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/options.ts) | `longPressDurationMs: 500` / `coarseDragDistanceSquared: 36` / `dragDistanceSquared: 16` / `coarseHandleRadius: 20` / `handleRadius: 12` |
| iOS UIKit long-press default | [Apple — UILongPressGestureRecognizer](https://developer.apple.com/documentation/uikit/uilongpressgesturerecognizer) | `minimumPressDuration` default = `0.5s` |
| Android long-press default | [Android — ViewConfiguration](https://developer.android.com/reference/android/view/ViewConfiguration) | `getLongPressTimeout()` = 500ms / `getDoubleTapTimeout()` = 300ms |

---

## Patterns to Mirror

### TOUCH_THRESHOLDS_SSOT (新規ファイル)

```ts
// SOURCE (NEW): apps/web/src/lib/touch-thresholds.ts
//
// 業界標準 (Excalidraw / tldraw / iOS HIG / Android ViewConfiguration) で収束した
// タイミング / 距離しきい値の SSOT。各定数の根拠は ADR-0007 D2 を参照。
// touch-action 関連 (touch-action: none) は CSS 側 (global.css)、サイズ関連
// (HANDLE_RADIUS_TOUCH 等) は colors.ts に既に集約済。

/** 長押し成立までの押下継続時間 (ms)。Excalidraw/tldraw/iOS UIKit/Android すべて 500ms で一致 */
export const LONG_PRESS_DURATION_MS = 500;

/** ダブルタップ判定の最大間隔 (ms)。Excalidraw `TAP_TWICE_TIMEOUT` / Android `getDoubleTapTimeout` */
export const DOUBLE_TAP_INTERVAL_MS = 300;

/** ダブルタップの 1 回目と 2 回目の最大距離 (px)。Excalidraw `DOUBLE_TAP_POSITION_THRESHOLD` */
export const DOUBLE_TAP_POSITION_THRESHOLD_PX = 35;

/** mouse / pen 入力での drag 開始しきい値 (px)。tldraw `dragDistanceSquared = 16` の sqrt */
export const DRAG_SLOP_PX_FINE = 4;

/** touch 入力での drag 開始しきい値 (px)。tldraw `coarseDragDistanceSquared = 36` の sqrt */
export const DRAG_SLOP_PX_COARSE = 6;
```

### PAIRED_BINDING_PATTERN (各 Shape)

```tsx
// SOURCE (BEFORE): apps/web/src/components/canvas/shapes/RectangleShape.tsx:63-67
<Group
  // ...
  onClick={(e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onClick(annotation.id);
  }}
/>

// AFTER (本 plan):
<Group
  // ...
  onClick={(e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onClick(annotation.id);
  }}
  onTap={(e: KonvaEventObject<TouchEvent>) => {
    // ADR-0007 D1: Konva の `click` は mouse 専用、touch では `tap` が別発火する。
    // body は onClick と同一で、shape 選択を touch 経路でも成立させる。
    e.cancelBubble = true;
    onClick(annotation.id);
  }}
/>
```

### TEXTSHAPE_PAIRED_BINDING (Text の dbl もペア確認)

```tsx
// SOURCE (BEFORE): apps/web/src/components/canvas/shapes/TextShape.tsx:41-58
// onClick: ✓ 既存
// onDblClick: ✓ 既存
// onDblTap: ✓ 既存 (post-review fix で追加済)
// onTap: ✗ 未配線

// AFTER:
<Text
  // ...
  onClick={(e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onClick(annotation.id);
  }}
  onTap={(e: KonvaEventObject<TouchEvent>) => {
    e.cancelBubble = true;
    onClick(annotation.id);
  }}
  onDblClick={(e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onDblClick?.(annotation.id);
  }}
  onDblTap={(e: KonvaEventObject<TouchEvent>) => {
    // 既存 (post-review fix) — body は onDblClick と同一
    e.cancelBubble = true;
    onDblClick?.(annotation.id);
  }}
/>
```

### ARROWSHAPE_HANDLE_PAIRED_BINDING (Circle handle の Pointer + Touch)

```tsx
// SOURCE (BEFORE): apps/web/src/components/canvas/shapes/ArrowShape.tsx:91-94, 108-111
<Circle
  draggable
  onPointerDown={(e: KonvaEventObject<PointerEvent>) => {
    // 親 Arrow の draggable に drag を奪わせない。
    e.cancelBubble = true;
  }}
  onDragEnd={(e) => { /* ... */ }}
/>

// AFTER (本 plan):
<Circle
  draggable
  onPointerDown={(e: KonvaEventObject<PointerEvent>) => {
    // 単一 pointer (mouse / pen / single-touch) の cancelBubble。
    e.cancelBubble = true;
  }}
  onTouchStart={(e: KonvaEventObject<TouchEvent>) => {
    // ADR-0007 D1 + ADR-0006 Status Update: Phase 10.I-2 で Stage に
    // `onTouchMove` (multi-touch pinch) を bind したため、touch event 経路でも
    // cancelBubble を効かせる必要がある。`onPointerDown` だけでは Konva の
    // touch event 経路 (`onTouchStart/Move/End`) には伝搬しない。
    e.cancelBubble = true;
  }}
  onDragEnd={(e) => { /* ... */ }}
/>
```

### TEST_PATTERN_PAIRED_BINDING (各 Shape test)

```ts
// SOURCE (PATTERN): apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx 既存 mock
// react-konva の Group / Rect / Circle / Arrow / Text を mock して props を capture する。
// 既に `onClick` を capture しているなら、`onTap` も同じ mock で同時に capture される。
//
// ADD ASSERTION:
test('paired binding: onClick と onTap が両方 bind されている', () => {
  const onClick = vi.fn();
  render(<RectangleShape annotation={mockAnnotation} onClick={onClick} {...otherProps} />);

  // capture は mock の vi.hoisted パターンで Group props 全部を取れる前提
  const groupProps = capture.groupProps[0];
  expect(typeof groupProps.onClick).toBe('function');
  expect(typeof groupProps.onTap).toBe('function');

  // onTap が onClick と同じ dispatch を呼ぶことを発火で確認
  const fakeEvent = { cancelBubble: false } as KonvaEventObject<TouchEvent>;
  groupProps.onTap(fakeEvent);
  expect(onClick).toHaveBeenCalledWith(mockAnnotation.id);
  expect(fakeEvent.cancelBubble).toBe(true);
});
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/lib/touch-thresholds.ts` | CREATE | タイミング定数 SSOT (ADR-0007 D2)、5 export 定数 |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | UPDATE | `onTap` を `onClick` と並列に追加 (line 63 周辺) |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | UPDATE | (1) shape 本体 `onTap` 追加 (line 69 周辺) (2) Circle handle 2 箇所に `onTouchStart` 追加 (line 91-94 / 108-111) |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | UPDATE | `onTap` を `onClick` と並列に追加 (line 63 周辺) |
| `apps/web/src/components/canvas/shapes/TextShape.tsx` | UPDATE | `onTap` を `onClick` と並列に追加 (line 41 周辺、`onDblTap` は既追加) |
| `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx` | UPDATE | paired binding assertion 追加 (`onTap` が `onClick` と同 dispatch) |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | UPDATE | (1) shape 本体の paired binding assertion (2) Circle handle の `onPointerDown + onTouchStart` 両方 bind assertion |
| `apps/web/src/components/canvas/__tests__/HighlightShape.test.tsx` | UPDATE | RectangleShape と同型の paired binding assertion |
| `apps/web/src/components/canvas/__tests__/TextShape.test.tsx` (もし存在) | UPDATE | `onTap` paired + `onDblTap` paired 両方の assertion |
| `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` | UPDATE | sub-phase 10.J-1 行の Status を `pending` → `in-progress` → `complete`、PRP Plan link 追加 |

## NOT Building

- **長押しコンテキストメニュー (`useLongPress` hook + `ContextMenu.tsx`)** — Phase 10.J-2 の対象。本 plan ではタイミング定数 (`LONG_PRESS_DURATION_MS`) を SSOT 化するのみで、消費は 10.J-2
- **Transformer の coarse anchor 24→20px 再調整** — Phase 10.J-3 の対象
- **E2E `dispatchEvent('touchstart')` 経路 migration / 既存 19 spec 書き直し** — Phase 10.J-4 の対象。本 plan では unit test の paired binding assertion のみ追加 (Playwright 拡張は最小限 / smoke 1 件のみオプション)
- **paired binding 強制の ESLint custom rule** — PRD Q1 で「unit test での hardcode assertion (本 plan で対応)」を採用、ESLint custom rule は Phase 11+ retainer
- **`Event.isTrusted` の参照箇所追加 / runtime チェック** — 本 plan の Task 6 で grep ゼロ件確認のみ (静的検証のみ)
- **`HANDLE_RADIUS_TOUCH` / `ANCHOR_SIZE_TOUCH` の 24→20 再調整** — Phase 10.J-3 の対象 (`colors.ts`)
- **`MIN_TAP_TARGET_PX = 44` / `HIT_TEST_MARGIN_PX = 8` の定数化** — Phase 10.J-3 の対象 (`colors.ts` か `touch-thresholds.ts` かは Plan で確定する)
- **`navigator.vibrate(15)`** — Phase 10.J-2 の long-press 成立時に追加 (本 plan では未使用)
- **既存 Pointer Events 一本化方針 (ADR-0006) の変更** — 本 plan は ADR-0006 を維持しつつ Shape 単位で paired binding を補強するのみ
- **TextShape 編集モードの新機能** — `onDblTap` は既追加、本 plan では `onTap` 配線のみ
- **PRP Plan の Mac spike / palm rejection / pen 最適化等** — PRD Won't 継承

---

## Step-by-Step Tasks

### Task 1: `touch-thresholds.ts` の SSOT 新設

- **ACTION**: `apps/web/src/lib/touch-thresholds.ts` を新規作成
- **IMPLEMENT**:
  ```ts
  // ADR-0007 D2: Touch UX タイミング定数の SSOT
  // 各定数の業界標準値の根拠は ADR-0007 を参照
  // (Excalidraw / tldraw / iOS UIKit / Android ViewConfiguration で収束)

  /** 長押し成立までの押下継続時間 (ms)。Excalidraw `TOUCH_CTX_MENU_TIMEOUT` /
   * tldraw `longPressDurationMs` / iOS UIKit `minimumPressDuration` (0.5s) /
   * Android `ViewConfiguration.getLongPressTimeout()` 全社一致 */
  export const LONG_PRESS_DURATION_MS = 500;

  /** ダブルタップ判定の最大間隔 (ms)。Excalidraw `TAP_TWICE_TIMEOUT` /
   * Android `getDoubleTapTimeout()` */
  export const DOUBLE_TAP_INTERVAL_MS = 300;

  /** ダブルタップの 1 回目と 2 回目の最大距離 (px)。
   * Excalidraw `DOUBLE_TAP_POSITION_THRESHOLD` */
  export const DOUBLE_TAP_POSITION_THRESHOLD_PX = 35;

  /** mouse / pen 入力での drag 開始しきい値 (px)。tldraw `dragDistanceSquared = 16` の sqrt */
  export const DRAG_SLOP_PX_FINE = 4;

  /** touch 入力での drag 開始しきい値 (px)。tldraw `coarseDragDistanceSquared = 36` の sqrt */
  export const DRAG_SLOP_PX_COARSE = 6;
  ```
- **MIRROR**: `apps/web/src/components/canvas/colors.ts` の export const 形式
- **IMPORTS**: なし
- **GOTCHA**:
  - 本 plan では消費されない (10.J-2 以降で import される)。CI で `pnpm typecheck` / `biome ci` 緑になるかのみ確認
  - `LONG_PRESS_DURATION` ではなく `LONG_PRESS_DURATION_MS` の suffix 必須 (定数の単位を identifier に込める project convention、`colors.ts` と一貫)
- **VALIDATE**:
  - `ls apps/web/src/lib/touch-thresholds.ts` でファイル存在
  - `pnpm -F @pitamark/web typecheck` でエラーなし
  - `pnpm -F @pitamark/web lint` で biome ci 緑
  - `grep -n "LONG_PRESS_DURATION_MS" apps/web/src/lib/touch-thresholds.ts` で 1 件以上

### Task 2: `RectangleShape.tsx` に `onTap` を追加

- **ACTION**: `apps/web/src/components/canvas/shapes/RectangleShape.tsx` の `onClick` (line 63 周辺) と並列に `onTap` を追加
- **IMPLEMENT**: `PAIRED_BINDING_PATTERN` (上記) を Rectangle に適用。body は `onClick` と完全に同一 (`e.cancelBubble = true; onClick(annotation.id);`)
- **MIRROR**: 既存 `onClick` の body
- **IMPORTS**: 必要なら `import type { KonvaEventObject } from 'konva/lib/Node';` を維持。`TouchEvent` は browser global のため別途 import 不要
- **GOTCHA**:
  - `onClick` と `onTap` の body を **完全に同一** にする (cancelBubble 含む)。lint で重複検知が出る場合は callback を抽出して 1 関数化してもよいが、本 plan ではインライン重複を許容 (4 Shape × 2 行で計 8 行、抽象化コスト > 重複コスト)
  - `e: KonvaEventObject<TouchEvent>` の型注釈を忘れない (`MouseEvent` ではない)
- **VALIDATE**:
  - `grep -n "onTap" apps/web/src/components/canvas/shapes/RectangleShape.tsx` で 1 件以上
  - `pnpm -F @pitamark/web typecheck` 緑

### Task 3: `HighlightShape.tsx` に `onTap` を追加

- **ACTION**: `apps/web/src/components/canvas/shapes/HighlightShape.tsx` の `onClick` (line 63 周辺) と並列に `onTap` を追加
- **IMPLEMENT**: Task 2 と同型 (RectangleShape と同パターン)
- **MIRROR**: Task 2 で書いた RectangleShape の `onTap` 配線
- **GOTCHA**: 同上
- **VALIDATE**:
  - `grep -n "onTap" apps/web/src/components/canvas/shapes/HighlightShape.tsx` で 1 件以上
  - `pnpm -F @pitamark/web typecheck` 緑

### Task 4: `TextShape.tsx` に `onTap` を追加

- **ACTION**: `apps/web/src/components/canvas/shapes/TextShape.tsx` の `onClick` (line 41 周辺) と並列に `onTap` を追加。`onDblTap` (line 53) は既存維持
- **IMPLEMENT**: `TEXTSHAPE_PAIRED_BINDING` (上記) のとおり、`onTap` を `onClick` 直後に配線
- **MIRROR**: 既存 `onDblTap` (line 53) のスタイル
- **GOTCHA**:
  - `onClick` と `onTap` の dispatch 先 (`onClick(annotation.id)`) は同一 props を呼ぶ。`onDblClick / onDblTap` は別 prop (`onDblClick` または対応する prop) を呼んでいる現状を維持
  - TextShape は `onDblTap` で edit モードに進入する仕様 (10.I post-review fix)。`onTap` は **選択のみ** で edit には進まないこと
- **VALIDATE**:
  - `grep -n "onTap\b" apps/web/src/components/canvas/shapes/TextShape.tsx` で 1 件以上 (既存 `onDblTap` は別 match)
  - `pnpm -F @pitamark/web typecheck` 緑

### Task 5: `ArrowShape.tsx` に `onTap` + Circle handle `onTouchStart` を追加

- **ACTION**: `apps/web/src/components/canvas/shapes/ArrowShape.tsx` で 2 箇所の修正:
  1. shape 本体 (`<Arrow>`) の `onClick` (line 69 周辺) と並列に `onTap` を追加
  2. Circle handle 2 箇所 (line 91-94 = from-handle / line 108-111 = to-handle) の既存 `onPointerDown` に並列で `onTouchStart` を追加 (cancelBubble 確保)
- **IMPLEMENT**:
  - 修正 1: Task 2-4 と同パターン (`onTap` を `onClick` 直後に追加)
  - 修正 2: `ARROWSHAPE_HANDLE_PAIRED_BINDING` (上記) のとおり、Circle handle 各々で `onTouchStart={(e: KonvaEventObject<TouchEvent>) => { e.cancelBubble = true; }}` を追加
- **MIRROR**: 修正 1 は Task 2、修正 2 は ADR-0006 Status Update + Phase 10.I-2 の `onTouchMove` 経路解説
- **IMPORTS**: 既存 `KonvaEventObject` 維持
- **GOTCHA**:
  - Circle handle の `onPointerDown` は **削除しない**。`onPointerDown` は単一 pointer (mouse / pen / single-touch) を、`onTouchStart` は Konva の touch event 経路 (Phase 10.I-2 で導入された multi-touch path) を、それぞれ別経路で cancelBubble するため両方必要 (ADR-0007 D1 例外注記の「shape 内部 paired binding」を Konva pointer + touch 並存環境に展開した解釈)
  - body はすべて `e.cancelBubble = true;` のみ (drag 親への伝搬抑止)
  - 2 箇所の Circle handle で完全に同一の handler 実装。callback 抽出はオーバーキルでコスト高
- **VALIDATE**:
  - `grep -n "onTap\b" apps/web/src/components/canvas/shapes/ArrowShape.tsx` で 1 件以上
  - `grep -n "onTouchStart" apps/web/src/components/canvas/shapes/ArrowShape.tsx` で **2 件** (Circle handle 2 つ)
  - `grep -n "onPointerDown" apps/web/src/components/canvas/shapes/ArrowShape.tsx` で **2 件** (削除されていないこと)
  - `pnpm -F @pitamark/web typecheck` 緑

### Task 6: `Event.isTrusted` の grep 確認 (sanity check)

- **ACTION**: `dispatchEvent('touchstart')` E2E 経路の前提として `Event.isTrusted` 参照箇所がゼロであることを確認
- **IMPLEMENT**:
  ```bash
  grep -rn "isTrusted" apps/web/src apps/api/src packages/shared/src
  ```
  期待: ゼロ件 (PRD Open Question Q5 と同一)。1 件でも出たら本 plan を一旦止め、Open Questions 行に列挙して 10.J-4 の dispatchEvent 経路 default 化と整合させる方針を再考
- **MIRROR**: ADR-0007 D5 / PRD Q5 の前提検証
- **IMPORTS**: なし
- **GOTCHA**:
  - PRD 起票時点で grep 確認済 (ゼロ件)。本 plan では再確認するだけ (人間の git 履歴 + コード変更で増える可能性に備える)
  - 1 件でも見つけたら、その箇所が runtime に実際に走るか / dead code かを判別する。dead code なら削除、live code なら 10.J-4 設計に bypass を組み込む
- **VALIDATE**:
  - `grep -rn "isTrusted" apps/web/src apps/api/src packages/shared/src` の出力ゼロ行
  - 本 task の VALIDATE 失敗時のみ Plan の Open Questions に escalate

### Task 7: 各 Shape unit test に paired binding assertion を追加

- **ACTION**: 4 Shape の test ファイルそれぞれで paired binding assertion を追加
- **IMPLEMENT**: `TEST_PATTERN_PAIRED_BINDING` (上記) を各 Shape に適用:
  - `RectangleShape.test.tsx`: `onClick` capture と `onTap` capture が両方関数 + `onTap` 発火で `onClick(id)` callback が呼ばれることを確認
  - `HighlightShape.test.tsx`: 同上
  - `TextShape.test.tsx` (存在する場合): `onClick + onTap` paired + `onDblClick + onDblTap` paired 両方
  - `ArrowShape.test.tsx`: shape 本体の `onClick + onTap` + Circle handle 2 つの `onPointerDown + onTouchStart` 両方 bind
- **MIRROR**: 既存 mock の vi.hoisted + react-konva pattern (`RectangleShape.test.tsx` 既存)。既存 `onClick` capture を確認している spec があれば、そのまま並列で `onTap` capture を確認
- **IMPORTS**: 変更最小限。`KonvaEventObject` 型注釈不要 (mock の callback signature は any 寄り)
- **GOTCHA**:
  - mock の capture は **rendered の毎回最後の props を取る** patten が標準。spec 内で `render(...)` 後に `capture.<groupOrText>Props[0]` で取得
  - `onTap(fakeEvent)` の発火後 `fakeEvent.cancelBubble === true` を必ず assert (パイプライン全体の伝搬抑止確認)
  - TextShape は `onDblTap` も既存 + `onTap` 新規でペア検証 (4 prop の bind 確認)
- **VALIDATE**:
  - `pnpm -F @pitamark/web test -- src/components/canvas/__tests__/RectangleShape.test.tsx` 緑
  - 同 ArrowShape.test.tsx / HighlightShape.test.tsx / TextShape.test.tsx 緑
  - 既存 spec が 1 件も red 化していないこと (`pnpm -F @pitamark/web test` 全体緑)

### Task 8: PRD の 10.J-1 行を更新

- **ACTION**: `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` の Implementation Phases テーブルで 10.J-1 行を更新
- **IMPLEMENT**:
  - Status 列: `pending` → `in-progress` (実装着手時) → `complete` (Task 1-7 + manual verify 完了時)
  - PRP Plan 列: `TBD` → `[plan](../plans/phase-10-j-1-paired-binding-and-touch-thresholds.plan.md)`
- **MIRROR**: Phase 10.I PRD の Implementation Phases テーブルでの complete 後の表記
- **IMPORTS**: なし (Markdown)
- **GOTCHA**: 10.J-2 / 10.J-3 / 10.J-4 行は触らない (まだ pending)
- **VALIDATE**:
  - `grep -n "10.J-1" .claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` で Status / Plan link が更新されている

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `RectangleShape.test.tsx` 既存全 spec | 既存 fireEvent パターン | 全緑 (regression なし) | No |
| `RectangleShape.test.tsx` paired binding spec (NEW) | mock の `onTap` capture を呼ぶ | `onClick(id)` props 呼び出し + `cancelBubble = true` | No |
| `HighlightShape.test.tsx` paired binding spec (NEW) | 同上 | 同上 | No |
| `TextShape.test.tsx` paired binding spec (NEW) | `onTap + onDblTap` 両 capture | 各々 `onClick(id)` / `onDblClick(id)` を呼ぶ | No |
| `ArrowShape.test.tsx` paired binding spec (NEW) | shape 本体 + Circle handle 2 つ全部の capture | 4 種 (`onClick / onTap / onPointerDown / onTouchStart`) すべて関数 | No |

### Edge Cases Checklist

- [ ] 既存 chromium E2E (Phase 10.I で 78 件) が全緑 (regression なし)
- [ ] mobile-chrome E2E (Phase 10.I で 22 件) が全緑 (regression なし)
- [ ] PC で shape を click → 選択状態 → Transformer 表示 (既存挙動維持)
- [ ] mobile-chrome (emulation) で shape を tap → 選択状態 (paired binding 効果)
- [ ] ArrowShape の Circle handle を mouse drag → 親 Arrow が移動しない (cancelBubble 既存挙動)
- [ ] ArrowShape の Circle handle を touch drag (emulation) → 親 Arrow が移動しない (`onTouchStart` cancelBubble の追加効果)
- [ ] (本 sub-phase の VALIDATE 範囲外、10.J-4 で実機 QA): iPhone Safari で shape を 1 回タップ → 選択状態 + Transformer 表示

---

## Validation Commands

### Static Analysis
```bash
pnpm typecheck
```
EXPECT: Zero type errors。`KonvaEventObject<TouchEvent>` 型が新規 4 箇所すべてで通る。

```bash
pnpm lint
```
EXPECT: Zero biome ci errors。trailing comma / quote style 違反なし。

### Unit Tests
```bash
pnpm -F @pitamark/web test -- src/components/canvas/__tests__
pnpm -F @pitamark/web test
```
EXPECT: 既存全 spec 緑 + paired binding 新 spec 緑。

### Full Test Suite
```bash
pnpm test
```
EXPECT: web / api / shared 全 workspace の vitest 緑。

### E2E (回帰のみ)
```bash
pnpm -F @pitamark/web test:e2e
```
EXPECT: chromium 78 件 + mobile-chrome 22 件 (Phase 10.I 時点) すべて緑。`page.mouse` 経由の既存 spec は本 sub-phase では migration せず (10.J-4 で実施)。

### Build
```bash
pnpm -F @pitamark/web build
```
EXPECT: success、bundle size の劇的増加なし (paired binding 追加は 16 行程度の差分のみ)。

### Manual Validation (PC)

- [ ] PC (Chrome) で `pnpm dev` 起動 → 画像投入 → 4 Shape 描画 + click 選択 + Transformer 表示 + リサイズが従来通り
- [ ] DevTools Mobile Emulation (Pixel 5) で shape tap → 選択状態 (paired binding の sanity)

> 実機 QA (iPhone Safari + Android Chrome) は **Phase 10.J-4** で実施。本 sub-phase では desktop / emulation 緑のみで成立。

---

## Acceptance Criteria

- [ ] Task 1 (`touch-thresholds.ts` 新設) 完了 + 5 定数 export
- [ ] Task 2 (RectangleShape `onTap`) 完了 + grep `onTap` で 1 件以上
- [ ] Task 3 (HighlightShape `onTap`) 完了 + grep `onTap` で 1 件以上
- [ ] Task 4 (TextShape `onTap`) 完了 + grep で `onTap` / `onDblTap` 両方 bind 確認
- [ ] Task 5 (ArrowShape `onTap` + Circle handle `onTouchStart`) 完了 + grep `onTouchStart` で 2 件、`onPointerDown` で 2 件 (削除されていない)
- [ ] Task 6 (Event.isTrusted grep) 完了 + ゼロ件確認
- [ ] Task 7 (paired binding unit test assertion) 完了 + 4 Shape test 全緑
- [ ] Task 8 (PRD 10.J-1 行更新) 完了
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e` すべて緑
- [ ] PC chromium project で既存 e2e spec が全緑 (非劣化)
- [ ] mobile-chrome project で既存 e2e spec が全緑 (回帰なし)

## Completion Checklist

- [ ] Code follows discovered patterns (Patterns to Mirror セクション準拠)
- [ ] Error handling matches codebase style (本 sub-phase は handler 内 cancelBubble + callback の単純委譲のみで不変)
- [ ] Logging follows codebase conventions (新規 console 系コード追加なし)
- [ ] Tests follow test patterns (vi.hoisted + react-konva mock、既存 capture 拡張)
- [ ] No hardcoded values (タイミング定数は SSOT、サイズ定数は 10.J-3 で別途)
- [ ] Documentation updated (PRD 10.J-1 行 + ADR-0007 はすでに先行 commit 済)
- [ ] No unnecessary scope additions (NOT Building セクション準拠)
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `onClick + onTap` の二重発火 (PC で touch screen ある場合に mouse + touch 両方発火) | Low | Medium | Konva は内部で同 hit に対する mouse / touch を coordinate する。実機で観察 → 二重発火していたら handler 内で `e.evt.pointerType` または timestamp で dedupe |
| TextShape の `onTap` で edit モードに進んでしまう (`onDblTap` と混線) | Low | High | `onTap` body は `onClick(annotation.id)` のみ呼ぶ (= 選択 dispatch のみ)。`onDblTap` は `onDblClick(annotation.id)` を呼ぶ別 dispatch なので混線しない |
| Circle handle の `onTouchStart` 追加で既存 `onPointerDown` の cancelBubble が打ち消される | Low | Medium | Konva は両 handler を独立に走らせる (互いに干渉しない)。両方で `cancelBubble = true` を set するだけなので idempotent |
| paired binding unit test が既存 mock の capture pattern と合わない | Medium | Low | 既存 `RectangleShape.test.tsx` の `vi.hoisted()` を読み、capture key (例: `groupProps`) を確認。新 prop も同 capture に含まれる前提 |
| `touch-thresholds.ts` の 5 定数の値が将来の field data で不適切と判明 | Low | Low | ADR-0007 D2 に「業界標準値で当初固定、field data で調整」と明記済。本 plan では値の調整はしない |
| `Event.isTrusted` 参照が PR 中に増える | Low | Low | Task 6 で grep ゼロ件確認、CI に grep check の hook 追加は本 plan のスコープ外 (10.J-4 で検討) |
| 本 plan で touch UX が向上しないように見える (実機 QA は 10.J-4) | Medium | Low | 本 plan は「shape 選択が動く」基盤の提供。長押し menu / Transformer 再調整は別 sub-phase で完成させる旨を PRD で明示済 |

## Notes

### `onClick` の `KonvaEventObject<MouseEvent>` 型と `onTap` の `KonvaEventObject<TouchEvent>` 型

Konva の `onClick` は `MouseEvent` を、`onTap` は `TouchEvent` をそれぞれ wrap する。React-Konva 経由でも型は維持される。両 handler を `<Group>` に配線する際、TS 型は別々に注釈する必要 (snip-share の `verbatimModuleSyntax` 設定下では型を厳格にチェック)。

### Phase 10.J-1 が独立 PR を作らない理由

ECC PRP 規約 (memory: feedback_branch_per_phase) で「PRD 単位で 1 ブランチ 1 PR」のため、10.J-1 / 10.J-2 / 10.J-3 / 10.J-4 はすべて同一ブランチ `phase-10-j-touch-ux-standards` (本 plan 着手時すでに作成済 / commit `0f1de88` で PRD + ADR-0007 起票済) で進める。コミット粒度のみ sub-phase で区切る。本 plan の 8 タスクで 1〜2 コミット程度を想定 (touch-thresholds + 4 Shape / unit test + PRD 更新)。

### 後続 sub-phase への引き継ぎ事項

- 10.J-2 (long-press menu): 本 plan で確立した `LONG_PRESS_DURATION_MS` / `DRAG_SLOP_PX_COARSE` を `useLongPress` hook で import。`useTouchDevice` (10.I-2) と組み合わせて fine / coarse runtime 切替
- 10.J-3 (Transformer 再調整): 本 plan の `touch-thresholds.ts` には**入れない** (サイズ定数は `colors.ts` に集約。`MIN_TAP_TARGET_PX` / `HIT_TEST_MARGIN_PX` を `colors.ts` か `touch-thresholds.ts` のどちらに置くかは 10.J-3 Plan 起票時に再確定)
- 10.J-4 (E2E migration + 実機 QA): 本 plan で paired binding を確立済なので、`dispatchEvent('touchstart')` 経路の新規 spec は shape 選択 sanity を直接 assert できる
