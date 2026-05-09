# Plan: Phase 10.I-1 — Pointer Events 一本化 + 描画系復旧

## Summary

`apps/web/src/components/canvas/CanvasStage.tsx` および `ArrowShape.tsx` の event handler を `onMouseDown/Move/Up/Leave` から `onPointerDown/Move/Up/Cancel` に置換し、Stage container に `touch-action: none` を当てる。これにより iPhone Safari / Android Chrome で破綻している矩形・矢印・ハイライト描画と既存図形の指ドラッグ移動を復旧する。並行して ADR-0006 (Pointer Events 一本化) を起票し、`Konva.captureTouchEventsEnabled` 等の global 設定方針を文書化する。本サブフェーズは描画系の復旧のみが対象で、2-finger pinch (10.I-2) / Toolbar bottom 化 (10.I-3) / 受入測定 (10.I-4) は対象外。

## User Story

As **a snap-share mobile user (iPhone Safari / Android Chrome)**, I want **矩形・矢印・ハイライト・テキストを指でドラッグして描画 + 既存図形を指で移動できる**, so that **PC を開かずにスマホ単体でアノテーション共有を完結できる**.

## Problem → Solution

**Current state**: スマホで `<Stage>` をタップしても `handleMouseDown` が発火するが、`mousemove` は touch 環境で発火しないため drag 系描画 (= 矩形/矢印/ハイライト) が成立しない。テキストだけが `<Group draggable>` の click 一発確定で例外的に動作。

**Desired state**: `<Stage>` が `onPointerDown/Move/Up/Cancel` を受け、iOS Safari / Android Chrome の touch event が pointer event として単一経路で流れる。`touch-action: none` で browser native gesture (pan / pinch / double-tap zoom) との衝突を抑止。すべての描画系が touch でも desktop と同じコードパスで動作する。

## Metadata

- **Complexity**: Medium (3-7 files、推定 200〜350 行の差分)
- **Source PRD**: `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md`
- **PRD Phase**: 10.I-1 (Pointer Events 一本化 + 描画系復旧)
- **Estimated Files**: 7 (CanvasStage.tsx / ArrowShape.tsx / global.css / 2 test files / ADR-0006 / PRD 更新)

---

## UX Design

### Before

```
┌───────────────────────────────┐
│ [iPhone Safari]               │
│  ┌─────────────────────────┐  │
│  │ Toolbar: [□][→][T][▥]   │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │ 画像 (背景)              │  │
│  │  指でドラッグ → ✗描けない│  │
│  │  既存矩形に touch → ✗   │  │
│  │  テキスト配置 → ✓のみ    │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
                                ↑
                        破綻状態 (PRD で確認)
```

### After

```
┌───────────────────────────────┐
│ [iPhone Safari]               │
│  ┌─────────────────────────┐  │
│  │ Toolbar (位置は 10.I-3) │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │ 画像 (背景)              │  │
│  │  指で 1 本指ドラッグ      │  │
│  │   → ✓矩形/矢印/ハイライト│  │
│  │  既存図形の上 1 本指 drag│  │
│  │   → ✓移動                │  │
│  │  テキスト → ✓ (既存)     │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
                                ↑
                  PC 同等の描画・移動 (パリティ復旧)
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 1 本指 drag (描画ツール選択時) | 何も起きない | 矩形/矢印/ハイライトを描画 | `pointerType: 'touch'` 含む全 pointerType で動作 |
| 1 本指 drag (select ツール) | 何も起きない | 既存図形を移動 | shape 側 `draggable` は元から touch サポート、Stage 経路のみ修正 |
| マウス drag (PC) | 動作 | 動作 (非劣化) | mouse event は内部で pointer に集約、prop は `onPointerDown` 経由で発火 |
| 2 本指 / pinch | OS 標準 (画面 zoom) | **OS 動作を抑止** (`touch-action: none`)、ただし pinch zoom の独自実装は **10.I-2 対象** | 10.I-1 完了時点では「2 本指は無反応」が正しい状態 |
| 長押し (textselection / コンテキスト) | OS 標準 | OS 動作を抑止 (`touch-action: none`) | snap-share では長押しを使わない方針 (PRD Won't) |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | `apps/web/src/components/canvas/CanvasStage.tsx` | 198-272 | `handleMouseDown` 全体。pan branch / select / draft start / pendingAutoArrow 確定の分岐を保ったまま prop name を変える |
| **P0** | `apps/web/src/components/canvas/CanvasStage.tsx` | 274-309 | `handleMouseMove`。pan の delta 計算 + draft 更新 + presence 座標 broadcast |
| **P0** | `apps/web/src/components/canvas/CanvasStage.tsx` | 311-396 | `handleMouseLeave` (311-315) + `handleMouseUp` (317-396)。Auto-next-A/B の確定シーケンス |
| **P0** | `apps/web/src/components/canvas/CanvasStage.tsx` | 488-501 | `<Stage>` JSX prop の差し替え対象 |
| **P0** | `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | 80-104 | endpoint handle (Circle) の `onMouseDown` (`e.cancelBubble = true`) — 親 Arrow の drag を抑止する箇所が 2 箇所ある |
| **P1** | `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx` | 全体 (~165 行) | `vi.hoisted()` + `react-konva` mock pattern。新規 test を書く際にコピーする骨組み |
| **P1** | `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | 99-138 | `onDragEnd` / `onMouseDown` 検証ロジック — `onMouseDown` → `onPointerDown` 書き換えと同期する |
| **P2** | `apps/web/src/styles/global.css` | 全体 | Tailwind v4 + tokens import の構成把握。`touch-action: none` を末尾追加する場所 |
| **P2** | `apps/web/src/main.tsx` | 1-15 | Konva global 設定の追加場所 (現状なし。`Konva.captureTouchEventsEnabled` を真にする選択を行うならここ) |
| **P2** | `apps/web/playwright.config.ts` | 34-37 | `mobile-chrome` (Pixel 5) project 既存。10.I-1 では Playwright 拡張は最小限 (smoke 1 spec) |
| **P2** | `docs/adr/ADR-0001-orpc-for-room-crud.md` | 全体 | ADR テンプレートの実例。ADR-0006 起票時に踏襲 |
| **P2** | `apps/web/vite.config.ts` | 74-90 | vitest 設定 (happy-dom, globals: false, coverage v8)。テスト追加時の前提知識 |
| **P2** | `tsconfig.base.json` | 全体 | `noUncheckedIndexedAccess` / `verbatimModuleSyntax` 確認。`import type { KonvaEventObject } from 'konva/lib/Node';` の type-only import 必須 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| react-konva の event prop マッピング | [react-konva `src/makeUpdates.ts`](https://github.com/konvajs/react-konva/blob/master/src/makeUpdates.ts) | `on` プレフィックスを除いた lowercase 名で `instance.on()` に登録される。`onPointerDown` → `pointerdown`、追加実装不要 |
| Konva の Pointer Events 既定 | [Konva `src/Global.ts` L48,82](https://github.com/konvajs/konva/blob/master/src/Global.ts) | `Konva.pointerEventsEnabled = true` (default) / `Konva.captureTouchEventsEnabled = false` (default) |
| Stage の pointer position API | [Konva `src/Stage.ts` L295,309,842](https://github.com/konvajs/konva/blob/master/src/Stage.ts) | `getPointerPosition()` は最初の 1 ポインタのみ。multi-touch は `getPointersPositions()` (10.I-2 で使う) |
| `KonvaEventObject<PointerEvent>` 型 | [Konva `src/Node.ts` L208-215](https://github.com/konvajs/konva/blob/master/src/Node.ts) | `e.evt.pointerId` / `e.evt.pointerType` / `e.evt.isPrimary` がトップレベルで読める |
| `touch-action` 仕様 | [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action) | iOS Safari は browser gesture 介入時に `pointercancel` を発火し `pointermove` を停止。`touch-action: none` で抑止 |
| jsdom の PointerEvent 制限 | [dom-testing-library #1291](https://github.com/testing-library/dom-testing-library/issues/1291), [#558](https://github.com/testing-library/dom-testing-library/issues/558) | `fireEvent.pointerDown(el, { clientX, pointerType })` は座標 / pointerType を落とす。**unit test は `fireEvent.mouseDown` を維持**。Konva 内部で mouse → 共通 `_pointerdown` ハンドラに合流するため `onPointerDown` prop は呼ばれる |
| 2-finger pinch ベスト | [Konva Multi-touch Scale Stage](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html), [Excalidraw `App.tsx`](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx) | 10.I-1 では実装しない (10.I-2 対象)。但し `pointerId` Map 管理が必要であることだけ把握しておく |

---

## Patterns to Mirror

### TYPE_IMPORT_PATTERN
```ts
// SOURCE: apps/web/src/components/canvas/CanvasStage.tsx:1-10 (推定)
// SOURCE: apps/web/src/components/canvas/shapes/ArrowShape.tsx:1-10 (推定)
import type { KonvaEventObject } from 'konva/lib/Node';
```

### EVENT_HANDLER_NAMING (Before → After)
```ts
// SOURCE (BEFORE): apps/web/src/components/canvas/CanvasStage.tsx:198-272
const handleMouseDown = useCallback(
  (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    // ...
  },
  [/* deps */],
);

// AFTER (本 plan):
const handlePointerDown = useCallback(
  (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    // body は完全に同じ (内部 API 変更なし)
  },
  [/* deps */],
);
```

### STAGE_PROPS_REWIRING
```tsx
// SOURCE (BEFORE): apps/web/src/components/canvas/CanvasStage.tsx:488-501
<Stage
  ref={composedStageRef}
  width={width}
  height={height}
  scaleX={transform.scale}
  scaleY={transform.scale}
  x={transform.x}
  y={transform.y}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onMouseLeave={handleMouseLeave}
  onWheel={handleWheel}
>

// AFTER:
<Stage
  ref={composedStageRef}
  width={width}
  height={height}
  scaleX={transform.scale}
  scaleY={transform.scale}
  x={transform.x}
  y={transform.y}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onPointerCancel={handlePointerCancel}  // 新規ハンドラ (handlePointerUp と等価)
  onPointerLeave={handlePointerLeave}
  onWheel={handleWheel}
>
```

### CANCEL_BUBBLE_IN_HANDLE
```tsx
// SOURCE (BEFORE): apps/web/src/components/canvas/shapes/ArrowShape.tsx:80-88
<Circle
  draggable
  onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
  }}
  onDragEnd={(e) => { /* ... */ }}
/>

// AFTER:
<Circle
  draggable
  onPointerDown={(e: KonvaEventObject<PointerEvent>) => {
    e.cancelBubble = true;
  }}
  onDragEnd={(e) => { /* ... */ }}
/>
```

### POINTER_POSITION_API_UNCHANGED
```ts
// SOURCE: apps/web/src/components/canvas/CanvasStage.tsx:206 / 232 / 281 / 289
// 変更不要 — touch でも mouse でも pen でも getPointerPosition / getRelativePointerPosition は動く
const pos = stage.getPointerPosition();           // screen 座標 (pan delta 計算用)
const logical = stage.getRelativePointerPosition(); // logical 座標 (描画 / hit-test 用)
```

### TEST_PATTERN_PRESERVED (mouse event を維持)
```ts
// SOURCE: apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx:23-50, 146-156
// 既存 vi.hoisted + react-konva mock を維持。fireEvent は mouseDown のまま
//
// RATIONALE: jsdom の PointerEvent コンストラクタは clientX / pointerType を初期化オプションから
// 落とす既知バグ (dom-testing-library#1291)。`fireEvent.pointerDown(el, { clientX: 10 })` しても
// ハンドラ側で座標が読めない。Konva 内部で mouse event は `_pointerdown` 共通ハンドラに合流する
// ので、`onPointerDown` prop は mouseDown でも発火する。ゆえにテストは mouseDown / mouseMove /
// mouseUp で書き、touch / pen 固有の挙動は Playwright (10.I-4) に寄せる。
const onTransformEnd = capture.rectProps[0]?.onTransformEnd as () => void;
act(() => {
  onTransformEnd();
});
```

### CSS_TOUCH_ACTION
```css
/* SOURCE (NEW): apps/web/src/styles/global.css 末尾に追加
 * Konva が生成する Stage container は class `konvajs-content` を持つ (Konva 公式実装、
 * src/Stage.ts L926 で userSelect:'none' は付くが touch-action は付かない)。
 * iOS Safari / Android Chrome の native gesture (pan / pinch / double-tap zoom / 長押し選択)
 * を抑止しないと pointercancel が発火して pointermove が途中で死ぬ。
 */
.konvajs-content {
  touch-action: none;
}
```

### KONVA_GLOBAL_BOOTSTRAP (optional / 推奨)
```ts
// SOURCE (NEW): apps/web/src/main.tsx の import './styles/global.css' 直後に追加候補
//
// pointerEventsEnabled は default true なので明示は冗長だが、Konva バージョンアップ時の
// regression 検知として固定する選択あり。本 plan では「明示しない」を採用 (Notes 参照)。
//
// captureTouchEventsEnabled は default false。これを true にすると Konva が pointerdown
// 時に setPointerCapture を呼び、Stage 外に出ても pointermove を拾える。snap-share の
// useRef ベース drag ロジックと相性が良い。本 plan では「true にする」を採用。
import Konva from 'konva';
Konva.captureTouchEventsEnabled = true;
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATE | 4 ハンドラ rename (Mouse → Pointer)、Stage prop 5 箇所差し替え、`onPointerCancel` 新規追加 |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | UPDATE | 2 箇所の Circle handle `onMouseDown` を `onPointerDown` に rename (line 80-104 内) |
| `apps/web/src/styles/global.css` | UPDATE | 末尾に `.konvajs-content { touch-action: none; }` を追加 |
| `apps/web/src/main.tsx` | UPDATE | `Konva.captureTouchEventsEnabled = true` を 1 行追加 |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | UPDATE | `onMouseDown` を assert している箇所 (~L136-138) を `onPointerDown` に書き換え |
| `docs/adr/ADR-0006-pointer-events-unification.md` | CREATE | Pointer Events 一本化と global 設定方針 (`captureTouchEventsEnabled`) を文書化 |
| `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` | UPDATE | sub-phase 10.I-1 の status を `pending` → `in-progress` → `complete` に更新、PRP Plan link 追加 |

## NOT Building

- **2-finger pinch zoom / 2-finger pan** — Phase 10.I-2 の対象
- **selection handle のヒットエリア拡大 (24/44 px adaptive)** — Phase 10.I-2 の対象 (`@media (pointer: coarse)`)
- **`hitStrokeWidth` の Arrow / Highlight 適用** — Phase 10.I-2 の対象
- **Toolbar の bottom 固定 + safe-area-inset** — Phase 10.I-3 の対象
- **VisualViewport API での IME 吸収** — Should、Phase 10.I MVP 後にドッグフードで判断
- **awareness layer の touch device 判定** — Should、Phase 10.I-3 以降
- **palm rejection / ペンモード / 長押しメニュー / 3-finger ジェスチャ** — PRD Won't
- **既存 unit test を `fireEvent.pointerDown` に書き換え** — jsdom の制限により無意味 (External Doc 参照)。Playwright (10.I-4) に検証を寄せる
- **Playwright `mobile-chrome` の本格 spec 拡張** — 10.I-1 では smoke 1 件 (Stage が pointerdown を受けて矩形が描ける) のみ。本格 12 ケースは 10.I-4
- **`Konva.pointerEventsEnabled` の明示設定** — default `true` であり Konva バージョン pin が別途あるため冗長。`captureTouchEventsEnabled` のみ明示
- **`<KonvaImage> listening={false}` 等の listening 規約変更** — CLAUDE.md の規約をそのまま継承

---

## Step-by-Step Tasks

### Task 1: ADR-0006 起票

- **ACTION**: `docs/adr/ADR-0006-pointer-events-unification.md` を新規作成
- **IMPLEMENT**:
  - Status: Accepted
  - Date: 2026-05-09
  - Context: Phase 10.I PRD と実機破綻の経緯
  - Decision: Pointer Events 一本化 + `Konva.captureTouchEventsEnabled = true` + Stage container `touch-action: none` + unit test は mouse event を維持
  - Alternatives: (a) imperative native touch listener 追加 (rejected: 経路が増え race の温床) (b) Pointer Events だが capture を使わない (rejected: Stage 外 drag が切れる)
  - Consequences: テストは mouse event ベース維持 / 10.I-2 で multi-touch を pointerId Map で実装する伏線 / type 注釈は `KonvaEventObject<PointerEvent>` に統一
- **MIRROR**: `docs/adr/ADR-0001-orpc-for-room-crud.md` 全体構造 (Header / Status / Date / Deciders / Related / Context / Decision / Consequences)
- **IMPORTS**: なし (Markdown)
- **GOTCHA**: 番号衝突を避けるため、commit 直前に `ls docs/adr/` で 0006 が空いていることを再確認
- **VALIDATE**:
  - `ls docs/adr/ADR-0006-pointer-events-unification.md` でファイル存在
  - `grep -l "ADR-0006" .claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` で PRD から参照されている

### Task 2: Konva global 設定の bootstrap

- **ACTION**: `apps/web/src/main.tsx` に `Konva.captureTouchEventsEnabled = true` を追加
- **IMPLEMENT**:
  ```ts
  // apps/web/src/main.tsx の上部 import 群の最後に追加
  import Konva from 'konva';
  // 詳細は ADR-0006 を参照。Pointer Capture を有効化し、Stage 外に出ても pointermove
  // を拾えるようにする (drag-move の途切れ防止)。
  Konva.captureTouchEventsEnabled = true;
  ```
- **MIRROR**: `apps/web/src/main.tsx:1-4` の import スタイル
- **IMPORTS**: `import Konva from 'konva';`
- **GOTCHA**:
  - `import Konva from 'konva/lib/Global';` ではなく **default export の `'konva'` を使う**。前者は internal path で `verbatimModuleSyntax` 環境では `import` 形式が崩れる
  - `verbatimModuleSyntax: true` のため、Konva は **type ではなく value として import** すること (`import Konva from 'konva'` は OK、`import type` ではない)
- **VALIDATE**:
  - `pnpm -F @pitamark/web typecheck` でエラーなし
  - `pnpm dev` 起動後、ブラウザ console で `window` 周辺の Konva 動作に regression がないこと (smoke)

### Task 3: `global.css` に `touch-action: none` を追加

- **ACTION**: `apps/web/src/styles/global.css` の末尾に Konva container 用 CSS を追加
- **IMPLEMENT**:
  ```css
  /* iOS Safari / Android Chrome の native gesture (pan / pinch / double-tap zoom /
   * 長押し selection) を抑止する。Pointer Events で multi-touch / drag を完結させる
   * ため、ブラウザ側のジェスチャ介入で pointercancel が早期発火するのを防ぐ。
   * Konva は Stage container に `userSelect: 'none'` までは設定するが touch-action
   * は当てないため、ここで補う。詳細は ADR-0006 / Phase 10.I PRD。 */
  .konvajs-content {
    touch-action: none;
  }
  ```
- **MIRROR**: `apps/web/src/styles/global.css` 末尾の既存 CSS パターン (Tailwind layer の外、生 selector)
- **IMPORTS**: なし
- **GOTCHA**:
  - `.konvajs-content` は Konva 公式実装で生成される class 名。バージョン上げで変わる可能性ゼロではないので、**実機検証で touch-action が効いていることを必ず確認** (DevTools Computed → `touch-action: none` を Stage container 上で見る)
  - `body` 全体に当てると landing / 法務 page の通常スクロールを殺す → 必ず `.konvajs-content` 限定で
- **VALIDATE**:
  - `pnpm -F @pitamark/web build` で CSS が含まれる
  - `pnpm dev` で iPhone Safari 実機 (or Chrome DevTools mobile emulation) で Stage 上の touch-action が effective

### Task 4: `CanvasStage.tsx` のハンドラ rename + Stage prop 差し替え

- **ACTION**: `apps/web/src/components/canvas/CanvasStage.tsx` の 4 ハンドラを rename し、`onPointerCancel` を新規追加
- **IMPLEMENT**:
  - `handleMouseDown` → `handlePointerDown`、引数型 `KonvaEventObject<MouseEvent>` → `KonvaEventObject<PointerEvent>`、内部ロジック完全維持 (line 198-272)
  - `handleMouseMove` → `handlePointerMove` (line 274-309)、同様
  - `handleMouseUp` → `handlePointerUp` (line 317-396)、同様
  - `handleMouseLeave` → `handlePointerLeave` (line 311-315)、同様
  - **新規**: `handlePointerCancel` を `handlePointerUp` と同じ実装で追加 (内容は body 共有 — `useCallback(handlePointerUp, [...])` 等で参照を共有してもよいが、関数 identity を分けたいなら新規 useCallback)
  - `<Stage>` JSX (line 488-501) の `onMouseDown/Move/Up/Leave` を pointer 系に置換、`onPointerCancel={handlePointerCancel}` 追加
- **MIRROR**: `EVENT_HANDLER_NAMING` + `STAGE_PROPS_REWIRING` patterns (上記 Patterns to Mirror セクション)
- **IMPORTS**: 既存の `import type { KonvaEventObject } from 'konva/lib/Node';` をそのまま使用 (型引数のみ変更)
- **GOTCHA**:
  - `e.evt.button` を見ている箇所 (右クリック判定があれば) は **PointerEvent でも継承プロパティとして読める** (PointerEvent extends MouseEvent extends UIEvent extends Event)。挙動互換
  - `handlePointerCancel` を忘れると iOS で system gesture 介入時にドラッグ中状態がリーク。**必ず追加**
  - useCallback の deps array に変更が無いか丁寧に確認 (関数名 rename だけで deps が崩れることはないが、grep で旧名の残りがないか確認)
  - `pendingAutoArrow` 確定経路 (line 200-220 周辺) が pointer 経由でも click 1 発で動くこと
- **VALIDATE**:
  - `grep -n "handleMouse" apps/web/src/components/canvas/CanvasStage.tsx` で **0 件** (完全 rename)
  - `pnpm -F @pitamark/web typecheck` でエラーなし
  - `pnpm -F @pitamark/web test -- src/components/canvas` で既存ユニット影響なし (mouseDown ベースなので緑のはず)

### Task 5: `ArrowShape.tsx` の handle onMouseDown rename

- **ACTION**: `apps/web/src/components/canvas/shapes/ArrowShape.tsx` の 2 箇所 (line 80-88, 97-104) で `onMouseDown` → `onPointerDown` に rename
- **IMPLEMENT**:
  ```tsx
  // line 80-88 周辺 (from-handle Circle)
  // line 97-104 周辺 (to-handle Circle) 同型
  <Circle
    draggable
    onPointerDown={(e: KonvaEventObject<PointerEvent>) => {
      e.cancelBubble = true;
    }}
    onDragEnd={(e) => { /* ... */ }}
  />
  ```
- **MIRROR**: `CANCEL_BUBBLE_IN_HANDLE` pattern
- **IMPORTS**: 既存の `KonvaEventObject` import を維持、型引数を `MouseEvent` → `PointerEvent` に
- **GOTCHA**:
  - 親 `<Arrow draggable>` の drag event を抑止する目的で `cancelBubble = true` を設定している。pointer event でも `cancelBubble` は同じ意味で動く (Konva 統一 API)
  - `onClick` は別系統で、touch でも tap で発火するので変更不要
- **VALIDATE**:
  - `grep -n "onMouseDown" apps/web/src/components/canvas/shapes/ArrowShape.tsx` で **0 件**
  - 既存 ArrowShape.test.tsx の onMouseDown を読んでいる箇所も同期して書き換える (Task 6)

### Task 6: `ArrowShape.test.tsx` の修正

- **ACTION**: `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` で `onMouseDown` prop を assert している箇所を `onPointerDown` に書き換え
- **IMPLEMENT**:
  - L136-138 周辺の `capture.<...>.onMouseDown` 参照を `onPointerDown` に変更
  - mock 側でも `onPointerDown` prop を capture するように調整 (既存 `onMouseDown` capture を rename)
- **MIRROR**: `RectangleShape.test.tsx:23-50` の mock pattern (Pointer 化に対応した capture key)
- **IMPORTS**: 変更なし
- **GOTCHA**:
  - **テスト発火イベント自体は `fireEvent.mouseDown` のまま維持**。Konva は内部で mouse → pointer に集約するので、prop name が `onPointerDown` でも mouseDown 発火で呼ばれる。jsdom の PointerEvent オプション落ち問題回避のため (External Doc 参照)
  - happy-dom 環境でも `fireEvent.mouseDown` の挙動は jsdom と同等
- **VALIDATE**:
  - `pnpm -F @pitamark/web test -- src/components/canvas/__tests__/ArrowShape.test.tsx` で全 spec 緑
  - `grep -n "onMouseDown" apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` で **0 件**

### Task 7: 描画 smoke の Playwright spec 追加 (mobile-chrome)

- **ACTION**: `apps/web/e2e/touch-rectangle-draw.spec.ts` を新規作成 (1 件のみ、smoke レベル)
- **IMPLEMENT**:
  ```ts
  import { test, expect } from '@playwright/test';

  test.describe('Phase 10.I-1: pointer events smoke', () => {
    test('mobile-chrome で矩形ツールを選んで矩形が描ける', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'mobile-chrome project 限定');
      await page.goto('/');
      // TODO: i18n 対応の test ID もしくは label-based selector で
      //  - 画像投入 (D&D 経由 or test-only entry point)
      //  - 矩形ツール選択
      //  - Stage 上を pointerdown → pointermove → pointerup で 1 矩形描画
      //  - rendered 矩形が DOM (Konva canvas) に存在
      // ※ 詳細選択子は実装時に既存 e2e/*.spec.ts を参照
    });
  });
  ```
- **MIRROR**: `apps/web/e2e/` 配下の既存 spec の構造 (test.describe + test ID-based selector)
- **IMPORTS**: `@playwright/test`
- **GOTCHA**:
  - mobile-chrome project は `hasTouch: true` がデフォルト (Pixel 5 device descriptor)。`page.touchscreen` も使えるが、`page.dispatchEvent` で `pointerdown` を直接送る方が確実
  - 完全 12 ケース (PRD MVP 受入) は 10.I-4 で書く。10.I-1 では「破綻していた経路が動く」smoke のみで OK
  - `webServer` は既に `pnpm -F @pitamark/web dev` で起動するため、追加設定不要
- **VALIDATE**:
  - `pnpm -F @pitamark/web test:e2e -- -g "pointer events smoke" --project=mobile-chrome` で緑
  - 同テストが `--project=chromium` でも skip 動作

### Task 8: PRD と Phase テーブルの更新

- **ACTION**: `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` の Implementation Phases テーブルを更新
- **IMPLEMENT**:
  - 10.I-1 の Status 列: `pending` → `in-progress` (実装着手時) → `complete` (Task 1-7 + manual verify 完了時)
  - PRP Plan 列: `-` → `[plan](../plans/phase-10-i-1-pointer-events-migration.plan.md)`
- **MIRROR**: 既存 PRD の Implementation Phases テーブル形式 (Phase 8 / 10.B / 10.D 等の遷移パターン)
- **IMPORTS**: なし (Markdown)
- **GOTCHA**: PRD ファイル内の sub-phase 10.I-1 行を 1 箇所書き換え。10.I-2 / 10.I-3 / 10.I-4 は触らない
- **VALIDATE**:
  - `grep -n "10.I-1" .claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` で Status / Plan link が更新されている

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `RectangleShape.test.tsx` 全 spec | 既存 fireEvent.mouseDown / onTransformEnd 直接呼び出し | 全緑 (regression なし) | No |
| `ArrowShape.test.tsx` 全 spec | mock の `onPointerDown` capture + `cancelBubble` 確認 | 全緑 + onMouseDown が assert 残骸ゼロ | No |
| `HighlightShape.test.tsx` (もし存在) | 既存 spec | 全緑 (本サブフェーズで shape 自体は触らない) | No |
| 新規 unit test | (なし — pointer 固有挙動は Playwright に寄せる方針) | - | - |

### Edge Cases Checklist

- [ ] mouse drag で矩形描画 (PC 非劣化) — chromium project
- [ ] touch drag で矩形描画 (mobile-chrome project, smoke 1 件)
- [ ] Stage 外への drag (`captureTouchEventsEnabled` 効果) で drag が切れない (手動 PC)
- [ ] iOS Safari の system gesture 介入時 (画面端から swipe) で `pointercancel` が呼ばれ drag 状態がクリアされる (手動実機)
- [ ] 既存 ArrowShape の endpoint handle drag (cancelBubble 経路) が touch でも動く
- [ ] テキスト配置 (既存 click 経路) が劣化していないこと
- [ ] PNG export が touch 描画後でも動く (= 描画系の Yjs origin / annotation 配列に副作用なし)
- [ ] リアルタイム同期 (mobile→PC) が touch 描画後でも 1 秒以内に伝播 (手動 2 デバイス、Should)

---

## Validation Commands

### Static Analysis
```bash
pnpm typecheck
```
EXPECT: Zero type errors. 特に `KonvaEventObject<MouseEvent>` の残骸ゼロ。

```bash
pnpm lint
```
EXPECT: Zero biome ci errors. trailing comma / quote style 違反なし。

### Unit Tests
```bash
pnpm -F @pitamark/web test -- src/components/canvas
pnpm -F @pitamark/web test
```
EXPECT: 既存全 spec 緑、`grep -n "handleMouse\|onMouseDown" apps/web/src` で本 plan 修正対象ファイル外の残骸ゼロ。

### Full Test Suite
```bash
pnpm test
```
EXPECT: web / api / shared 全 workspace の vitest 緑。

### E2E
```bash
pnpm -F @pitamark/web test:e2e -- -g "pointer events smoke" --project=mobile-chrome
pnpm -F @pitamark/web test:e2e
```
EXPECT: 新規 smoke 緑、既存 chromium spec 緑。

### Build
```bash
pnpm -F @pitamark/web build
```
EXPECT: success、bundle size の劇的増加なし (Pointer Events 化は同等の event 配線のため)。

### Manual Validation

- [ ] PC (Chrome / Firefox) で `pnpm dev` 起動 → 画像投入 → 矩形 / 矢印 / ハイライト drag 描画 / 既存図形移動 / 既存テキスト配置がすべて従来通り
- [ ] PC で wheel zoom と Cmd+wheel zoom が劣化していない
- [ ] Chrome DevTools Mobile Emulation (iPhone 12 / Pixel 5) で touch drag 描画
- [ ] **実機 iPhone Safari (Bonjour / ngrok 等で 5173 を露出) で touch drag 描画 + 既存図形移動が動く**
- [ ] **実機 Android Chrome で同上**
- [ ] DevTools の Computed → `touch-action: none` が `.konvajs-content` 上で effective
- [ ] iOS Safari で画面端 swipe → `pointercancel` が出て drag がクリアされる (Console.log で確認)

---

## Acceptance Criteria

- [ ] Task 1 (ADR-0006) 完了 + status: Accepted
- [ ] Task 2 (Konva.captureTouchEventsEnabled) 完了
- [ ] Task 3 (global.css touch-action) 完了
- [ ] Task 4 (CanvasStage.tsx ハンドラ rename) 完了 + grep `handleMouse` ゼロ件
- [ ] Task 5 (ArrowShape.tsx handle rename) 完了 + grep `onMouseDown` ゼロ件
- [ ] Task 6 (ArrowShape.test.tsx) 完了 + 全 spec 緑
- [ ] Task 7 (Playwright smoke) 完了 + mobile-chrome 緑
- [ ] Task 8 (PRD 更新) 完了
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e` すべて緑
- [ ] 実機 iPhone Safari + Pixel Chrome で矩形 drag 描画が動作 (smoke レベル、本格 12 ケースは 10.I-4)
- [ ] PC chromium project で既存 e2e spec が全緑 (非劣化)

## Completion Checklist

- [ ] Code follows discovered patterns (Patterns to Mirror セクション準拠)
- [ ] Error handling matches codebase style (本サブフェーズは event handler 内 early-return パターン維持で不変)
- [ ] Logging follows codebase conventions (新規 console 系コード追加なし)
- [ ] Tests follow test patterns (vi.hoisted + react-konva mock, fireEvent.mouseDown 維持)
- [ ] No hardcoded values (touch-action: none は CSS 値、ADR で根拠リンク)
- [ ] Documentation updated (ADR-0006 + PRD 10.I-1 行)
- [ ] No unnecessary scope additions (NOT Building セクション準拠)
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `.konvajs-content` class 名が将来の Konva バージョンで変わる | Low | High (実機で touch-action 効かない) | ADR-0006 に注意書き、実機検証必須項目に「Computed CSS 確認」を含める。万一変わったら `useEffect` で `stage.container().style.touchAction = 'none'` に fallback |
| `Konva.captureTouchEventsEnabled = true` が既存 wheel zoom に副作用 | Low | Medium | 手動 PC 検証で wheel zoom が劣化していないことを確認。`useStageTransform.handleWheel` は本サブフェーズで触らない |
| jsdom + happy-dom の event 互換性差 | Medium | Low | 既存テストが happy-dom で通っているので mouseDown ベース維持で影響なし。pointer 固有挙動は Playwright に寄せる方針を ADR で明示 |
| `pointercancel` ハンドラを忘れて drag リーク | Medium | Medium | Task 4 の VALIDATE に「`grep -n "onPointerCancel" CanvasStage.tsx` で 1 箇所以上」を入れる |
| `verbatimModuleSyntax` で `import Konva from 'konva'` が type-only として扱われる | Low | Medium | Konva は class export なので value import で問題なし。typecheck で検知される |
| 既存 `KonvaEventObject<MouseEvent>` の残存 (rename 漏れ) | Medium | Low | grep ベースの check を Validation Commands と Task ごとに配置 |
| Playwright mobile-chrome の hasTouch + dispatchEvent('pointerdown') の組み合わせが flake | Medium | Low | 10.I-1 では smoke 1 件のみ。flake が出たら `test.retry(2)` を一時付与し 10.I-4 で根本対応 |
| Phase 10.I-2 (multi-touch) が実装される前に「2 本指 = 何も起きない」状態を実機ユーザーが触ると違和感 | High | Low | 10.I-1 の sub-phase 完了後すぐに 10.I-2 着手。同 PR で merge する設計 (PRD memory: 1 ブランチ 1 PR) |

## Notes

### テスト方針の修正 (PRD Q1 への回答)

PRD Open Question Q1「Pointer Events 移行のため `fireEvent.pointerDown` 系に書き換えるか」について、**書き換えない** を Plan で確定する。理由:

1. jsdom (および happy-dom) の `PointerEvent` コンストラクタは `clientX` / `clientY` / `pointerType` を初期化オプションから落とす ([dom-testing-library #1291](https://github.com/testing-library/dom-testing-library/issues/1291))
2. Konva 内部で mouse / touch / pointer は共通ハンドラ `_pointerdown` に集約される ([Konva `Stage.ts`](https://github.com/konvajs/konva/blob/master/src/Stage.ts))
3. ゆえに `<Stage onPointerDown={fn}>` に対して `fireEvent.mouseDown(stageEl, { clientX: 10, clientY: 20 })` しても `fn` は座標付きで呼ばれる
4. pointer 固有挙動 (`pointerType === 'touch'` 分岐 / multi-touch) は Playwright `mobile-chrome` project (実 PointerEvent) で検証する方が信頼できる

### `Konva.pointerEventsEnabled` の明示について

default `true` のため明示しない (本 plan では `captureTouchEventsEnabled` のみ明示)。Konva バージョンを変える PR では `pnpm -F @pitamark/web build` の bundle に `pointerEventsEnabled` 既定値が変わっていないかチェックする運用で吸収。

### Stage 親 div 戦略

CanvasStage.tsx は現状 `<Stage>` を親 div で包んでいない (line 488 で `<Stage>` 直接 return)。Konva が内部生成する `.konvajs-content` div に CSS で `touch-action: none` を当てるのが最も干渉が少ない。手段の代替案として「`useEffect` で `stage.container().style.touchAction = 'none'` を imperative に設定」もあり得るが、CSS で済むなら CSS が単純で確実。実機検証で効かなければ Risks の fallback に切り替え。

### ECC PRP との整合

本 plan は **PRD 単位で 1 ブランチ 1 PR** ルール (memory: feedback_branch_per_phase) のため、10.I-1 / 10.I-2 / 10.I-3 / 10.I-4 はすべて同一ブランチ `phase-10-i-touch-optimization` (新規作成、本 plan 着手時) で進める。コミット粒度のみ sub-phase で区切る。本 plan の 8 タスクで 1〜3 コミット程度を想定 (ADR + bootstrap / コア rename / ArrowShape + test / Playwright + PRD)。

### 後続 sub-phase への引き継ぎ事項

- 10.I-2 (pinch / pan): 本 plan で `captureTouchEventsEnabled = true` にしたため、Konva が pointer capture を効かせる。`stage.getPointersPositions()` で 2 ポインタを拾う設計が直接書ける
- 10.I-2 (hit area): `@media (pointer: coarse)` selector が global.css に未追加なので、10.I-2 のタスクで追加
- 10.I-3 (Toolbar): 本 plan で Toolbar には触らない
- 10.I-4 (受入): 本 plan の Playwright smoke を base として 12 ケースに拡張
