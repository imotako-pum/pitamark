# Plan: Phase 7.7-2 色変更 UI + Schema 拡張(stroke/fill → color に統一)

## Summary
全 4 種注釈(矩形/矢印/テキスト/ハイライト)の色を業務文脈に合わせて変更可能にする。スキーマレベルで `stroke` / `fill` を `color` に統一(未リリースなのでマイグレーション不要)、Toolbar に 7 色固定パレット + 2 適用ボタン(「新規デフォルトに設定」「選択中に適用」)を追加。デフォルトは赤(矩形/矢印/テキスト同期、ハイライトは黄独立)。

## User Story
As a **画像注釈で上司に成果物確認を求めるビジネスマン**, I want to **配置する注釈の色をパレットから選び、新規デフォルトとして使うか既存の注釈に適用するかを明示的に選びたい**, so that **「赤で目立たせる」「黄で強調する」など意図に応じた色で指示できる**.

## Problem → Solution
**現状**: 矩形=青、矢印=赤、テキスト=黒、ハイライト=黄でハードコード。色変更 UI も color フィールドも存在しない。
**改善後**: スキーマに `color` フィールドを追加、Toolbar の色パレットから選択して「新規デフォルト変更」「選択中の注釈に適用」の 2 ボタンで使い分け可能。デフォルトは赤(同期 3 種)+ 黄(ハイライト独立)。

## Metadata
- **Complexity**: Large(スキーマ変更が広範囲に波及。15+ ファイル)
- **Source PRD**: `.claude/PRPs/prds/phase-7.7-ux-foundation.prd.md`
- **PRD Phase**: Phase 2 (A2: 色変更 UI + Schema 拡張)
- **Estimated Files**: 12 UPDATE / 3 CREATE(ColorPalette + 単体テスト + E2E)

---

## UX Design

### Before
```
┌─────────────────────────────────────────────────────────┐
│ Toolbar: [V][R][A][T][H] | [Undo][Redo][Del] | [DL][🗑] │
│                                                          │
│ 注釈: 矩形は青固定 / 矢印は赤固定 /                      │
│       テキストは黒固定 / ハイライトは黄固定               │
│ 色変更: 不可能                                           │
└─────────────────────────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────────────────────────────────┐
│ Toolbar:                                                          │
│   [V][R][A][T][H] | [Undo][Redo][Del] |                          │
│   [● ○ ○ ○ ○ ○ ○] [🎨デフォルト][✓選択中に適用] |                 │
│   [DL][🗑]                                                       │
│                                                                   │
│ ● = 現在ピックされている色(リング表示)                         │
│ デフォルトボタン: 矢印/矩形/テキストは同期、ハイライトは独立      │
│ 選択中に適用: selectedId が無いと disabled                       │
└─────────────────────────────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 新規矩形/矢印/テキスト描画時の色 | コードハードコード | `state.defaultColors.sync` から取得 | 同期 3 種で共有 |
| 新規ハイライト描画時の色 | `FILL_HIGHLIGHT` ハードコード | `state.defaultColors.highlight` から取得 | 独立(用途差) |
| 注釈の色フィールド | rect/arrow=`stroke`、text/highlight=`fill` | 全タイプ `color` で統一 | スキーマ破壊変更(未リリース) |
| Toolbar 色パレット | なし | 7 色 + 2 適用ボタン | 新規 ColorPalette コンポーネント |
| 既存注釈の色変更 | 不可 | 「選択中に適用」ボタンで dispatch | Yjs 経由で他クライアントにも同期 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `packages/shared/src/annotation.ts` | 全体 | 4 注釈型の現状スキーマ。`color` への統一が必要 |
| P0 | `apps/web/src/domain/annotation/yjs-codec.ts` | 全体 | Y.Map ⇔ Annotation 変換。`stroke`/`fill` キーを `color` に変更 |
| P0 | `apps/web/src/domain/annotation/yjs-mutations.ts` | 全体 | LOCAL_ORIGIN + tx ヘルパー。setAnnotationColorY を新規追加 |
| P0 | `apps/web/src/hooks/annotationsReducer.ts` | 全体 | state に defaultColors 追加、3 actions 追加 |
| P0 | `apps/web/src/hooks/yjs-annotations-context.ts` | 68-103 | applyDataAction の switch に annotation/set-color を追加 |
| P0 | `apps/web/src/components/canvas/CanvasStage.tsx` | 39-73 | buildDraft* がハードコード色を使っている。state.defaultColors から取得に変更 |
| P0 | `apps/web/src/components/canvas/colors.ts` | 全体 | パレット定数追加、デフォルト色定義 |
| P0 | `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | 全体 | annotation.stroke → annotation.color |
| P0 | `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | 全体 | annotation.stroke → annotation.color |
| P0 | `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | 全体 | annotation.fill → annotation.color |
| P0 | `apps/web/src/components/canvas/shapes/TextShape.tsx` | 全体 | annotation.fill → annotation.color |
| P0 | `apps/web/src/components/toolbar/Toolbar.tsx` | 全体 | ColorPalette セクション追加 |
| P1 | `apps/web/src/components/toolbar/ToolButton.tsx` | 全体 | ボタンスタイルの参考(shadcn Button + Tooltip パターン) |
| P1 | `apps/web/src/pages/EditorShell.tsx` | 195-208 | Toolbar への props 流入口。color 関連 props を追加 |
| P1 | `apps/web/src/domain/annotation/operations.ts` | 全体 | setStroke / setFill を setColor に統合 |
| P2 | `packages/shared/src/__tests__/annotation.test.ts` | 全体 | スキーマテストの fixture 更新 |
| P2 | `apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx` | 1-20 | react-konva モックパターン参考 |
| P2 | `apps/web/e2e/annotation-tools.spec.ts` | 全体 | E2E パターン参考(dragOnStage, ANNOTATIONS_KEY) |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| 業界の色 UI 慣例 | Phase 7.7 PRD 市場調査 | 5-7 色固定パレット + デフォルト赤が事実上標準(Skitch / CleanShot / Shottr) |
| shadcn Button | 既存 `apps/web/src/components/ui/button.tsx` | variant="ghost" / size="icon" を palette アイテム + 適用ボタンで使用 |

---

## Patterns to Mirror

### NAMING_CONVENTION
```typescript
// SOURCE: apps/web/src/components/toolbar/Toolbar.tsx:32-37
type ToolDef = Readonly<{
  tool: Tool;
  icon: typeof MousePointer2;
  label: string;
  shortcut: string;
}>;
```
- Props 型は `Readonly<{...}>` ラップ
- 内部 def 型も同様
- Component / 型は PascalCase、定数は UPPER_SNAKE_CASE

### REDUCER_ACTION_DEFINITION
```typescript
// SOURCE: apps/web/src/hooks/annotationsReducer.ts:21-30 + Phase 7.7-1 拡張パターン
export type AnnotationsAction =
  | { type: 'tool/set'; tool: Tool }
  | { type: 'select/set'; id: string | null }
  // 新規追加:
  | { type: 'default-color/set-sync'; color: string }
  | { type: 'default-color/set-highlight'; color: string }
  | { type: 'annotation/set-color'; id: string; color: string }
  // ...
```
- UI-only action は短いプレフィックスで識別(`tool/`, `select/`, `default-color/`)
- データ変更系は `annotation/` プレフィックス + COMMITTING_ACTIONS に登録

### YJS_MUTATION_PATTERN
```typescript
// SOURCE: apps/web/src/domain/annotation/yjs-mutations.ts:54-67
export const setAnnotationColorY = (
  doc: Y.Doc,
  ya: YAnnotations,
  id: string,
  color: string,
): void => {
  const m = ya.get(id);
  if (!m) return;
  tx(doc, () => {
    m.set('color', color);
  });
};
```
- `tx(doc, fn)` で LOCAL_ORIGIN ラップ(既存ヘルパー流用)
- 存在しない id は no-op
- 全注釈型が同じ `color` フィールドを持つので type guard 不要

### YJS_DISPATCH_BRIDGE
```typescript
// SOURCE: apps/web/src/hooks/yjs-annotations-context.ts:68-103
case 'annotation/set-color':
  setAnnotationColorY(doc, yAnnotations, action.id, action.color);
  return;
case 'default-color/set-sync':
case 'default-color/set-highlight':
  return;  // UI-only state, do not persist to Yjs
```
- `tool/set` / `select/set` と同じく UI-only は早期 return

### REDUCER_OPERATION_PATTERN
```typescript
// SOURCE: apps/web/src/domain/annotation/operations.ts:74-87 (existing setStroke / setFill — 統合対象)
export const setColor = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  color: string,
): ReadonlyArray<Annotation> =>
  annotations.map((a) => (a.id === id ? { ...a, color } : a));
```
- 既存の setStroke / setFill (operations.ts:74-102) を **削除** して setColor に統合
- 全タイプが color を持つので type guard 不要(`{ ...a, color }` で型は維持される)

### COLOR_HEX_PATTERN
```typescript
// SOURCE: apps/web/src/components/canvas/colors.ts (Phase 7.7-1 拡張済)
// CLAUDE.md ルール 4: Konva は CSS 変数を解決しないため hex literal 必須
export const HANDLE_FILL = '#ffffff';

// 新規追加:
export const COLOR_PALETTE: ReadonlyArray<string> = [
  '#e74c3c', // red (default sync)
  '#ff8c42', // orange
  '#f5d142', // yellow (default highlight)
  '#2ecc71', // green
  '#3a86ff', // blue
  '#9b59b6', // purple
  '#202020', // black
];
export const DEFAULT_SYNC_COLOR = '#e74c3c';
export const DEFAULT_HIGHLIGHT_COLOR = '#f5d142';
```

### KONVA_COLOR_MAPPING
```typescript
// SOURCE: 既存 RectangleShape.tsx:24, ArrowShape.tsx:25-28 (要更新)
// rect/arrow: konva の stroke prop に annotation.color
stroke={isSelected ? OUTLINE_ACCENT : annotation.color}

// SOURCE: 既存 ArrowShape.tsx:36
// arrow: pointer head の fill も同色
fill={stroke}  // = annotation.color when not selected

// SOURCE: 既存 TextShape.tsx:66, HighlightShape.tsx:24 (要更新)
// text/highlight: konva の fill prop に annotation.color
fill={annotation.color}
```
- スキーマ統一後、Konva の prop 名は変わらず(`stroke`/`fill`) — マッピングは Shape 内で行う

### TOOLBAR_BUTTON_PATTERN
```typescript
// SOURCE: apps/web/src/components/toolbar/ToolButton.tsx:38-49
<Button
  type="button"
  variant="ghost"
  size="icon"
  aria-label={label}
  aria-pressed={pressed}
  disabled={disabled}
  onClick={onClick}
  className={cn('rounded-md border border-transparent', TONE_CLASS[tone])}
>
  <Icon size={18} strokeWidth={1.75} />
</Button>
```
- shadcn Button + Tooltip ラッパー
- size="icon"(32x32px 想定)、aria-pressed で pick 状態
- ColorPalette のスウォッチもこのパターン(Icon の代わりに inline 色 div)

### TEST_STRUCTURE_UNIT
```typescript
// SOURCE: apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx (Phase 7.7-1)
const { capture } = vi.hoisted(() => ({ capture: { ... } }));

vi.mock('react-konva', async () => { ... });
// or: vi.mock('react-konva', () => ({...}))
```
- ColorPalette テストは react-konva 不要(純 React UI)→ `@testing-library/react` 相当を使うか、既存パターンの `createRoot + act` で
- shadcn Button / Tooltip を含むためそれらの mock も必要(または実物利用 + happy-dom で動かす)

### TEST_STRUCTURE_E2E
```typescript
// SOURCE: apps/web/e2e/annotation-tools.spec.ts:1-40
const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';
const dragOnStage = async (...) => { /* ... */ };
const skipNonChromium = (testInfo) => test.skip(...);
```
- `__SNAP_SHARE_ANNOTATIONS__` で window.annotations を取得して color フィールドを検証
- パレット要素のクリックは `getByRole('button', { name: '色: red' })` 等で

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `packages/shared/src/annotation.ts` | UPDATE | stroke/fill → color にリネーム(全 4 型) |
| `packages/shared/src/__tests__/annotation.test.ts` | UPDATE | テスト fixture を color に更新 |
| `apps/web/src/domain/annotation/yjs-codec.ts` | UPDATE | Y.Map のキー名 `stroke`/`fill` → `color` |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | UPDATE | setAnnotationColorY 追加 |
| `apps/web/src/domain/annotation/operations.ts` | UPDATE | setStroke / setFill を削除して setColor に統合 |
| `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` | UPDATE | fixture と setAnnotationColorY テスト追加 |
| `apps/web/src/domain/annotation/__tests__/operations.test.ts` | UPDATE | setStroke/setFill テスト削除、setColor テスト追加 |
| `apps/web/src/hooks/annotationsReducer.ts` | UPDATE | state に defaultColors 追加、3 actions 追加 |
| `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` | UPDATE | 新 actions のテスト + 既存 fixture を color に |
| `apps/web/src/hooks/yjs-annotations-context.ts` | UPDATE | applyDataAction に annotation/set-color 追加、default-color/* は no-op |
| `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` | UPDATE | annotation/set-color と新 default-color/* の挙動テスト |
| `apps/web/src/components/canvas/colors.ts` | UPDATE | COLOR_PALETTE / DEFAULT_SYNC_COLOR / DEFAULT_HIGHLIGHT_COLOR 追加。STROKE_RECTANGLE 等は削除可(CanvasStage が defaultColors 経由になるため) |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATE | buildDraft* が `state.defaultColors.sync` / `state.defaultColors.highlight` を引数受け取りに変更 |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | UPDATE | annotation.stroke → annotation.color |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | UPDATE | annotation.stroke → annotation.color |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | UPDATE | annotation.fill → annotation.color |
| `apps/web/src/components/canvas/shapes/TextShape.tsx` | UPDATE | annotation.fill → annotation.color |
| `apps/web/src/components/toolbar/Toolbar.tsx` | UPDATE | ColorPalette セクション追加、props 拡張 |
| `apps/web/src/components/toolbar/ColorPalette.tsx` | CREATE | パレット 7 色 + 2 適用ボタン |
| `apps/web/src/components/toolbar/__tests__/ColorPalette.test.tsx` | CREATE | パレット選択 + 2 ボタンの dispatch テスト |
| `apps/web/src/pages/EditorShell.tsx` | UPDATE | Toolbar に color 関連 props を追加(state.defaultColors / handleSetDefaultColor / handleApplyColorToSelected) |
| `apps/web/e2e/annotation-color.spec.ts` | CREATE | E2E: パレット選択 → デフォルト変更 → 描画で色反映 / 適用ボタンで既存注釈の色変更 |

## NOT Building

- **任意 RGB カラーピッカー** — PRD で Won't 確定。固定パレット 7 色のみ
- **HSL / HEX 入力** — 同上
- **「最近使った色」履歴** — オーバースペック
- **テーマ別パレット**(モード切替) — 1 共有パレット
- **stroke の太さ変更 UI** — 別フェーズ(strokeWidth は Schema に既存だが UI 露出は Phase 7.7 スコープ外)
- **ハイライト不透明度の変更** — `HIGHLIGHT_OPACITY = 0.35` 固定
- **色のキーボードショートカット**(数字キーで色切替など) — Phase 4 (B2 ショートカット網羅) で扱うかは Phase 4 plan で判断
- **Yjs マイグレーション** — 未リリースのためスキーマ破壊変更可(PRD 確定事項)
- **Eyedropper / カラースポイト** — オーバースペック
- **複数選択への一括適用** — selectedId は単数モデルを維持

---

## Step-by-Step Tasks

### Task 1: shared スキーマで stroke/fill → color に統一
- **ACTION**: `packages/shared/src/annotation.ts` を更新
- **IMPLEMENT**:
  - RectangleAnnotationSchema: `stroke: ColorSchema` → `color: ColorSchema`
  - ArrowAnnotationSchema: `stroke: ColorSchema` → `color: ColorSchema`
  - TextAnnotationSchema: `fill: ColorSchema` → `color: ColorSchema`
  - HighlightAnnotationSchema: `fill: ColorSchema` → `color: ColorSchema`
  - `strokeWidth` は維持(矩形/矢印のみ。線の太さは別概念)
- **MIRROR**: 既存スキーマ定義(同ファイル内)
- **IMPORTS**: 変更なし
- **GOTCHA**: ColorSchema(`#[0-9A-Fa-f]{6}` 正規表現)はそのまま流用
- **VALIDATE**: `pnpm -F @snap-share/shared typecheck`

### Task 2: shared テスト fixture を color に更新
- **ACTION**: `packages/shared/src/__tests__/annotation.test.ts` を更新
- **IMPLEMENT**:
  - 全 fixture の `stroke: '#xxx'` → `color: '#xxx'`、`fill: '#xxx'` → `color: '#xxx'`
  - "rejects malformed stroke color" → "rejects malformed color" にリネーム
- **MIRROR**: 既存テスト構造(describe / it パターン)
- **VALIDATE**: `pnpm -F @snap-share/shared test`

### Task 3: yjs-codec のキー名を color に統一
- **ACTION**: `apps/web/src/domain/annotation/yjs-codec.ts` を更新
- **IMPLEMENT**:
  - annotationToYMap: 全タイプで `m.set('color', annotation.color)`(stroke/fill の set 削除)
  - yMapToAnnotation: 全タイプで `color: m.get('color')`(stroke/fill の get 削除)
- **MIRROR**: 既存 codec パターン
- **GOTCHA**: arrow は既存で stroke/strokeWidth 両方持つ。strokeWidth はそのまま、stroke のみ color に
- **VALIDATE**: typecheck + `pnpm -F @snap-share/web test -- yjs-codec`

### Task 4: setAnnotationColorY mutation 追加
- **ACTION**: `apps/web/src/domain/annotation/yjs-mutations.ts` を更新
- **IMPLEMENT**:
  - export const `setAnnotationColorY = (doc, ya, id, color) => { const m = ya.get(id); if (!m) return; tx(doc, () => { m.set('color', color); }); }`
  - 全タイプ共通(type guard 不要)
- **MIRROR**: YJS_MUTATION_PATTERN
- **VALIDATE**: typecheck

### Task 5: yjs-mutations テスト追加
- **ACTION**: `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` を更新
- **IMPLEMENT**:
  - 既存 fixture(rect/arr/txt/hi) の stroke/fill → color
  - 新規 describe "setAnnotationColorY":
    - "sets color on rectangle / arrow / text / highlight" — 4 型それぞれで ya 内の color フィールドが更新される
    - "is a no-op for unknown id"
- **MIRROR**: 既存 describe `resizeRectangleY / resizeHighlightY`
- **VALIDATE**: `pnpm -F @snap-share/web test -- yjs-mutations`

### Task 6: operations.ts で setStroke/setFill を setColor に統合
- **ACTION**: `apps/web/src/domain/annotation/operations.ts` を更新
- **IMPLEMENT**:
  - `setStroke`, `setFill` を削除(現状未使用 dead code)
  - 新規:
    ```typescript
    export const setColor = (
      annotations: ReadonlyArray<Annotation>,
      id: string,
      color: string,
    ): ReadonlyArray<Annotation> =>
      annotations.map((a) => (a.id === id ? { ...a, color } : a));
    ```
- **MIRROR**: REDUCER_OPERATION_PATTERN
- **GOTCHA**: discriminated union を `{ ...a, color }` で更新する場合、TypeScript は member union を維持(全 4 型が color を持つため)。型エラーが出たら `as Annotation` キャストで吸収
- **VALIDATE**: typecheck

### Task 7: operations テスト更新
- **ACTION**: `apps/web/src/domain/annotation/__tests__/operations.test.ts` を更新
- **IMPLEMENT**:
  - fixture の stroke/fill → color(全 4 型)
  - setStroke / setFill の describe を削除
  - 新規 describe "setColor":
    - "updates color on any annotation type" — 4 型それぞれ
    - "is a no-op for unknown id"
- **VALIDATE**: `pnpm -F @snap-share/web test -- operations`

### Task 8: annotationsReducer に defaultColors と新 actions 追加
- **ACTION**: `apps/web/src/hooks/annotationsReducer.ts` を更新
- **IMPLEMENT**:
  - `AnnotationsState` 拡張:
    ```typescript
    export type AnnotationsState = Readonly<{
      annotations: ReadonlyArray<Annotation>;
      selectedId: string | null;
      tool: Tool;
      defaultColors: Readonly<{ sync: string; highlight: string }>;
    }>;
    ```
  - `initialAnnotationsState` に `defaultColors: { sync: DEFAULT_SYNC_COLOR, highlight: DEFAULT_HIGHLIGHT_COLOR }`
    - 注: colors.ts が circular にならないように `import { DEFAULT_SYNC_COLOR, DEFAULT_HIGHLIGHT_COLOR } from '../components/canvas/colors'` する。もし循環したら、定数を別ファイル `apps/web/src/lib/color-palette.ts` に切り出す
  - 新 action 型 3 つ追加(REDUCER_ACTION_DEFINITION 参照)
  - reducer の switch case 追加:
    - `default-color/set-sync`: `{ ...state, defaultColors: { ...state.defaultColors, sync: action.color } }`
    - `default-color/set-highlight`: 同上 highlight
    - `annotation/set-color`: `{ ...state, annotations: setColor(state.annotations, action.id, action.color) }`
  - `COMMITTING_ACTIONS` に `'annotation/set-color'` を追加(Undo/Redo 対象)
- **MIRROR**: REDUCER_ACTION_DEFINITION
- **GOTCHA**: `default-color/*` は **COMMITTING_ACTIONS に追加しない**(UI 状態、Undo 対象外)
- **VALIDATE**: typecheck

### Task 9: annotationsReducer テスト追加
- **ACTION**: `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` を更新
- **IMPLEMENT**:
  - 既存 fixture の stroke/fill → color
  - 新規 describe:
    - "default-color/set-sync updates state.defaultColors.sync"
    - "default-color/set-highlight updates state.defaultColors.highlight"
    - "annotation/set-color updates color of target annotation"
    - "annotation/set-color is no-op for unknown id"
  - `isCommittingAction` テスト: `'annotation/set-color'` は true、`'default-color/set-sync'` は false
- **VALIDATE**: `pnpm -F @snap-share/web test -- annotationsReducer`

### Task 10: yjs-annotations-context bridge 拡張
- **ACTION**: `apps/web/src/hooks/yjs-annotations-context.ts` を更新
- **IMPLEMENT**:
  - applyDataAction の switch に追加:
    ```typescript
    case 'default-color/set-sync':
    case 'default-color/set-highlight':
      return;  // UI-only, do not persist
    case 'annotation/set-color':
      setAnnotationColorY(doc, yAnnotations, action.id, action.color);
      return;
    ```
  - import に `setAnnotationColorY` 追加
- **MIRROR**: YJS_DISPATCH_BRIDGE
- **VALIDATE**: typecheck

### Task 11: yjs-annotations-context テスト
- **ACTION**: `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` を更新
- **IMPLEMENT**:
  - 既存 fixture の stroke/fill → color
  - 新規テスト:
    - "annotation/set-color updates the color field in Yjs"
    - "default-color/set-sync does not mutate Yjs"(UI-only)
- **VALIDATE**: `pnpm -F @snap-share/web test -- yjs-annotations-context`

### Task 12: colors.ts に COLOR_PALETTE / デフォルト追加 + 旧定数掃除
- **ACTION**: `apps/web/src/components/canvas/colors.ts` を更新
- **IMPLEMENT**:
  - 追加:
    ```typescript
    export const COLOR_PALETTE: ReadonlyArray<string> = [
      '#e74c3c', '#ff8c42', '#f5d142', '#2ecc71', '#3a86ff', '#9b59b6', '#202020',
    ];
    export const DEFAULT_SYNC_COLOR = '#e74c3c';
    export const DEFAULT_HIGHLIGHT_COLOR = '#f5d142';
    ```
  - 削除: `STROKE_RECTANGLE`, `STROKE_ARROW`, `FILL_TEXT`, `FILL_HIGHLIGHT`(CanvasStage が defaultColors 経由になるので未使用に)
  - 注: 削除後に grep で他参照がないか必ず確認(presence layer 等)
- **MIRROR**: 既存定数定義スタイル
- **GOTCHA**: 削除した定数を import している場所(主に CanvasStage)も同 PR で除去必要。grep `STROKE_RECTANGLE\|STROKE_ARROW\|FILL_TEXT\|FILL_HIGHLIGHT` で全箇所洗う
- **VALIDATE**: typecheck(削除した import の参照箇所が型エラーになる → Task 13 で修正)

### Task 13: CanvasStage.buildDraft* を defaultColors 経由に
- **ACTION**: `apps/web/src/components/canvas/CanvasStage.tsx` を更新
- **IMPLEMENT**:
  - `buildDraftRectangle / buildDraftHighlight / buildDraftArrow` に `color: string` 引数追加
  - text 注釈作成箇所(L110-126)も `state.defaultColors.sync` を `fill` に渡すよう変更 → `color` フィールドに統一
  - handleMouseDown / handleMouseMove / handleMouseUp で state.defaultColors を読んで builder に渡す
  - import 削除: `STROKE_RECTANGLE`, `STROKE_ARROW`, `FILL_TEXT`, `FILL_HIGHLIGHT`
  - text 注釈の `fill` プロパティ → `color` に
- **MIRROR**: 既存 buildDraft* シグネチャ + state 読み出しパターン
- **GOTCHA**:
  - text 注釈は draft なし(直接 dispatch)。L114-122 の `Annotation: { type: 'text', ..., fill: FILL_TEXT }` を `{ type: 'text', ..., color: state.defaultColors.sync }` に変更
  - useCallback の依存配列に `state.defaultColors.sync` / `.highlight` を追加(buildDraft が引数化されるなら不要だが、handlers 内で参照するなら必要)
- **VALIDATE**: typecheck

### Task 14: Shape 4 ファイルで stroke/fill → color にリネーム
- **ACTION**: 以下 4 ファイルを更新
  - `apps/web/src/components/canvas/shapes/RectangleShape.tsx`
  - `apps/web/src/components/canvas/shapes/ArrowShape.tsx`
  - `apps/web/src/components/canvas/shapes/HighlightShape.tsx`
  - `apps/web/src/components/canvas/shapes/TextShape.tsx`
- **IMPLEMENT**:
  - RectangleShape: `stroke={isSelected ? OUTLINE_ACCENT : annotation.stroke}` → `... : annotation.color`
  - ArrowShape: 同上 + `fill={stroke}`(pointer head)はそのまま(stroke 変数経由で参照)
  - HighlightShape: `fill={annotation.fill}` → `fill={annotation.color}`
  - TextShape: `fill={annotation.fill}` → `fill={annotation.color}`
- **MIRROR**: KONVA_COLOR_MAPPING
- **GOTCHA**: 4 ファイルとも `annotation.{stroke|fill}` のリネームのみ。Konva 側の prop 名(stroke/fill)は変更しない
- **VALIDATE**: typecheck

### Task 15: ColorPalette コンポーネント新規作成
- **ACTION**: `apps/web/src/components/toolbar/ColorPalette.tsx` を新規作成
- **IMPLEMENT**:
  - Props:
    ```typescript
    type ColorPaletteProps = Readonly<{
      pickedColor: string;             // 現在ピックされている色(UI ローカル状態 or 親管理)
      hasSelection: boolean;            // 選択中注釈の有無
      disabled: boolean;                // imageLoaded === false の時 disable
      onPickColor: (color: string) => void;
      onApplyAsDefault: (color: string) => void;
      onApplyToSelected: (color: string) => void;
    }>;
    ```
  - レイアウト: 7 色のスウォッチボタン + Divider + 「デフォルト」ボタン + 「選択中に適用」ボタン
  - スウォッチボタン: shadcn Button の `variant="ghost"` をベース、size="icon"、内部に `<span style={{ background: color }} />` で色表示
  - pick 状態の視覚: `aria-pressed={pickedColor === color}` + `ring-2 ring-(--color-accent)` 等
  - 「デフォルト」ボタン: lucide `Brush` アイコン + tooltip "新規描画のデフォルト色に設定"
  - 「選択中に適用」ボタン: lucide `Wand2` アイコン + tooltip "選択中の注釈に適用"、disabled when `!hasSelection`
- **MIRROR**: TOOLBAR_BUTTON_PATTERN(ToolButton)
- **IMPORTS**:
  ```typescript
  import { Brush, Wand2 } from 'lucide-react';
  import { Button } from '@/components/ui/button';
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
  import { COLOR_PALETTE } from '../canvas/colors';
  ```
- **GOTCHA**:
  - スウォッチ button の `aria-label="色: {hex}"`(スクリーンリーダー対応)
  - 色 swatch は `<span>` の background で hex 直指定(CSS 変数禁止 — colors.ts が SSOT)
- **VALIDATE**: typecheck

### Task 16: Toolbar に ColorPalette を組み込む
- **ACTION**: `apps/web/src/components/toolbar/Toolbar.tsx` を更新
- **IMPLEMENT**:
  - props 追加:
    ```typescript
    pickedColor: string;
    onPickColor: (color: string) => void;
    onApplyDefaultColor: (color: string) => void;
    onApplyColorToSelected: (color: string) => void;
    ```
  - レイアウト: 既存 [Tools] | [History/Delete] の後ろに `<Divider />` + `<ColorPalette />` を追加
- **MIRROR**: 既存 Toolbar セクション分割パターン(Divider 区切り)
- **VALIDATE**: typecheck

### Task 17: EditorShell で ColorPalette state を配線
- **ACTION**: `apps/web/src/pages/EditorShell.tsx` を更新
- **IMPLEMENT**:
  - `pickedColor` のローカル state(`useState<string>(DEFAULT_SYNC_COLOR)`)
  - ハンドラ:
    - `handlePickColor = (color) => setPickedColor(color)`
    - `handleApplyDefaultColor = (color) => { const isHighlightContext = store.state.tool === 'highlight' || (selectedAnnotation?.type === 'highlight'); dispatch({ type: isHighlightContext ? 'default-color/set-highlight' : 'default-color/set-sync', color }); }`
    - `handleApplyColorToSelected = (color) => { if (store.state.selectedId) dispatch({ type: 'annotation/set-color', id: store.state.selectedId, color }); }`
  - Toolbar に新 props を渡す
- **MIRROR**: 既存 EditorShell の handler パターン
- **GOTCHA**:
  - 「デフォルトに設定」のセマンティクスは「現在のツール選択 / 選択中注釈の type に応じて sync or highlight default に設定」がユーザー直感に合う
  - シンプルバージョン: 常に sync default に設定し、Highlight tool 時のみ highlight default に。MVP はこれで OK
- **VALIDATE**: typecheck

### Task 18: ColorPalette 単体テスト
- **ACTION**: `apps/web/src/components/toolbar/__tests__/ColorPalette.test.tsx` を新規作成
- **IMPLEMENT**:
  - "renders 7 color swatch buttons" — `getAllByRole('button', { name: /^色: #/ })` の length
  - "marks the picked color as pressed" — `pickedColor='#e74c3c'` → 該当 button の `aria-pressed='true'`
  - "calls onPickColor when a swatch is clicked"
  - "calls onApplyAsDefault with picked color when default button clicked"
  - "calls onApplyToSelected with picked color when apply button clicked"
  - "disables apply-to-selected button when hasSelection=false"
- **MIRROR**: TEST_STRUCTURE_UNIT(`createRoot + act` パターン、または @testing-library/react を導入なら render)
- **GOTCHA**:
  - shadcn Button + Tooltip は実物 import で OK(canvas backend 不要)
  - lucide icons は実物 OK
  - `vi.mock` 不要(純 React コンポーネント)
- **VALIDATE**: `pnpm -F @snap-share/web test -- ColorPalette`

### Task 19: E2E テスト
- **ACTION**: `apps/web/e2e/annotation-color.spec.ts` を新規作成
- **IMPLEMENT**:
  - "新規矩形のデフォルト色が初期値で赤":
    - 画像ドロップ → 矩形ツール選択 → 描画
    - `readAnnotations()` で `color === '#e74c3c'`
  - "パレットで色をピック → デフォルトに設定 → 新規描画でその色が使われる":
    - 緑 swatch クリック → 「デフォルトに設定」クリック → 矩形描画 → color が緑
  - "選択中の注釈に色を適用すると更新される":
    - 矩形描画 → V キーで select tool → 矩形クリック → 青 swatch → 「選択中に適用」 → 既存矩形の color が青
  - "ハイライトのデフォルトは sync と独立":
    - ハイライトツール → 描画 → 黄色のまま
    - 矩形ツール → 緑 default 設定 → 矩形描画 → 緑 / ハイライト描画 → 依然黄
  - 各テスト先頭に `skipNonChromium(testInfo)`
- **MIRROR**: TEST_STRUCTURE_E2E(`apps/web/e2e/annotation-tools.spec.ts` 参考)
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e -- annotation-color`

### Task 20: 全体検証 + lint / format
- **ACTION**: 全タスク完了後の品質ゲート
- **IMPLEMENT**:
  - `pnpm typecheck` 全緑
  - `pnpm exec biome check --write .` で auto-fix(import 並び等)→ `pnpm lint` 緑
  - `pnpm test` 全緑
  - `pnpm -F @snap-share/web test:e2e` 全緑(annotation-resize / annotation-tools / 新 annotation-color)
  - `pnpm build` 緑
- **VALIDATE**: 全コマンド exit 0

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| shared スキーマ: rectangle parse with color | `{ ..., color: '#e74c3c' }` | OK | malformed color → throw |
| shared スキーマ: 全 4 型に color が必須 | `color` 欠如 | parse error | - |
| yjs-codec: rect → Y.Map → rect | RectangleAnnotation | round-trip equal | color が保持される |
| yjs-mutations: setAnnotationColorY on rect | (id, '#xxx') | Y.Map.color = '#xxx' | unknown id → no-op |
| yjs-mutations: setAnnotationColorY on highlight | (id, '#xxx') | 同上 | type 関係なく動く |
| operations: setColor | (annotations, id, '#xxx') | 該当のみ color 更新 | id 不在 / 全 4 型 |
| reducer: default-color/set-sync | { color: '#xxx' } | state.defaultColors.sync 更新 | highlight に影響なし |
| reducer: default-color/set-highlight | { color: '#xxx' } | state.defaultColors.highlight 更新 | sync に影響なし |
| reducer: annotation/set-color | { id, color } | annotations[i].color 更新 | unknown id → no-op |
| reducer: isCommittingAction | annotation/set-color | true | default-color/* → false |
| yjs-context: annotation/set-color | applyDataAction(action) | Y.Map で color 更新 | UI-only actions は無視 |
| ColorPalette: render | 7 color array | 7 swatch buttons | - |
| ColorPalette: pick | clicked '#e74c3c' | onPickColor('#e74c3c') | - |
| ColorPalette: apply-as-default | clicked button + pickedColor='#xxx' | onApplyAsDefault('#xxx') | - |
| ColorPalette: apply-to-selected | hasSelection=false | button disabled | - |

### Edge Cases Checklist
- [x] 不在 id への setColor / setAnnotationColorY → no-op
- [x] 同期(sync)と独立(highlight)の defaultColors が混ざらない
- [x] 選択 0 件で「適用」ボタンが disabled
- [x] パレット外の任意色は受け取らない(UI で防ぐ)
- [x] スキーマ拒否: 6 桁 hex 以外の color はパース失敗
- [x] Yjs 同期: 別タブで color 変更 → 反映(既存 mutation テストで担保)
- [x] Undo: 色変更を Cmd+Z で戻せる(COMMITTING_ACTIONS に登録済)
- [x] Phase 7.7-1 の resize と Phase 7.7-2 の color が共存(Shape リファクタが衝突しない)

---

## Validation Commands

### Static Analysis
```sh
pnpm typecheck
```
EXPECT: turbo 4 タスク全緑

### Lint
```sh
pnpm exec biome check --write .
pnpm lint
```
EXPECT: clean

### Unit Tests (該当領域)
```sh
pnpm -F @snap-share/shared test
pnpm -F @snap-share/web test
```
EXPECT: 全緑(既存テストの fixture 更新も含む)

### Build
```sh
pnpm build
```
EXPECT: vite + wrangler dry-run 成功

### E2E
```sh
pnpm -F @snap-share/web test:e2e -- annotation-color
pnpm -F @snap-share/web test:e2e   # 全 regression
```
EXPECT: 新規 annotation-color 緑、既存 annotation-resize / annotation-tools / 他 regression なし

### Manual Validation (dev server)
- [ ] `pnpm dev` → http://localhost:5173
- [ ] 画像投入 → 矩形描画 → 赤(`#e74c3c`)で配置される
- [ ] パレットで緑をピック → デフォルトに設定 → 矩形描画 → 緑
- [ ] V キー → 既存赤矩形クリック → 青ピック → 選択中に適用 → 矩形が青
- [ ] H ハイライトツール → 描画 → 黄色のまま(sync default 影響なし)
- [ ] パレットで橙ピック → デフォルト(ハイライトコンテキストで) → ハイライト描画 → 橙
- [ ] Cmd+Z → 色変更が元に戻る
- [ ] 別ブラウザで同じルーム開く → リアルタイム反映

---

## Acceptance Criteria
- [ ] Task 1-20 完了
- [ ] 全 validation コマンド緑
- [ ] スキーマが `color` で統一(stroke/fill 削除)
- [ ] 7 色固定パレット + 2 適用ボタン UI
- [ ] デフォルト: sync = 赤(`#e74c3c`)、highlight = 黄(`#f5d142`)
- [ ] 「新規デフォルトに設定」「選択中の注釈に適用」両方動作
- [ ] sync(rect/arrow/text)と highlight でデフォルトが独立
- [ ] Undo/Redo がリサイズも色変更も対象に含む
- [ ] 既存 E2E (annotation-resize / annotation-tools) regression なし
- [ ] PRD の Phase 2 status を `pending` → `complete` に更新

## Completion Checklist
- [ ] コードが Patterns to Mirror に準拠
- [ ] エラーハンドリング = no-op パターン(reducer / Yjs mutation の不在 id)
- [ ] テストが TEST_STRUCTURE_UNIT / E2E パターン準拠
- [ ] ハードコード値: COLOR_PALETTE / DEFAULT_*_COLOR は colors.ts に集約
- [ ] CLAUDE.md ルール順守:
  - [ ] ルール 1: 判別共用体維持
  - [ ] ルール 4: Konva 色は hex literal、CSS 変数不可
  - [ ] ルール 6: 新規依存追加なし(全て既存 catalog)
  - [ ] ルール 8: Yjs mutation は LOCAL_ORIGIN で transact ラップ
- [ ] 不要なスコープ追加なし(RGB ピッカー / 履歴 / 不透明度等は明示的除外)
- [ ] Self-contained — 実装中に追加調査不要

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| stroke/fill → color の波及範囲が広い(grep で 30+ 箇所) | H | M | 段階的に: schema → codec → mutations → operations → reducer → shapes → CanvasStage の順で typecheck を頻繁に走らせる |
| reducer state 拡張で historyReducer が壊れる | L | M | historyReducer は state を opaque に扱うので影響なし。テストで担保 |
| EditorShell の handleApplyDefaultColor が「現在のコンテキスト」判定で迷う | M | L | MVP は「常に sync 側、Highlight tool 時のみ highlight 側」のシンプルルール。将来選択中タイプを見るように改善 |
| circular import (`reducer ← colors.ts`) | L | M | colors.ts は依存が無い純粋定数モジュール。reducer から import しても循環しない |
| arrow の pointer head fill が stroke 経由で設定されている → 切り離しが必要 | L | L | 現状 `fill={stroke}` で stroke 変数経由。stroke 変数を `color` 由来に変えるだけで済む |
| Phase 7.7-1 で追加した resize テストの fixture が color に対応していない | M | L | Task 5/7/9/11 で同時更新 |
| ColorPalette のスウォッチを button 化すると Tooltip が冗長 | L | L | label に色名でなく hex を表示、Tooltip は付けない or `aria-label="色: {hex}"` のみ |

## Notes
- **本フェーズの本質はスキーマ破壊変更のリファクタ**。既存ロジックの本質は変わらず、stroke/fill のキー名と CanvasStage の色出所を差し替えるだけ。新規 UI(ColorPalette)は薄い React コンポーネント
- **「新規デフォルトに設定」の判定**: MVP は「現在の tool が highlight なら highlight default、それ以外なら sync default」。将来 selected の type を見て分岐する拡張余地あり
- **次フェーズ Phase 7.7-3 (B1 ズーム/パン)** との衝突: CanvasStage を触るが、本フェーズは buildDraft のみ、Phase 3 は Stage transform。重複しない
- **Phase 7.7-1 の Risk #6**(Stage scale ≠ 1)は本フェーズでも未解決。Phase 7.7-3 で着手

---
*Generated: 2026-05-03*
*Status: ready-to-implement*
