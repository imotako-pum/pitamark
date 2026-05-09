# Plan: Phase 10.J-2 — 長押しコンテキストメニュー実装

## Summary

snap-share の全 4 Shape (`Rectangle / Arrow / Highlight / Text`) に対し、500ms 長押しで context menu が出現する仕組みを実装する。`apps/web/src/hooks/useLongPress.ts` に Excalidraw / tldraw 標準パターンの timer + slop 監視 hook を新設、`apps/web/src/components/canvas/ContextMenu.tsx` に shadcn 風の menu UI を新設、`AnnotationLayer.tsx` で menu の open / position / target shape ID を保持する。menu 項目は **削除** / **複製** / **前面へ移動** / **背面へ移動** の 4 つで、削除と複製は既存 dispatcher (`annotation/remove` / `annotation/add` with clone) を使う。前面 / 背面は新 dispatcher (`annotation/reorder`) + Y.Map ではなく schema に `zOrder` field 追加で実現する (詳細は Open Questions)。誤発火対策として 500ms (`LONG_PRESS_DURATION_MS`) + 6px slop (`DRAG_SLOP_PX_COARSE`) + 250ms opacity fade の visual feedback + `navigator.vibrate(15)` (Android only) を組み合わせる。

## User Story

As **a snap-share mobile user (iPhone Safari / Android Chrome)**, I want **shape を 500ms 長押しすると context menu が出て、削除 / 複製 / 前面 / 背面の操作を 1 タップで実行できる**, so that **PC で右クリック→コンテキストメニューと同じ操作効率がスマホでも得られる、ツールバーまでの親指往復を避けられる**.

## Problem → Solution

**Current state**: Phase 10.I で機能パリティ (描画 / 移動 / pinch zoom)、10.J-1 で paired binding (shape 選択) が動くようになったが、shape を選択した後に削除 / 複製 / 順序変更を行うには (a) ツールバーの削除アイコンまで親指を往復する、(b) キーボードショートカット (PC でしか使えない) を使う、の 2 択しかない。業界標準 (Keynote / Slides / Figma / Excalidraw / tldraw) では shape の長押しで context menu が出るのが標準パターンで、これを欠いている限り mobile UX は PC 比で半分程度の生産性に留まる。

**Desired state**: 全 4 Shape で `useLongPress` hook が touch / mouse の押下を 500ms 監視し、移動量 6px 未満で長押し成立を判定する。成立時に shape 上の押下座標を anchor として `ContextMenu` が pop し、4 項目から 1 項目を選択すると即時 dispatch + menu close。誤発火対策として押下中 250ms かけて opacity 0.85 へ fade、Android では `vibrate(15)` で触覚フィードバック。menu は画面端で flip して常に viewport 内に収まる。

## Metadata

- **Complexity**: Medium (12-15 files、推定 800-1200 行の差分)
- **Source PRD**: `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md`
- **PRD Phase**: 10.J-2 (長押しコンテキストメニュー実装)
- **Estimated Files**: 14 (useLongPress / useLongPress test / ContextMenu / ContextMenu test / 4 Shape / 4 Shape test 拡張 / AnnotationLayer / annotationsReducer / annotation operations / yjs-mutations / shared schema / PRD 更新)
- **ADR Reference**: ADR-0007 D4 (長押し menu 仕様)

---

## UX Design

### Touch (iPhone Safari / Android Chrome)

```
[初期状態]                          [500ms 押下中]                  [長押し成立]
┌──────────────────┐                ┌──────────────────┐             ┌──────────────────┐
│                  │                │                  │             │  ┌──────────────┐ │
│   ┌────────┐     │                │   ┌────────┐     │             │  │ 削除          │ │
│   │ shape  │     │   →            │   │ shape  │ ← 250ms          │  │ 複製          │ │
│   └────────┘     │   long press   │   └ ──────┘ ← opacity 0.85    │  │ 前面へ        │ │
│                  │                │                  │             │  │ 背面へ        │ │
└──────────────────┘                └──────────────────┘             │  └──────────────┘ │
                                                                     │   (vibrate 15ms) │
                                                                     └──────────────────┘
                                                                              ↑
                                                              shape の押下座標を anchor、
                                                              画面端では flip して
                                                              viewport 内に収める
```

### キャンセル動線

| キャンセル条件 | 振る舞い |
|---|---|
| 移動量 > 6px (DRAG_SLOP_PX_COARSE) | 長押し timer cancel、shape の draggable に移行 |
| pointerup が 500ms 以内 | timer cancel、選択 dispatch (= `onClick / onTap`) のみ |
| 別の touch (multi-touch) 開始 | timer cancel、stage の pinch path に移行 |
| `pointercancel` (system gesture) | timer cancel、状態クリア |
| menu open 中の **menu 外タップ** | menu close (selection 状態は維持) |
| menu open 中の **項目タップ** | dispatch + menu close + 選択解除 (or 維持、項目仕様に従う) |

### Desktop (Chrome / Firefox)

長押しは PC でも動くが、PC は通常右クリック (`onContextMenu`) で同等の menu を出すのが慣習。本 plan では **PC でも長押しで menu が出る** ようにする (一貫性確保)。右クリックでも出すかは Open Question Q5 で確認。

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | `apps/web/src/lib/touch-thresholds.ts` | 全体 | Phase 10.J-1 で確立した SSOT 定数。`LONG_PRESS_DURATION_MS` / `DRAG_SLOP_PX_COARSE` を import |
| **P0** | `apps/web/src/hooks/annotationsReducer.ts` | 32-59 | `AnnotationsAction` union。`annotation/reorder` 新規追加箇所、`isCommittingAction` も同期 |
| **P0** | `apps/web/src/hooks/annotationsReducer.ts` | 84-89 | 既存 `annotation/remove` パターン (削除 menu 項目で再利用) |
| **P0** | `apps/web/src/hooks/annotationsReducer.ts` | 82-83 | 既存 `annotation/add` パターン (複製 menu 項目で再利用、id 採番 + offset で clone) |
| **P0** | `apps/web/src/domain/annotation/operations.ts` | 全体 | `addAnnotation` / `removeAnnotation` / 等の純粋関数。`reorderAnnotation` を新規追加する場所 |
| **P0** | `apps/web/src/domain/annotation/yjs-mutations.ts` | 全体 | Yjs ベース mutation 層。`reorderAnnotationY` を追加 (zOrder field を Y.Map<Y.Map> に書き込む) |
| **P0** | `apps/web/src/domain/annotation/yjs-codec.ts` | 全体 | Annotation ↔ Y.Map<Y.Map> codec。zOrder field を encode/decode に追加 |
| **P0** | `packages/shared/src/annotation.ts` | 全体 | Zod discriminated union。zOrder を共通 base field として追加 |
| **P0** | `apps/web/src/components/canvas/AnnotationLayer.tsx` | 全体 | shape rendering の集約点。context menu の state (open / position / targetId) を hold する場所 |
| **P0** | `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | 全体 (Phase 10.J-1 修正済) | `useLongPress` を hook で配線する pattern |
| **P0** | `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | 全体 | 同上 (Circle handle は対象外、shape 本体のみ) |
| **P0** | `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | 全体 | 同上 |
| **P0** | `apps/web/src/components/canvas/shapes/TextShape.tsx` | 全体 | 同上 (`onDblTap` の edit mode 進入と長押しで menu の競合に注意) |
| **P1** | `apps/web/src/hooks/__tests__/useTouchDevice.test.tsx` | 全体 | 既存 hook テストの構造 (vi.useFakeTimers + matchMedia mock)。`useLongPress` テストで踏襲 |
| **P1** | `apps/web/src/components/toolbar/Toolbar.tsx` | 削除ボタン関連 | 既存の削除 dispatch flow。menu 項目で同 dispatch を呼ぶ |
| **P1** | `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` | 全体 | reducer test pattern。`annotation/reorder` の test を追加 |
| **P2** | `docs/adr/ADR-0007-touch-ux-standards.md` | D4 | 長押し menu 仕様の意思決定根拠 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Excalidraw context menu パターン | [`packages/excalidraw/components/App.tsx`](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx) | `TOUCH_CTX_MENU_TIMEOUT = 500` で `setTimeout` 開始、`pointermove` 監視で slop 超過時 cancel |
| tldraw long-press 実装 | [`useGestureEvents.ts`](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/hooks/useGestureEvents.ts) | `_longPressTimeout` ref + `pointercancel` で cleanup の 標準パターン |
| `navigator.vibrate` 仕様 | [MDN — Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) | iOS Safari は無視、Android Chrome は反応。try/catch で safety net |
| iOS HIG context menu | [Apple — Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus) | viewport 端で flip、min item height 44pt |
| Material 3 menu | [m3.material.io — Menus](https://m3.material.io/components/menus/specs) | min item height 48dp、divider で危険操作 (削除) を分離 |
| Konva の `getPointerPosition` (multi-touch 中の) | [Konva `Stage.ts`](https://github.com/konvajs/konva/blob/master/src/Stage.ts) | menu anchor 座標は `stage.getPointerPosition()` から取得、stage の transform を考慮 |

---

## Patterns to Mirror

### USE_LONG_PRESS_HOOK (新規)

```ts
// SOURCE (NEW): apps/web/src/hooks/useLongPress.ts
//
// ADR-0007 D4: 長押し menu の誤発火対策の標準パターン (Excalidraw/tldraw 同等)
// - 500ms 押下継続
// - 移動量 6px 未満
// - pointercancel / pointerup で cleanup
// - visual feedback (opacity 0.85 fade) + Android haptic vibrate(15)

import { useCallback, useEffect, useRef } from 'react';
import { LONG_PRESS_DURATION_MS, DRAG_SLOP_PX_COARSE } from '../lib/touch-thresholds';

type LongPressOptions = {
  onLongPress: (anchor: { x: number; y: number }) => void;
  durationMs?: number;
  slopPx?: number;
};

type LongPressHandlers = {
  onPointerDown: (e: { evt: PointerEvent; cancelBubble: boolean }) => void;
  onPointerMove: (e: { evt: PointerEvent }) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  // additionally onTouchStart/Move/End for Konva touch event 経路 (10.I-2 multi-touch
  // path との独立 cleanup) — 詳細は ARROWSHAPE_HANDLE_PAIRED_BINDING (10.J-1) を参考
};

export const useLongPress = ({
  onLongPress,
  durationMs = LONG_PRESS_DURATION_MS,
  slopPx = DRAG_SLOP_PX_COARSE,
}: LongPressOptions): LongPressHandlers => {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  // cleanup on unmount
  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (e) => {
      const { clientX, clientY } = e.evt;
      startRef.current = { x: clientX, y: clientY };
      timerRef.current = window.setTimeout(() => {
        if (startRef.current) {
          // haptic feedback (Android only, iOS は no-op)
          try {
            navigator.vibrate?.(15);
          } catch {
            // safety net
          }
          onLongPress(startRef.current);
        }
        timerRef.current = null;
      }, durationMs);
    },
    [onLongPress, durationMs],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!startRef.current) return;
      const dx = e.evt.clientX - startRef.current.x;
      const dy = e.evt.clientY - startRef.current.y;
      if (dx * dx + dy * dy > slopPx * slopPx) {
        cancel();
      }
    },
    [cancel, slopPx],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
  };
};
```

### CONTEXT_MENU_COMPONENT (新規)

```tsx
// SOURCE (NEW): apps/web/src/components/canvas/ContextMenu.tsx
//
// 画面端で flip、min-h-11 (44px) tap target、Android Material vs iOS HIG の中間
// (削除を最後に置く誤タップ回避ルールに従う)

type ContextMenuItem = {
  id: 'delete' | 'duplicate' | 'bring-front' | 'send-back';
  label: string;
  variant?: 'destructive';
};

type ContextMenuProps = {
  open: boolean;
  anchor: { x: number; y: number } | null;
  items: ContextMenuItem[];
  onSelect: (id: ContextMenuItem['id']) => void;
  onClose: () => void;
};

export const ContextMenu = ({ open, anchor, items, onSelect, onClose }: ContextMenuProps) => {
  if (!open || !anchor) return null;
  const flipped = computeFlip(anchor); // viewport 端からの距離で +/- 方向決定
  return (
    <div
      role="menu"
      aria-label="annotation context menu"
      style={{
        position: 'fixed',
        left: flipped.x,
        top: flipped.y,
        // viewport 内にクランプ
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          role="menuitem"
          className={`min-h-11 ... ${item.variant === 'destructive' ? 'text-red-600' : ''}`}
          onClick={() => {
            onSelect(item.id);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};
```

### REORDER_ACTION_PATTERN (annotationsReducer 拡張)

```ts
// SOURCE (BEFORE): apps/web/src/hooks/annotationsReducer.ts:32-59
// AnnotationsAction union に新規 type を追加

type AnnotationsAction =
  // ... 既存
  | { type: 'annotation/duplicate'; sourceId: string; cloned: Annotation }
  | { type: 'annotation/reorder'; id: string; direction: 'front' | 'back' };

// reducer:
case 'annotation/duplicate':
  return { ...state, annotations: addAnnotation(state.annotations, action.cloned) };
case 'annotation/reorder':
  return {
    ...state,
    annotations: reorderAnnotation(state.annotations, action.id, action.direction),
  };

// isCommittingAction にも追加 (両方 committing)
```

### ZORDER_SCHEMA_FIELD (Open Question Q1 で意思決定)

```ts
// 案 A: zOrder field を schema に追加
// SOURCE: packages/shared/src/annotation.ts
const baseAnnotation = z.object({
  id: z.string(),
  createdAt: z.number(),
  zOrder: z.number().default(0), // 新規 field
});
// → AnnotationLayer の sort: ascending zOrder で render

// 案 B: 既存 createdAt を z-order に流用
// → reorder = createdAt を更新 (createdAt が "creation timestamp" → "render order key" に
//    意味変容する semantic shift。既存コードへの影響を grep で確認必須)

// 案 C: 配列順序のみで管理 (zOrder field なし)
// → 移動 / 複製では順序変わらない、reorder のみ swap
//   ただし Yjs Y.Map は順序保証なし → Y.Array にスキーマ変更が必要 (大規模 refactor)
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/hooks/useLongPress.ts` | CREATE | 長押し timer + slop 監視 hook |
| `apps/web/src/hooks/__tests__/useLongPress.test.tsx` | CREATE | timer / slop / cancel パスの unit test |
| `apps/web/src/components/canvas/ContextMenu.tsx` | CREATE | menu UI コンポーネント |
| `apps/web/src/components/canvas/__tests__/ContextMenu.test.tsx` | CREATE | open / item dispatch / 画面端 flip の unit test |
| `apps/web/src/components/canvas/AnnotationLayer.tsx` | UPDATE | menu state hold + Shape 配下に hook 経由で配線 |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | UPDATE | `useLongPress` props 受領 + 配線 |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | UPDATE | 同上 (shape 本体のみ、Circle handle は対象外) |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | UPDATE | 同上 |
| `apps/web/src/components/canvas/shapes/TextShape.tsx` | UPDATE | 同上 (`onDblTap` edit mode との競合: 長押し成立後は edit に進まない設計) |
| `apps/web/src/components/canvas/__tests__/{4 Shape}.test.tsx` | UPDATE | 長押し props 受領 assertion |
| `apps/web/src/hooks/annotationsReducer.ts` | UPDATE | `annotation/duplicate` + `annotation/reorder` 追加 (Open Question Q1 の決定後) |
| `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` | UPDATE | 新 action の reducer test |
| `apps/web/src/domain/annotation/operations.ts` | UPDATE | `cloneAnnotation` (offset 付き) + `reorderAnnotation` 純粋関数追加 |
| `apps/web/src/domain/annotation/__tests__/operations.test.ts` (もし存在) | UPDATE | 新関数の test |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | UPDATE | `duplicateAnnotationY` + `reorderAnnotationY` 追加 |
| `apps/web/src/domain/annotation/yjs-codec.ts` | UPDATE | zOrder field の encode/decode (Open Question Q1 が案 A の場合) |
| `packages/shared/src/annotation.ts` | UPDATE | zOrder field 追加 (Open Question Q1 が案 A の場合) |
| `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` | UPDATE | 10.J-2 行 status を complete に、Plan link 追加 |

## NOT Building

- **Transformer の coarse anchor 24→20px 再調整** — Phase 10.J-3 の対象
- **E2E `dispatchEvent('touchstart')` 経路 migration** — Phase 10.J-4 の対象 (本 plan では unit test + 手動 emulation 検証で完結)
- **色変更 / フォントサイズ変更 等のプロパティ menu 項目** — PRD Won't、Phase 11+ 候補
- **コピー / ペースト** — PRD Won't、Phase 10.K 以降
- **複数選択 + 一括操作** — PRD Won't
- **shape rotation menu 項目** — PRD Won't
- **長押し成立中の触覚継続フィードバック (進度 progress bar 風)** — `vibrate(15)` 単発のみ (実装コスト過大)
- **PC 右クリック (`onContextMenu`) で menu 表示** — Open Question Q5 で意思決定 (default は touch のみ、PC でも長押しで出る)
- **menu の keyboard navigation (矢印キー / Enter)** — Should、本 plan では `onClick` のみ。a11y は Phase 11+ で
- **menu の i18n** — 既存 `useI18n` 経由で日英対応する (新 key 追加のみ)。新言語追加は対象外

---

## Step-by-Step Tasks

### Task 1: Open Questions の意思決定 (実装着手前)

- **ACTION**: 後述 Open Questions セクションの Q1 (zOrder field 案) / Q2 (menu 項目順) / Q3 (TextShape `onDblTap` との競合) / Q4 (PC 右クリック対応) / Q5 (menu の選択維持/解除) を確定する
- **IMPLEMENT**: User と簡易 review、Plan の他 Task に反映
- **VALIDATE**: Q1-Q5 すべて [x] の状態で Task 2 に進む

### Task 2: `useLongPress` hook 新設

- **ACTION**: `apps/web/src/hooks/useLongPress.ts` を新規作成
- **IMPLEMENT**: `USE_LONG_PRESS_HOOK` (上記 Patterns to Mirror) のとおり実装。Konva の `KonvaEventObject` 型に対応する handler 5 つ (`onPointerDown / Move / Up / Cancel + onTouchStart`) を return
- **MIRROR**: `apps/web/src/hooks/useTouchDevice.ts` の hook 構造 (return 型 + cleanup pattern)
- **IMPORTS**: `LONG_PRESS_DURATION_MS / DRAG_SLOP_PX_COARSE` from `../lib/touch-thresholds`
- **GOTCHA**:
  - `setTimeout` の型は `number` (browser env)。`NodeJS.Timeout` ではない
  - `cancel` cleanup は **必ず unmount で呼ぶ** (`useEffect(() => cancel, [cancel])`)
  - haptic vibrate は `try/catch` で囲む (一部 Chromium で SecurityError 投げる事例あり)
- **VALIDATE**:
  - `pnpm -F @pitamark/web typecheck` 緑
  - `pnpm -F @pitamark/web lint` 緑

### Task 3: `useLongPress` の unit test

- **ACTION**: `apps/web/src/hooks/__tests__/useLongPress.test.tsx` を新規作成
- **IMPLEMENT**:
  - `vi.useFakeTimers()` で 500ms timer の検証
  - test ケース 5 件:
    1. 500ms 経過で `onLongPress` が anchor 付きで呼ばれる
    2. 100ms で pointerup → cancel される
    3. 移動量 7px (slop 超) で cancel される
    4. 移動量 5px (slop 未満) では cancel しない
    5. unmount で timer clear (memory leak ガード)
- **MIRROR**: `apps/web/src/hooks/__tests__/useTouchDevice.test.tsx` の vitest + fake timer pattern
- **IMPORTS**: `renderHook` from `@testing-library/react` (or 同等の hook test 環境)。なければ component wrapper 経由で test
- **GOTCHA**:
  - `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })` で `Date.now()` を固定しない (`navigator.vibrate` の `try/catch` 周りで実時間が要るかもしれない)
  - `act` で hook 呼び出し
- **VALIDATE**:
  - 5 件の test 緑
  - `pnpm -F @pitamark/web test -- src/hooks/__tests__/useLongPress` 緑

### Task 4: `ContextMenu` component 新設

- **ACTION**: `apps/web/src/components/canvas/ContextMenu.tsx` を新規作成
- **IMPLEMENT**: `CONTEXT_MENU_COMPONENT` (上記 Patterns to Mirror) のとおり。要件:
  - props: `{ open, anchor, items, onSelect, onClose }`
  - `open === false` または `anchor === null` で `null` return
  - `onPointerDown` で `e.stopPropagation()` (menu 自身のクリックが close をトリガしないよう)
  - 画面端 flip (`computeFlip` helper を component 内 or 別 file に切り出し)
  - 各 button は `min-h-11 min-w-11 px-4` で 44px tap target、`aria-label` / `role="menuitem"` 付き
  - destructive (`delete`) は `text-red-600` で視認性
- **MIRROR**: `apps/web/src/components/toolbar/ToolButton.tsx` の Tailwind class pattern + a11y attribute
- **IMPORTS**: 新規 i18n key (`useI18n` で `cm.delete / cm.duplicate / cm.bringFront / cm.sendBack`)
- **GOTCHA**:
  - `position: fixed` で stage の transform 影響なし、screen 座標で配置
  - flip ロジック: `if (anchor.x + menuWidth > viewportWidth) anchor.x -= menuWidth` 等
  - menu 外タップで close する仕組みは AnnotationLayer 側で `onPointerDown` capture (Task 6)
- **VALIDATE**:
  - `pnpm -F @pitamark/web typecheck` 緑
  - `pnpm -F @pitamark/web lint` 緑

### Task 5: `ContextMenu` の unit test

- **ACTION**: `apps/web/src/components/canvas/__tests__/ContextMenu.test.tsx` を新規作成
- **IMPLEMENT**:
  - test ケース 6 件:
    1. `open: false` で何も render しない
    2. `open: true && anchor` で 4 button 全部 render
    3. button click で `onSelect(id)` + `onClose()` 両方呼ばれる
    4. menu 外 pointerdown で `onClose` (Task 6 の AnnotationLayer 側 wiring と整合)
    5. 画面右端 anchor で flip して left に表示
    6. destructive item に `text-red-600` クラス付与
- **MIRROR**: 既存 component test の RTL pattern
- **IMPORTS**: `@testing-library/react`、`vi.fn()` for callback
- **GOTCHA**: viewport size の mock (window.innerWidth 等) は test setup で
- **VALIDATE**: 6 件の test 緑

### Task 6: `AnnotationLayer` で menu state を hold

- **ACTION**: `apps/web/src/components/canvas/AnnotationLayer.tsx` で menu 関連 state を `useState` で hold + 全 Shape props に `useLongPress` の anchor callback を伝搬
- **IMPLEMENT**:
  - state 3 個: `menuOpen` / `menuAnchor` / `menuTargetId`
  - `handleLongPress(id)` callback を生成して各 Shape 経由で `useLongPress` に渡す
  - `<ContextMenu>` を Layer 末尾に配置 (Konva 外、React DOM 上)
  - `handleSelect` で 4 項目別に dispatch (削除 → `annotation/remove` / 複製 → `annotation/duplicate` / 前面 → `annotation/reorder direction:'front'` / 背面 → 同 'back')
  - menu 外 pointerdown で close (`document.addEventListener` の cleanup-aware 配線)
- **MIRROR**: AnnotationLayer 既存の dispatch pattern + Shape props 配線
- **IMPORTS**: ContextMenu / useLongPress / 既存 dispatch
- **GOTCHA**:
  - menu の DOM 配置: Konva canvas は HTML overlay できないので、`<ContextMenu>` は AnnotationLayer の親 (CanvasStage の sibling か `EditorShell`) に置く方が clean
  - **再考**: AnnotationLayer は Konva の Layer 配下なので React DOM 出せない。`portal` か CanvasStage の outer wrapper に menu を置くか、設計で確定 (Open Question として残す)
- **VALIDATE**:
  - typecheck 緑
  - 既存 unit test 全部緑

### Task 7: 4 Shape に `useLongPress` を配線

- **ACTION**: `RectangleShape / ArrowShape / HighlightShape / TextShape` 各々で `useLongPress({ onLongPress })` を呼び、return された 5 handler を Konva の対応する prop に bind
- **IMPLEMENT**:
  ```tsx
  // 各 Shape:
  const longPressHandlers = useLongPress({
    onLongPress: (anchor) => onLongPressShape(annotation.id, anchor),
  });
  // <Group / KonvaRect / 等> に bind
  // ※ 既存の onClick / onTap (10.J-1) は維持
  // ※ longPressHandlers の onPointerDown は **既存の onPointerDown と合成** する必要あり
  //    (ArrowShape の Circle handle 用 onPointerDown と競合しないよう shape 本体のみ bind)
  ```
- **MIRROR**: RectangleShape の Phase 10.J-1 修正 (paired binding 追加方法)
- **IMPORTS**: useLongPress / TouchEvent 型維持
- **GOTCHA**:
  - **TextShape の `onDblTap` (edit mode 進入) と長押し menu の競合**: 長押しは 500ms、`onDblTap` は 300ms 以内の 2 回タップ。互いに排他で問題なし、但し test で確認
  - 各 Shape に新 prop `onLongPress: (id, anchor) => void` を追加 (RectangleShapeProps 等の type 拡張)
- **VALIDATE**:
  - 4 Shape 全 typecheck 緑
  - 既存 spec 緑、新 prop 配線の assertion 追加

### Task 8: 4 Shape unit test に長押し配線 assertion 追加

- **ACTION**: 各 Shape の test で `useLongPress` mock を設定し、Konva に正しい handler が bind されていることを assert
- **IMPLEMENT**:
  - mock `vi.mock('../../../hooks/useLongPress')` で hook を捕捉
  - render 後、`useLongPress` が呼ばれた引数 (`onLongPress` callback) を確認
  - shape の `onPointerDown` prop が hook の handler になっていることを assert (識別性確保のため hook return をユニーク mock 関数に)
- **MIRROR**: Phase 10.J-1 で追加した paired binding assertion
- **GOTCHA**: hook mock の return 値は test ごとに reset (`beforeEach` で)
- **VALIDATE**: 4 Shape test 緑

### Task 9: `annotationsReducer` に `annotation/duplicate` / `annotation/reorder` 追加

- **ACTION**: 2 新 action type を `AnnotationsAction` union に追加、reducer + `isCommittingAction` を更新
- **IMPLEMENT**: `REORDER_ACTION_PATTERN` (上記) のとおり
- **MIRROR**: 既存 `annotation/move` の構造
- **IMPORTS**: `cloneAnnotation` / `reorderAnnotation` from `../domain/annotation/operations`
- **GOTCHA**:
  - `isCommittingAction` で両方 `true` (undo に積む)
  - default branch の `_exhaustive: never` が新 action 追加で型エラーを早期検出
- **VALIDATE**:
  - typecheck 緑
  - reducer test 緑

### Task 10: `operations.ts` に `cloneAnnotation` + `reorderAnnotation` 追加

- **ACTION**: 純粋関数 2 つを `apps/web/src/domain/annotation/operations.ts` に追加
- **IMPLEMENT**:
  - `cloneAnnotation(annotation, idGenerator, offset)`: 新 id + 既存 type 別に座標 offset を加算 (例: rectangle → `x + 16, y + 16`、arrow → `from + 16, to + 16` 等)
  - `reorderAnnotation(annotations, id, direction)`: 配列から id の annotation を抜き出し、`direction === 'front'` なら末尾に push、`'back'` なら先頭に unshift
- **MIRROR**: 既存 `addAnnotation` / `removeAnnotation` / `moveAnnotation` の immutable pattern
- **IMPORTS**: `Annotation` type from `@pitamark/shared`、`createAnnotationId` from既存
- **GOTCHA**:
  - `cloneAnnotation` の id 生成は `crypto.randomUUID()` direct 呼び出しではなく、既存 `createAnnotationId` を使う (test 環境で deterministic にできる pattern を継承)
  - `reorderAnnotation` は配列 immutable: `[...annotations.filter(a => a.id !== id), found]` 形式
- **VALIDATE**: operations test 緑 (既存 + 新 6 件程度)

### Task 11: Yjs mutations + codec 更新

- **ACTION**:
  - `apps/web/src/domain/annotation/yjs-mutations.ts` に `duplicateAnnotationY` + `reorderAnnotationY` を追加
  - `apps/web/src/domain/annotation/yjs-codec.ts` に zOrder field の encode/decode を追加 (Open Question Q1 が案 A の場合)
  - `packages/shared/src/annotation.ts` の Zod schema に `zOrder` を追加 (case 案 A)
- **IMPLEMENT**:
  - `duplicateAnnotationY(doc, ya, cloned)`: 既存 `addAnnotationY` を呼ぶだけ (clone は reducer 側で済んでいる)
  - `reorderAnnotationY(doc, ya, id, direction)`: `ya.get(id).set('zOrder', newValue)` で zOrder field を更新。`newValue` は現在の最大/最小から +/-1 (or 浮動小数で間に挿入)
- **MIRROR**: 既存 `moveAnnotationY` の transact + 個別 field set pattern
- **IMPORTS**: `LOCAL_ORIGIN` (CLAUDE.md 8 の規約)
- **GOTCHA**:
  - 全 annotation の zOrder を毎回 renormalize するか、既存 max/min ± 1 で済ますか (Open Question Q1 の sub-detail)
  - 既存 annotation で zOrder 未設定のものは `default(0)` で扱う (Zod default)
  - Yjs codec の encode/decode で zOrder を fallback 0 に
- **VALIDATE**:
  - shared package の test 緑
  - yjs-mutations / yjs-codec の test (もしあれば) 緑

### Task 12: AnnotationLayer 側の menu open/close 挙動 + 統合

- **ACTION**: AnnotationLayer の menu state を Shape の `useLongPress` callback で更新、close は menu 外 pointerdown で発火
- **IMPLEMENT**:
  - `useEffect(() => { window.addEventListener('pointerdown', maybeClose); return cleanup }, [menuOpen])`
  - `maybeClose(e)` は menu の DOM 内タップは無視、menu 外タップで `setMenuOpen(false)`
  - 各 menu 項目選択後の dispatch を Task 9 の新 action 経由で
- **MIRROR**: shadcn-style "click outside to close" pattern
- **GOTCHA**: cleanup を確実に (memory leak)
- **VALIDATE**: 手動 PC + emulation で menu open/close、項目選択が動く

### Task 13: PRD 10.J-2 行を complete に更新

- **ACTION**: `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` の 10.J-2 行
- **IMPLEMENT**: status `pending` → `complete`、Plan link 追加
- **VALIDATE**: grep で確認

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `useLongPress.test.tsx` (5 件) | timer / slop / cancel パス | 各 path で onLongPress 呼ばれる/呼ばれない | Yes |
| `ContextMenu.test.tsx` (6 件) | open / item dispatch / flip / destructive | 各 prop の rendering と callback | Yes |
| `annotationsReducer.test.ts` (新 2 件) | duplicate / reorder action | 配列の正しい変化 | No |
| `operations.test.ts` (新 6 件) | cloneAnnotation / reorderAnnotation | 純粋関数の出力 | No |
| 4 Shape test 拡張 (新 4 件) | useLongPress 配線確認 | hook が正しい props で呼ばれる | No |

### Edge Cases Checklist

- [ ] 長押し中に shape が削除される (peer remote remove) → menu open 時の target id が消える → menu auto close
- [ ] 長押し中に画面回転で viewport 変化 → menu position 再計算 (or close)
- [ ] 連続長押し (1 回目 close 後すぐ 2 回目) → 正しく動作
- [ ] TextShape の `onDblTap` (300ms 以内 2 回タップ) と長押しの混在 → 排他 (どちらか一方のみ発火)
- [ ] 削除 menu 項目 + Yjs sync → mobile→PC で 1 秒以内反映
- [ ] reorder 連続 (front → back → front) → Yjs CRDT 競合解消
- [ ] navigator.vibrate が undefined の environment (Safari iOS) でクラッシュしない

---

## Validation Commands

### Static Analysis
```bash
pnpm typecheck && pnpm lint
```

### Unit Tests
```bash
pnpm test
```
EXPECT: 既存 354 件 + 新規 ~25 件 = 380 件付近 緑

### E2E (回帰のみ、新 spec は 10.J-4 で)
```bash
pnpm test:e2e
```
EXPECT: chromium 78 件 + mobile-chrome 22 件 緑

### Build
```bash
pnpm build
```
EXPECT: success、bundle size 増加 ~5KB gz 以下

### Manual Validation

- [ ] PC Chrome で shape 長押し → menu pop → 4 項目動作
- [ ] PC Chrome で menu 外 click → close
- [ ] DevTools Pixel 5 emulation で 長押し → menu pop → vibrate logged in console
- [ ] **本格実機 QA は 10.J-4 で実施**

---

## Acceptance Criteria

- [ ] Task 1 (Open Questions 確定) 完了
- [ ] Task 2-13 すべて完了 + grep / typecheck / lint 緑
- [ ] unit test 全緑、新規 ~25 件追加
- [ ] menu open / select / close の手動確認 (PC + emulation)
- [ ] 既存 chromium / mobile-chrome E2E 全緑
- [ ] PRD 10.J-2 行 complete

## Completion Checklist

- [ ] Code follows discovered patterns
- [ ] Error handling matches codebase style (try/catch around vibrate のみ)
- [ ] Logging follows codebase conventions (デバッグ console は最終 commit 前に削除)
- [ ] Tests follow test patterns
- [ ] No hardcoded values (定数は `touch-thresholds.ts` から)
- [ ] Documentation updated (PRD + ADR-0007 D4 既存)
- [ ] No unnecessary scope additions (NOT Building セクション準拠)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| zOrder field 追加が既存 annotation の Yjs 互換を壊す | Medium | High | Zod default(0) + codec の fallback で旧 annotation も読める。Plan で migration テスト 1 件追加 |
| `useLongPress` の timer が React 19 strict mode で 2 回発火 | Medium | Medium | useEffect cleanup を確実に、`act()` で test |
| menu の DOM 配置が Konva canvas と z-index で衝突 | High | Low | menu は `position: fixed` で document body 直下、CanvasStage の z-index より高く |
| TextShape の `onDblTap` と長押し menu が競合 | Low | Medium | 300ms vs 500ms で排他、test で確認 |
| reorder 連続実行で Yjs CRDT が無限ループ | Low | High | `LOCAL_ORIGIN` での transact 内 1 回 set のみ、CRDT 自体は競合解決可 |
| 削除 menu 項目で peer の作業が消える事故 | Medium | High | confirm dialog なし (誤発火対策で事前に防ぐ)、undo (`Cmd+Z`) で復元可能なことを担保 |
| `navigator.vibrate(15)` で SecurityError | Low | Low | try/catch、log のみ |
| menu open 中に shape が remote remove → ghost menu | Medium | Low | `useEffect([menuTargetId, annotations])` で targetId が消えたら auto close |
| 推定 800-1200 LOC が膨張して 1500+ LOC に | Medium | Low | Open Question Q1 で zOrder 案 A 採用なら schema 拡張で +200 LOC、許容範囲 |

## Notes

### `useLongPress` の Konva event 適合

Konva の `KonvaEventObject<PointerEvent>` は `e.evt: PointerEvent` を持つ。`useLongPress` の handler は `e.evt.clientX / clientY` を読む前提で、Konva の event を直接渡せる。ただし Konva の `e.cancelBubble` は React の `e.stopPropagation()` とは別物で、適切に両方扱う必要がある (test で確認)。

### Yjs mutators 規約 (CLAUDE.md 8)

`reorderAnnotationY` は **必ず `tx(doc, () => { ... }, LOCAL_ORIGIN)`** で transact 内に書く。peer に伝播する時 origin が null になる仕様で、UndoManager は LOCAL_ORIGIN 起源のみ track する。

### Phase 10.J-3 / 10.J-4 への引き継ぎ

- 10.J-3 (Transformer 再調整): 本 plan で zOrder field を追加した場合、Transformer の anchor は zOrder と関係なし (Transformer は selectedId 単一 shape のみ)
- 10.J-4 (E2E migration): 本 plan の menu 動作は emulation で sanity check のみ。`dispatchEvent('touchstart')` での long-press 再現 (500ms wait) は 10.J-4 で実装

---

## Open Questions

(Task 1 で確定)

- [ ] **Q1**: zOrder の管理方法 → 案 A (zOrder field を schema 追加) / 案 B (createdAt 流用) / 案 C (Y.Array refactor)
  - **暫定**: 案 A — schema 拡張 200 LOC で済む、Yjs 互換は default(0) で
- [ ] **Q2**: menu 項目順 → Material 寄り (削除を最後) / iOS 寄り (削除を最初)
  - **暫定**: Material 寄り (削除を最後、誤タップ防止)
- [ ] **Q3**: TextShape の長押し menu の挙動 → text 編集中 (`isEditing`) は menu を出さない / 出す
  - **暫定**: `isEditing` 中は menu 出さない (text input フォーカス維持優先)
- [ ] **Q4**: PC 右クリック (`onContextMenu`) で menu 出すか → 出す / 長押しのみ
  - **暫定**: 出さない (本 plan は touch UX 中心、PC 右クリックは Phase 11+ で検討)
- [ ] **Q5**: menu 項目選択後の selectedId → 維持 / 解除
  - **暫定**: 削除 → 自動解除 (selection target が消えるため)、複製 → 新 annotation を選択、reorder → 維持
