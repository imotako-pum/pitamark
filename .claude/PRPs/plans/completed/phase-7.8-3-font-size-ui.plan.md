# Plan: Phase 7.8-3 フォントサイズ変更 UI

## Summary

テキスト注釈のフォントサイズ(現状 18px ハードコード固定)を Toolbar の `[A-] [18px] [A+]` 3 要素 + `[` / `]` shortcut で変更可能にする。Phase 7.7-2 で確立した「単一 active 値 + 1 操作で active 更新 + 選択中なら適用」パターン(activeColor)をそのままフォントサイズへ複製する。Schema 変更は不要(`fontSize` フィールドは既存)。

## User Story

As a **画像注釈で上司に成果物確認を求めるビジネスマン**,
I want **テキスト注釈のフォントサイズを Toolbar と shortcut で素早く変えたい**,
So that **画像サイズや指摘内容に応じて読みやすい文字量に調整できる**.

## Problem → Solution

**現状**: `DEFAULT_FONT_SIZE = 18` を `apps/web/src/components/canvas/colors.ts:38` から 3 か所(`CanvasStage.tsx:243` の通常 text、`CanvasStage.tsx:375` の Auto-next-A 連鎖、`EditorShell.tsx:394` の Auto-next-B 連鎖)で読み取って固定値で text を作成。フォントサイズ UI / shortcut / reducer action / Yjs mutation すべて 0 件。

**改善後**: `state.activeFontSize` を SSOT として持ち、3 か所の text 作成は `state.activeFontSize` を使う。Toolbar に `[A-] [18px] [A+]` を追加、`[` / `]` で -2/+2px shortcut。`activeColor` と同じく「常に active 更新 + 選択中 text なら個別適用」の単一クリックモデル。

## Metadata

- **Complexity**: Medium(reducer / Yjs / Toolbar / 3 か所の text 作成 / shortcut / HelpModal — 計 14 ファイル前後)
- **Source PRD**: `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md`
- **PRD Phase**: Phase 3 (フォントサイズ変更 UI)
- **Estimated Files**: 11 UPDATE / 5 CREATE

---

## UX Design

### Before

```
┌──────────────────────────────────────────────────────────────────┐
│ Toolbar:                                                         │
│   [V][R][A][T][H] | [Undo][Redo][Del] |                          │
│   [● ○ ○ ○ ○ ○ ○] |                                               │
│   [DL][🗑] | [?]                                                  │
│                                                                  │
│ Text 注釈の fontSize: 18px 固定。変更 UI 0 件。                  │
└──────────────────────────────────────────────────────────────────┘
```

### After

```
┌──────────────────────────────────────────────────────────────────┐
│ Toolbar:                                                         │
│   [V][R][A][T][H] | [Undo][Redo][Del] |                          │
│   [● ○ ○ ○ ○ ○ ○] | [A-][18px][A+] |                              │
│   [DL][🗑] | [?]                                                  │
│                                                                  │
│ A- / A+: クリックで activeFontSize ±2px (8-200 でクランプ)。     │
│ 中央の "18px": 現在の activeFontSize を表示(クリック不可)。     │
│ 選択中 text があればその text にも同じサイズが適用される。       │
│ Shortcut: ] で +2 / [ で -2 (text 編集中は browser default)      │
└──────────────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 新規 text 作成時の fontSize | `DEFAULT_FONT_SIZE` ハードコード | `state.activeFontSize` から取得 | 3 か所(通常 text / Auto-next-A / Auto-next-B)で同じ source を読む |
| Toolbar フォントサイズ UI | なし | `[A-] [現在値] [A+]` の 3 要素 | カラーパレットの後ろに Divider 区切りで配置 |
| 選択中 text のサイズ変更 | 不可 | A+/A- ボタンが activeFontSize 更新 + 選択中 text に dispatch | activeColor と同じパターン |
| `]` キー(text 編集中以外) | (機能なし) | activeFontSize +2px / 選択中 text に適用 | `isEditableTarget` で text 編集中は素通し |
| `[` キー(text 編集中以外) | (機能なし) | activeFontSize -2px / 選択中 text に適用 | 同上 |
| HelpModal | フォントサイズ section 無し | 「テキスト」section 追加(`[` / `]` 行) | 既存 SECTIONS 配列に 1 entry |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/plans/completed/phase-7.7-2-color-palette.plan.md` | 全体 | 同型実装の手本(activeColor の SSOT 設計、Yjs bridge、Toolbar 配線、E2E パターンすべて踏襲) |
| P0 | `apps/web/src/hooks/annotationsReducer.ts` | 全体 | `activeColor` の add/action/reducer/COMMITTING_ACTIONS パターンを fontSize に複製 |
| P0 | `apps/web/src/hooks/yjs-annotations-context.ts` | 68-125 | `applyDataAction` switch — `active-font-size/set` は no-op、`annotation/set-font-size` で setTextFontSizeY 呼出 |
| P0 | `apps/web/src/hooks/useYjsAnnotationsStore.ts` | 79-151, 171-195 | `activeColor` の `useStateRef`、dispatch 内分岐、state 組み立てを fontSize に同型複製 |
| P0 | `apps/web/src/domain/annotation/yjs-mutations.ts` | 109-130 | `setTextY` / `setAnnotationColorY` パターン — `setTextFontSizeY` の手本(text type guard 必要) |
| P0 | `apps/web/src/domain/annotation/operations.ts` | 75-107 | `setText` / `setColor` パターン — `setFontSize` は text 限定の no-op gate(setText パターン) |
| P0 | `apps/web/src/components/canvas/CanvasStage.tsx` | 234-250, 367-380 | text 作成 2 か所(通常 + Auto-next-A)で `DEFAULT_FONT_SIZE` を `activeFontSize` に置換 |
| P0 | `apps/web/src/pages/EditorShell.tsx` | 319-345, 368-405, 407-423, 439-455 | handlePickColor 同型の handleSet/Inc/DecFontSize、handleConfirmAutoArrow の text 作成、useKeyboardShortcuts 配線、Toolbar props |
| P0 | `apps/web/src/components/toolbar/ColorPalette.tsx` | 全体 | 同型 UI の手本(role="group"、aria-label、disabled、Tooltip ラッパー、shadcn Button + variant) |
| P0 | `apps/web/src/components/toolbar/Toolbar.tsx` | 全体 | FontSizeControl の組み込み位置(ColorPalette の隣 + Divider) |
| P0 | `apps/web/src/hooks/useKeyboardShortcuts.ts` | 全体 | C/⇧C パターン(`!mod && key === '['` 等)を `[`/`]` に複製、`isEditableTarget` で text 編集中をガード |
| P1 | `packages/shared/src/annotation.ts` | 全体 | `MAX_FONT_SIZE = 200` 既存定数。Schema は `fontSize: z.number().positive().max(MAX_FONT_SIZE)` で MIN は無し → `MIN_FONT_SIZE = 8` は web 側で定義 |
| P1 | `apps/web/src/components/canvas/colors.ts` | 38 | `DEFAULT_FONT_SIZE = 18` の場所。今回は維持(初期値ソース)、新定数は別ファイル |
| P1 | `apps/web/src/lib/colorCycle.ts` | 全体 | shortcut 用 pure 関数の手本(palette 巡回 → fontSize はクランプ +/−) |
| P1 | `apps/web/src/components/canvas/TextEditorOverlay.tsx` | 41-61 | `fontSize={annotation.fontSize * transform.scale}` — Schema の fontSize を読む側、編集中もリアルタイム反映済(変更不要だが確認) |
| P1 | `apps/web/src/components/dialogs/HelpModal.tsx` | 17-55 | `SECTIONS` 配列に「テキスト」section を 1 行追加するだけ |
| P2 | `apps/web/e2e/annotation-color.spec.ts` | 全体 | E2E パターン(setupRoom, dragOnStage, ANNOTATIONS_KEY, skipNonChromium)を font-size.spec.ts に複製 |
| P2 | `apps/web/src/components/toolbar/__tests__/ColorPalette.test.tsx` | 全体 | unit test の `createRoot + act` パターン(@testing-library 不使用) |
| P2 | `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` | 全体 | HelpModal テストパターン |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| `[` `]` shortcut の業界慣例 | Phase 7.8 PRD Research Summary | Photoshop / Figma 系で `[` `]` がブラシサイズ ±。フォントサイズ専用 shortcut は標準化されておらず採用余地あり |
| JIS / US 配列での `[` `]` 挙動 | KeyboardEvent.key 仕様 | `e.key` は **物理キーでなく文字** を返す。JIS/US 共に `Shift` 無しで `[` キーを押せば `e.key === '['`。`{` は Shift 込みで別物。本実装は `e.key === '['` / `']'` を直接判定 |

---

## Patterns to Mirror

### NAMING_CONVENTION
```typescript
// SOURCE: apps/web/src/hooks/annotationsReducer.ts:14-16, 17-27
export const TOOLS = ['select', ...] as const;
export type Tool = (typeof TOOLS)[number];

export type AnnotationsState = Readonly<{
  ...
  activeColor: string;  // ← フォントサイズも同型: activeFontSize: number
}>;
```
- 単一 active 値は `active*` プレフィックス、reducer action は `active-*/set` で UI-only 識別
- データ変更系は `annotation/set-*` で committing(Undo 対象)

### REDUCER_ACTION_DEFINITION
```typescript
// SOURCE: apps/web/src/hooks/annotationsReducer.ts:29-54
export type AnnotationsAction =
  | { type: 'tool/set'; tool: Tool }
  | { type: 'select/set'; id: string | null }
  | { type: 'active-color/set'; color: string }
  // ↓ 新規追加
  | { type: 'active-font-size/set'; fontSize: number }
  | { type: 'annotation/set-font-size'; id: string; fontSize: number }
  // ...
```

### REDUCER_OPERATION_PATTERN
```typescript
// SOURCE: apps/web/src/domain/annotation/operations.ts:75-80
export const setText = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  text: string,
): ReadonlyArray<Annotation> =>
  annotations.map((a) => (a.id === id && a.type === 'text' ? { ...a, text } : a));
```
- `setFontSize` は text 限定 → `setText` パターン(同 1-line filter map)に倣う。type guard 不一致時は元の参照を返して no-op

### YJS_MUTATION_PATTERN
```typescript
// SOURCE: apps/web/src/domain/annotation/yjs-mutations.ts:109-115
export const setTextY = (doc: Y.Doc, ya: YAnnotations, id: string, text: string): void => {
  const m = ya.get(id);
  if (!m || m.get('type') !== 'text') return;
  tx(doc, () => {
    m.set('text', text);
  });
};
```
- `setTextFontSizeY` は同型: `m.get('type') !== 'text'` で type guard、`tx(doc, () => m.set('fontSize', fontSize))`
- LOCAL_ORIGIN ラップは `tx` ヘルパー経由で自動

### YJS_DISPATCH_BRIDGE
```typescript
// SOURCE: apps/web/src/hooks/yjs-annotations-context.ts:69-115
const applyDataAction = (action: AnnotationsAction): void => {
  switch (action.type) {
    case 'tool/set':
    case 'select/set':
    case 'active-color/set':
    case 'active-font-size/set': // ← 追加
      return;  // UI-only state; never persisted to Yjs.
    // ...
    case 'annotation/set-color':
      setAnnotationColorY(doc, yAnnotations, action.id, action.color);
      return;
    case 'annotation/set-font-size': // ← 追加
      setTextFontSizeY(doc, yAnnotations, action.id, action.fontSize);
      return;
  }
};
```

### YJS_STORE_DISPATCH
```typescript
// SOURCE: apps/web/src/hooks/useYjsAnnotationsStore.ts:79-151
const [activeColor, setActiveColor] = useStateRef<string>(DEFAULT_SYNC_COLOR);
// ↓ 同型追加
const [activeFontSize, setActiveFontSize] = useStateRef<number>(DEFAULT_FONT_SIZE);

const dispatch = useCallback(
  (action: AnnotationsAction) => {
    switch (action.type) {
      case 'active-color/set':
        setActiveColor(action.color);
        return;
      case 'active-font-size/set':           // ← 追加
        setActiveFontSize(action.fontSize);
        return;
      // ...
      default:
        ctx?.applyDataAction(action);
    }
  },
  [ctx, setSelectedId, setTool, setActiveColor, setActiveFontSize, selectedIdRef], // 依存追加
);

const state: AnnotationsState = {
  annotations,
  selectedId,
  tool,
  activeColor,
  activeFontSize, // ← 追加
};
```

### EDITOR_HANDLER_PATTERN
```typescript
// SOURCE: apps/web/src/pages/EditorShell.tsx:319-328
const handlePickColor = useCallback(
  (color: string) => {
    store.dispatch({ type: 'active-color/set', color });
    const id = store.state.selectedId;
    if (id) {
      store.dispatch({ type: 'annotation/set-color', id, color });
    }
  },
  [store],
);
```
- フォントサイズ用 `handleSetFontSize`(直接値指定)+ `handleIncrementFontSize` / `handleDecrementFontSize`(クランプ計算で active を読み出して set へ委譲)
- 選択中が text 以外の時に dispatch しても `setFontSize` operation / `setTextFontSizeY` mutation 双方が type guard で no-op になるため、handler 側で型チェックは不要(コードを薄く保つ)

### TOOLBAR_BUTTON_PATTERN
```tsx
// SOURCE: apps/web/src/components/toolbar/ColorPalette.tsx:23-55
<Tooltip>
  <TooltipTrigger render={
    <Button type="button" variant="ghost" size="icon-sm"
      aria-label={`色: ${color}`}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onPickColor(color)}
      className={cn(...)}
    >
      <span aria-hidden="true" .../>
    </Button>
  } />
  <TooltipContent side="bottom"><span>{color}</span></TooltipContent>
</Tooltip>
```
- A-/A+ ボタンは `size="icon-sm"`(ColorPalette 各 swatch と同サイズ)、icon は lucide `Minus` / `Plus` または text(`A-` / `A+`)
- 中央の現在値表示は ColorPalette とは別の素 `<span>`(button ではない、aria-pressed もない)。`aria-live="polite"` で値変化を SR にも通知

### KEYBOARD_SHORTCUT_PATTERN
```typescript
// SOURCE: apps/web/src/hooks/useKeyboardShortcuts.ts:103-133
if (!mod && e.key === '?') {
  const cb = ref.current.onShowHelp;
  if (cb) { e.preventDefault(); cb(); }
  return;
}
// ...
if (!mod && key === 'c') {
  const cb = e.shiftKey ? ref.current.onCycleColorPrev : ref.current.onCycleColorNext;
  if (cb) { e.preventDefault(); cb(); }
  return;
}
```
- `[`/`]` も `!mod && e.key === '['` で判定。`isEditableTarget` ガードは関数冒頭(L53)で既に効くので追加コード不要
- `e.preventDefault()` は cb 提供時のみ(fitToViewport 等と同方針 — 未提供時は browser default を温存)

### TEST_STRUCTURE_UNIT
```typescript
// SOURCE: apps/web/src/components/toolbar/__tests__/ColorPalette.test.tsx:1-50
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';

const renderControl = (props: ...) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => { root = createRoot(container); });
  act(() => { root?.render(<TooltipProvider>...</TooltipProvider>); });
  return { container, unmount: () => { ... } };
};
```
- `@testing-library/react` 非依存。`createRoot + act` で十分
- `TooltipProvider` で wrap しないと shadcn Tooltip が render エラーになる(ColorPalette test と同じ)

### TEST_STRUCTURE_E2E
```typescript
// SOURCE: apps/web/e2e/annotation-color.spec.ts:1-60
const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';
const skipNonChromium = (testInfo) => test.skip(testInfo.project.name !== 'chromium', '...');
const setupRoom = async (page) => { await page.goto('/'); await dropImage(page); ... };
const readAnnotations = async (page) => page.evaluate(...);
```
- `font-size.spec.ts` で `aria-label="フォントサイズを大きく"` 等で button locate
- text 注釈の `fontSize` フィールドを `readAnnotations()` で検証

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/lib/fontSize.ts` | CREATE | `MIN_FONT_SIZE`/`MAX_FONT_SIZE`/`FONT_SIZE_STEP` 定数 + `clampFontSize`/`incrementFontSize`/`decrementFontSize` 純関数 |
| `apps/web/src/lib/__tests__/fontSize.test.ts` | CREATE | clamp / increment / decrement の境界テスト |
| `apps/web/src/components/toolbar/FontSizeControl.tsx` | CREATE | A-/A+ ボタン + 現在値表示 3 要素コンポーネント |
| `apps/web/src/components/toolbar/__tests__/FontSizeControl.test.tsx` | CREATE | render / click → callback 発火 / disabled prop |
| `apps/web/e2e/font-size.spec.ts` | CREATE | E2E: A+ クリック / 選択中 text への適用 / `]` shortcut / 8-200 クランプ |
| `apps/web/src/hooks/annotationsReducer.ts` | UPDATE | `activeFontSize` state、`active-font-size/set` + `annotation/set-font-size` action、reducer case、COMMITTING_ACTIONS 登録 |
| `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` | UPDATE | 2 actions の動作 + `isCommittingAction` 判定テスト |
| `apps/web/src/hooks/yjs-annotations-context.ts` | UPDATE | applyDataAction switch に `active-font-size/set`(no-op)+ `annotation/set-font-size`(setTextFontSizeY 呼出) |
| `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` | UPDATE | annotation/set-font-size で text 注釈の fontSize 更新 / active-font-size/set は Yjs 非伝播 |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | UPDATE | `useStateRef<number>(DEFAULT_FONT_SIZE)`、dispatch case、state 組み立て、依存配列 |
| `apps/web/src/domain/annotation/operations.ts` | UPDATE | `setFontSize` 純関数追加(text 限定 no-op gate) |
| `apps/web/src/domain/annotation/__tests__/operations.test.ts` | UPDATE | setFontSize: text 更新 / 他型 no-op / 不在 id no-op |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | UPDATE | `setTextFontSizeY` 追加(text type guard + LOCAL_ORIGIN tx) |
| `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` | UPDATE | setTextFontSizeY: text 更新 / 他型 no-op / 不在 id no-op |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATE | text 作成 2 か所(通常 + Auto-next-A)で `DEFAULT_FONT_SIZE` → `state.activeFontSize`、useCallback 依存配列に追加 |
| `apps/web/src/pages/EditorShell.tsx` | UPDATE | `handleConfirmAutoArrow` の text 作成で `state.activeFontSize` 使用、`handleSetFontSize` / `handleIncrementFontSize` / `handleDecrementFontSize` 追加、Toolbar props 拡張、useKeyboardShortcuts 配線 |
| `apps/web/src/components/toolbar/Toolbar.tsx` | UPDATE | props に `activeFontSize` / `onIncrementFontSize` / `onDecrementFontSize` 追加、ColorPalette と Divider の後に `<FontSizeControl />` 配置 |
| `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | UPDATE | props に activeFontSize と新ハンドラを追加(既存テスト維持) |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | UPDATE | `onIncrementFontSize` / `onDecrementFontSize` callback 追加、`!mod && e.key === ']'` / `'['` 分岐 |
| `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` | UPDATE | `]` で onIncrement / `[` で onDecrement / 修飾子付きは無発火 / input フォーカス時無発火 |
| `apps/web/src/components/dialogs/HelpModal.tsx` | UPDATE | `SECTIONS` に「テキスト」section を追加(`[`/`]` 行) |
| `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` | UPDATE | 「テキスト」section が描画されることを検証 |

## NOT Building

- **任意 px 数値入力欄**(`<input type="number">` 等) — PRD で「`[A-] [現在値] [A+]` の 3 要素」確定。MVP は ±2px ステップのみ
- **新規 text 作成専用 default と「選択中 text への個別適用」を別ボタンで分離する 2 ボタン式** — PRD の Decisions Log で「暗黙切替で確定」、現実装の color UX(activeColor 単一)に整合
- **non-text 注釈に対する fontSize 適用** — text 専用フィールドのため schema 上不可
- **shortcut の代替候補(`Cmd+Shift+>` / `Cmd+Shift+<` 等)** — PRD の残論点だったが `[` / `]` で確定(後段「Decisions」参照)
- **Yjs マイグレーション** — Schema 変更ゼロ(fontSize は既存)
- **font-family / font-weight 変更** — Phase 7.8 スコープ外、需要薄
- **複数 text への一括サイズ変更** — selectedId は単数モデル維持
- **font size プリセット(タイトル / 本文 / 注釈の 3 段階)** — オーバースペック、±2px で十分
- **A- / A+ ボタンの長押しリピート** — MVP は 1 クリック 1 ステップ
- **shortcut の visual feedback(押した瞬間に Toolbar の数値がパルス)** — 必要なら Phase 5 で

---

## Step-by-Step Tasks

### Task 1: lib/fontSize.ts と単体テスト
- **ACTION**: `apps/web/src/lib/fontSize.ts` と `apps/web/src/lib/__tests__/fontSize.test.ts` を新規作成
- **IMPLEMENT**:
  ```typescript
  // apps/web/src/lib/fontSize.ts
  import { MAX_FONT_SIZE } from '@snap-share/shared';

  // 8 は dogfood で「画像 30% 縮小時にも読める下限」目安。schema は positive(>0)
  // で min を持たないため、UI 側でクランプして極小フォントの暴発を防ぐ。
  export const MIN_FONT_SIZE = 8;
  export { MAX_FONT_SIZE };
  // Photoshop と同じ ±2 単位ステップ。dogfood で 1 / 2 / 4 を再評価。
  export const FONT_SIZE_STEP = 2;

  export const clampFontSize = (size: number): number =>
    Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)));

  export const incrementFontSize = (current: number): number =>
    clampFontSize(current + FONT_SIZE_STEP);

  export const decrementFontSize = (current: number): number =>
    clampFontSize(current - FONT_SIZE_STEP);
  ```
- **MIRROR**: `apps/web/src/lib/colorCycle.ts`(pure 関数 + シンプル境界処理)
- **IMPORTS**: `MAX_FONT_SIZE` は shared から(`packages/shared/src/annotation.ts:7`)
- **GOTCHA**:
  - `Math.round` を入れて、外部から非整数が入ったときに整数に固定する(text 表示が整数 px の方が直感的)
  - クランプは clampFontSize で常に通す(他関数の `+/− STEP` だけだと境界突破)
- **VALIDATE**: `pnpm -F @snap-share/web test -- fontSize`

テスト要点(`fontSize.test.ts`):
- `clampFontSize(18)` → 18
- `clampFontSize(7)` → 8 / `clampFontSize(201)` → 200
- `clampFontSize(18.7)` → 19(Math.round)
- `incrementFontSize(18)` → 20 / `incrementFontSize(200)` → 200
- `decrementFontSize(18)` → 16 / `decrementFontSize(8)` → 8
- `decrementFontSize(9)` → 8(7 にならず 8 で止まる)

### Task 2: shared スキーマ確認(変更不要)
- **ACTION**: `packages/shared/src/annotation.ts` を read のみ
- **IMPLEMENT**: 既存の `TextAnnotationSchema.fontSize: z.number().positive().max(MAX_FONT_SIZE)` を維持
- **MIRROR**: なし
- **IMPORTS**: なし
- **GOTCHA**: schema は `positive()` のみで `min()` を持たない。UI 側 8 は schema より厳しいクランプであり OK
- **VALIDATE**: `pnpm -F @snap-share/shared typecheck`(no-op 確認)

### Task 3: domain/annotation/operations.ts に setFontSize 追加
- **ACTION**: `apps/web/src/domain/annotation/operations.ts` を更新
- **IMPLEMENT**:
  ```typescript
  // text 専用の fontSize 更新。色と異なり全注釈共通フィールドではないため、
  // type guard で text 以外は no-op にする。setText と同じ作法。
  export const setFontSize = (
    annotations: ReadonlyArray<Annotation>,
    id: string,
    fontSize: number,
  ): ReadonlyArray<Annotation> =>
    annotations.map((a) => (a.id === id && a.type === 'text' ? { ...a, fontSize } : a));
  ```
- **MIRROR**: `setText`(L75-80)
- **IMPORTS**: 変更なし
- **GOTCHA**: `{ ...a, fontSize }` で TextAnnotation 型は維持される(type narrowing 下での spread)
- **VALIDATE**: typecheck

### Task 4: operations.ts のテスト追加
- **ACTION**: `apps/web/src/domain/annotation/__tests__/operations.test.ts` を更新
- **IMPLEMENT**: `describe('setFontSize')` を追加:
  - `it('updates fontSize on a text annotation')` — `setFontSize([text], 't1', 24)` → `(next[0] as TextAnnotation).fontSize === 24`
  - `it('is a no-op when id matches a non-text annotation')` — `setFontSize([rect], 'r1', 24)` → `next[0] === rect`(参照同一)
  - `it('is a no-op for unknown id')`
  - `import { setFontSize } from '../operations';` を追加
- **MIRROR**: `describe('setText')`(L214-233)
- **VALIDATE**: `pnpm -F @snap-share/web test -- operations`

### Task 5: yjs-mutations.ts に setTextFontSizeY 追加
- **ACTION**: `apps/web/src/domain/annotation/yjs-mutations.ts` を更新
- **IMPLEMENT**:
  ```typescript
  // text 専用 — fontSize は TextAnnotation のみ持つフィールド。type guard なしに
  // 走らせると非 text の Y.Map に fontSize が紛れ込み、AnnotationSchema.safeParse
  // が失敗するエントリを生成しうる(yMapToAnnotation 経由でドロップされるため
  // データ消失にはならないが、防衛で type guard を入れる)。
  export const setTextFontSizeY = (
    doc: Y.Doc,
    ya: YAnnotations,
    id: string,
    fontSize: number,
  ): void => {
    const m = ya.get(id);
    if (!m || m.get('type') !== 'text') return;
    tx(doc, () => {
      m.set('fontSize', fontSize);
    });
  };
  ```
- **MIRROR**: `setTextY`(L109-115)
- **IMPORTS**: 変更なし
- **VALIDATE**: typecheck

### Task 6: yjs-mutations.test.ts に setTextFontSizeY テスト追加
- **ACTION**: `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` を更新
- **IMPLEMENT**: `describe('setTextFontSizeY')` を追加(`describe('setAnnotationColorY')` の隣):
  - text に対して fontSize 更新が反映される(`yMapToAnnotation(ya.get('t1'))` で `fontSize === 24`)
  - rect に対して呼んでも no-op(rect の元値が保持される)
  - 不在 id で no-op
  - import に `setTextFontSizeY` 追加
- **MIRROR**: `describe('setAnnotationColorY')`(L185-210)
- **VALIDATE**: `pnpm -F @snap-share/web test -- yjs-mutations`

### Task 7: annotationsReducer.ts に activeFontSize state と 2 actions 追加
- **ACTION**: `apps/web/src/hooks/annotationsReducer.ts` を更新
- **IMPLEMENT**:
  - `import { DEFAULT_FONT_SIZE, DEFAULT_SYNC_COLOR } from '../components/canvas/colors';`(既存 import に DEFAULT_FONT_SIZE 追加)
  - `import { setFontSize, ... } from '../domain/annotation/operations';`(既存 import に setFontSize 追加)
  - `AnnotationsState` に `activeFontSize: number;` 追加
  - `initialAnnotationsState` に `activeFontSize: DEFAULT_FONT_SIZE` 追加
  - action 型 2 つ追加:
    ```typescript
    | { type: 'active-font-size/set'; fontSize: number }
    | { type: 'annotation/set-font-size'; id: string; fontSize: number }
    ```
  - reducer の switch case 追加:
    ```typescript
    case 'active-font-size/set':
      return { ...state, activeFontSize: action.fontSize };
    case 'annotation/set-font-size':
      return {
        ...state,
        annotations: setFontSize(state.annotations, action.id, action.fontSize),
      };
    ```
  - `COMMITTING_ACTIONS` に `'annotation/set-font-size'` を追加(`active-font-size/set` は加えない)
- **MIRROR**: `activeColor` まわり全部(L3, 26, 32, 60, 72-73, 121-125, 141)
- **IMPORTS**: 上記 2 つ追加
- **GOTCHA**:
  - `default-color/set-sync` が past の plan に出ていたが現実装は `active-color/set` 1 個に統合済 — 同型を踏襲する
  - reducer の `_exhaustive: never` チェックがあるため、action 追加で必ず switch case を増やすこと
- **VALIDATE**: typecheck

### Task 8: annotationsReducer.test.ts に新 actions テスト追加
- **ACTION**: `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` を更新
- **IMPLEMENT**: 既存の `describe('annotationsReducer.active-color/set')` と `describe('annotationsReducer.annotation/set-color')` の隣に追加:
  - `describe('annotationsReducer.active-font-size/set')`:
    - `it('updates state.activeFontSize')` — `{ type: 'active-font-size/set', fontSize: 24 }` → `next.activeFontSize === 24`
    - `it('does not touch annotations or selection')`
  - `describe('annotationsReducer.annotation/set-font-size')`:
    - `it('updates fontSize of the matching text annotation')` — text fixture を seed して fontSize 更新
    - `it('is a no-op for non-text annotations')` — rect fixture で参照同一
    - `it('is a no-op for unknown id')`
  - `describe('isCommittingAction')` に追加:
    - `it('treats annotation/set-font-size as a committing action (Undo target)')` — true
    - `it('treats active-font-size/set as UI-only (not committed)')` — false
  - text fixture をファイル先頭に追加(rect と同じ場所、`apps/web/src/domain/annotation/__tests__/operations.test.ts` から流用):
    ```typescript
    const text: TextAnnotation = {
      id: 't1', type: 'text', createdAt: 1, x: 0, y: 0,
      text: 'hello', fontSize: 18, color: '#202020',
    };
    ```
- **MIRROR**: `describe('annotationsReducer.active-color/set')`(L154-174)
- **VALIDATE**: `pnpm -F @snap-share/web test -- annotationsReducer`

### Task 9: yjs-annotations-context.ts の applyDataAction 拡張
- **ACTION**: `apps/web/src/hooks/yjs-annotations-context.ts` を更新
- **IMPLEMENT**:
  - import に `setTextFontSizeY` 追加
  - applyDataAction switch に追加:
    ```typescript
    case 'tool/set':
    case 'select/set':
    case 'active-color/set':
    case 'active-font-size/set':  // ← 追加
      // UI-only state; never persisted to Yjs.
      return;
    // ...
    case 'annotation/set-font-size':  // ← 追加
      setTextFontSizeY(doc, yAnnotations, action.id, action.fontSize);
      return;
    ```
- **MIRROR**: `active-color/set` / `annotation/set-color` の 2 case
- **VALIDATE**: typecheck

### Task 10: yjs-annotations-context.test.ts のテスト追加
- **ACTION**: `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` を更新
- **IMPLEMENT**:
  - text fixture を追加(yjs-mutations.test.ts の txt 関数と同型)
  - 新規テスト:
    - `it('annotation/set-font-size updates fontSize of the underlying text Y.Map')` — text 注釈追加 → `applyDataAction({ type: 'annotation/set-font-size', id, fontSize: 24 })` → snapshot で fontSize 反映
    - `it('active-font-size/set does not mutate Yjs (UI-only)')` — Y.Doc に何も変化が無いことを `yAnnotations.size` 等で確認
- **MIRROR**: 既存の `applyDataAction` テスト群
- **VALIDATE**: `pnpm -F @snap-share/web test -- yjs-annotations-context`

### Task 11: useYjsAnnotationsStore.ts に activeFontSize 配線
- **ACTION**: `apps/web/src/hooks/useYjsAnnotationsStore.ts` を更新
- **IMPLEMENT**:
  - import に `DEFAULT_FONT_SIZE` を追加(既存 `DEFAULT_SYNC_COLOR` の隣)
  - `const [activeFontSize, setActiveFontSize] = useStateRef<number>(DEFAULT_FONT_SIZE);` を `activeColor` の直下に追加
  - dispatch case に追加:
    ```typescript
    case 'active-font-size/set':
      setActiveFontSize(action.fontSize);
      return;
    ```
  - dispatch の useCallback 依存配列に `setActiveFontSize` 追加
  - state 組み立てに `activeFontSize` 追加
- **MIRROR**: `activeColor` の同型実装(L82, 139-140, 150, 175)
- **VALIDATE**: typecheck

### Task 12: CanvasStage.tsx の text 作成 2 か所で activeFontSize を使う
- **ACTION**: `apps/web/src/components/canvas/CanvasStage.tsx` を更新
- **IMPLEMENT**:
  - L131: 既存 destructure `const { tool, selectedId, annotations, activeColor } = state;` に `activeFontSize` を追加
  - L243(`handleMouseDown` の text 分岐): `fontSize: DEFAULT_FONT_SIZE` → `fontSize: activeFontSize`
  - L375(`handleMouseUp` の Auto-next-A 分岐): 同上
  - `handleMouseDown` の useCallback 依存配列に `activeFontSize` 追加(`activeColor` の隣)
  - `handleMouseUp` の useCallback 依存配列にも `activeFontSize` 追加
  - `DEFAULT_FONT_SIZE` の import が他で使われていないなら remove(L15)。**確認**: `EditorShell.tsx` で別途 import しているのでそれは別 task で更新するが、この CanvasStage では DEFAULT_FONT_SIZE が他参照無いはずなので import を削除可能
- **MIRROR**: `activeColor` の destructure → `buildDraftRectangle/Highlight/Arrow` への伝搬パターン
- **GOTCHA**:
  - L131 の destructure に `activeFontSize` を加え忘れると `state.activeFontSize` の直接参照になり依存配列の整合が崩れる。必ず destructure 経由
  - useCallback 依存配列の更新を忘れると stale closure(古い activeFontSize で作成される)
- **VALIDATE**: typecheck + `pnpm -F @snap-share/web test`(既存テストの regression なし確認)

### Task 13: EditorShell.tsx に handleSet/Inc/DecFontSize と Toolbar 配線追加
- **ACTION**: `apps/web/src/pages/EditorShell.tsx` を更新
- **IMPLEMENT**:
  - L25 import: `import { incrementFontSize, decrementFontSize, clampFontSize } from '../lib/fontSize';` を追加
  - L394(`handleConfirmAutoArrow` 内 textAnnotation): `fontSize: DEFAULT_FONT_SIZE` → `fontSize: store.state.activeFontSize`
  - `handlePickColor` の直下に追加(handlePickColor: 319-328 をそのまま手本):
    ```typescript
    // フォントサイズも color と同じく「常に active 更新 + 選択中 text なら個別適用」
    // の 1 操作モデル。text 以外が選択中の場合は dispatch しても reducer の
    // setFontSize と Yjs の setTextFontSizeY が type guard で no-op になる。
    const handleSetFontSize = useCallback(
      (size: number) => {
        const next = clampFontSize(size);
        store.dispatch({ type: 'active-font-size/set', fontSize: next });
        const id = store.state.selectedId;
        if (id) {
          store.dispatch({ type: 'annotation/set-font-size', id, fontSize: next });
        }
      },
      [store],
    );

    // [/] shortcut + A-/A+ ボタン共通の経路。active から +/− STEP したクランプ値で
    // handleSetFontSize に委譲し、選択中 text への適用ロジックを 1 か所に閉じる。
    const handleIncrementFontSize = useCallback(() => {
      handleSetFontSize(incrementFontSize(store.state.activeFontSize));
    }, [handleSetFontSize, store.state.activeFontSize]);

    const handleDecrementFontSize = useCallback(() => {
      handleSetFontSize(decrementFontSize(store.state.activeFontSize));
    }, [handleSetFontSize, store.state.activeFontSize]);
    ```
  - `useKeyboardShortcuts` 呼出に追加:
    ```typescript
    onIncrementFontSize: source ? handleIncrementFontSize : undefined,
    onDecrementFontSize: source ? handleDecrementFontSize : undefined,
    ```
  - `Toolbar` JSX に props 追加:
    ```jsx
    activeFontSize={store.state.activeFontSize}
    onIncrementFontSize={handleIncrementFontSize}
    onDecrementFontSize={handleDecrementFontSize}
    ```
- **MIRROR**: `handleCycleColorNext` / `handleCycleColorPrev`(L333-339)、`useKeyboardShortcuts` の `onCycleColorNext` 配線(L418-419)、Toolbar `activeColor` props
- **GOTCHA**:
  - `source ? handle... : undefined` ガードは fitToViewport / setHundredPercent と同型。画像未投入時に shortcut が発火しないようにする
  - `handleSetFontSize` は useKeyboardShortcuts には直接渡さない(`[`/`]` は inc/dec のみ。直接 set は Toolbar の +/- ボタンと内部 inc/dec で十分)
  - Auto-next-B 経路の text 作成(`handleConfirmAutoArrow` 内)は `store.state.activeFontSize` を直接参照(callback 引数化しなくても、useCallback の依存に `store` が入っており `store` の identity stable のため OK)
- **VALIDATE**: typecheck

### Task 14: useKeyboardShortcuts.ts に `[`/`]` バインド追加
- **ACTION**: `apps/web/src/hooks/useKeyboardShortcuts.ts` を更新
- **IMPLEMENT**:
  - `KeyboardShortcuts` 型に追加:
    ```typescript
    /** Optional. `]` → activeFontSize +2px / 選択中 text にも適用。
     *  preventDefault only when provided so `]` keeps its default elsewhere. */
    onIncrementFontSize?: () => void;
    /** Optional. `[` → activeFontSize -2px / 選択中 text にも適用。 */
    onDecrementFontSize?: () => void;
    ```
  - `useEffect` 内の onKey に追加(`'c'` ブランチの後):
    ```typescript
    // `[` / `]` — フォントサイズ ±2 (Photoshop 流)。`isEditableTarget` ガードは
    // 関数冒頭で効くので text 編集中は素通しされる。Cmd/Ctrl 修飾は除外
    // (browser shortcut の温存)。
    if (!mod && e.key === ']') {
      const cb = ref.current.onIncrementFontSize;
      if (cb) { e.preventDefault(); cb(); }
      return;
    }
    if (!mod && e.key === '[') {
      const cb = ref.current.onDecrementFontSize;
      if (cb) { e.preventDefault(); cb(); }
      return;
    }
    ```
- **MIRROR**: `?` (L103-110) と `c` (L125-132) の処理パターン
- **GOTCHA**:
  - `e.key === ']'` で文字判定。`e.code === 'BracketRight'` だと JIS の `[` 物理キー位置が異なるため壊れる。文字判定の方が両配列で安全(JIS でも Shift 無しで `]` キー押下時に `e.key === ']'`)
  - `Shift+]` は `e.key === '}'` になり別物 → 偶発発火しない(意図通り)
- **VALIDATE**: typecheck

### Task 15: useKeyboardShortcuts.test.tsx にテスト追加
- **ACTION**: `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` を更新
- **IMPLEMENT**: 既存の `describe('useKeyboardShortcuts')` 内に追加:
  - `it('] fires onIncrementFontSize and prevents default when provided')`
  - `it('] does NOT preventDefault when onIncrementFontSize is undefined')`
  - `it('[ fires onDecrementFontSize and prevents default when provided')`
  - `it('Cmd+] does NOT trigger increment (browser shortcut preserved)')` — `key: ']', metaKey: true` で発火なし
  - `it('Shift+] does NOT trigger increment (Shift+] = "}", different key)')` — `key: '}', shiftKey: true` を送って未呼出確認
  - `it('does not fire [/] when focus is in an input')` — text 編集中の素通し確認
- **MIRROR**: Enter / `?` / `c` のテスト群(L196-235, 129-163)
- **VALIDATE**: `pnpm -F @snap-share/web test -- useKeyboardShortcuts`

### Task 16: FontSizeControl.tsx 新規作成
- **ACTION**: `apps/web/src/components/toolbar/FontSizeControl.tsx` を新規作成
- **IMPLEMENT**:
  ```tsx
  import { Minus, Plus } from 'lucide-react';
  import { Button } from '@/components/ui/button';
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
  import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '../../lib/fontSize';

  type FontSizeControlProps = Readonly<{
    activeFontSize: number;
    disabled: boolean;
    onIncrementFontSize: () => void;
    onDecrementFontSize: () => void;
  }>;

  export const FontSizeControl = ({
    activeFontSize,
    disabled,
    onIncrementFontSize,
    onDecrementFontSize,
  }: FontSizeControlProps) => {
    const atMin = activeFontSize <= MIN_FONT_SIZE;
    const atMax = activeFontSize >= MAX_FONT_SIZE;
    return (
      // biome-ignore lint/a11y/useSemanticElements: ColorPalette と同じく role="group" でグルーピング
      <div className="flex items-center gap-0.5" role="group" aria-label="フォントサイズ">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="フォントサイズを小さくする"
                disabled={disabled || atMin}
                onClick={onDecrementFontSize}
                className="rounded-md"
              >
                <Minus size={14} aria-hidden="true" />
              </Button>
            }
          />
          <TooltipContent side="bottom"><span>小さく [</span></TooltipContent>
        </Tooltip>
        <span
          className="min-w-10 px-1 text-center text-xs tabular-nums select-none"
          aria-live="polite"
          aria-label={`現在のフォントサイズ: ${activeFontSize}px`}
        >
          {activeFontSize}px
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="フォントサイズを大きくする"
                disabled={disabled || atMax}
                onClick={onIncrementFontSize}
                className="rounded-md"
              >
                <Plus size={14} aria-hidden="true" />
              </Button>
            }
          />
          <TooltipContent side="bottom"><span>大きく ]</span></TooltipContent>
        </Tooltip>
      </div>
    );
  };
  ```
- **MIRROR**: `apps/web/src/components/toolbar/ColorPalette.tsx` 全体
- **IMPORTS**:
  - `Minus, Plus` from `lucide-react`
  - `Button` / `Tooltip*` from `@/components/ui/*`(既に other Toolbar 子で使用)
  - `MIN_FONT_SIZE, MAX_FONT_SIZE` from `../../lib/fontSize`
- **GOTCHA**:
  - `aria-live="polite"` で SR が値変更を読み上げる(Inc/Dec した直後の値変化を伝える)
  - `tabular-nums` で 2/3 桁の値が来ても幅が動かない(8px → 18px → 100px → 200px)
  - `disabled` は image 未読込 OR 既に min/max。min/max のときは reducer 呼出も無駄なため UI ロックで防ぐ
- **VALIDATE**: typecheck

### Task 17: FontSizeControl 単体テスト
- **ACTION**: `apps/web/src/components/toolbar/__tests__/FontSizeControl.test.tsx` を新規作成
- **IMPLEMENT**:
  ```typescript
  import { act } from 'react';
  import { createRoot, type Root } from 'react-dom/client';
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
  import { TooltipProvider } from '@/components/ui/tooltip';
  import { FontSizeControl } from '../FontSizeControl';

  const renderControl = (props: {
    activeFontSize?: number;
    disabled?: boolean;
    onIncrementFontSize?: () => void;
    onDecrementFontSize?: () => void;
  }) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let root: Root | undefined;
    act(() => { root = createRoot(container); });
    act(() => {
      root?.render(
        <TooltipProvider>
          <FontSizeControl
            activeFontSize={props.activeFontSize ?? 18}
            disabled={props.disabled ?? false}
            onIncrementFontSize={props.onIncrementFontSize ?? (() => {})}
            onDecrementFontSize={props.onDecrementFontSize ?? (() => {})}
          />
        </TooltipProvider>,
      );
    });
    return { container, unmount: () => { act(() => { root?.unmount(); }); container.remove(); } };
  };

  describe('FontSizeControl', () => {
    beforeEach(() => { while (document.body.firstChild) document.body.removeChild(document.body.firstChild); });
    afterEach(() => { vi.clearAllMocks(); });

    it('renders the current font size', () => {
      const m = renderControl({ activeFontSize: 24 });
      expect(m.container.textContent).toContain('24px');
      m.unmount();
    });

    it('clicking + calls onIncrementFontSize', () => {
      const onIncrementFontSize = vi.fn();
      const m = renderControl({ onIncrementFontSize });
      const btn = m.container.querySelector<HTMLButtonElement>('button[aria-label="フォントサイズを大きくする"]');
      act(() => { btn?.click(); });
      expect(onIncrementFontSize).toHaveBeenCalledOnce();
      m.unmount();
    });

    it('clicking − calls onDecrementFontSize', () => {
      const onDecrementFontSize = vi.fn();
      const m = renderControl({ onDecrementFontSize });
      const btn = m.container.querySelector<HTMLButtonElement>('button[aria-label="フォントサイズを小さくする"]');
      act(() => { btn?.click(); });
      expect(onDecrementFontSize).toHaveBeenCalledOnce();
      m.unmount();
    });

    it('disables both buttons when disabled prop is true', () => {
      const m = renderControl({ disabled: true });
      const buttons = m.container.querySelectorAll<HTMLButtonElement>('button');
      for (const b of buttons) expect(b.disabled).toBe(true);
      m.unmount();
    });

    it('disables − at MIN_FONT_SIZE (8) and disables + at MAX_FONT_SIZE (200)', () => {
      const minM = renderControl({ activeFontSize: 8 });
      expect(minM.container.querySelector<HTMLButtonElement>('button[aria-label="フォントサイズを小さくする"]')?.disabled).toBe(true);
      expect(minM.container.querySelector<HTMLButtonElement>('button[aria-label="フォントサイズを大きくする"]')?.disabled).toBe(false);
      minM.unmount();
      const maxM = renderControl({ activeFontSize: 200 });
      expect(maxM.container.querySelector<HTMLButtonElement>('button[aria-label="フォントサイズを大きくする"]')?.disabled).toBe(true);
      expect(maxM.container.querySelector<HTMLButtonElement>('button[aria-label="フォントサイズを小さくする"]')?.disabled).toBe(false);
      maxM.unmount();
    });
  });
  ```
- **MIRROR**: `ColorPalette.test.tsx` 全体
- **VALIDATE**: `pnpm -F @snap-share/web test -- FontSizeControl`

### Task 18: Toolbar.tsx に FontSizeControl 組み込み
- **ACTION**: `apps/web/src/components/toolbar/Toolbar.tsx` を更新
- **IMPLEMENT**:
  - import に `FontSizeControl` 追加
  - `ToolbarProps` に追加:
    ```typescript
    activeFontSize: number;
    onIncrementFontSize: () => void;
    onDecrementFontSize: () => void;
    ```
  - 関数引数 destructure に上記 3 つ追加
  - JSX 内、`<ColorPalette ... />` の直後に:
    ```jsx
    <Divider />
    <FontSizeControl
      activeFontSize={activeFontSize}
      disabled={!imageLoaded}
      onIncrementFontSize={onIncrementFontSize}
      onDecrementFontSize={onDecrementFontSize}
    />
    ```
- **MIRROR**: 既存 ColorPalette の挿入箇所(L120-121)
- **VALIDATE**: typecheck

### Task 19: Toolbar.test.tsx の props 拡張
- **ACTION**: `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` を更新
- **IMPLEMENT**:
  - `props` の default に追加:
    ```typescript
    activeFontSize: 18,
    onIncrementFontSize: vi.fn(),
    onDecrementFontSize: vi.fn(),
    ```
  - 新規テスト:
    - `it('renders FontSizeControl with the active font size')` — `'18px'` の text が container に含まれる
    - `it('renders FontSizeControl A+ button with aria-label')` — `button[aria-label="フォントサイズを大きくする"]` が見つかる
- **MIRROR**: 既存 props 設定パターン
- **VALIDATE**: `pnpm -F @snap-share/web test -- Toolbar.test`

### Task 20: HelpModal.tsx に「テキスト」section 追加
- **ACTION**: `apps/web/src/components/dialogs/HelpModal.tsx` を更新
- **IMPLEMENT**:
  - `EDIT_ROWS` の後あたりに新定数:
    ```typescript
    const TEXT_ROWS: ReadonlyArray<Row> = [
      { label: 'フォントサイズ +2', keys: [']'] },
      { label: 'フォントサイズ -2', keys: ['['] },
    ];
    ```
  - `SECTIONS` 配列に追加(色 と 編集 の間あたり、Toolbar 並びに合わせる):
    ```typescript
    { title: 'テキスト', rows: TEXT_ROWS },
    ```
- **MIRROR**: `COLOR_ROWS` / `EDIT_ROWS`(L25-35)
- **VALIDATE**: typecheck + 既存 HelpModal テストが落ちないこと

### Task 21: HelpModal.test.tsx のテスト追加
- **ACTION**: `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` を更新
- **IMPLEMENT**:
  - 既存テストパターンに合わせて 1 ケース追加:
    - `it('lists the [ and ] shortcuts under "テキスト" section')` — modal を open → `getByText('テキスト')` 存在 + `]` キーボード表示が含まれる
- **MIRROR**: 既存 HelpModal テスト
- **VALIDATE**: `pnpm -F @snap-share/web test -- HelpModal`

### Task 22: E2E `font-size.spec.ts` 新規作成
- **ACTION**: `apps/web/e2e/font-size.spec.ts` を新規作成
- **IMPLEMENT**:
  ```typescript
  import { expect, test } from '@playwright/test';
  import { dropImage } from './fixtures/upload';

  const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';
  const DEFAULT_FONT_SIZE = 18;
  const STEP = 2;

  type AnnotationSnapshot = ReadonlyArray<Record<string, unknown>>;

  const readAnnotations = async (page: import('@playwright/test').Page) =>
    page.evaluate(
      (k) => ((window as unknown as Record<string, AnnotationSnapshot>)[k] ?? []) as AnnotationSnapshot,
      ANNOTATIONS_KEY,
    );

  const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
    test.skip(testInfo.project.name !== 'chromium', 'font-size はキー入力依存で chromium のみで検証する');

  const setupRoom = async (page: import('@playwright/test').Page) => {
    await page.goto('/');
    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
    await page.waitForFunction(
      (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
      ANNOTATIONS_KEY,
      { timeout: 10_000 },
    );
  };

  const clickStageAt = async (page, offset) => { /* annotation-color.spec と同型 */ };

  test.describe('font size — Toolbar A-/A+ + [/] shortcut', () => {
    test('Toolbar に現在の activeFontSize "18px" が表示される', async ({ page }, testInfo) => {
      skipNonChromium(testInfo);
      await setupRoom(page);
      await expect(page.getByText('18px')).toBeVisible();
    });

    test('A+ 1 回クリック → activeFontSize 20 → 新規 text が 20px で作成される', async ({ page }, testInfo) => {
      skipNonChromium(testInfo);
      await setupRoom(page);
      await page.getByRole('button', { name: 'フォントサイズを大きくする' }).click();
      await expect(page.getByText('20px')).toBeVisible();

      // text ツール → クリックで空 text 作成 → 文字打鍵 → Enter で確定
      await page.getByRole('button', { name: 'テキスト' }).click();
      await clickStageAt(page, { x: 200, y: 200 });
      await page.keyboard.type('hello');
      await page.keyboard.press('Enter');

      const annotations = await readAnnotations(page);
      const t = annotations.find((a) => a.type === 'text') as { fontSize: number } | undefined;
      expect(t?.fontSize).toBe(DEFAULT_FONT_SIZE + STEP);
    });

    test('] shortcut で activeFontSize +2 (text 未編集中)', async ({ page }, testInfo) => {
      skipNonChromium(testInfo);
      await setupRoom(page);
      await page.keyboard.press(']');
      await expect(page.getByText('20px')).toBeVisible();
      await page.keyboard.press(']');
      await expect(page.getByText('22px')).toBeVisible();
      await page.keyboard.press('[');
      await expect(page.getByText('20px')).toBeVisible();
    });

    test('既存 text 選択中に A+ → その text の fontSize も追従する', async ({ page }, testInfo) => {
      skipNonChromium(testInfo);
      await setupRoom(page);

      // text 1 個作成
      await page.getByRole('button', { name: 'テキスト' }).click();
      await clickStageAt(page, { x: 200, y: 200 });
      await page.keyboard.type('a');
      await page.keyboard.press('Enter');

      // V キー → text を click で再選択
      await page.keyboard.press('v');
      await clickStageAt(page, { x: 205, y: 205 });

      // A+ で active も text の fontSize も 20 に
      await page.getByRole('button', { name: 'フォントサイズを大きくする' }).click();

      const annotations = await readAnnotations(page);
      const t = annotations.find((a) => a.type === 'text') as { fontSize: number } | undefined;
      expect(t?.fontSize).toBe(20);
      await expect(page.getByText('20px')).toBeVisible();
    });

    test('MIN(8) で − ボタンが disabled、MAX(200) で + が disabled', async ({ page }, testInfo) => {
      skipNonChromium(testInfo);
      await setupRoom(page);
      // 5 連打で 18 → 16 → 14 → 12 → 10 → 8(下限)
      for (let i = 0; i < 5; i++) await page.keyboard.press('[');
      await expect(page.getByText('8px')).toBeVisible();
      await expect(page.getByRole('button', { name: 'フォントサイズを小さくする' })).toBeDisabled();
      // もう 1 回 [ を打っても 8 のまま、A- は disabled
      await page.keyboard.press('[');
      await expect(page.getByText('8px')).toBeVisible();
    });

    test('text 編集中の [ / ] は文字入力としてスルーされる(shortcut 発火しない)', async ({ page }, testInfo) => {
      skipNonChromium(testInfo);
      await setupRoom(page);
      await page.getByRole('button', { name: 'テキスト' }).click();
      await clickStageAt(page, { x: 200, y: 200 });
      // textarea が focus 中
      await page.keyboard.type('a]b');
      await page.keyboard.press('Enter');

      // activeFontSize は 18 のまま(] が shortcut 化していない)
      await expect(page.getByText('18px')).toBeVisible();
      const annotations = await readAnnotations(page);
      const t = annotations.find((a) => a.type === 'text') as { text: string } | undefined;
      expect(t?.text).toBe('a]b');
    });
  });
  ```
- **MIRROR**: `apps/web/e2e/annotation-color.spec.ts` 全体(setupRoom / clickStageAt / readAnnotations / skipNonChromium 相当をコピー)
- **GOTCHA**:
  - `page.getByText('18px')` は Toolbar 内の `<span aria-live="polite">18px</span>` をマッチ。複数 match を避けるため `tabular-nums` の span は他に作らない
  - `text 編集中の [/]` テストは現状 `isEditableTarget` ガード(useKeyboardShortcuts.ts:53)がある前提。Phase 7.8-1/7.8-2 と同じ前提で動く
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e -- font-size`

### Task 23: 全体検証 + lint / format
- **ACTION**: 全タスク完了後の品質ゲート
- **IMPLEMENT**:
  - `pnpm typecheck` 全緑(turbo 4 タスク)
  - `pnpm exec biome check --write .` で auto-fix(import 並び等)→ `pnpm lint` 緑
  - `pnpm test` 全緑
  - `pnpm -F @snap-share/web test:e2e` 全緑(annotation-color / annotation-resize / auto-next-* / font-size 含む regression なし)
  - `pnpm build` 緑
- **VALIDATE**: 全コマンド exit 0

### Task 24: PRD 更新
- **ACTION**: `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` の Implementation Phases テーブルを更新
- **IMPLEMENT**:
  - Phase 3 の `Status` を `pending` → `in-progress`(implement 中) → `complete`(実装完了時)
  - `PRP Plan` 列に `[plan](../plans/phase-7.8-3-font-size-ui.plan.md)` を追加
- **VALIDATE**: 目視

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| fontSize.clampFontSize(7) | 7 | 8(下限へクランプ) | 境界 |
| fontSize.clampFontSize(201) | 201 | 200(上限) | 境界 |
| fontSize.clampFontSize(18.7) | 18.7 | 19(Math.round) | 非整数防衛 |
| fontSize.incrementFontSize(200) | 200 | 200(上限到達) | 境界 |
| fontSize.decrementFontSize(8) | 8 | 8(下限到達) | 境界 |
| operations.setFontSize(text fixture, 24) | text + 24 | text の fontSize=24 | OK |
| operations.setFontSize(rect fixture, 24) | rect + 24 | rect 参照同一(no-op) | type guard |
| operations.setFontSize(text fixture, unknown id) | unknown | text 参照同一 | not found |
| yjs-mutations.setTextFontSizeY(text Y.Map, 24) | Y.Map + 24 | fontSize=24 で codec round-trip | text gate 通過 |
| yjs-mutations.setTextFontSizeY(rect Y.Map, 24) | rect Y.Map | rect の元値保持 | type guard |
| reducer.active-font-size/set | { fontSize: 24 } | state.activeFontSize=24 | annotations / selection 不変 |
| reducer.annotation/set-font-size(text id) | { id, fontSize: 24 } | annotations[i].fontSize=24 | committing |
| reducer.annotation/set-font-size(rect id) | { id, fontSize: 24 } | rect 参照同一(no-op) | type guard |
| reducer.isCommittingAction | annotation/set-font-size | true | Undo target |
| reducer.isCommittingAction | active-font-size/set | false | UI-only |
| yjs-context.applyDataAction(annotation/set-font-size) | text id + 24 | yMap.fontSize=24 | text-only |
| yjs-context.applyDataAction(active-font-size/set) | { fontSize: 24 } | yAnnotations.size 不変 | UI-only |
| FontSizeControl: render | 24 | "24px" 表示 | OK |
| FontSizeControl: + click | onIncrementFontSize 呼出 | called once | OK |
| FontSizeControl: − click | onDecrementFontSize 呼出 | called once | OK |
| FontSizeControl: 全体 disabled | disabled=true | 全 button.disabled=true | image 未読込 |
| FontSizeControl: at MIN | activeFontSize=8 | − disabled / + enabled | 境界 |
| FontSizeControl: at MAX | activeFontSize=200 | + disabled / − enabled | 境界 |
| useKeyboardShortcuts: ] | onIncrementFontSize provided | called + preventDefault | shortcut |
| useKeyboardShortcuts: ] (cb undef) | provider undef | preventDefault=false | browser default 温存 |
| useKeyboardShortcuts: [ | onDecrementFontSize provided | called + preventDefault | shortcut |
| useKeyboardShortcuts: Cmd+] | metaKey=true | onIncrementFontSize 未呼出 | browser shortcut 温存 |
| useKeyboardShortcuts: Shift+] = "}" | key='}', shiftKey=true | 未呼出 | 別キー |
| useKeyboardShortcuts: input focus + ] | input focus | 未呼出 | text 編集中スルー |

### Edge Cases Checklist
- [x] 不在 id への setFontSize / setTextFontSizeY → no-op
- [x] 非 text への setFontSize / setTextFontSizeY → no-op
- [x] 8 / 200 でのクランプ(UI ボタン disabled + lib 関数双方)
- [x] 非整数 fontSize の Math.round 正規化
- [x] text 編集中の [/] が文字入力として通る(shortcut 化しない)
- [x] Cmd+]/Cmd+[ (browser tab 切替) を奪わない
- [x] Shift+] (`}`) / Shift+[ (`{`) で誤発火しない
- [x] 画像未読込時の shortcut が effect 無し(`source ? ... : undefined` ガード)
- [x] activeFontSize が複数クライアントで独立(UI-only state、Yjs 非伝播)
- [x] text 注釈の fontSize は Yjs 経由で peer に同期(setTextFontSizeY)
- [x] Cmd+Z で fontSize 変更が巻き戻る(annotation/set-font-size は COMMITTING_ACTIONS)
- [x] Cmd+Z で active-font-size/set は対象外(UI-only)
- [x] Auto-next-A / Auto-next-B 連鎖の text 作成が現在の activeFontSize を使う

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

### Unit Tests
```sh
pnpm -F @snap-share/shared test
pnpm -F @snap-share/web test
```
EXPECT: 全緑(新規 fontSize / FontSizeControl / reducer / yjs / shortcut テスト含む)

### Build
```sh
pnpm build
```
EXPECT: vite + wrangler dry-run 成功

### E2E
```sh
pnpm -F @snap-share/web test:e2e -- font-size
pnpm -F @snap-share/web test:e2e   # 全 regression
```
EXPECT: 新規 font-size 緑、既存 spec(annotation-color / annotation-resize / annotation-tools / auto-next-arrow-text / auto-next-rect-arrow / golden-path / help-modal / keyboard-shortcuts / zoom-pan / 他)regression なし

### Manual Validation (dev server)
- [ ] `pnpm dev` → http://localhost:5173 → 画像投入(自動 room 作成)
- [ ] Toolbar に `[A-] [18px] [A+]` が ColorPalette の隣に表示
- [ ] A+ クリック → "20px" → text 作成 → fontSize 20 で配置
- [ ] `]` shortcut で +2px(text 未編集中)
- [ ] text 描画 → V キーで select → text クリック → A+ クリック → 既存 text の fontSize が 20 に変わる + active も 20
- [ ] 5 連打 `[` → "8px"、A- ボタン disabled、もう 1 連打しても 8px のまま
- [ ] 多連打 `]` → "200px"、A+ ボタン disabled
- [ ] 矩形 → 矢印 Auto-next-B(Enter)で発生する text の fontSize が現在の activeFontSize に追従
- [ ] 矢印 → text Auto-next-A(矢印 mouseup)で発生する text の fontSize が現在の activeFontSize に追従
- [ ] text 編集中に `]`/`[` を打つと textarea に文字が入る(shortcut 化しない)
- [ ] Cmd+Z で fontSize 変更が 1 step ずつ巻き戻る(active 値ではなく注釈の fontSize)
- [ ] HelpModal(`?` キー)に「テキスト」section が出る
- [ ] 別ブラウザで同じ room 開く → text 作成 + fontSize 変更が peer に同期、active 値はクライアント独立

---

## Acceptance Criteria
- [ ] Task 1-24 完了
- [ ] 全 validation コマンド緑
- [ ] `state.activeFontSize` が SSOT、Toolbar / 3 か所の text 作成 / shortcut が同 source を読む
- [ ] `[A-] [現在値] [A+]` の Toolbar UI(ColorPalette の作法に整合)
- [ ] `[` / `]` shortcut が ±2px、JIS/US 両配列で動作確認
- [ ] 8 / 200 でクランプ(UI ボタン disabled + lib pure 関数双方)
- [ ] 単一クリックで「active 更新 + 選択中 text に適用」(activeColor と同じ作法)
- [ ] Yjs 同期が peer 間で動作(text の fontSize は伝播、active は UI-only)
- [ ] Cmd+Z で fontSize 変更が undo step として巻き戻る
- [ ] HelpModal にテキストセクション追加
- [ ] 既存 E2E(annotation-color / annotation-resize / auto-next-*) regression なし
- [ ] PRD の Phase 3 status を `pending` → `complete` に更新

## Completion Checklist
- [ ] コードが Patterns to Mirror に準拠(activeColor 同型)
- [ ] エラーハンドリング = no-op パターン(reducer / Yjs mutation の type guard / unknown id)
- [ ] テストが TEST_STRUCTURE_UNIT / E2E パターン準拠
- [ ] ハードコード値: MIN/MAX/STEP は `apps/web/src/lib/fontSize.ts` に集約、`MAX_FONT_SIZE` は shared から re-export
- [ ] CLAUDE.md ルール順守:
  - [ ] ルール 1: 判別共用体維持(setFontSize は text-only type guard)
  - [ ] ルール 2: 単一 useReducer 内で state 拡張(activeFontSize)
  - [ ] ルール 4: Konva 色は hex literal(影響なし、確認のみ)
  - [ ] ルール 6: 新規依存追加なし(lucide-react / shadcn / vitest はすべて既存 catalog)
  - [ ] ルール 8: Yjs mutation は LOCAL_ORIGIN で transact ラップ(setTextFontSizeY は tx ヘルパー経由)
- [ ] 不要なスコープ追加なし(任意 px 数値入力 / プリセット / 長押しリピート等は明示的除外)
- [ ] Self-contained — 実装中に追加調査不要

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `[` / `]` キーが JIS 配列で別文字を返して shortcut が動かない | L | M | `e.key` ベース(物理キー位置でなく文字)で判定。E2E `font-size.spec.ts` で実 chromium 上の挙動を確認、JIS でも `[` キー押下時 `e.key === '['` で確実(`e.code === 'BracketLeft'` は使わない) |
| `active-font-size/set` を applyDataAction で UI-only と分類し忘れて Yjs に流れる | L | H | switch を `case 'active-color/set': case 'active-font-size/set': return;` でグルーピングして同性質を視覚的に揃える。Task 9 / 10 の test で Y.Doc 不変を assert |
| useCallback 依存配列の更新漏れで activeFontSize の stale closure | M | M | CanvasStage / EditorShell の handler ごとに依存追加する箇所を Task 12/13 で明示。typecheck では拾えないため eslint-plugin-react-hooks(既設定)に依存 |
| FontSizeControl と ColorPalette の差別化不足で見た目が同じ swatch に見える | L | L | Minus/Plus アイコン + 中央数値表示で形状的に明確に違う。色なしの `Button variant="ghost"` で揃える |
| Auto-next-A の text 作成箇所が EditorShell ではなく CanvasStage に残っており 1 か所更新漏れ | M | M | grep `DEFAULT_FONT_SIZE` で残存箇所を Task 23 で全部洗う(現状 5 箇所中 3 箇所が text 作成) |
| MIN/MAX クランプが UI と reducer / mutation で二重 / 不整合 | L | L | UI(ボタン disabled)+ pure 関数(clampFontSize)で double-guard。schema 上限 200 と UI 上限を `MAX_FONT_SIZE` で共有 |
| HelpModal の「テキスト」section 順序が UX と乖離 | L | L | Toolbar の左→右順(ツール → 色 → テキスト → 編集 → ズーム → 出力 → ヘルプ)に揃える |
| Phase 7.8-2 の handleConfirmAutoArrow の text fontSize が「Enter 押下時の active」を使うべきか「矩形 mouseup 時の active」を使うべきか | L | L | Enter 押下時(= activeFontSize 最新)を使う。store.state.activeFontSize を `handleConfirmAutoArrow` 内部で都度参照、ref ではなく毎回 state を読み出す(callback 依存に store) |

## Notes

### Decisions(plan で確定)

- **min font size = 8、step = 2**: dogfood 想定の最低可読サイズ + Photoshop 流ステップ。MAX は schema の `MAX_FONT_SIZE = 200` を再利用
- **Shortcut は `[` / `]`(JIS/US 両対応)**: `e.key === '['` / `']'` で文字判定。物理キー位置(`e.code`)に依存しないため両配列で同じ挙動。`Shift+[` (`{`) / `Shift+]` (`}`) は別キー扱いで誤発火しない。Cmd+] は browser タブ切替を温存
- **暗黙切替の解釈**: PRD は「text 選択中なら個別、未選択なら active 更新」だが、Phase 7.7-2 dogfood 後の進化形 `handlePickColor`(常に active 更新 + 選択中なら追加で適用)と一貫させる。挙動は実質等価(text 未選択時は active のみ)で、選択中 text にサイズ変更すると **次に作る text もそのサイズになる** という直感ルールが揃う
- **A-/A+ の lucide アイコン**: `Minus` / `Plus`。テキスト "A-" / "A+" でも可だが、ColorPalette の swatch とサイズが揃うアイコン形状を採用
- **Auto-next 連鎖の fontSize source**: Phase 7.8-1/7.8-2 で生成される空 text も `activeFontSize` を読む。連鎖中に shortcut で変更した最新値が反映される設計
- **新規ハンドラの命名**: `handleSetFontSize`(値直接) + `handleIncrementFontSize` / `handleDecrementFontSize`(STEP 演算)。color の `handlePickColor` / `handleCycleColorNext` / `handleCycleColorPrev` と対称

### 設計上のフォーカス

- **single source of truth**: `state.activeFontSize` 1 個。Toolbar / shortcut / 3 か所の text 作成 / 選択中 text 適用、すべて同 state を読む
- **薄い lib 層**: `apps/web/src/lib/fontSize.ts` に MIN/MAX/STEP 定数 + clamp/inc/dec の pure 関数のみ。React 依存ゼロで unit test 容易
- **type guard を 2 段で持つ**: operations.setFontSize(reducer 経由) と yjs-mutations.setTextFontSizeY(Yjs 経由)双方が text 限定。reducer から呼ばれた `non-text id` の dispatch は両側で no-op になる
- **Phase 7.7-2 / 7.8-1 / 7.8-2 と同型**: AnnotationsState 拡張の 3 件目(activeColor / pendingAutoArrow に続く activeFontSize)、yjs bridge と reducer の双方向は形を揃える

### 次フェーズへの伏線

- **Phase 7.8-4 Smart snap** とはファイル境界が分離(snap は `apps/web/src/lib/snap.ts` 新規 + `handleMouseMove` の pos 補正、本フェーズは Toolbar / reducer / shortcut のみ)。並列実装可能
- **Phase 7.8-5 dogfood** で 8 / 200 / 2 のクランプ・ステップ値が妥当か再評価。必要なら `apps/web/src/lib/fontSize.ts` の定数調整 1 行で済む

---

*Generated: 2026-05-04*
*Status: ready-to-implement*
