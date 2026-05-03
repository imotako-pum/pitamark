# Plan: Phase 7.8-2 — Auto-next B: 矩形 → 矢印 次手予測

## Summary

矩形を描き終わった瞬間、矢印プレビュー(半透明)を「**ヤジリ = 矩形右辺中央**、尾 = 右下 45° に既定長 100px」で表示し、Enter 確定で矢印 add → Phase 7.8-1 Auto-next-A に連鎖して text 編集を起動、BS / Esc / 別ツールキー / マウス mousedown でキャンセルする。新規ロジックは「pending state + 5 経路のキャンセル + Enter binding」のみで、矢印確定時の text 即時編集は Phase 7.8-1 で完成済の連鎖を 100% 再利用する。

## User Story

As a **業務スクショで「枠で囲んで矢印で指して補足」を量産するビジネスマン**,
I want **矩形を描いたら既定の右下矢印プレビューが出て、Enter だけで矢印 + テキストが連鎖して完結する**,
So that **「枠 → 指す → 補足」のコンボごとにツール切替 + 位置決め + IME 起動の 3-4 アクションを毎回繰り返す摩擦が消える**.

## Problem → Solution

**Current (Phase 7.7 + 7.8-1 完了時点)**: 矩形を描いた後、ユーザーは (1) `A` キーでツール切替 → (2) ドラッグで矢印を引く → (3) Auto-next-A で text 編集起動 → (4) 補足打鍵。これでも Phase 7.7 比で改善しているが、**矩形と矢印の関係(矢印が矩形を指す)を毎回ユーザーが手で構成する** 摩擦が残る。

**Desired**: 矩形 mouseup の瞬間に既定の右下矢印プレビューが半透明で表示される。Enter で矢印確定 → そのまま Auto-next-A で text 編集に流れ込む。BS / Esc で素直にキャンセルできるので「邪魔頻度 < 1 回/session」を担保。

## Metadata

- **Complexity**: **Medium**
- **Source PRD**: `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md`
- **PRD Phase**: Phase 2: B 矩形→矢印 次手予測
- **Estimated Files**: 7 (CREATE 3, UPDATE 4)
- **Estimated LOC**: 250-350 (production + test)

---

## UX Design

### Before (Phase 7.8-1 完了時点)

```
┌─────────────────────────────────────────────────────────┐
│ 1. ユーザー: R キー押下                                 │
│ 2. ユーザー: ドラッグで矩形を描く                       │
│ 3. ユーザー: A キー押下 (ツール切替)                    │
│ 4. ユーザー: ドラッグで矢印を引く                       │
│ 5. ブラウザ: Auto-next-A 起動 → textarea + フォーカス    │
│ 6. ユーザー: 補足を打鍵 → Enter                         │
└─────────────────────────────────────────────────────────┘
合計: 6 アクション (矩形描画 + ツール切替 + 矢印描画 + 補足)
```

### After (Phase 7.8-2 完了時点)

```
┌─────────────────────────────────────────────────────────┐
│ 1. ユーザー: R キー押下                                 │
│ 2. ユーザー: ドラッグで矩形を描く                       │
│ 3. ブラウザ: 矩形 add → 既定矢印プレビュー表示          │
│             (矩形右辺中央 → 右下 45°/100px、半透明)     │
│ 4. ユーザー: Enter                                       │
│ 5. ブラウザ: 矢印 add → Auto-next-A 連鎖 → textarea     │
│ 6. ユーザー: 補足を打鍵 → Enter                         │
└─────────────────────────────────────────────────────────┘
合計: 4 アクション (矩形描画 + Enter 確定 + 補足)
キャンセル: BS / Esc / 別ツールキー / マウス mousedown
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 矩形 mouseup 直後の状態 | tool=rectangle、selectedId=新矩形 | tool=rectangle (or select)、selectedId=新矩形、`pendingAutoArrow` ref が立つ、半透明矢印プレビュー描画 | tool は変更しない (PRD 確定: `select` 相当の自由状態) |
| pending 中 Enter | (該当しない、textarea がなければ no-op) | 矢印 add + Auto-next-A 連鎖起動 (text + IME) | 新規 binding |
| pending 中 BS | (該当: 選択中注釈削除) | pending クリア (矩形は残る、tool=rectangle のまま) | pending 優先、通常 BS は pending クリア後に復帰 |
| pending 中 Esc | (該当: 選択解除) | pending クリア (矩形は残る) | pending 優先、handleEscape の最初 |
| pending 中 別ツールキー (V/R/A/T/H) | (該当: ツール切替) | pending クリア + 新ツールへ切替 | `handleSetTool` で吸収 |
| pending 中 マウス mousedown (任意座標) | (該当: stage クリックで選択解除など) | pending クリア + 通常 mousedown 処理続行 | CanvasStage `handleMouseDown` 冒頭で吸収 |
| 矢印プレビューの見た目 | (該当しない) | 半透明 (opacity 0.4) で `pointerAtBeginning` (矢じりが矩形右辺中央) | listening=false の Layer で描画 |
| Cmd+Z 1 回 (Enter 確定後) | text を削除 | text を削除 (矢印は残る) | Phase 7.8-1 と同じ |
| Cmd+Z 2 回 (Enter 確定後) | 矢印も削除 | 矢印も削除 (矩形は残る) | stopUndoCapture で 3 step 分離 |
| Cmd+Z 3 回 (Enter 確定後) | (Phase 7.8-1 では矩形も同 step) | 矩形も削除 | 矩形 → 矢印 → text の 3 ステップ |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/web/src/components/canvas/CanvasStage.tsx` | 全体 (468 行) | pending Arrow プレビュー描画位置、handleMouseDown / handleMouseUp 拡張位置、Phase 7.8-1 Auto-next-A 経路 (L302-337) を共通関数に抽出 |
| P0 | `apps/web/src/pages/EditorShell.tsx` | 全体 (385 行) | pending state を持つ場所、handleEscape / handleDelete / handleSetTool 拡張、useKeyboardShortcuts 配線、autoNextChainRef 再利用 |
| P0 | `apps/web/src/hooks/useKeyboardShortcuts.ts` | 全体 (129 行) | 新キー (Enter) 追加位置、isEditableTarget ガード継承、preventDefault 規約 |
| P0 | `apps/web/src/lib/autoNextOffset.ts` | 全体 (30 行) | Auto-next-A 連鎖時の text offset 計算 (`computeAutoNextTextOffset(from, to, distance)`)、新 plan で 100% 再利用 |
| P0 | `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | 1-60 | `pointerAtBeginning` の意味 (Phase 7.8-1 修正)、from = ヤジリ side、to = 尾 side。pending 矢印のプレビュー描画も同 props で出す |
| P0 | `apps/web/src/components/canvas/colors.ts` | 全体 | DEFAULT_STROKE_WIDTH / ARROW_POINTER_LENGTH / ARROW_POINTER_WIDTH を import |
| P1 | `apps/web/src/hooks/useAnnotationsStore.ts` | 全体 (78 行) | `stopUndoCapture` が既存 (Phase 7.8-1 で追加済)、矩形 add の直後と arrow add の直前/直後で呼ぶ |
| P1 | `apps/web/src/hooks/useYjsAnnotationsStore.ts` | 165-170 | `stopUndoCapture` の Yjs 経路 (`ctx.undoManager.stopCapturing()`) — Phase 7.8-2 で 2 回呼ぶ場合の挙動 |
| P1 | `apps/web/src/hooks/annotationsReducer.ts` | 全体 (146 行) | `Tool` 型、`AnnotationsAction` 全体、`isCommittingAction` (annotation/add は committing) |
| P1 | `packages/shared/src/annotation.ts` | 1-86 | `Annotation` discriminated union、`RectangleAnnotation` / `ArrowAnnotation` 形状、`Point` |
| P1 | `apps/web/src/lib/id.ts` | 全体 | `generateId()` |
| P2 | `apps/web/e2e/auto-next-arrow-text.spec.ts` | 全体 (Phase 7.8-1 完成版) | E2E パターン: window expose key 命名規則、setupRoomWithImage / dragArrow / annotationCount / currentTool ヘルパ、polling 設計 |
| P2 | `apps/web/src/lib/__tests__/autoNextOffset.test.ts` | 全体 (Phase 7.8-1) | unit test の AAA + describe ネスト、純関数の vitest スタイル |
| P2 | `apps/web/src/components/canvas/AnnotationLayer.tsx` | 全体 | `<Layer>` の使い方、`extraLayers` slot との関係 (pending arrow を AnnotationLayer に混ぜない理由 — annotation 配列に偽要素を入れたくない) |
| P2 | `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` | 全体 | `Harness` + `press` パターン、`onConfirmAutoArrow` の test 追加形式 |
| P2 | `apps/web/src/components/canvas/TextEditorOverlay.tsx` | 全体 (82 行) | textarea の `stopPropagation` で Enter が window keydown まで bubble しないことを確認 (Enter binding 競合がない理由) |

## External Documentation

No external research needed — feature uses established internal patterns:

- text 即時編集 / TextEditorOverlay 経路 (Phase 7.7)
- Auto-next-A 連鎖 + autoNextChainRef + stopUndoCapture (Phase 7.8-1)
- Konva `<Arrow opacity>` プレビュー (公式 props、`pointerAtBeginning` は Phase 7.8-1 で実証済)
- React useRef + useState の同期 (Phase 7.7-3 panActiveRef パターン)
- Window expose for E2E (Phase 7.7-3, 7.8-1 で実証)

---

## Patterns to Mirror

### PENDING_STATE_REF + STATE (Phase 7.7-3 panActiveRef を踏襲)

```tsx
// SOURCE: apps/web/src/components/canvas/CanvasStage.tsx:122-128
const spaceDownRef = useRef(false);
const panActiveRef = useRef(false);
const panLastRef = useRef<{ x: number; y: number } | null>(null);
```

**応用**: pending Auto-arrow は **EditorShell に持つ**(CanvasStage の Layer 描画と useKeyboardShortcuts 両方が触る必要)。ref + state の二重管理:
- ref: 同 React event 内で同期参照(handleConfirmAutoArrow / handleCancelAutoArrow が ref.current で最新値を見る)
- state: Konva 再レンダーをトリガ(プレビュー Arrow を表示/消す)

### AUTO_NEXT_A_CHAIN (Phase 7.8-1 の text 即時編集起動)

```tsx
// SOURCE: apps/web/src/components/canvas/CanvasStage.tsx:311-337
if (currentDraft.type === 'arrow') {
  store.stopUndoCapture();
  const offset = computeAutoNextTextOffset(
    currentDraft.from,
    currentDraft.to,
    AUTO_NEXT_TEXT_OFFSET_PX,
  );
  const textId = generateId();
  const textAnnotation: Annotation = {
    id: textId,
    type: 'text',
    createdAt: Date.now(),
    x: currentDraft.to.x + offset.x,
    y: currentDraft.to.y + offset.y,
    text: '',
    fontSize: DEFAULT_FONT_SIZE,
    color: activeColor,
  };
  dispatch({ type: 'annotation/add', annotation: textAnnotation });
  dispatch({ type: 'tool/set', tool: 'text' });
  dispatch({ type: 'select/set', id: textId });
  onStartTextEditing(textId, { autoNext: true });
}
```

**応用**: Phase 7.8-2 の Enter 確定経路で、矢印 add の直後にこの構造をそのまま呼ぶ。ただし呼出元が CanvasStage ではなく EditorShell(handleConfirmAutoArrow)になる点に注意。EditorShell から `onStartTextEditing` を呼ぶ代わりに `handleStartTextEditing(id, { autoNext: true })` を直接呼ぶ。

### KEYBOARD_SHORTCUT_OPTIONAL_BINDING (Phase 7.7-4 onShowHelp パターン)

```tsx
// SOURCE: apps/web/src/hooks/useKeyboardShortcuts.ts:99-106
if (!mod && e.key === '?') {
  const cb = ref.current.onShowHelp;
  if (cb) {
    e.preventDefault();
    cb();
  }
  return;
}
```

**応用**: Enter binding も同じ作法。`onConfirmAutoArrow` を **pending != null のときだけ provide** し、それ以外は undefined にすることで、通常時の Enter は奪わない。

```tsx
// useKeyboardShortcuts に追加
if (!mod && e.key === 'Enter' && !e.shiftKey) {
  const cb = ref.current.onConfirmAutoArrow;
  if (cb) {
    e.preventDefault();
    cb();
  }
  return;
}
```

```tsx
// EditorShell の useKeyboardShortcuts 配線
onConfirmAutoArrow: pendingAutoArrow ? handleConfirmAutoArrow : undefined,
```

### CANCEL_PRIORITY_HANDLERS (Esc / Delete / SetTool 拡張)

```tsx
// SOURCE: apps/web/src/pages/EditorShell.tsx:146-154
const handleEscape = useCallback(() => {
  if (editingTextId) {
    setEditingTextId(null);
    return;
  }
  if (store.state.selectedId) {
    store.dispatch({ type: 'select/set', id: null });
  }
}, [editingTextId, store]);
```

**応用**: 既存の優先順位ハンドラに pending Auto-arrow クリアを **最初に挿入**:

```tsx
const handleEscape = useCallback(() => {
  if (pendingAutoArrowRef.current) {
    setPendingAutoArrow(null);
    return;
  }
  if (editingTextId) {
    setEditingTextId(null);
    return;
  }
  if (store.state.selectedId) {
    store.dispatch({ type: 'select/set', id: null });
  }
}, [editingTextId, store]);
```

handleDelete / handleSetTool も同じく pending を最初にチェックして return / クリア。

### KONVA_LAYER_LISTENING_FALSE (プレビュー描画)

```tsx
// SOURCE: apps/web/src/components/canvas/ImageLayer.tsx 等
<Layer listening={false}>
  <KonvaImage image={image} listening={false} />
</Layer>
```

**応用**: pending Arrow プレビューも `listening={false}` の Layer に描画する。ヒット検知不要 + 既存 AnnotationLayer の hit-test を奪わない。

### WINDOW_EXPOSE_FOR_E2E (Phase 7.8-1 `__SNAP_SHARE_TOOL__` パターン)

```tsx
// SOURCE: apps/web/src/pages/EditorShell.tsx:202-204
useEffect(() => {
  (window as unknown as Record<string, unknown>).__SNAP_SHARE_TOOL__ = store.state.tool;
}, [store.state.tool]);
```

**応用**: pendingAutoArrow を `__SNAP_SHARE_PENDING_AUTO_ARROW__` で expose、E2E から poll で「pending が立った/消えた」を検証可能にする。

### STOP_UNDO_CAPTURE_BREAKPOINT (Phase 7.8-1)

```tsx
// SOURCE: apps/web/src/components/canvas/CanvasStage.tsx:315
store.stopUndoCapture();
```

**応用**: 矩形 mouseup 直後と Enter 確定経路で 2 回呼ぶ:
- 矩形 add 直後 → step 1 (矩形) を fix
- Enter 確定で矢印 add 直前 → step 2 開始のためのクリーンスタート、ただし add は committing なので明示呼出は不要(ただし保険で呼ぶ)
- text add 前 → step 2 (矢印) を fix、step 3 (text) として独立

**結果**: Cmd+Z 連打で text → 矢印 → 矩形 の 3 段巻き戻し。

### UNIT_TEST_PURE_FUNCTION (Phase 7.7-4 colorCycle / Phase 7.8-1 autoNextOffset)

```ts
// SOURCE: apps/web/src/lib/__tests__/autoNextOffset.test.ts
import { describe, expect, it } from 'vitest';
import { computeAutoNextTextOffset } from '../autoNextOffset';

describe('computeAutoNextTextOffset', () => {
  it('returns +x offset for a right-pointing arrow', () => {
    expect(computeAutoNextTextOffset({ x: 0, y: 0 }, { x: 100, y: 0 }, 8)).toEqual({ x: 8, y: 0 });
  });
  // ...
});
```

**応用**: `computeAutoArrowDefault(rect): { from, to }` を同じスタイルで test。

### E2E_AUTO_NEXT_PATTERN (Phase 7.8-1 spec)

```ts
// SOURCE: apps/web/e2e/auto-next-arrow-text.spec.ts
const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';
const TOOL_KEY = '__SNAP_SHARE_TOOL__';

const setupRoomWithImage = async (page) => {
  await page.goto('/');
  await dropImageBuffer(page, SAMPLE, 'auto-next.png');
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
  await page.waitForFunction(
    (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
    ANNOTATIONS_KEY,
    { timeout: 10_000 },
  );
  // ...
};
```

**応用**: 矩形描画 → pending poll → Enter or BS / Esc → annotation count poll でカバー。

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/lib/autoArrowDefault.ts` | CREATE | 純関数 `computeAutoArrowDefault(rect): { from, to }` を独立配置(unit test しやすい)。`AUTO_ARROW_DEFAULT_LENGTH_PX = 100` 定数も export |
| `apps/web/src/lib/__tests__/autoArrowDefault.test.ts` | CREATE | 純関数 unit test(右辺中央 / 45° / 矩形サイズ違い / 定数値域) |
| `apps/web/e2e/auto-next-rect-arrow.spec.ts` | CREATE | E2E spec(Enter 確定 + A 連鎖 / BS キャンセル / Esc キャンセル / 別ツールキー / mousedown キャンセル / Cmd+Z 3 段巻き戻し / 通常 R ツール影響なし) |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATE | `pendingAutoArrow` props 受け取り → Layer プレビュー描画 / `handleMouseDown` 冒頭でキャンセル / `handleMouseUp` rectangle 経路で `onAutoNextRectangle` callback 呼出 |
| `apps/web/src/pages/EditorShell.tsx` | UPDATE | `pendingAutoArrowRef + pendingAutoArrow state + setPending` / `handleAutoNextRectangle` / `handleConfirmAutoArrow`(矢印 add → Auto-next-A 連鎖) / `handleCancelAutoArrow` / `handleEscape`/`handleDelete`/`handleSetTool` を pending 優先に拡張 / window expose `__SNAP_SHARE_PENDING_AUTO_ARROW__` |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | UPDATE | `onConfirmAutoArrow?: () => void` props 追加 + Enter binding(`!mod && e.key === 'Enter' && !shift` で provided なら preventDefault + 呼出) |
| `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` | UPDATE | Enter binding test 追加(provided で発火 / undefined で no-op / Shift+Enter で発火しない / mod+Enter で発火しない / input フォーカス時無効化) |
| `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` | UPDATE | Phase 2 status を `pending` → `in-progress` + plan link |

**触らないファイル**(影響範囲外):

- `packages/shared/src/annotation.ts` — Schema 変更不要(既存 Rectangle / Arrow / Text スキーマで成立)
- `apps/web/src/hooks/annotationsReducer.ts` — 既存 action だけで成立
- `apps/web/src/hooks/useAnnotationsStore.ts` / `useYjsAnnotationsStore.ts` — Phase 7.8-1 の `stopUndoCapture` を再利用
- `apps/web/src/lib/autoNextOffset.ts` — Phase 7.8-1 の `computeAutoNextTextOffset` を再利用
- `apps/web/src/components/canvas/shapes/ArrowShape.tsx` — pointerAtBeginning の挙動はそのまま、pending Arrow も同 props で描画
- `apps/web/src/components/canvas/AnnotationLayer.tsx` — 触らない、pending Arrow は別 Layer
- `apps/web/src/components/canvas/TextEditorOverlay.tsx` — 触らない、Phase 7.8-1 で確定済の経路をそのまま使う
- `apps/web/src/components/dialogs/HelpModal.tsx` — Phase 5 でまとめて更新

## NOT Building

- **Phase 3 (フォントサイズ UI)** — 別 plan
- **Phase 4 (Smart snap)** — 別 plan
- **HelpModal 更新** — Phase 5 でまとめて追記
- **マウスドラッグで起点指定 (PRD で代替案として却下)** — Enter/BS 経路で MVP 成立、ユーザーが自前で矢印を引きたい場合は **mousedown で pending クリア → そのまま `A` キーで通常矢印ツール** という 2 ステップで対応(PRD 確定経路)
- **既定矢印の方向/長さの動的計算**(画像端を超えないように調整)— 右下 45° / 100px 固定。dogfood で要望出れば Phase 5 で再評価
- **既定矢印の右下以外の方向**(右上 / 左下 / 左上)— PRD 確定: 右下のみ MVP
- **連続 Auto-next-B**(矢印確定 → text 確定 → 自動的に次の矩形描画モード)— スコープ外、ユーザーが R キー押下で再開
- **pending 中の他クライアント可視化** — PRD 確定: しない
- **opt-out 設定 / 修飾子発火** — PRD 確定: 常時 ON
- **新規ショートカット追加(Enter 以外)** — Enter のみ追加、それ以外は既存キーで吸収
- **矩形以外の確定後 pending(矢印 → 矩形 等の逆連鎖)** — スコープ外
- **Arrow `pointerAtEnding` への戻し** — Phase 7.8-1 で `pointerAtBeginning` 反転済、Phase 7.8-2 はその挙動を前提として `from = ヤジリ = 矩形右辺中央` で実装

---

## Step-by-Step Tasks

### Task 1: 純関数 `computeAutoArrowDefault` を新規作成

- **ACTION**: `apps/web/src/lib/autoArrowDefault.ts` を新規作成
- **IMPLEMENT**:
  ```typescript
  import type { Point, RectangleAnnotation } from '@snap-share/shared';

  // Phase 7.8-2 Auto-next-B: 矩形確定時の既定矢印プレビューの長さ。右下 45° 方向に
  // この距離だけ尾(to)を伸ばす。dogfood で長すぎ/短すぎが出れば Phase 5 で再評価。
  export const AUTO_ARROW_DEFAULT_LENGTH_PX = 100;

  /**
   * Compute the default auto-arrow endpoints for a rectangle: arrowhead anchored
   * at the rectangle's right-edge midpoint, tail extending 100px down-right at 45°.
   *
   * Returns `{ from, to }` where `from` is the arrowhead side (rectangle right-edge
   * midpoint, since Phase 7.8-1 set `pointerAtBeginning` on `<KonvaArrow>`) and
   * `to` is the tail side. The Auto-next-A chain then places the auto-text along
   * `to + offset` (= further away from the rectangle, in the user's reading flow).
   */
  export const computeAutoArrowDefault = (
    rect: Pick<RectangleAnnotation, 'x' | 'y' | 'width' | 'height'>,
  ): { from: Point; to: Point } => {
    const arrowHead: Point = {
      x: rect.x + rect.width,
      y: rect.y + rect.height / 2,
    };
    const tail: Point = {
      x: arrowHead.x + AUTO_ARROW_DEFAULT_LENGTH_PX / Math.SQRT2,
      y: arrowHead.y + AUTO_ARROW_DEFAULT_LENGTH_PX / Math.SQRT2,
    };
    return { from: arrowHead, to: tail };
  };
  ```
- **MIRROR**: `apps/web/src/lib/autoNextOffset.ts` の構造(定数 export + 純関数 export + 一段の JSDoc)
- **IMPORTS**: `import type { Point, RectangleAnnotation } from '@snap-share/shared';`
- **GOTCHA**:
  - `Math.SQRT2` は `Math.sqrt(2)` と同等。Konva の浮動小数演算を考慮して定数を直接使う(`100 / Math.SQRT2 ≈ 70.71`)
  - `Pick<RectangleAnnotation, 'x' | 'y' | 'width' | 'height'>` で他のフィールド(color/strokeWidth/id/createdAt/type)依存を作らない → unit test がシンプルに
  - Phase 7.8-1 の `pointerAtBeginning` 反転と整合: `from = ヤジリ = 矩形右辺中央`、`to = 尾 = 右下方向`
- **VALIDATE**: `pnpm -w typecheck` でゼロエラー

### Task 2: `computeAutoArrowDefault` の unit test

- **ACTION**: `apps/web/src/lib/__tests__/autoArrowDefault.test.ts` を新規作成
- **IMPLEMENT**:
  ```typescript
  import { describe, expect, it } from 'vitest';
  import { AUTO_ARROW_DEFAULT_LENGTH_PX, computeAutoArrowDefault } from '../autoArrowDefault';

  describe('computeAutoArrowDefault', () => {
    it('places the arrowhead at the right-edge midpoint of a 100x80 rectangle at origin', () => {
      const { from, to } = computeAutoArrowDefault({ x: 0, y: 0, width: 100, height: 80 });
      // 右辺中央 = (100, 40)
      expect(from).toEqual({ x: 100, y: 40 });
      // 100px 右下 45°
      const expected = 100 / Math.SQRT2;
      expect(to.x).toBeCloseTo(100 + expected, 5);
      expect(to.y).toBeCloseTo(40 + expected, 5);
    });

    it('preserves the from/to relationship for a translated rectangle', () => {
      const { from, to } = computeAutoArrowDefault({ x: 200, y: 150, width: 60, height: 40 });
      expect(from).toEqual({ x: 260, y: 170 });
      const expected = 100 / Math.SQRT2;
      expect(to.x).toBeCloseTo(260 + expected, 5);
      expect(to.y).toBeCloseTo(170 + expected, 5);
    });

    it('uses the AUTO_ARROW_DEFAULT_LENGTH_PX constant for the tail extension distance', () => {
      const { from, to } = computeAutoArrowDefault({ x: 0, y: 0, width: 10, height: 10 });
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      expect(length).toBeCloseTo(AUTO_ARROW_DEFAULT_LENGTH_PX, 5);
    });

    it('extends the tail at exactly 45° down-right (dx === dy)', () => {
      const { from, to } = computeAutoArrowDefault({ x: 0, y: 0, width: 50, height: 30 });
      expect(to.x - from.x).toBeCloseTo(to.y - from.y, 5);
      // 両方とも正 (右下)
      expect(to.x - from.x).toBeGreaterThan(0);
      expect(to.y - from.y).toBeGreaterThan(0);
    });

    it('produces a deterministic constant value when called multiple times', () => {
      const r = { x: 100, y: 50, width: 80, height: 60 };
      expect(computeAutoArrowDefault(r)).toEqual(computeAutoArrowDefault(r));
    });
  });
  ```
- **MIRROR**: `apps/web/src/lib/__tests__/autoNextOffset.test.ts` の vitest describe + it スタイル
- **IMPORTS**: `import { describe, expect, it } from 'vitest';` + `import { AUTO_ARROW_DEFAULT_LENGTH_PX, computeAutoArrowDefault } from '../autoArrowDefault';`
- **GOTCHA**:
  - 浮動小数比較は `toBeCloseTo(expected, 5)`(小数 5 桁精度)
  - `from` は整数になる(座標が整数なら)→ `toEqual` で OK、`to` は無理数を含むので `toBeCloseTo`
- **VALIDATE**: `pnpm -F @snap-share/web test -- src/lib/__tests__/autoArrowDefault.test.ts` で 5 ケース全緑

### Task 3: `useKeyboardShortcuts` に `onConfirmAutoArrow` (Enter binding) 追加

- **ACTION**: `apps/web/src/hooks/useKeyboardShortcuts.ts` を更新
- **IMPLEMENT**:
  - `KeyboardShortcuts` 型に追加:
    ```typescript
    /** Optional. Enter (no modifier, no shift) → confirm pending auto-arrow.
     *  preventDefault only when provided so Enter keeps its default elsewhere
     *  (e.g. button focus, form submit) when there is no pending arrow. */
    onConfirmAutoArrow?: () => void;
    ```
  - onKey 内に分岐追加(既存の `if (!mod && e.key === '?')` の **直後**、modifier 不要の Enter として並べる):
    ```typescript
    // Enter — confirm pending auto-arrow (Phase 7.8-2). text 編集中は textarea が
    // stopPropagation するためここに届かない。pending != null のときだけ provided
    // 経路で発火し、それ以外は browser default の Enter (ボタン focus 等) を温存。
    if (!mod && e.key === 'Enter' && !e.shiftKey) {
      const cb = ref.current.onConfirmAutoArrow;
      if (cb) {
        e.preventDefault();
        cb();
      }
      return;
    }
    ```
  - 配置: `if (!mod && e.key === '?')` の直後、`if (!mod && key === 'c')` の前
- **MIRROR**: `KEYBOARD_SHORTCUT_OPTIONAL_BINDING` パターン(Phase 7.7-4 onShowHelp)
- **IMPORTS**: 変更なし
- **GOTCHA**:
  - `e.key === 'Enter'`(`'enter'` ではない、`e.key.toLowerCase()` 経由ではなく `e.key` を直接比較するので **大文字 'E' で始まる**)
  - text 編集中の Enter は TextEditorOverlay の textarea で `stopPropagation` 済 → window keydown には届かない(既存挙動)
  - 通常時(pending なし)は `onConfirmAutoArrow` が undefined → preventDefault 呼ばれず、browser default の Enter(ボタン focus / フォーム submit)が動く
  - `Shift+Enter` は除外(将来「逆方向確定」等のために予約 / textarea 改行と重複しないため)
- **VALIDATE**: `pnpm -w typecheck` でゼロエラー

### Task 4: `useKeyboardShortcuts` のテスト拡充

- **ACTION**: `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` に test 追加
- **IMPLEMENT**:
  ```typescript
  it('Enter fires onConfirmAutoArrow and prevents default when provided', () => {
    const onConfirmAutoArrow = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onConfirmAutoArrow })} />);
    const { prevented } = press({ key: 'Enter' });
    expect(onConfirmAutoArrow).toHaveBeenCalledOnce();
    expect(prevented).toBe(true);
  });

  it('Enter does NOT preventDefault when onConfirmAutoArrow is undefined', () => {
    mount.render(<Harness shortcuts={baseShortcuts()} />);
    const { prevented } = press({ key: 'Enter' });
    expect(prevented).toBe(false);
  });

  it('Shift+Enter does NOT trigger confirm', () => {
    const onConfirmAutoArrow = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onConfirmAutoArrow })} />);
    press({ key: 'Enter', shiftKey: true });
    expect(onConfirmAutoArrow).not.toHaveBeenCalled();
  });

  it('Cmd+Enter does NOT trigger confirm (modifier required to be absent)', () => {
    const onConfirmAutoArrow = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onConfirmAutoArrow })} />);
    press({ key: 'Enter', metaKey: true });
    expect(onConfirmAutoArrow).not.toHaveBeenCalled();
  });

  it('does not fire Enter binding when focus is in an input', () => {
    const onConfirmAutoArrow = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onConfirmAutoArrow })} />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(event, 'target', { value: input, writable: false });
    window.dispatchEvent(event);
    expect(onConfirmAutoArrow).not.toHaveBeenCalled();
    input.remove();
  });
  ```
- **MIRROR**: 既存の `Harness` + `press` ヘルパパターン(Phase 7.7-4 で導入)
- **IMPORTS**: 既存の vi / Harness / press / baseShortcuts
- **GOTCHA**:
  - `press({ key: 'Enter' })` は happy-dom で `e.key === 'Enter'` を生成
  - `key` は大文字始まり(`'Enter'`)、`e.key.toLowerCase()` 比較経路ではないので注意
  - `metaKey: true` で Cmd+Enter、`shiftKey: true` で Shift+Enter のテスト
- **VALIDATE**: `pnpm -F @snap-share/web test -- useKeyboardShortcuts` で 17 ケース(既存 12 + 新規 5)全緑

### Task 5: `CanvasStage` に pendingAutoArrow props + プレビュー描画 + handleMouseDown キャンセル + handleMouseUp rectangle 経路

- **ACTION**: `apps/web/src/components/canvas/CanvasStage.tsx` を更新
- **IMPLEMENT**:
  1. props 型に追加:
     ```typescript
     /** Phase 7.8-2 Auto-next-B: pending 中の既定矢印プレビュー(半透明)を描画する。
      *  null のときはプレビュー無し。state は EditorShell に置き、ここでは
      *  受け取って描画するだけ。 */
     pendingAutoArrow: { from: Point; to: Point; color: string; strokeWidth: number } | null;
     /** 矩形 mouseup 直後に呼ばれる。EditorShell が pending state を立てる。 */
     onAutoNextRectangle: (rect: { x: number; y: number; width: number; height: number }) => void;
     /** マウス mousedown 任意座標で pending をキャンセルする経路。pending が null のときは
      *  no-op、null でないときは EditorShell が pending を null にする。CanvasStage は
      *  クリア後に通常の mousedown 処理を続行する。 */
     onCancelAutoArrowIfAny: () => void;
     ```
  2. props 受け取りに追加:
     ```typescript
     pendingAutoArrow,
     onAutoNextRectangle,
     onCancelAutoArrowIfAny,
     ```
  3. import 追加(`KonvaArrow` と関連色定数):
     ```typescript
     import { Arrow as KonvaArrow, Layer } from 'react-konva';
     // colors.ts から既存:
     import {
       ARROW_POINTER_LENGTH,
       ARROW_POINTER_WIDTH,
       DEFAULT_FONT_SIZE,
       DEFAULT_STROKE_WIDTH,
     } from './colors';
     ```
     既存の `Stage` import に Layer / Arrow を追加。なお `react-konva` から複数 export されている。
  4. `handleMouseDown` 冒頭に pending キャンセルを追加(既存 Space pan check の **後**、selectedId クリアの **前**):
     ```typescript
     const handleMouseDown = useCallback(
       (e: KonvaEventObject<MouseEvent>) => {
         const stage = e.target.getStage();
         if (!stage) return;

         if (spaceDownRef.current) {
           // ... 既存 pan
           return;
         }

         // Phase 7.8-2: pending Auto-arrow があれば、マウスクリック (任意座標) で
         // キャンセル。クリック自体は通常の mousedown 処理を続行する (stage クリックで
         // 選択解除など) → ユーザーが「右下既定矢印が合わない」時に自前で矢印を
         // 描き始められる。
         onCancelAutoArrowIfAny();

         // ... 既存 isStageClick / select/draw/text ロジック
       },
       [tool, dispatch, onStartTextEditing, activeColor, selectedId, setCursor, onCancelAutoArrowIfAny],
     );
     ```
  5. `handleMouseUp` の `if (currentDraft.type === 'arrow') { ... }` の **直前** に rectangle 分岐を追加:
     ```typescript
     if (reachedThreshold && currentDraft) {
       dispatch({ type: 'annotation/add', annotation: currentDraft });
       dispatch({ type: 'select/set', id: currentDraft.id });

       // Phase 7.8-2 Auto-next-B: 矩形確定直後に既定矢印プレビューを立てる。
       // pending state は EditorShell に置き、ここでは callback で通知。stopUndoCapture
       // も EditorShell 側で呼ぶ (handleAutoNextRectangle 内) ため、ここでは矩形 add の
       // 直後だけで他の処理はしない。
       if (currentDraft.type === 'rectangle') {
         onAutoNextRectangle({
           x: currentDraft.x,
           y: currentDraft.y,
           width: currentDraft.width,
           height: currentDraft.height,
         });
       }

       if (currentDraft.type === 'arrow') {
         // ... 既存 Auto-next-A 経路 (変更なし)
       }
     }
     ```
  6. Stage の return JSX 末尾、`<AnnotationLayer>` と `{extraLayers}` の **間** に pending Arrow Layer を追加:
     ```jsx
     <AnnotationLayer ... />
     {pendingAutoArrow && (
       <Layer listening={false}>
         <KonvaArrow
           points={[
             pendingAutoArrow.from.x,
             pendingAutoArrow.from.y,
             pendingAutoArrow.to.x,
             pendingAutoArrow.to.y,
           ]}
           // Phase 7.8-1 と同じ反転で矢じり = from = 矩形右辺中央
           pointerAtBeginning
           pointerAtEnding={false}
           pointerLength={ARROW_POINTER_LENGTH}
           pointerWidth={ARROW_POINTER_WIDTH}
           stroke={pendingAutoArrow.color}
           fill={pendingAutoArrow.color}
           strokeWidth={pendingAutoArrow.strokeWidth}
           opacity={0.4}
         />
       </Layer>
     )}
     {extraLayers}
     ```
  7. `handleMouseUp` の依存配列に `onAutoNextRectangle` を追加(既存の `[dispatch, setCursor, activeColor, onStartTextEditing, store.stopUndoCapture]` に末尾追加)
- **MIRROR**: AUTO_NEXT_A_CHAIN(handleMouseUp arrow 分岐の構造)、KONVA_LAYER_LISTENING_FALSE(プレビュー Layer)、PENDING_STATE_REF + STATE
- **IMPORTS**:
  ```typescript
  import { Arrow as KonvaArrow, Layer, Stage } from 'react-konva';
  import {
    ARROW_POINTER_LENGTH,
    ARROW_POINTER_WIDTH,
    DEFAULT_FONT_SIZE,
    DEFAULT_STROKE_WIDTH,
  } from './colors';
  ```
- **GOTCHA**:
  - **rectangle 分岐 と arrow 分岐は排他**(annotation type は判別共用体): if/if の 2 つに分けて書く(if/else if でも OK だが、既存 arrow 分岐をいじりたくないので追加だけ)
  - **handleMouseDown の `onCancelAutoArrowIfAny` 呼出位置**: Space pan の後、selectedId クリアの前。これにより「Space+drag pan 中に pending 残しっぱなし」を避けつつ、「mousedown で pending を消して、その後通常の選択解除処理が走る」順序になる
  - **pending Layer の listening={false}**: ヒット検知させない。AnnotationLayer の hit-test を奪わないため
  - **opacity 0.4**: PRD plan 記述通り。dogfood で要調整なら Phase 5 で
  - **依存配列**: useCallback の依存に `onAutoNextRectangle` / `onCancelAutoArrowIfAny` を追加(EditorShell が useCallback で stable ref を渡すので毎レンダー再生成されない)
  - **Layer の z-order**: AnnotationLayer の上、extraLayers の下。awareness layer (extraLayers) が常に最上に来るので presence カーソルは pending arrow の上に表示される(自然な挙動)
- **VALIDATE**:
  - `pnpm -w typecheck`
  - 手動: `pnpm -F @snap-share/web dev` で 矩形を描く → 半透明矢印が右下に出る、まだクリック / Enter / BS は配線されてないので Phase 6 で確認

### Task 6: `EditorShell` に pending state + handlers + window expose

- **ACTION**: `apps/web/src/pages/EditorShell.tsx` を更新
- **IMPLEMENT**:
  1. import 追加:
     ```typescript
     import type { Annotation, Point, RectangleAnnotation, TextAnnotation } from '@snap-share/shared';
     import {
       ARROW_POINTER_LENGTH,
       ARROW_POINTER_WIDTH,
       DEFAULT_FONT_SIZE,
       DEFAULT_STROKE_WIDTH,
     } from '../components/canvas/colors';
     import { generateId } from '../lib/id';
     import { AUTO_ARROW_DEFAULT_LENGTH_PX, computeAutoArrowDefault } from '../lib/autoArrowDefault';
     import { AUTO_NEXT_TEXT_OFFSET_PX, computeAutoNextTextOffset } from '../lib/autoNextOffset';
     ```
  2. pending state を追加(`autoNextChainRef` の隣):
     ```typescript
     // Phase 7.8-2 Auto-next-B: 矩形確定直後の既定矢印プレビューの pending 状態。
     // CanvasStage の Layer 描画と useKeyboardShortcuts (Enter binding) 両方が touch するため
     // EditorShell に置く。ref + state の二重管理 — ref は同 React event 内で同期参照 (Enter
     // 確定 callback が ref.current で最新を見る)、state は Konva 再レンダーをトリガする。
     type PendingAutoArrow = Readonly<{
       from: Point;
       to: Point;
       color: string;
       strokeWidth: number;
     }>;
     const pendingAutoArrowRef = useRef<PendingAutoArrow | null>(null);
     const [pendingAutoArrow, setPendingAutoArrowState] = useState<PendingAutoArrow | null>(null);

     const setPendingAutoArrow = useCallback((p: PendingAutoArrow | null) => {
       pendingAutoArrowRef.current = p;
       setPendingAutoArrowState(p);
     }, []);
     ```
  3. 矩形 mouseup 時に呼ばれる callback:
     ```typescript
     const handleAutoNextRectangle = useCallback(
       (rect: { x: number; y: number; width: number; height: number }) => {
         // 矩形 add は CanvasStage 側で既に dispatch 済 (handleMouseUp の committing dispatch)。
         // ここでは pending を立てるだけ。stopUndoCapture を呼んで矩形 step を fix し、
         // 後続の arrow add (Enter 経路) を別 step として独立させる。
         store.stopUndoCapture();
         const { from, to } = computeAutoArrowDefault(rect);
         setPendingAutoArrow({
           from,
           to,
           color: store.state.activeColor,
           strokeWidth: DEFAULT_STROKE_WIDTH,
         });
       },
       [store, setPendingAutoArrow],
     );
     ```
  4. Enter 確定 callback(矢印 add → Auto-next-A 連鎖):
     ```typescript
     const handleConfirmAutoArrow = useCallback(() => {
       const p = pendingAutoArrowRef.current;
       if (!p) return; // 安全側ガード
       // 1. 矢印 add (新 step として開始)
       const arrowId = generateId();
       const arrowAnnotation: Annotation = {
         id: arrowId,
         type: 'arrow',
         createdAt: Date.now(),
         from: p.from,
         to: p.to,
         color: p.color,
         strokeWidth: p.strokeWidth,
       };
       store.dispatch({ type: 'annotation/add', annotation: arrowAnnotation });
       store.dispatch({ type: 'select/set', id: arrowId });

       // 2. step 分離: arrow → text を独立 undo step に (Phase 7.8-1 と同じ)
       store.stopUndoCapture();

       // 3. Auto-next-A 連鎖: text を to + offset で生成
       const offset = computeAutoNextTextOffset(p.from, p.to, AUTO_NEXT_TEXT_OFFSET_PX);
       const textId = generateId();
       const textAnnotation: Annotation = {
         id: textId,
         type: 'text',
         createdAt: Date.now(),
         x: p.to.x + offset.x,
         y: p.to.y + offset.y,
         text: '',
         fontSize: DEFAULT_FONT_SIZE,
         color: p.color,
       };
       store.dispatch({ type: 'annotation/add', annotation: textAnnotation });
       store.dispatch({ type: 'tool/set', tool: 'text' });
       store.dispatch({ type: 'select/set', id: textId });

       // 4. pending クリア + Auto-next chain 起動 (handleStartTextEditing と同じ flag を立てる)
       setPendingAutoArrow(null);
       autoNextChainRef.current = true;
       setEditingTextId(textId);
     }, [store, setPendingAutoArrow]);
     ```
  5. 各キャンセル経路を pending 優先に拡張:
     ```typescript
     // handleEscape の冒頭に pending クリアを最優先で挿入
     const handleEscape = useCallback(() => {
       if (pendingAutoArrowRef.current) {
         setPendingAutoArrow(null);
         return;
       }
       if (editingTextId) {
         setEditingTextId(null);
         return;
       }
       if (store.state.selectedId) {
         store.dispatch({ type: 'select/set', id: null });
       }
     }, [editingTextId, store, setPendingAutoArrow]);

     // handleDelete の冒頭にも pending クリアを最優先
     const handleDelete = useCallback(() => {
       if (pendingAutoArrowRef.current) {
         setPendingAutoArrow(null);
         return;
       }
       const id = store.state.selectedId;
       if (!id) return;
       store.dispatch({ type: 'annotation/remove', id });
       if (editingTextId === id) {
         setEditingTextId(null);
       }
     }, [store, editingTextId, setPendingAutoArrow]);

     // handleSetTool でも pending クリア (別ツールキー押下時)
     const handleSetTool = useCallback(
       (tool: Tool) => {
         if (pendingAutoArrowRef.current) {
           setPendingAutoArrow(null);
         }
         store.dispatch({ type: 'tool/set', tool });
       },
       [store, setPendingAutoArrow],
     );
     ```
  6. mousedown キャンセル(CanvasStage に渡す callback):
     ```typescript
     const handleCancelAutoArrowIfAny = useCallback(() => {
       if (pendingAutoArrowRef.current) {
         setPendingAutoArrow(null);
       }
     }, [setPendingAutoArrow]);
     ```
  7. CanvasStage への props を追加:
     ```jsx
     <CanvasStage
       // ... 既存 props
       pendingAutoArrow={pendingAutoArrow}
       onAutoNextRectangle={handleAutoNextRectangle}
       onCancelAutoArrowIfAny={handleCancelAutoArrowIfAny}
     />
     ```
  8. useKeyboardShortcuts に追加:
     ```typescript
     useKeyboardShortcuts({
       // ... 既存
       onConfirmAutoArrow: pendingAutoArrow ? handleConfirmAutoArrow : undefined,
     });
     ```
  9. window expose:
     ```typescript
     // Phase 7.8-2: pending Auto-arrow を E2E から poll するため公開。
     useEffect(() => {
       (window as unknown as Record<string, unknown>).__SNAP_SHARE_PENDING_AUTO_ARROW__ =
         pendingAutoArrow;
     }, [pendingAutoArrow]);
     ```
  10. handleClearImage の冒頭に pending クリアも追加(画像変更時に pending が残らないように):
      ```typescript
      const handleClearImage = useCallback(() => {
        setPendingAutoArrow(null);
        setStageImageSize(null);
        setImageNaturalSize(null);
        onClearImage();
        setEditingTextId(null);
      }, [onClearImage, setStageImageSize, setPendingAutoArrow]);
      ```
- **MIRROR**:
  - PENDING_STATE_REF + STATE(Phase 7.7-3 panActiveRef を踏襲)
  - AUTO_NEXT_A_CHAIN(Phase 7.8-1 の text 即時編集起動構造)
  - CANCEL_PRIORITY_HANDLERS(Phase 7.7-3 / 7.8-1 の handleEscape 拡張)
  - WINDOW_EXPOSE_FOR_E2E
  - STOP_UNDO_CAPTURE_BREAKPOINT(矩形 add 直後 + arrow add 直後の 2 回呼出)
- **IMPORTS**: 上記
- **GOTCHA**:
  - **handleConfirmAutoArrow は useKeyboardShortcuts より前に定義**(Phase 7.7-4 で確認した宣言順問題)。useCallback の宣言順序: pendingAutoArrow / refs → handleAutoNextRectangle → handleConfirmAutoArrow → handleEscape / handleDelete / handleSetTool / handleCancelAutoArrowIfAny → useKeyboardShortcuts
  - **既存の `handleSetTool` 名衝突**: 既に L123 にある `handleSetTool` は `useCallback((tool) => { store.dispatch({ type: 'tool/set', tool }); }, [store])` だけのシンプル版。これに pending クリアを追加するだけ
  - **handleEscape / handleDelete の依存配列に `setPendingAutoArrow`**: useCallback でラップした setter を依存に入れる
  - **`handleConfirmAutoArrow` は `useKeyboardShortcuts` の依存配列に渡されているので**、`pendingAutoArrow` state 変化時に再生成される。これで「pending state 変化 → useKeyboardShortcuts に新 callback ref 注入 → ref.current 更新」が成立
  - **「pending != null のときだけ provide」**: `pendingAutoArrow ? handleConfirmAutoArrow : undefined` で Enter binding 自体をオフ。Phase 7.7-4 onShowHelp と同じ作法
  - **`store.dispatch` 連続 4 回**: `tool/set` と `select/set` は replace、`annotation/add` 2 つは commit。stopUndoCapture を間で呼ぶことで undo step が分離される
  - **`autoNextChainRef.current = true` のタイミング**: `setEditingTextId(textId)` の直前。既存の `handleStartTextEditing` は CanvasStage 経由で呼ばれるが、Phase 7.8-2 の Enter 確定経路は EditorShell 内で完結するので `handleStartTextEditing` を経由せず ref を直接立てる(同等の効果)
  - **window expose で `null` の場合**: `__SNAP_SHARE_PENDING_AUTO_ARROW__` が `null` を持つ。E2E は `null` で「pending なし」、object で「pending あり」を判定
  - **Yjs と local モード両対応**: `store.stopUndoCapture()` は両モードで動く(local は no-op、Yjs は `ctx.undoManager.stopCapturing()`)
- **VALIDATE**:
  - `pnpm -w typecheck`
  - 手動: `pnpm -F @snap-share/web dev` で
    1. R キー → 矩形 drag → 半透明矢印プレビュー出現
    2. Enter → 矢印確定 + textarea 出現
    3. "OK" → Enter → text 確定、tool=select
    4. R → 矩形 → BS → pending 消失、矩形残る
    5. R → 矩形 → Esc → pending 消失、矩形残る
    6. R → 矩形 → V キー → pending 消失、tool=select
    7. R → 矩形 → Stage の任意座標 click → pending 消失、通常 mousedown 処理続行
    8. R → 矩形 → Enter → "OK" → Enter → Cmd+Z → text 消失 → Cmd+Z → 矢印消失 → Cmd+Z → 矩形消失 (3 段巻き戻し)

### Task 7: E2E spec `auto-next-rect-arrow.spec.ts` を新規作成

- **ACTION**: `apps/web/e2e/auto-next-rect-arrow.spec.ts` を新規作成
- **IMPLEMENT**: 以下 7 ケース
  1. **矩形確定 → pending 立つ**: 矩形 drag → `__SNAP_SHARE_PENDING_AUTO_ARROW__` が object になる、矩形 1 件追加、tool='rectangle' のまま
  2. **Enter 確定 → 矢印 + text + tool=text**: 矩形 → Enter → annotations.length === 2 (rect + arrow + 空 text の **3**?)、textarea visible、tool='text'
     - 注意: 矩形 add → 矢印 add → text add で 3 件、Enter 直後の polling では 3 件が見える
  3. **Enter → text 確定 → tool=select**: 上記の続きで textarea に "OK" → Enter → annotations.length === 3 (rect + arrow + text="OK")、tool='select'
  4. **BS キャンセル**: 矩形 → BS → `__SNAP_SHARE_PENDING_AUTO_ARROW__` === null、矩形 1 件残る、tool='rectangle' のまま
  5. **Esc キャンセル**: 矩形 → Esc → 同上(BS と同等)
  6. **別ツールキー (V) でキャンセル**: 矩形 → V キー → pending null、tool='select'
  7. **mousedown キャンセル**: 矩形 → Stage の任意座標 click → pending null、矩形残る
  8. **Cmd+Z で矩形 → 矢印 → text の 3 段巻き戻し**: Enter 確定 + "OK" 確定後、Cmd+Z 1 回目で text 消失 (length=2)、2 回目で矢印消失 (length=1)、3 回目で矩形消失 (length=0)
  9. **通常 R ツールは Auto-next-B 後の挙動を壊さない**: 矢印 add → text add → 通常 R で別矩形描画 → 新矩形について再度 pending 立つ(連続使用回帰)
- **MIRROR**: `apps/web/e2e/auto-next-arrow-text.spec.ts` の setupRoomWithImage / dragArrow / annotationCount / currentTool ヘルパパターン
- **IMPORTS**:
  ```typescript
  import { expect, test } from '@playwright/test';
  import { buildSolidPng, dropImageBuffer } from './fixtures/upload';
  ```
- **GOTCHA**:
  - **dragRectangle ヘルパ**: `dragArrow` と同じ形だが `keyboard.press('r')` 後の drag。共通化のため両方を取れる `dragShape(page, box, tool, fromOffset, toOffset)` ヘルパに分離してもよい
  - **pending poll**: `expect.poll(() => page.evaluate((k) => (window as unknown as Record<string, unknown>)[k] !== null, PENDING_KEY))`
  - **Cmd+Z の連続発火**: Phase 7.8-1 spec と同じ `process.platform === 'darwin' ? 'Meta+z' : 'Control+z'` パターン
  - **mousedown キャンセルテスト**: stage 上で空白領域(矩形と離れた位置)を click。click は mousedown + mouseup なので、mousedown で pending クリア後、mouseup は通常の click 処理(stage 空クリックで selectedId クリア)を完了する
  - **chromium 限定**: 既存 spec と同じ `skipNonChromium` パターン
  - **MIN_DRAG_PIXELS=4 を超える矩形**: 矩形 drag は 50-100px 程度で OK
  - **0 文字 Enter で text 自動削除**: Enter 確定後 textarea 即 Enter (空文字) で text のみ消える、矢印は残る → annotations.length === 2 (rect + arrow)
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e -- e2e/auto-next-rect-arrow.spec.ts` で 8-9 ケース全緑

### Task 8: PRD Phase 2 status 更新

- **ACTION**: `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` の Implementation Phases テーブルで Phase 2 を `pending` → `in-progress` + plan link 追加
- **IMPLEMENT**:
  - 該当行: `| 2 | B: 矩形→矢印 次手予測 | ... | pending | - | 1 | - |`
  - 変更後: `| 2 | B: 矩形→矢印 次手予測 | ... | in-progress | - | 1 | [plan](../plans/phase-7.8-2-auto-next-rect-arrow.plan.md) |`
- **MIRROR**: Phase 7.8 PRD で Phase 1 が `complete` 時に `[plan](../plans/completed/...)` / `[report](../reports/...)` の形になっている。in-progress 時はまず `plans/` 直下の plan link のみ
- **IMPORTS**: なし
- **GOTCHA**: markdown 表のセル数を維持(`|` の個数)
- **VALIDATE**: `git diff .claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` で意図通りの 1 行差分のみ

### Task 9: 全体回帰

- **ACTION**: 全フェーズ統合検証
- **IMPLEMENT**:
  ```bash
  pnpm -w typecheck && pnpm -w lint && pnpm -w test && \
    pnpm -F @snap-share/web test:e2e && pnpm -w build
  ```
- **VALIDATE**: 全コマンドが exit 0
  - typecheck: ゼロエラー
  - lint: クリーン(必要なら `pnpm -w format` で自動整形)
  - unit: 既存 228 件 + 新規 5(autoArrowDefault) + 5(useKeyboardShortcuts) = **238 件以上**全緑
  - E2E: 既存 57 件 + 新規 8-9(auto-next-rect-arrow) = **65-66 件**全緑
  - build: vite build (web) + wrangler dry-run (api) 両方緑

---

## Testing Strategy

### Unit Tests (`computeAutoArrowDefault`)

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| 100x80 矩形 at origin | `{x:0,y:0,w:100,h:80}` | from=(100,40), to=(100+70.71, 40+70.71) | No |
| 平行移動 | `{x:200,y:150,w:60,h:40}` | from=(260,170), to=(260+70.71, 170+70.71) | No |
| 距離一致 | `{x:0,y:0,w:10,h:10}` | length(to-from) === 100 | No |
| 45° 確認 | `{x:0,y:0,w:50,h:30}` | (to.x-from.x) === (to.y-from.y) > 0 | No |
| 決定的 | 同 input 2 回 | 同じ結果 | No |

### Unit Tests (`useKeyboardShortcuts` Enter binding)

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| Enter + onConfirmAutoArrow provided | `key='Enter'` | onConfirmAutoArrow 呼ばれる、preventDefault | 通常 |
| Enter + undefined | `key='Enter'`, no callback | preventDefault 呼ばれない | discoverability ガード |
| Shift+Enter | `key='Enter', shiftKey=true` | onConfirmAutoArrow 呼ばれない | 除外 |
| Cmd+Enter | `key='Enter', metaKey=true` | onConfirmAutoArrow 呼ばれない | 除外 |
| input フォーカス時 Enter | input focus + Enter | 呼ばれない | isEditableTarget |

### E2E Tests (Playwright)

| Test | Scenario | Expected |
|---|---|---|
| 矩形 → pending 立つ | R drag | `__SNAP_SHARE_PENDING_AUTO_ARROW__` is object、annotations.length=1、tool='rectangle' |
| Enter → 矢印 + text + tool=text | R drag → Enter | annotations.length=3、textarea visible、tool='text' |
| Enter → text "OK" → tool=select | textarea に "OK" → Enter | annotations.length=3、text="OK"、tool='select' |
| BS キャンセル | R drag → BS | pending=null、矩形残る、tool='rectangle' |
| Esc キャンセル | R drag → Esc | 同上 |
| 別ツールキー V キャンセル | R drag → V | pending=null、tool='select' |
| mousedown キャンセル | R drag → stage click | pending=null、矩形残る |
| Cmd+Z 3 段巻き戻し | Enter "OK" Enter → Cmd+Z×3 | 1 回目 length=2、2 回目 length=1、3 回目 length=0 |
| 連続 Auto-next-B | 矩形→Enter→text→Enter→ 別矩形→Enter | 各サイクルで pending 立つ・連鎖発動 |

### Edge Cases Checklist

- [x] 矩形長辺/短辺 0 (MIN_DRAG_PIXELS=4 で弾かれる、handleMouseUp は dispatch しない)
- [x] 画像端付近の矩形(プレビュー矢印が画像外に出る)— Konva は画像外描画 OK、PNG export 時は image bbox のみ rasterize なので「画面では見える」だけ。dogfood で再評価、本フェーズでは非問題
- [x] pending 中の Cmd+Z(矩形を巻き戻す)— pending state は ref / state にあるが annotation 側は矩形 add だけなので Cmd+Z で矩形が消える。pending は残るが Enter 確定時に存在しない `from`/`to` を使うことになる(矩形を消したのに矢印描画予定)→ **対応**: `handleConfirmAutoArrow` は pendingAutoArrowRef を見て annotations 配列の存在チェックはしない。**仕様**: pending Auto-arrow は「矩形が残ってる前提」なので、ユーザーが Cmd+Z で矩形を消したら手動で BS してから再描画する想定。dogfood で混乱があれば `pendingAutoArrow` を Cmd+Z で自動クリアする処理を追加検討
- [x] pending 中の handleClearImage(画像クリア)→ Task 6 で `setPendingAutoArrow(null)` 追加済
- [x] pending 中の Cmd+Z で矩形消失 → pending 残るが **annotation 側のみ消失**、Enter 確定で「孤立した矢印」が描画される(意図と違うが破壊はしない)— Phase 5 dogfood で観察
- [x] Yjs 多人数で同時に pending → 各クライアント独立な pending state、annotation はローカル発火のみ、Yjs sync は arrow add 確定後
- [x] 通常 text ツールへの影響(`autoNextChainRef` が立たない経路)— 既存の `handleStartTextEditing` 経路は変更なし、Auto-next-B でも `setEditingTextId` 直接呼出で同じ ref 立てる
- [x] textarea 編集中の Enter — `stopPropagation` で window keydown に届かない(既存挙動)、`onConfirmAutoArrow` は呼ばれない

---

## Validation Commands

### Static Analysis
```sh
pnpm -w typecheck
```
EXPECT: ゼロエラー

### Lint
```sh
pnpm -w lint
```
EXPECT: クリーン(必要なら `pnpm -w format` で自動整形)

### Unit Tests
```sh
pnpm -F @snap-share/web test -- src/lib/__tests__/autoArrowDefault.test.ts
pnpm -F @snap-share/web test -- useKeyboardShortcuts
```
EXPECT: autoArrowDefault 5 件 + useKeyboardShortcuts 17 件(既存 12 + 新規 5)全緑

### Full Unit Suite
```sh
pnpm -w test
```
EXPECT: 既存 228 件 + 新規 10 件 = 238 件全緑、回帰 0

### E2E
```sh
pnpm -F @snap-share/web test:e2e -- e2e/auto-next-rect-arrow.spec.ts
```
EXPECT: 8-9 ケース全緑

### Full E2E Suite
```sh
pnpm -F @snap-share/web test:e2e
```
EXPECT: 既存 57 件 + 新規 8-9 = 65-66 件全緑、回帰 0

### Build
```sh
pnpm -w build
```
EXPECT: vite build (web) + wrangler dry-run (api) 両方緑

### Manual Validation
- [ ] `pnpm -F @snap-share/web dev` で起動 → 画像投入
- [ ] R キー → 矩形 drag → 半透明矢印プレビュー (右下 45°/100px) が出現
- [ ] Enter → 矢印確定 + 矢印終端 +offset で textarea 出現 + IME 起動
- [ ] "OK" → Enter → text 確定、Toolbar の V (select) が active 表示
- [ ] R → 矩形 → BS → pending 消失、矩形残る、tool='rectangle' のまま
- [ ] R → 矩形 → Esc → pending 消失、矩形残る
- [ ] R → 矩形 → V キー → pending 消失、tool='select'
- [ ] R → 矩形 → Stage 任意座標 click → pending 消失、通常 mousedown 処理続行(空クリックなら selectedId クリア)
- [ ] R → 矩形 → Enter → "OK" → Enter → Cmd+Z 連打で text → 矢印 → 矩形 の 3 段巻き戻し
- [ ] R → 矩形 → Enter → 0 文字 Enter → text のみ消失、矢印は残る、tool='select'
- [ ] R → 矩形 → Enter → 編集中 Esc → text のみ消失、矢印は残る、tool='select'
- [ ] T → 通常 text 作成 → tool='text' のまま (Phase 7.8-2 の連鎖が text ツール経路を壊していない)

---

## Acceptance Criteria
- [ ] Task 1-9 の `IMPLEMENT` 全完了
- [ ] `pnpm -w typecheck` ゼロエラー
- [ ] `pnpm -w lint` クリーン
- [ ] 新規 unit test 10 ケース(autoArrowDefault 5 + useKeyboardShortcuts 5)全緑
- [ ] 新規 E2E spec 8-9 ケース全緑
- [ ] 既存 unit + E2E 全緑(回帰 0)
- [ ] `pnpm -w build` 緑
- [ ] Manual Validation チェックリスト全完了
- [ ] PRD Phase 2 status が `in-progress` に更新済 + plan link 設定済

## Completion Checklist
- [ ] pending state は EditorShell に置き、ref + state の二重管理(同期参照と Konva 再レンダー両方を満たす)
- [ ] 矩形 add 直後 + arrow add 直後の 2 箇所で `store.stopUndoCapture()` を呼ぶ(矩形/矢印/text を独立 step に)
- [ ] `pointerAtBeginning` 反転を踏襲: pending Arrow も `from = ヤジリ = 矩形右辺中央`
- [ ] Enter binding は `pendingAutoArrow != null` のときだけ provide(`onShowHelp` パターン)
- [ ] handleEscape / handleDelete / handleSetTool の **冒頭** に pending クリア優先分岐を追加
- [ ] handleMouseDown の冒頭(Space pan check の後)で pending クリア
- [ ] handleClearImage で pending もクリア(画像変更時にゴミ残らないように)
- [ ] `__SNAP_SHARE_PENDING_AUTO_ARROW__` window expose で E2E 検証可能
- [ ] HelpModal は **触らない**(Phase 5 でまとめて更新)
- [ ] PR タイトル / コミット message は日本語、prefix は英語(`feat(phase-7.8-2):`)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| pending 中に矩形を Cmd+Z で消すと「孤立矢印」 | M | L | dogfood で観察、必要なら pending 自動クリアを追加(Phase 5) |
| Enter binding が button focus / form submit を奪う | L | M | `onConfirmAutoArrow` を `pendingAutoArrow ? ... : undefined` で provide → pending なし時は preventDefault 呼ばれない、browser default 温存 |
| 連続 Auto-next-B が 1 step に merge される(captureTimeout) | L | M | 矩形 add 直後 + arrow add 直後の 2 回 stopUndoCapture でカバー、Phase 7.8-1 と同じ作法 |
| pending 中の handleMouseDown で「click なのか drag 開始なのか」誤認 | L | L | onCancelAutoArrowIfAny は pending クリアのみ、その後の通常処理はそのまま流す。drag 開始なら新 dragStart が立つ |
| 既存 E2E が「矩形 add のみ」を期待していて pending 立つことで失敗 | M | L | Phase 7.8-1 と同様の問題が再発の可能性。回帰時は Esc を 1 回挟む既存 spec 修正で対応(Phase 7.8-1 で実証済) |
| Yjs UndoManager の `stopCapturing` 連続呼出で意図しない挙動 | L | L | 矩形 add 直後 + arrow add 直後の 2 回呼出は事実上「区切り目を 2 つ作る」だけで副作用なし(undo step 数は 1 増えるだけ) |
| 既定矢印が画像端を超える | M | L | プレビューは Konva 描画なので画像外も visible、ユーザーが BS で消して別アプローチへ。MVP では非対応 |
| `pendingAutoArrow.color` が後から色変更で変わらない | L | L | pending は確定時の色 snapshot を保持、Enter 確定までに色変更してもプレビュー色は固定。**設計判断**: シンプルに保つ、ユーザーが BS で消して再描画してくれという挙動。dogfood で要望出れば Phase 5 で再評価 |
| Konva Layer の z-order ミス(pending arrow が awareness の上に) | L | L | AnnotationLayer < pending Layer < extraLayers の順を厳守、awareness は extraLayers にあるので pending arrow の上 |

## Notes

- **Phase 7.8-2 の心臓部は EditorShell の pending state + 4 経路のキャンセル + Enter binding**。Phase 7.8-1 の Auto-next-A (text 即時編集起動) は arrow add 後の連鎖部分を 100% 再利用
- **既定矢印の方向 (右下 45°)** は PRD 確定。ユーザーがビジネススクショで「左下から右上に矢印」を引きたい場面もあるが、MVP は右下のみ。dogfood で要望が多ければ Phase 5 で「マウス位置に応じた方向選択」「キーで方向切替 (例: 1=右下, 2=右上)」等を検討
- **矩形を確定した時点で tool は 'rectangle' のまま**(PRD 確定: tool は変更しない)。これにより「連続矩形 + 各 pending を Enter で確定」というワークフローもシームレスに動く(R で矩形 → Enter で連鎖 → R で次の矩形 → ...)
- **pending Arrow のプレビュー色**は `store.state.activeColor` の現在値。Phase 7.7-2 の color cycle 後の色を反映するので、ユーザーが C で色を巡回した直後でも整合
- **Phase 5 dogfood の観察ポイント**:
  - 既定 100px 長は妥当か(短すぎるとユーザーが BS して描き直す頻度高)
  - 右下 45° は業務スクショで頻度高いか
  - 矩形 add → Enter までの平均時間(success metric「15 秒以内」の達成度)
  - pending 中の混乱(「これ何?」と感じる頻度)
- **Confidence Score**: **8/10** — 単一パスでの実装可能性高。残り 2/10 は (1) Enter binding の side-effect (button focus / form submit) で予期せぬ衝突があるかも、(2) 既存 E2E への副作用(Phase 7.8-1 で実証済の Esc 挟みパターンで吸収可能)
