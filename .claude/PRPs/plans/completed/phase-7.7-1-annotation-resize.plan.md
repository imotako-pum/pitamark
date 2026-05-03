# Plan: Phase 7.7-1 注釈リサイズ(Konva Transformer + Arrow 端点ハンドル)

## Summary
配置済み注釈(rectangle / highlight / arrow)のリサイズ UI を実装する。Konva.Transformer を rectangle / highlight にバインドし、arrow には 2 端点 Circle ハンドルを実装。reducer / Yjs mutation 経路は既に存在しているため、本 plan の主体は **UI 接続 + Konva ノード参照管理 + テスト追加**。

## User Story
As a **画像注釈で上司に成果物確認を求めるビジネスマン**, I want to **配置済みの矩形・矢印・ハイライト注釈をマウスで自然にリサイズしたい**, so that **「ツールバーで削除して描き直す」往復を断ち、思考を切らさずに 1 サイクルで注釈を完成させられる**.

## Problem → Solution
**現状**: 注釈は配置後 `draggable` で移動はできるが、サイズ変更ハンドルが存在しない。サイズが間違ったら削除して描き直すしかなく、Shottr 同等の「予測不足」体験。
**改善後**: 矩形 / ハイライトは Konva 標準 Transformer の 8 ハンドル(Shift で比率固定、Alt で中心基点)、矢印は from/to の 2 端点を Circle で個別ドラッグ可能。Yjs 経由で他クライアントに即座に同期。

## Metadata
- **Complexity**: Medium(3-10 ファイル / 200-400 行 / 既存パターン踏襲)
- **Source PRD**: `.claude/PRPs/prds/phase-7.7-ux-foundation.prd.md`
- **PRD Phase**: Phase 1 (A1: 注釈リサイズ)
- **Estimated Files**: 6 ファイル更新 / 4 ファイル新規(テスト含む)
- **PRD スコープ修正**: 「矩形/楕円/矢印/直線」→ **既存スキーマ準拠で「矩形/矢印/ハイライト」の 3 種**(楕円・直線はスキーマに存在しないため Phase 7.7 スコープ外、テキストは fontSize ベースの別問題で Phase 7.7 スコープ外)

---

## UX Design

### Before
```
┌──────────────────────────────────┐
│  ツール: 矩形を選択 → 描画         │
│   ┌─────┐                        │
│   │     │  ← 配置済み(移動のみ可)│
│   └─────┘                        │
│   サイズ間違い → Delete → 再描画   │
└──────────────────────────────────┘
```

### After
```
┌────────────────────────────────────┐
│  ツール: 選択 (V) で注釈クリック     │
│   ┌●──●──●─┐                       │
│   ●        ●  ← 8 ハンドル表示       │
│   └●──●──●─┘                       │
│   ハンドルドラッグ:                  │
│   - 通常: 自由リサイズ                │
│   - Shift: 縦横比固定                │
│   - Alt: 中心基点                    │
│                                    │
│   矢印は 2 端点 Circle:              │
│   ●━━━━▶●  ← 端点ドラッグで伸縮     │
└────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 配置済み矩形/ハイライト | 移動のみ | 選択時に 8 ハンドル表示 + リサイズ可 | Shift/Alt は Konva 自動 |
| 配置済み矢印 | 移動のみ | 選択時に from/to の 2 端点ハンドル表示 | Transformer ではなくカスタム Circle |
| 配置済みテキスト | 移動 + ダブルクリック編集 | **変更なし** | Phase 7.7 スコープ外(fontSize UI は将来) |
| Yjs 経由の他クライアント | move のみ反映 | resize / endpoint change も反映 | mutation は既存 |
| Undo/Redo | move/add/delete のみ | resize も対象 | reducer の COMMITTING_ACTIONS に既登録済 |

---

## Mandatory Reading

実装前に必ず読むべきファイル:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/web/src/hooks/annotationsReducer.ts` | 21-30, 87-95 | resize-rect / resize-highlight / set-arrow-endpoints action は既定義。COMMITTING_ACTIONS にも登録済 |
| P0 | `apps/web/src/domain/annotation/yjs-mutations.ts` | 全体 | resizeRectangleY / resizeHighlightY / setArrowEndpointsY 既実装。LOCAL_ORIGIN / tx ヘルパー |
| P0 | `apps/web/src/hooks/yjs-annotations-context.ts` | 68-102 | dispatch → Yjs の橋渡し(applyDataAction 内に resize 系の case が既存) |
| P0 | `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | 全体 | 改修対象。Transformer 追加 |
| P0 | `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | 全体 | 改修対象。Transformer 追加 |
| P0 | `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | 全体 | 改修対象。端点 Circle ハンドル追加 |
| P0 | `apps/web/src/components/canvas/AnnotationLayer.tsx` | 全体 | shape 列挙 + コールバック流入口。新規 onResize / onArrowEndpoints 追加 |
| P1 | `apps/web/src/components/canvas/CanvasStage.tsx` | 35-75, 95-130 | store dispatch 経路、editing/select state |
| P1 | `apps/web/src/hooks/useAnnotationsStore.ts` | 全体 | dispatch 公開 API |
| P1 | `packages/shared/src/annotation.ts` | 全体 | 注釈スキーマ(変更なし、参照のみ) |
| P2 | `apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx` | 1-12, 45-63 | Vitest + react-konva モックパターン |
| P2 | `apps/web/e2e/annotation-tools.spec.ts` | 1-40 | Playwright dragOnStage パターン |
| P2 | `apps/web/src/components/canvas/colors.ts` | 全体 | OUTLINE_ACCENT / SELECTED_STROKE_BOOST 等の色定数 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Transformer 基本パターン | https://konvajs.org/docs/react/Transformer.html | useRef + useEffect で `nodes([shapeRef.current])`、選択解除時に `nodes([])` |
| keepRatio (Shift) | https://konvajs.org/docs/select_and_transform/Keep_Ratio.html | default true、コーナー時自動。Shift 押下で side ハンドルでも比率固定 |
| centeredScaling (Alt) | https://konvajs.org/docs/select_and_transform/Centered_Scaling.html | default false、Alt 押下で中心基点。Konva が自動ハンドリング |
| onTransformEnd の値再計算 | https://konvajs.org/docs/react/Transformer.html | scaleX/Y を 1 にリセット → width = node.width() * scaleX |
| Arrow 端点ハンドル代替 | https://konvajs.org/docs/sandbox/Modify_Curves_with_Anchor_Points.html | Konva 公式に Arrow 用 Transformer 例なし。Circle 2 個のカスタム実装が業界慣例 |
| boundBoxFunc | https://konvajs.org/api/Konva.Transformer.html | 最小サイズ強制(`Math.abs(newBox.width) < MIN ? oldBox : newBox`)、絶対座標 |

---

## Patterns to Mirror

### NAMING_CONVENTION
```typescript
// SOURCE: apps/web/src/components/canvas/shapes/RectangleShape.tsx:6-11
type RectangleShapeProps = Readonly<{
  annotation: RectangleAnnotation;
  isSelected: boolean;
  onClick: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}>;

export const RectangleShape = ({ annotation, isSelected, onClick, onDragEnd }: RectangleShapeProps) => {
  // ...
};
```
- Props 型は `Readonly<{...}>` ラップ
- export 名 = ファイル名 = PascalCase
- 型名は `<ComponentName>Props`

### REDUCER_ACTION_DISPATCH
```typescript
// SOURCE: apps/web/src/components/canvas/AnnotationLayer.tsx:36-68
case 'rectangle':
  return (
    <RectangleShape
      key={a.id}
      annotation={a}
      isSelected={a.id === selectedId}
      onClick={onShapeClick}
      onDragEnd={(id, x, y) => onShapeMove(id, x - a.x, y - a.y)}
    />
  );
```
- AnnotationLayer 内で switch on a.type
- delta 変換は AnnotationLayer の責務(Shape は absolute 座標を返す)

### REDUCER_ACTION_DEFINITION
```typescript
// SOURCE: apps/web/src/hooks/annotationsReducer.ts:21-30
export type AnnotationsAction =
  | { type: 'tool/set'; tool: Tool }
  | { type: 'select/set'; id: string | null }
  | { type: 'annotation/add'; annotation: Annotation }
  | { type: 'annotation/move'; id: string; dx: number; dy: number }
  | { type: 'annotation/resize-rect'; id: string; width: number; height: number }
  | { type: 'annotation/resize-highlight'; id: string; width: number; height: number }
  | { type: 'annotation/set-arrow-endpoints'; id: string; from: Point; to: Point }
  // ...

const COMMITTING_ACTIONS: ReadonlyArray<AnnotationsAction['type']> = [
  'annotation/add', 'annotation/remove', 'annotation/move',
  'annotation/resize-rect', 'annotation/resize-highlight',
  'annotation/set-arrow-endpoints', 'annotation/set-text',
];
```
**resize 系 action は既定義 + Undo 対象。新規追加不要。**

### YJS_MUTATION_PATTERN
```typescript
// SOURCE: apps/web/src/domain/annotation/yjs-mutations.ts:54-67
export const resizeRectangleY = (
  doc: Y.Doc,
  ya: YAnnotations,
  id: string,
  width: number,
  height: number,
): void => {
  const m = ya.get(id);
  if (!m || m.get('type') !== 'rectangle') return;
  tx(doc, () => {
    m.set('width', width);
    m.set('height', height);
  });
};

// LOCAL_ORIGIN ラップ済 (CLAUDE.md ルール 8 順守)
const tx = (doc: Y.Doc, fn: () => void): void => doc.transact(fn, LOCAL_ORIGIN);
```
**resize 系 mutation も既実装。新規追加不要。**

### YJS_DISPATCH_BRIDGE
```typescript
// SOURCE: apps/web/src/hooks/yjs-annotations-context.ts:68-102
const applyDataAction = (action: AnnotationsAction): void => {
  switch (action.type) {
    case 'annotation/resize-rect':
      resizeRectangleY(doc, yAnnotations, action.id, action.width, action.height);
      return;
    case 'annotation/resize-highlight':
      resizeHighlightY(doc, yAnnotations, action.id, action.width, action.height);
      return;
    case 'annotation/set-arrow-endpoints':
      setArrowEndpointsY(doc, yAnnotations, action.id, action.from, action.to);
      return;
    // ...
  }
};
```
**dispatch 経路も既実装。Shape 側で dispatch するだけで Yjs 同期完了。**

### TOOL_CALLBACK_FLOW
```typescript
// SOURCE: apps/web/src/components/canvas/CanvasStage.tsx (推定)
// AnnotationLayer に渡されるコールバックは store.dispatch を呼ぶ薄いラッパー
const handleShapeMove = (id: string, dx: number, dy: number) => {
  store.dispatch({ type: 'annotation/move', id, dx, dy });
};
```
新規追加コールバックも同パターンで `store.dispatch({ type: 'annotation/resize-rect', ... })` を呼ぶ。

### KONVA_TRANSFORMER_PATTERN
```typescript
// SOURCE: 公式 docs https://konvajs.org/docs/react/Transformer.html
const shapeRef = useRef<Konva.Rect>(null);
const trRef = useRef<Konva.Transformer>(null);

useEffect(() => {
  if (isSelected && shapeRef.current && trRef.current) {
    trRef.current.nodes([shapeRef.current]);
    trRef.current.getLayer()?.batchDraw();
  } else {
    trRef.current?.nodes([]);
  }
}, [isSelected]);

return (
  <>
    <KonvaRect ref={shapeRef} ... onTransformEnd={handleTransformEnd} />
    {isSelected && (
      <Transformer
        ref={trRef}
        rotateEnabled={false}
        flipEnabled={false}
        boundBoxFunc={(oldBox, newBox) =>
          (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) ? oldBox : newBox
        }
      />
    )}
  </>
);
```
keepRatio / centeredScaling は Konva デフォルト挙動を採用(Shift/Alt 押下で自動)。

### SELECTED_STATE_VISUAL
```typescript
// SOURCE: apps/web/src/components/canvas/shapes/RectangleShape.tsx (現状)
stroke={isSelected ? OUTLINE_ACCENT : annotation.stroke}
strokeWidth={isSelected ? annotation.strokeWidth + SELECTED_STROKE_BOOST : annotation.strokeWidth}
```
Transformer 表示中も視覚フィードバックを残す方針(Transformer 外周ハンドルだけだと選択状態が分かりにくい)。

### TEST_STRUCTURE_UNIT
```typescript
// SOURCE: apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx:1-12
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('react-konva', () => ({
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Image: () => null,
  Rect: () => null,
  Transformer: () => null,  // 追加が必要
}));

describe('RectangleShape', () => {
  it('attaches Transformer when selected', () => { /* ... */ });
});
```
react-konva は全コンポーネント vi.mock で no-op に置き換え(canvas backend を持ち込まない)。

### TEST_STRUCTURE_E2E
```typescript
// SOURCE: apps/web/e2e/annotation-tools.spec.ts:1-40
import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

const dragOnStage = async (page, startOffset, endOffset) => {
  const stage = page.locator('.konvajs-content canvas').first();
  const box = await stage.boundingBox();
  await page.mouse.move(box.x + startOffset.x, box.y + startOffset.y);
  await page.mouse.down();
  await page.mouse.move(box.x + endOffset.x, box.y + endOffset.y, { steps: 5 });
  await page.mouse.up();
};

const skipNonChromium = (testInfo) =>
  test.skip(testInfo.project.name !== 'chromium', '...');
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | UPDATE | Transformer + ref + onTransformEnd 追加 |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | UPDATE | Transformer + ref + onTransformEnd 追加 |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | UPDATE | from/to 端点 Circle ハンドル追加(Transformer は使わない) |
| `apps/web/src/components/canvas/AnnotationLayer.tsx` | UPDATE | onResizeRect / onResizeHighlight / onArrowEndpoints コールバックを各 Shape に流す |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATE | store.dispatch を呼ぶ薄いラッパー追加し AnnotationLayer に渡す |
| `apps/web/src/components/canvas/colors.ts` | UPDATE | 端点ハンドル用の色定数 1 個追加(`HANDLE_FILL` 等) |
| `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx` | CREATE | Transformer attach / detach の単体テスト |
| `apps/web/src/components/canvas/__tests__/HighlightShape.test.tsx` | CREATE | Transformer attach / detach の単体テスト |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | CREATE | 端点ハンドル表示・onDragMove で setArrowEndpoints 呼ばれることを検証 |
| `apps/web/e2e/annotation-resize.spec.ts` | CREATE | E2E: 矩形リサイズ → サイズ反映、ハイライトリサイズ、矢印端点移動 |

## NOT Building

- **楕円(EllipseAnnotation) の追加** — スキーマに存在しない。本フェーズでは新規注釈タイプを追加せず、既存型のリサイズに集中
- **直線(LineAnnotation) の追加** — 同上。Arrow と Line を分けるのは本フェーズでは過剰
- **テキスト注釈のリサイズ UI** — Konva Transformer scale ではテキストが歪む。fontSize の変更は別 UX 設計が必要(将来検討)
- **回転(rotate)機能** — `rotateEnabled={false}` で明示的に無効化。Phase 7.7 スコープ外
- **Flip(反転)機能** — `flipEnabled={false}` で明示的に無効化
- **複数選択 + 一括リサイズ** — 現状の `selectedId: string | null` モデルを単数のまま維持。複数選択は将来検討
- **`onTransform`(リアルタイム同期)** — `onTransformEnd` のみで Yjs 更新。中間状態を全 peer に流すと帯域・パフォーマンス劣化
- **新規 Yjs mutation の追加** — `resizeRectangleY / resizeHighlightY / setArrowEndpointsY` は既実装、流用のみ
- **新規 Reducer action の追加** — `annotation/resize-rect / resize-highlight / set-arrow-endpoints` は既定義、流用のみ
- **Stage の scale 変更との連動(ズーム時の hit-test)** — Phase 7.7-3 (B1) の責務。本フェーズは Stage scale = 1 前提

---

## Step-by-Step Tasks

### Task 1: RectangleShape に Transformer を追加
- **ACTION**: `apps/web/src/components/canvas/shapes/RectangleShape.tsx` を更新
- **IMPLEMENT**:
  - `useRef<Konva.Rect>(null)` と `useRef<Konva.Transformer>(null)` を追加
  - `useEffect` で `isSelected` 変更時に `trRef.current.nodes([shapeRef.current])` をアタッチ、解除時は `nodes([])`
  - `KonvaRect` に `ref={shapeRef}` と `onTransformEnd` を追加
  - `onTransformEnd` 内で `node.scaleX()/scaleY()` を取得 → `node.scaleX(1); node.scaleY(1)` で正規化 → `Math.max(MIN_SIZE, width * sx)` で新サイズ算出 → `onResize(annotation.id, {x, y, width, height})` 呼出
  - `Transformer` コンポーネントを Fragment 内に並列配置(`{isSelected && <Transformer .../>}`)
  - props に `onResize: (id: string, patch: { x: number; y: number; width: number; height: number }) => void` 追加
- **MIRROR**: KONVA_TRANSFORMER_PATTERN
- **IMPORTS**:
  ```typescript
  import { useEffect, useRef } from 'react';
  import { Rect as KonvaRect, Transformer } from 'react-konva';
  import type Konva from 'konva';
  ```
- **GOTCHA**:
  - `Konva` の type-only import: `import type Konva from 'konva'`(verbatimModuleSyntax 順守)
  - Transformer の `boundBoxFunc` は **絶対座標**を扱う。最小サイズ判定は `Math.abs(newBox.width) < MIN_SIZE` で
  - `MIN_SIZE` は新規定数(8 が無難。既存の `MIN_DRAG_PIXELS = 4` よりやや大きく)
  - `node.x() / node.y()` は Transformer ドラッグで変わる(coordinate 含めて再計算必要)
- **VALIDATE**:
  - `pnpm -F @snap-share/web typecheck` 緑
  - 単体テストは Task 8 で書く

### Task 2: HighlightShape に Transformer を追加
- **ACTION**: `apps/web/src/components/canvas/shapes/HighlightShape.tsx` を更新
- **IMPLEMENT**: Task 1 と同じパターン。違いは:
  - `onResize` の dispatch 先が `annotation/resize-highlight`
  - selected 時の視覚フィードバックは現状 `stroke={OUTLINE_ACCENT}, strokeWidth={2}`(維持)
- **MIRROR**: KONVA_TRANSFORMER_PATTERN, SELECTED_STATE_VISUAL
- **IMPORTS**: Task 1 と同じ
- **GOTCHA**:
  - Highlight は半透明 fill。Transformer のヒット検出は問題なし(`listening` がデフォルト true)
- **VALIDATE**: typecheck 緑

### Task 3: ArrowShape に 2 端点ハンドルを追加
- **ACTION**: `apps/web/src/components/canvas/shapes/ArrowShape.tsx` を更新
- **IMPLEMENT**:
  - `isSelected && <Circle .../>` の 2 個を Fragment で並列配置
  - 各 Circle の props: `x={annotation.from.x}, y={annotation.from.y}, radius={6}, fill={HANDLE_FILL}, stroke={OUTLINE_ACCENT}, strokeWidth={2}, draggable, onDragEnd`
  - `onDragEnd`: 端点新座標を取得 → `onArrowEndpoints(annotation.id, { from: newFrom, to: newTo })` 呼出
  - props に `onArrowEndpoints: (id: string, endpoints: { from: Point; to: Point }) => void` 追加
  - **既存の `onDragEnd`(矢印全体ドラッグ移動)は維持**
- **MIRROR**: 公式 Konva sandbox の Modify_Curves パターン
- **IMPORTS**:
  ```typescript
  import { Arrow as KonvaArrow, Circle } from 'react-konva';
  import type { Point } from '@snap-share/shared';
  ```
- **GOTCHA**:
  - Circle と Arrow が同じ Group / Layer 内にあるため、Circle のドラッグが Arrow の `draggable` と干渉しないように `e.cancelBubble = true` を Circle の onClick / onMouseDown に
  - 端点をドラッグしても、それは「リサイズ」であって「移動」ではない。`onDragEnd`(矢印全体)とは別 dispatch
  - Circle の半径 6 は Konva 公式例準拠。視認性とヒット領域のバランス
- **VALIDATE**: typecheck 緑

### Task 4: colors.ts にハンドル色を追加
- **ACTION**: `apps/web/src/components/canvas/colors.ts` を更新
- **IMPLEMENT**:
  ```typescript
  export const HANDLE_FILL = '#ffffff';  // 端点ハンドル用 fill (白)
  ```
  - OUTLINE_ACCENT は流用(既存 `#5b6dff`)
- **MIRROR**: 既存の hex 定数定義
- **GOTCHA**: CSS 変数は使えない(CLAUDE.md ルール 4)
- **VALIDATE**: typecheck 緑

### Task 5: AnnotationLayer に新コールバックを流す
- **ACTION**: `apps/web/src/components/canvas/AnnotationLayer.tsx` を更新
- **IMPLEMENT**:
  - props に追加:
    ```typescript
    onResizeRectangle: (id: string, patch: { x: number; y: number; width: number; height: number }) => void;
    onResizeHighlight: (id: string, patch: { x: number; y: number; width: number; height: number }) => void;
    onArrowEndpoints: (id: string, endpoints: { from: Point; to: Point }) => void;
    ```
  - switch on a.type の各 case で新規 props を Shape に流す:
    ```typescript
    case 'rectangle':
      return <RectangleShape ... onResize={onResizeRectangle} />;
    case 'highlight':
      return <HighlightShape ... onResize={onResizeHighlight} />;
    case 'arrow':
      return <ArrowShape ... onArrowEndpoints={onArrowEndpoints} />;
    ```
- **MIRROR**: 既存の onShapeMove pass-through パターン
- **IMPORTS**: `import type { Point } from '@snap-share/shared'`
- **VALIDATE**: typecheck 緑

### Task 6: CanvasStage に dispatch ラッパーを追加
- **ACTION**: `apps/web/src/components/canvas/CanvasStage.tsx` を更新
- **IMPLEMENT**:
  - 既存の `handleShapeMove` と同じスタイルで以下 3 つを追加:
    ```typescript
    const handleResizeRectangle = (id: string, patch: { x: number; y: number; width: number; height: number }) => {
      store.dispatch({ type: 'annotation/resize-rect', id, ...patch });
    };
    // 同様に handleResizeHighlight, handleArrowEndpoints
    ```
  - Wait — reducer の action は `width / height` のみ受け取る(`x / y` は含まない)。Transformer ドラッグで位置も変わる場合は `move` + `resize` を続けて dispatch する必要がある
  - **設計判断**: `resize-rect` action のシグネチャを `{ id, x, y, width, height }` に拡張するか、move + resize を分けて dispatch するか
  - **採用**: action を拡張(reducer / Yjs mutation も同時更新が必要)→ Task 7 で実施
  - AnnotationLayer に新コールバックを渡す
- **MIRROR**: 既存の handleShapeMove
- **GOTCHA**:
  - reducer / Yjs mutation のシグネチャ拡張がリスク。**もしくは Transformer の x/y 変化を Shape 側で吸収して常に位置不変として扱う実装も検討**
  - ただし Konva Transformer はリサイズ中に origin を動かす(中心基点でない場合)→ 位置の追従は必須
- **VALIDATE**: typecheck 緑

### Task 7: Reducer / Yjs mutation のシグネチャ拡張
- **ACTION**: 以下 3 ファイルを更新
  - `apps/web/src/hooks/annotationsReducer.ts`
  - `apps/web/src/domain/annotation/yjs-mutations.ts`
  - `apps/web/src/hooks/yjs-annotations-context.ts`
- **IMPLEMENT**:
  - reducer action 拡張:
    ```typescript
    | { type: 'annotation/resize-rect'; id: string; x: number; y: number; width: number; height: number }
    | { type: 'annotation/resize-highlight'; id: string; x: number; y: number; width: number; height: number }
    ```
  - reducer case 内で `x / y / width / height` の 4 フィールドを更新(現状は `width / height` のみ)
  - `resizeRectangleY / resizeHighlightY` のシグネチャに `x / y` 追加 → mutation 内で `m.set('x', x); m.set('y', y); m.set('width', width); m.set('height', height)`
  - `applyDataAction` の case 内で 4 フィールドを mutation に渡す
- **MIRROR**: REDUCER_ACTION_DEFINITION, YJS_MUTATION_PATTERN
- **GOTCHA**:
  - **未リリースのため Yjs マイグレーション不要**(PRD 確定事項)
  - 既存の reducer 単体テストがあれば signature 変更で fail する。同時更新必要
- **VALIDATE**:
  - `pnpm -F @snap-share/web test -- annotationsReducer` 緑
  - typecheck 緑

### Task 8: Shape 単体テスト 3 ファイル作成
- **ACTION**: 以下 3 ファイル新規作成
  - `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx`
  - `apps/web/src/components/canvas/__tests__/HighlightShape.test.tsx`
  - `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx`
- **IMPLEMENT**:
  - **RectangleShape**:
    - "renders KonvaRect with annotation props"
    - "calls onResize with patched dimensions when onTransformEnd fires"(Transformer モック → 直接 onTransformEnd を呼ぶ)
    - "does not render Transformer when not selected"
  - **HighlightShape**: 同上
  - **ArrowShape**:
    - "renders 2 endpoint Circles when selected"
    - "calls onArrowEndpoints with new from/to when endpoint Circle dragged"
    - "does not render Circles when not selected"
- **MIRROR**: TEST_STRUCTURE_UNIT
- **IMPORTS**:
  ```typescript
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
  import { act } from 'react';
  import { createRoot, type Root } from 'react-dom/client';
  ```
- **GOTCHA**:
  - `vi.mock('react-konva', () => ({ Rect: ..., Arrow: ..., Circle: ..., Transformer: ..., Group: ..., Text: ... }))` で全 Konva コンポーネントを no-op 化
  - `Konva.Rect` の ref は実体がないためモックで対応 — モック内で `forwardRef` を使い、ref に `{ scaleX: vi.fn(() => 2), scaleY: vi.fn(() => 1.5), x: vi.fn(() => 100), y: vi.fn(() => 50), width: vi.fn(() => 200), height: vi.fn(() => 100) }` を流す
- **VALIDATE**: `pnpm -F @snap-share/web test -- RectangleShape HighlightShape ArrowShape` 全緑

### Task 9: E2E テスト追加
- **ACTION**: `apps/web/e2e/annotation-resize.spec.ts` 新規作成
- **IMPLEMENT**:
  - "rectangle: select → drag corner handle → size persists" — 矩形を描く → V キーで select tool → 矩形クリック → ハンドル位置(右下角)を計算して drag → 新サイズが reflected されているか
  - "highlight: same as rectangle"
  - "arrow: select → drag endpoint → from/to updated"
  - 各テストの先頭に `skipNonChromium(testInfo)`
- **MIRROR**: TEST_STRUCTURE_E2E
- **IMPORTS**: 同上
- **GOTCHA**:
  - Transformer ハンドルの DOM はカスタム要素(canvas 内)。座標計算は「描画した矩形の右下角 + 数 px」で代用
  - Yjs 同期確認は本フェーズの E2E スコープ外(別タブ E2E は既存テストで実証済)
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e -- annotation-resize` 緑

### Task 10: 全体検証 + lint / format
- **ACTION**: 全フェーズ完了後の品質ゲート
- **IMPLEMENT**:
  - `pnpm typecheck` 全緑
  - `pnpm lint` (biome) クリーン
  - `pnpm test` 全緑(reducer 単体 + Shape 単体 + 既存テスト regression なし)
  - `pnpm test:e2e` 全緑
  - `pnpm build` 緑
- **VALIDATE**: 全コマンド exit 0

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| RectangleShape: Transformer attach on select | `isSelected=true` | `trRef.nodes()` に shapeRef がセットされる | - |
| RectangleShape: Transformer detach on deselect | `isSelected=false` | `trRef.nodes([])` | - |
| RectangleShape: onResize on transformEnd | scale 2.0 → onTransformEnd 発火 | onResize callback が `width = original * 2` で呼ばれる | scaleX≠scaleY |
| RectangleShape: minimum size guard | 5px 未満にリサイズ試行 | boundBoxFunc が oldBox を返す | min size = 5/8 |
| HighlightShape: 同上 | - | - | - |
| ArrowShape: 端点 Circle 表示 | `isSelected=true` | Circle x2 が render される | - |
| ArrowShape: 端点 Circle 非表示 | `isSelected=false` | Circle が render されない | - |
| ArrowShape: from 端点ドラッグ | from Circle を (50, 60) にドラッグ | onArrowEndpoints({from: {x:50,y:60}, to: 元のto}) | from と to の入れ替わりなし |
| Reducer: resize-rect with new x/y | action with x:10, y:20, width:100, height:50 | state の該当 annotation が 4 フィールド更新 | id が存在しない場合は no-op |
| Yjs mutation: resizeRectangleY with x/y | mutation 呼出 | Y.Map に x/y/width/height がセットされる | type mismatch は no-op |

### Edge Cases Checklist
- [x] 最小サイズ強制(< 5px は oldBox)
- [x] 矢印端点が同一座標になる場合(ゼロ長矢印 → 許容、Konva が点として描画)
- [x] 削除(annotation がなくなった瞬間)→ Transformer の `nodes([])` 呼出で例外なし
- [x] 同時 2 ブラウザリサイズ(LWW) — 既存 move と同じ Yjs LWW 挙動
- [x] React StrictMode の二重 useEffect → `nodes()` は冪等で問題なし
- [x] 選択中の注釈をリサイズ → Undo(`Cmd+Z`)で元のサイズに戻る — COMMITTING_ACTIONS に既登録
- [ ] Stage scale ≠ 1(ズーム時)→ Phase 7.7-3 のスコープ。本フェーズは scale=1 前提

---

## Validation Commands

### Static Analysis
```sh
pnpm -F @snap-share/web typecheck
pnpm -F @snap-share/shared typecheck
```
EXPECT: Zero type errors

### Lint
```sh
pnpm lint
```
EXPECT: Biome クリーン

### Unit Tests (該当領域)
```sh
pnpm -F @snap-share/web test -- src/components/canvas/__tests__/RectangleShape.test.tsx
pnpm -F @snap-share/web test -- src/components/canvas/__tests__/HighlightShape.test.tsx
pnpm -F @snap-share/web test -- src/components/canvas/__tests__/ArrowShape.test.tsx
pnpm -F @snap-share/web test -- src/hooks/__tests__/annotationsReducer.test.ts
pnpm -F @snap-share/web test -- src/domain/annotation/__tests__/yjs-mutations.test.ts
```
EXPECT: 全緑

### Full Test Suite
```sh
pnpm test
```
EXPECT: 既存テスト regression なし

### E2E
```sh
pnpm -F @snap-share/web test:e2e -- annotation-resize
pnpm -F @snap-share/web test:e2e -- annotation-tools  # regression
```
EXPECT: 緑、既存 E2E も regression なし

### Build
```sh
pnpm build
```
EXPECT: vite build (web) + wrangler dry-run (api) 両方成功

### Manual Validation (dev server)
- [ ] `pnpm dev` → http://localhost:5173
- [ ] 画像投入 → 矩形を描く → V キー → 矩形クリック → 8 ハンドル表示
- [ ] 角ハンドルドラッグ → サイズ変化
- [ ] Shift+ドラッグ → 比率固定
- [ ] Alt+ドラッグ → 中心基点
- [ ] Cmd+Z → サイズが元に戻る
- [ ] ハイライト同上
- [ ] 矢印を描く → 選択 → from/to 端点 Circle 表示 → 端点ドラッグで伸縮
- [ ] 別ブラウザで同じルームを開いてリサイズ → 反映確認(Yjs 同期)
- [ ] Stage scale=1 のまま破綻なく動作

---

## Acceptance Criteria
- [ ] Task 1-10 完了
- [ ] 全 validation コマンド緑
- [ ] 矩形 / ハイライトに Konva Transformer 8 ハンドル(Shift/Alt 自動対応)
- [ ] 矢印に from/to の 2 端点 Circle ハンドル
- [ ] リサイズ操作が Yjs 経由で他クライアントに同期
- [ ] Undo/Redo がリサイズも対象に含む
- [ ] テキスト注釈の挙動は変更なし(regression なし)
- [ ] 単体テスト 3 ファイル + E2E 1 ファイル追加
- [ ] PRD の Phase 1 status を `in-progress` → `complete` に更新

## Completion Checklist
- [ ] コードが Patterns to Mirror に準拠
- [ ] エラーハンドリング = no-op パターン(reducer の `id` 不在時 / Yjs mutation の type mismatch 時)
- [ ] ロギング = 既存通り(注釈操作はログ吐かない)
- [ ] テストが TEST_STRUCTURE_UNIT / E2E パターン準拠
- [ ] ハードコード値: `MIN_SIZE = 5`, `HANDLE_RADIUS = 6` のみ。それ以上は colors.ts / 既存定数流用
- [ ] CLAUDE.md ルール順守:
  - [ ] ルール 1: スキーマは判別共用体維持
  - [ ] ルール 4: Konva 色は hex literal のみ
  - [ ] ルール 5: ImageLayer の `listening={false}` 維持
  - [ ] ルール 8: Yjs mutation は `LOCAL_ORIGIN` で transact ラップ(既存 mutation 流用なので自動順守)
- [ ] 不要なスコープ追加なし(楕円/直線/回転/フリップは明示的に除外)
- [ ] Self-contained — 実装中に追加調査不要

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Transformer ノード ref 取得で React StrictMode の二重 mount 問題 | L | M | useEffect cleanup で `nodes([])` 不要(冪等)。問題発生時のみ対応 |
| reducer / Yjs mutation のシグネチャ拡張 (x/y 追加) で既存テストが fail | M | L | 同 PR で reducer / mutation テストも更新。Task 7 内で実施 |
| Konva Transformer と Yjs LWW の競合(2 人同時リサイズ) | M | M | 既存の move 操作でも同じ振る舞い(LWW)。E2E は単一 client で十分、別 client 同時操作は手動 QA |
| Arrow Circle が Arrow draggable と event 競合 | M | L | `e.cancelBubble = true` で event propagation を止める |
| react-konva モックで forwardRef + ref imperatively access が困難 | M | M | モック内で `useImperativeHandle` 相当の実装を仕込む(stub object 直接付与) |
| Stage scale ≠ 1 の Phase 7.7-3 完了後に座標計算が壊れる | L | M | `getRelativePointerPosition()` 統一は Phase 7.7-3 のスコープ。本フェーズは absolute 前提 |
| Konva 10.x への将来移行で Transformer API が変わる | L | L | 公式 changelog では Transformer API 破壊変更なし(CJS→ESM のみ) |

## Notes
- **本フェーズの実装は驚くほど軽い**: reducer / Yjs mutation / dispatch 経路が全て揃っているため、純粋に「UI Shape ↔ dispatch コールバック」の配線のみ。**主たる工数は Konva Transformer のアタッチ管理(useEffect + useRef)とテスト整備**
- **Arrow を Konva Transformer でやらない判断**: Konva 公式に Arrow の Transformer 例なし、bbox 矩形ハンドルでは伸縮方向が直感的でない。業界慣例に従い 2 端点 Circle 採用
- **Phase 7.7-3 (B1 ズーム/パン) との依存**: 本フェーズで Stage scale = 1 前提の座標計算を入れた箇所は、Phase 7.7-3 で `getRelativePointerPosition` 統一時に touchpoint となる。Risk 6 として明記
- **次フェーズ Phase 7.7-2 (色変更)**: AnnotationSchema に `color` フィールドを追加するため、本 plan で扱った `RectangleShape / HighlightShape / ArrowShape` の props もまた変更される(merge conflict 注意)。本フェーズ完了 → Phase 7.7-2 着手の直列がベース(PRD 注記済)

---
*Generated: 2026-05-03*
*Status: ready-to-implement*
