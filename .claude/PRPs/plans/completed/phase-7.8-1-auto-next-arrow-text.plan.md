# Plan: Phase 7.8-1 — Auto-next A: 矢印 → テキスト 次手予測

## Summary

矢印を引き終わった瞬間、終点(`to`)から矢印方向に数 px 先で **空 text 注釈を自動作成 + IME 即時起動** する次手予測 A を実装する。Phase 7.7 で既に完成している text 即時編集経路(TextEditorOverlay の Enter 確定 / Esc 破棄 / 0 文字自動削除 / `stopPropagation` ガード)を **完全再利用** し、新規ロジックは `CanvasStage.handleMouseUp` の arrow 分岐に追加する数行と Auto-next 専用の tool=select 復帰用 ref のみ。

## User Story

As a **業務スクショ注釈を量産するビジネスマン**,
I want **矢印を引いた直後にそのまま補足テキストを打鍵できる**,
So that **ツール切替やマウス位置決めの摩擦を 0 にし、指摘 1 件あたり 2-3 アクション分の時間を節約できる**.

## Problem → Solution

**Current**: 矢印を引いた後、ユーザーは (1) `T` キーでツール切替 → (2) 矢印終端付近をクリックして text 注釈作成 → (3) IME で打鍵 という 3 ステップを毎回繰り返している。

**Desired**: 矢印 mouseup の瞬間に空 text が IME 起動状態で生成される。ユーザーは **打鍵だけ** で次に進める。

## Metadata

- **Complexity**: **Medium**
- **Source PRD**: `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md`
- **PRD Phase**: Phase 1: A 矢印→テキスト 次手予測
- **Estimated Files**: 6 (CREATE 4, UPDATE 2)
- **Estimated LOC**: 250-350 (production + test)

---

## UX Design

### Before (Phase 7.7 完了時点)

```
┌─────────────────────────────────────────────┐
│ 1. ユーザー: A キー押下                     │
│ 2. ユーザー: ドラッグで矢印を引く           │
│ 3. ユーザー: T キー押下(ツール切替)        │
│ 4. ユーザー: 矢印終端付近をクリック         │
│ 5. ブラウザ: textarea 出現 + フォーカス     │
│ 6. ユーザー: 補足を打鍵                     │
│ 7. ユーザー: Enter で確定                   │
└─────────────────────────────────────────────┘
合計: 7 アクション(ツール切替 + クリック位置決めが摩擦)
```

### After (Phase 7.8-1 完了時点)

```
┌─────────────────────────────────────────────┐
│ 1. ユーザー: A キー押下                     │
│ 2. ユーザー: ドラッグで矢印を引く           │
│ 3. ブラウザ: 矢印確定 + 終端 +offset で     │
│             空 text 自動作成 + IME 起動     │
│ 4. ユーザー: 補足を打鍵                     │
│ 5. ユーザー: Enter で確定 → tool=select 復帰│
└─────────────────────────────────────────────┘
合計: 5 アクション(ツール切替 + クリック位置決めが消える)
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 矢印 mouseup 直後の状態 | tool=arrow、selectedId=新矢印 | tool=text、selectedId=新空 text、editingTextId=新空 text、textarea visible | Auto-next-A 起動 |
| 1 文字以上 Enter / フォーカス外 | (該当しない、別経路で確定) | text 確定、tool=**select** に復帰、selectedId=確定 text | Auto-next 経路のみ select 復帰(通常 text 経路は変更なし) |
| 0 文字 Enter / フォーカス外 | (該当しない) | text 自動削除(矢印は残る)、tool=**select** に復帰、selectedId=null | 既存 `handleTextCommit` の text==='' 削除経路を再利用 |
| 編集中 Esc | (該当しない) | text 破棄(空文字なら自動削除)、tool=**select** に復帰、selectedId=null or 矢印 | 既存 `handleTextCancel` の経路を再利用 |
| 編集中 BS | (該当しない) | 文字削除のみ(text 注釈は残る、編集続行) | TextEditorOverlay 内 textarea 標準挙動、`stopPropagation` で window key handler 不発 |
| Cmd+Z 1 回 | (該当しない) | text を削除(矢印は残る) | history 別 commit |
| Cmd+Z 2 回 | (該当しない) | 矢印も削除 | history 別 commit |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/web/src/components/canvas/CanvasStage.tsx` | 全体 (430行) | Auto-next 起動位置(L283-308 handleMouseUp の arrow 分岐) + 既存 text ツールの即時編集パターン(L207-222) |
| P0 | `apps/web/src/pages/EditorShell.tsx` | 111-219, 261-274, 322-326 | TextEditorOverlay 配線、`handleTextCommit/Cancel`、`handleEscape`、`useKeyboardShortcuts` 配線、`onStartTextEditing` |
| P0 | `apps/web/src/components/canvas/TextEditorOverlay.tsx` | 全体 (82行) | textarea の Enter/Esc/Blur 挙動、`stopPropagation`、armed ガード |
| P0 | `apps/web/src/hooks/annotationsReducer.ts` | 全体 (146行) | `annotation/add`/`tool/set`/`select/set`/`annotation/set-text`/`annotation/remove` の挙動、`isCommittingAction` の history commit ルール |
| P1 | `apps/web/src/hooks/useAnnotationsStore.ts` | 全体 (65行) | `dispatch` が history を commit するタイミング(`annotation/add` は commit、`tool/set`/`select/set` は replace) |
| P1 | `apps/web/src/components/canvas/colors.ts` | 全体 | `DEFAULT_FONT_SIZE = 18` を import |
| P1 | `packages/shared/src/annotation.ts` | 1-86 | `Annotation` 判別共用体、`TextAnnotationSchema` 形状、`COLOR_REGEX` |
| P1 | `apps/web/src/lib/id.ts` | 全体 | `generateId()` の signature(text 注釈の id 生成に使う) |
| P2 | `apps/web/e2e/golden-path.spec.ts` | 全体 (101行) | E2E パターン: `dropImageBuffer` / `__SNAP_SHARE_ANNOTATIONS__` polling / `getByRole('textbox', { name: '注釈テキストを編集' })` |
| P2 | `apps/web/src/hooks/useYjsAnnotationsStore.ts` | 100-115 | `__SNAP_SHARE_ANNOTATIONS__` window expose の既存パターン |
| P2 | `apps/web/src/components/dialogs/HelpModal.tsx` | 全体 | Phase 5(dogfood + HelpModal 追記)で更新する箇所の予習(本 Phase ではタッチしない) |

## External Documentation

No external research needed — feature uses established internal patterns(text 即時編集 / `useReducer` history / Konva Stage event / Yjs 自動同期はすべて Phase 1-7.7 で実証済)。

---

## Patterns to Mirror

### TEXT_TOOL_IMMEDIATE_EDIT (Auto-next-A の手本)

```tsx
// SOURCE: apps/web/src/components/canvas/CanvasStage.tsx:207-222
if (tool === 'text') {
  const id = generateId();
  const annotation: Annotation = {
    id,
    type: 'text',
    createdAt: Date.now(),
    x: pos.x,
    y: pos.y,
    text: '',
    fontSize: DEFAULT_FONT_SIZE,
    color: activeColor,
  };
  dispatch({ type: 'annotation/add', annotation });
  dispatch({ type: 'select/set', id });
  onStartTextEditing(id);
  return;
}
```

これを `handleMouseUp` の arrow 確定後にそっくり呼び出す。違いは座標計算(`pos.x/y` ではなく `arrow.to + offset`)と直前の `tool/set: 'text'` 追加のみ。

### ARROW_CONFIRMATION (Auto-next 起動位置)

```tsx
// SOURCE: apps/web/src/components/canvas/CanvasStage.tsx:283-308 (handleMouseUp)
const handleMouseUp = useCallback(
  (e: KonvaEventObject<MouseEvent>) => {
    if (panActiveRef.current) {
      panActiveRef.current = false;
      panLastRef.current = null;
      setCursor(spaceDownRef.current ? 'grab' : '');
      return;
    }
    const dragStart = dragStartRef.current;
    const currentDraft = draftRef.current;
    if (!dragStart) return;
    const stage = e.target.getStage();
    const pos = stage?.getRelativePointerPosition() ?? null;
    const reachedThreshold = pos && distance(dragStart, pos.x, pos.y) >= MIN_DRAG_PIXELS;

    if (reachedThreshold && currentDraft) {
      dispatch({ type: 'annotation/add', annotation: currentDraft });
      dispatch({ type: 'select/set', id: currentDraft.id });
      // ★ ここに Auto-next-A の起動分岐を追加(currentDraft.type === 'arrow' で発火)
    }
    draftRef.current = null;
    dragStartRef.current = null;
    setDraft(null);
  },
  [dispatch, setCursor],
);
```

### IMMUTABLE_REDUCER (annotation/add 経路)

```tsx
// SOURCE: apps/web/src/hooks/annotationsReducer.ts:74-81
case 'annotation/add':
  return { ...state, annotations: addAnnotation(state.annotations, action.annotation) };
case 'annotation/remove':
  return {
    ...state,
    annotations: removeAnnotation(state.annotations, action.id),
    selectedId: state.selectedId === action.id ? null : state.selectedId,
  };
```

`annotation/add` は `isCommittingAction = true`(L133-142)→ history に commit。`tool/set` / `select/set` は replace で history に残らない。Auto-next で「矢印 add → tool/set → select/set → text add」を連続 dispatch すると history は **矢印 commit → (tool replace) → (select replace) → text commit = 2 commit** になる。これが Phase 7.8 PRD の「各注釈は独立 step」要件と整合。

### TEXT_COMMIT_EMPTY_REMOVE (0 文字自動削除の既存経路)

```tsx
// SOURCE: apps/web/src/pages/EditorShell.tsx:201-219
const handleTextCommit = useCallback(
  (text: string) => {
    if (!editingTextId) return;
    if (text === '') {
      store.dispatch({ type: 'annotation/remove', id: editingTextId });
    } else {
      store.dispatch({ type: 'annotation/set-text', id: editingTextId, text });
    }
    setEditingTextId(null);
  },
  [editingTextId, store],
);

const handleTextCancel = useCallback(() => {
  if (editingTextId && editingAnnotation && editingAnnotation.text === '') {
    store.dispatch({ type: 'annotation/remove', id: editingTextId });
  }
  setEditingTextId(null);
}, [editingTextId, editingAnnotation, store]);
```

「0 文字 Enter で text 自動削除」「Esc で空 text なら削除」が既に動作している。**Phase 1 で追加するのは「Auto-next 経路で commit/cancel 後に tool=select に復帰する」分岐のみ**。

### REF_PATTERN (panActiveRef を Auto-next に踏襲)

```tsx
// SOURCE: apps/web/src/components/canvas/CanvasStage.tsx:122-124
const spaceDownRef = useRef(false);
const panActiveRef = useRef(false);
const panLastRef = useRef<{ x: number; y: number } | null>(null);
```

ref で「現在 Auto-next 連鎖中か」を保持する。state ではなく ref を使う理由は Phase 7.7-3 と同じ — 連続 React event 内で同期的に参照できる必要があるため。

### WINDOW_EXPOSE_FOR_E2E

```tsx
// SOURCE: apps/web/src/hooks/useYjsAnnotationsStore.ts:106-109
useEffect(() => {
  (
    window as unknown as { __SNAP_SHARE_ANNOTATIONS__?: ReadonlyArray<Annotation> }
  ).__SNAP_SHARE_ANNOTATIONS__ = annotations;
}, [annotations]);

// SOURCE: apps/web/src/pages/EditorShell.tsx:182-184
useEffect(() => {
  (window as unknown as Record<string, unknown>).__SNAP_SHARE_STAGE_TRANSFORM__ = stageTransform;
}, [stageTransform]);
```

E2E から tool 状態を assert したいので `__SNAP_SHARE_TOOL__` を追加 expose する(`store.state.tool` を `useEffect` で書き戻す 1 line)。

### E2E_KEYBOARD_AND_DROP

```ts
// SOURCE: apps/web/e2e/golden-path.spec.ts:32-99
await page.goto('/');
await dropImageBuffer(page, SAMPLE, 'golden.png');
await page.waitForFunction(
  (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
  ANNOTATIONS_KEY,
  { timeout: 10_000 },
);
const stage = page.locator('.konvajs-content canvas').first();
const box = await stage.boundingBox();
// ... mouse drag for arrow
const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
await expect(textarea).toBeVisible({ timeout: 5_000 });
await textarea.type('OK');
await textarea.press('Enter');
```

Auto-next E2E もこの形を踏襲する(矢印を mouse drag → textarea が visible になるのを待つ → 文字打鍵 → Enter → annotations.length と tool 状態をアサート)。

### UNIT_TEST_PATTERN (純関数)

```ts
// SOURCE: apps/web/src/lib/__tests__/colorCycle.test.ts (Phase 7.7-4)
import { describe, expect, it } from 'vitest';
import { nextColor, prevColor } from '../colorCycle';

describe('nextColor', () => {
  it('cycles to the next palette color', () => {
    expect(nextColor('#ff0000')).toBe(/* expected */);
  });
  it('wraps around at the end', () => { /* ... */ });
  it('returns the first color when given an unknown color', () => { /* ... */ });
});
```

`computeAutoNextTextOffset` を純関数として `apps/web/src/lib/autoNextOffset.ts` に切り出し、同じパターンで unit test する。

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/lib/autoNextOffset.ts` | CREATE | 純関数 `computeAutoNextTextOffset(from, to, distance): Point` を独立配置(unit test しやすい) |
| `apps/web/src/lib/__tests__/autoNextOffset.test.ts` | CREATE | 純関数 unit test(矢印長 0 / 各方向 / 大きな矢印) |
| `apps/web/e2e/auto-next-arrow-text.spec.ts` | CREATE | E2E spec: 5 ケース(基本確定 / 0 文字 Enter / Esc 中断 / Cmd+Z 連打 / 通常 text ツールは影響なし) |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATE | `handleMouseUp` の arrow 分岐に Auto-next-A 起動を追加、`onStartTextEditing` の signature 拡張 |
| `apps/web/src/pages/EditorShell.tsx` | UPDATE | `autoNextChainRef` 追加、`handleTextCommit`/`handleTextCancel` で tool=select 復帰、`__SNAP_SHARE_TOOL__` expose、`onStartTextEditing` signature 拡張 |
| `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` | UPDATE | Phase 1 status を `pending` → `in-progress` + plan link |

**触らないファイル**(影響範囲外):
- `packages/shared/src/annotation.ts` — Schema 変更不要(`fontSize`/`color` フィールド既存)
- `apps/web/src/hooks/annotationsReducer.ts` — 既存 action だけで成立
- `apps/web/src/hooks/useAnnotationsStore.ts` — 既存 dispatch 経路を使う
- `apps/web/src/domain/annotation/yjs-mutations.ts` — `annotation/add` 経由で既存ラップが効く
- `apps/web/src/hooks/useKeyboardShortcuts.ts` — Phase 1 では新キー追加なし(Enter/Esc/BS は textarea 内で `stopPropagation` 済)
- `apps/web/src/components/dialogs/HelpModal.tsx` — Phase 5 でまとめて更新

## NOT Building

- **Phase 2 (B 矩形→矢印)** — 別 plan で Enter/BS pending 経路を実装
- **Phase 3 (フォントサイズ UI)** — 別 plan
- **Phase 4 (Smart snap)** — 別 plan
- **HelpModal 更新** — Phase 5 で全機能まとめて追記
- **opt-out / 設定 UI / テレメトリ** — PRD 確定: 入れない
- **連鎖 Undo グループ化** — PRD 確定: 入れない、各注釈は独立 commit
- **presence 共有** — PRD 確定: 入れない
- **新規ショートカット追加** — Phase 1 では不要(Enter/Esc/BS は textarea 内で動作)
- **0 文字確定で「矢印もキャンセル」する代替案** — PRD 確定: 矢印は残す

---

## Step-by-Step Tasks

### Task 1: 純関数 `computeAutoNextTextOffset` を新規作成

- **ACTION**: `apps/web/src/lib/autoNextOffset.ts` を新規作成
- **IMPLEMENT**:
  - `export const AUTO_NEXT_TEXT_OFFSET_PX = 8;`(ファイル冒頭の定数、後で plan §「dogfood で調整」に従って 8-12 範囲を調整可能に)
  - `export const computeAutoNextTextOffset = (from: Point, to: Point, distance: number): Point => { ... }`
  - 矢印方向(`to - from`)の単位ベクトルに distance を掛けて返す
  - 矢印長 < 1px の degenerate ケースは fallback で `{x: distance, y: 0}` を返す(実用上は MIN_DRAG_PIXELS=4 で弾かれるが防御的に)
- **MIRROR**: なし(純関数の新規作成、既存パターンに従って小さく独立配置)
- **IMPORTS**: `import type { Point } from '@snap-share/shared';`
- **GOTCHA**:
  - `Point` は `packages/shared/src/annotation.ts` で `readonly` を含む zod スキーマから推論される。`Math.hypot` の引数は number だが `from.x - to.x` で OK
  - `noUncheckedIndexedAccess` 設定(tsconfig.base.json)があるため tuple の index アクセスは避ける
- **VALIDATE**: `pnpm -F @snap-share/web test -- src/lib/__tests__/autoNextOffset.test.ts`(後続 Task 2 で書く)

### Task 2: `computeAutoNextTextOffset` の unit test

- **ACTION**: `apps/web/src/lib/__tests__/autoNextOffset.test.ts` を新規作成
- **IMPLEMENT**: 以下 4-6 ケース
  - 右向き矢印 → offset.x = +distance, offset.y = 0
  - 上向き矢印 → offset.x = 0, offset.y = -distance
  - 斜め(45°)矢印 → offset.x = offset.y = distance / √2(`toBeCloseTo` 使う)
  - 長い矢印(100px+)も同じ単位ベクトル方向、distance 不変
  - degenerate(from === to)→ fallback `{x: distance, y: 0}`
  - 短い矢印(長さ 1px 未満)→ degenerate と同じ fallback
- **MIRROR**: `apps/web/src/lib/__tests__/colorCycle.test.ts` の vitest describe + it 形式
- **IMPORTS**: `import { describe, expect, it } from 'vitest';` + `import { computeAutoNextTextOffset } from '../autoNextOffset';`
- **GOTCHA**: 単位ベクトル比較は `toBe` ではなく `toBeCloseTo(expected, 5)` で(浮動小数点誤差)
- **VALIDATE**: `pnpm -F @snap-share/web test -- src/lib/__tests__/autoNextOffset.test.ts` で全ケース緑

### Task 3: `CanvasStage.tsx` の `onStartTextEditing` signature 拡張

- **ACTION**: `apps/web/src/components/canvas/CanvasStage.tsx` の `onStartTextEditing` を `(id: string, options?: { autoNext?: boolean }) => void` に拡張
- **IMPLEMENT**:
  - props 型(L23): `onStartTextEditing: (id: string, options?: { autoNext?: boolean }) => void;`
  - 既存の text ツール経路(L221)は `onStartTextEditing(id)` のままで OK(options は optional)
  - Auto-next-A 経路では `onStartTextEditing(textId, { autoNext: true })` と呼ぶ
- **MIRROR**: 既存 props と同じ Readonly 型構造、optional パラメータ追加
- **IMPORTS**: 変更なし
- **GOTCHA**:
  - `verbatimModuleSyntax` 設定(tsconfig.base.json)で型のみ import は `import type`(既存に揃える)
  - signature 変更は EditorShell の `setEditingTextId` ラップ側にも影響(Task 5 で受ける)
- **VALIDATE**: `pnpm -w typecheck` でゼロエラー

### Task 4: `CanvasStage.handleMouseUp` に Auto-next-A 起動分岐を追加

- **ACTION**: `apps/web/src/components/canvas/CanvasStage.tsx` の `handleMouseUp` (L283-308) に矢印確定後の Auto-next-A ロジック追加
- **IMPLEMENT**:
  ```tsx
  if (reachedThreshold && currentDraft) {
    dispatch({ type: 'annotation/add', annotation: currentDraft });
    dispatch({ type: 'select/set', id: currentDraft.id });

    // ★ Phase 7.8-1: Auto-next-A — arrow 確定直後に終端 +offset で空 text 即時編集を起動。
    // 既存の text ツール即時編集(L207-222)と同じ shape を、座標と tool 切替だけ
    // 差し替えて再利用する。
    if (currentDraft.type === 'arrow') {
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
  }
  ```
- **MIRROR**: TEXT_TOOL_IMMEDIATE_EDIT パターン(L207-222)の構造をそのまま再利用
- **IMPORTS**:
  ```ts
  import { computeAutoNextTextOffset, AUTO_NEXT_TEXT_OFFSET_PX } from '../../lib/autoNextOffset';
  ```
  既存の `DEFAULT_FONT_SIZE` import は維持(L11)。`generateId` も既存(L9)
- **GOTCHA**:
  - `currentDraft.type === 'arrow'` ガードは TS の判別共用体 narrowing で `currentDraft.from` / `currentDraft.to` の型を絞る(`Annotation` 直接アクセスだと型エラー)
  - 矢印 `add` → `tool/set` → `select/set` → text `add` の **連続 dispatch は同 React event 内で同期処理**(useReducer は同期、`storeReducer` も同期)、history は 2 commit に分かれる(rule #2 単一 useReducer 内で完結 / rule #3 useRef で同 cycle 同期)
  - text 注釈は `text: ''` で生成 → `TextAnnotationSchema.text.max(MAX_TEXT_LENGTH)` を満たす(0 文字は OK)
- **VALIDATE**:
  - `pnpm -w typecheck`
  - 手動: `pnpm -F @snap-share/web dev` で起動 → 画像投入 → A キー → 矢印 drag → 矢印 mouseup と同時に textarea が出ることを確認

### Task 5: `EditorShell.tsx` に Auto-next chain ref + tool=select 復帰

- **ACTION**: `apps/web/src/pages/EditorShell.tsx` を更新
- **IMPLEMENT**:
  1. `autoNextChainRef = useRef(false)` を追加(stageRef 等の隣)
  2. `setEditingTextId` の代わりに `handleStartTextEditing` を新規作成:
     ```tsx
     const handleStartTextEditing = useCallback(
       (id: string, options?: { autoNext?: boolean }) => {
         if (options?.autoNext) {
           autoNextChainRef.current = true;
         }
         setEditingTextId(id);
       },
       [],
     );
     ```
  3. `<CanvasStage>` の `onStartTextEditing` と `onTextDoubleClick` を `handleStartTextEditing` に差し替え
     - `onTextDoubleClick` も `handleStartTextEditing` でよい(options 省略 = 通常 text 編集 = autoNext=false)
  4. `handleTextCommit` の最後に Auto-next chain 復帰処理を追加:
     ```tsx
     const handleTextCommit = useCallback(
       (text: string) => {
         if (!editingTextId) return;
         if (text === '') {
           store.dispatch({ type: 'annotation/remove', id: editingTextId });
         } else {
           store.dispatch({ type: 'annotation/set-text', id: editingTextId, text });
         }
         setEditingTextId(null);
         if (autoNextChainRef.current) {
           autoNextChainRef.current = false;
           store.dispatch({ type: 'tool/set', tool: 'select' });
         }
       },
       [editingTextId, store],
     );
     ```
  5. 同様に `handleTextCancel` にも同じ復帰処理を追加(順序は同じ — `setEditingTextId(null)` の後)
  6. `__SNAP_SHARE_TOOL__` window expose を `__SNAP_SHARE_STAGE_TRANSFORM__` の隣に追加:
     ```tsx
     useEffect(() => {
       (window as unknown as Record<string, unknown>).__SNAP_SHARE_TOOL__ = store.state.tool;
     }, [store.state.tool]);
     ```
- **MIRROR**:
  - REF_PATTERN(`spaceDownRef` / `panActiveRef`)
  - WINDOW_EXPOSE_FOR_E2E(既存 `__SNAP_SHARE_STAGE_TRANSFORM__` の真隣に追加)
  - TEXT_COMMIT_EMPTY_REMOVE(既存ロジックは保ったまま 4 行追加)
- **IMPORTS**: 変更なし(`useRef` は既存)
- **GOTCHA**:
  - `autoNextChainRef.current = false` のクリアは **`setEditingTextId(null)` の後**(順序を反対にすると React の bail-out 評価でクリアが見逃される心配は無いが、可読性のため commit/remove dispatch → editingTextId クリア → ref クリア の順にする)
  - `handleTextCancel` 経路で空文字なら `annotation/remove` が走る(既存挙動)、Auto-next 経路でも同じ挙動 = 矢印は残り、空 text のみ消える ← Phase 7.8 PRD の挙動と一致
  - 通常の text ツール使用時(`autoNext=false`)は ref が立たないので tool は `'text'` のまま = 連続 text 作成モード継続 = 既存挙動を壊さない
  - Phase 7.7-3 の Comment「`useKeyboardShortcuts` の呼出位置は新ハンドラの後ろ」 を踏襲(`autoNextChainRef` を依存させる新ハンドラがあるが、ref そのものは hook 依存配列に入れない = 並び替え不要)
- **VALIDATE**:
  - `pnpm -w typecheck`
  - 手動: `pnpm -F @snap-share/web dev` で
    1. 矢印 → 文字 1 個 → Enter → tool が select に戻る(Toolbar の active 表示で確認 or Devtools で `window.__SNAP_SHARE_TOOL__` を見る)
    2. 矢印 → 何も打鍵せず Enter → text 自動削除、tool=select、矢印は残る
    3. 矢印 → Esc → text 自動削除、tool=select、矢印は残る
    4. **通常 T ツール → 普通の text 作成 → Enter → tool='text' のまま**(既存挙動を壊していない)

### Task 6: E2E spec `auto-next-arrow-text.spec.ts` を新規作成

- **ACTION**: `apps/web/e2e/auto-next-arrow-text.spec.ts` を新規作成
- **IMPLEMENT**: 以下 5 ケース
  1. **基本確定**: 画像投入 → A キー → 矢印 drag → textarea が visible → "OK" 打鍵 → Enter → annotations.length === 2(arrow + text="OK")、`__SNAP_SHARE_TOOL__ === 'select'`
  2. **0 文字 Enter で text 自動削除**: 矢印 drag → textarea visible → 何も打鍵せず Enter → annotations.length === 1(arrow のみ)、`__SNAP_SHARE_TOOL__ === 'select'`
  3. **編集中 Esc で text 中断**: 矢印 drag → textarea visible → Escape → annotations.length === 1(arrow のみ)、`__SNAP_SHARE_TOOL__ === 'select'`
  4. **Cmd+Z 個別巻き戻し**: 矢印 drag → "OK" → Enter(annotations.length === 2)→ Cmd+Z(annotations.length === 1, arrow 残る)→ Cmd+Z(annotations.length === 0)
  5. **通常 T ツールは Auto-next の影響を受けない**(既存挙動回帰): A キー押さず T キー → click → "Hi" → Enter → annotations.length === 1, `__SNAP_SHARE_TOOL__ === 'text'`(=Auto-next 中の select 復帰が漏れていないことの確認)
- **MIRROR**: `apps/web/e2e/golden-path.spec.ts` の dropImageBuffer / waitForFunction / boundingBox / mouse drag / textarea by role / annotations polling パターン
- **IMPORTS**:
  ```ts
  import { expect, test } from '@playwright/test';
  import { buildSolidPng, dropImageBuffer } from './fixtures/upload';
  ```
- **GOTCHA**:
  - chromium プロジェクトのみで OK(既存 spec と揃える、`skipNonChromium` ヘルパ踏襲)
  - mouse drag は `box.x` ベースで 100-200px 範囲、矢印長は MIN_DRAG_PIXELS=4 を超えるよう注意
  - Cmd+Z は `process.platform === 'darwin' ? 'Meta+z' : 'Control+z'` の動的選択(`golden-path.spec.ts` L95 と同じパターン)
  - textarea が visible になるまで `expect(textarea).toBeVisible({ timeout: 5_000 })` で待つ
  - `__SNAP_SHARE_TOOL__` の polling は `expect.poll` で(同期遅延を吸収)
- **VALIDATE**:
  - `pnpm -F @snap-share/web test:e2e -- e2e/auto-next-arrow-text.spec.ts` で 5 ケース全緑

### Task 7: PRD Phase 1 status 更新

- **ACTION**: `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` の Implementation Phases テーブルで Phase 1 を `pending` → `in-progress` に変更 + plan link 追加
- **IMPLEMENT**:
  - 該当行: `| 1 | A: 矢印→テキスト 次手予測 | ... | pending | - | - | - |`
  - 変更後: `| 1 | A: 矢印→テキスト 次手予測 | ... | in-progress | - | - | [plan](../plans/phase-7.8-1-auto-next-arrow-text.plan.md) |`
- **MIRROR**: Phase 7.7 PRD で同様の更新が行われている(plan link を `/plans/completed/` に移すのは Phase 完了 + report 作成時)
- **IMPORTS**: なし
- **GOTCHA**: `pending` 文字列だけでなくテーブルの末尾セル(PRP Plan)も更新する。Edit ツールで old_string を一意化するため行全体を渡す
- **VALIDATE**: 目視で PRD の該当行を確認

### Task 8: 全体回帰

- **ACTION**: 全フェーズ統合検証
- **IMPLEMENT**: `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -F @snap-share/web test:e2e && pnpm -w build`
- **VALIDATE**: 全コマンドが exit 0

---

## Testing Strategy

### Unit Tests (`computeAutoNextTextOffset`)

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| 右向き矢印 | from=(0,0), to=(100,0), d=8 | `{x: 8, y: 0}` | No |
| 左向き矢印 | from=(100,0), to=(0,0), d=8 | `{x: -8, y: 0}` | No |
| 上向き矢印 | from=(0,100), to=(0,0), d=8 | `{x: 0, y: -8}` | No |
| 下向き矢印 | from=(0,0), to=(0,100), d=8 | `{x: 0, y: 8}` | No |
| 斜め 45° | from=(0,0), to=(100,100), d=8 | `{x: 5.65...,y: 5.65...}` (toBeCloseTo) | No |
| degenerate (from === to) | from=(50,50), to=(50,50), d=8 | `{x: 8, y: 0}` (fallback) | Yes |
| 微小差(< 1px) | from=(0,0), to=(0.5, 0.3), d=8 | `{x: 8, y: 0}` (fallback) | Yes |
| distance ゼロ | from=(0,0), to=(100,0), d=0 | `{x: 0, y: 0}` | Yes(将来 0 設定の予防線) |

### E2E Tests (Playwright)

| Test | Scenario | Expected |
|---|---|---|
| 基本確定 | A → 矢印 drag → "OK" → Enter | annotations.length=2、tool=select、text="OK" |
| 0 文字 Enter | A → 矢印 drag → 即 Enter | annotations.length=1、tool=select、矢印のみ |
| 編集中 Esc | A → 矢印 drag → Escape | annotations.length=1、tool=select、矢印のみ |
| Cmd+Z 個別 | 確定後 Cmd+Z 連打 | 1 回目 length=1、2 回目 length=0 |
| 通常 T 回帰 | T → click → "Hi" → Enter | annotations.length=1、tool='**text**'(Auto-next 経路に巻き込まれない) |

### Edge Cases Checklist

- [x] 矢印長 0(MIN_DRAG_PIXELS=4 で弾かれる、handleMouseUp は dispatch しない)
- [x] 0 文字 Enter(既存 `handleTextCommit` の text==='' 経路で削除済)
- [x] Esc 中断(既存 `handleTextCancel` の空文字削除経路)
- [x] BS 文字削除(textarea 標準挙動 + `stopPropagation`)
- [x] 通常 text ツールへの影響(ref が立たないので tool=text 維持)
- [x] Yjs 多人数(矢印 add + text add の独立 transact、LOCAL_ORIGIN ラップ既存)
- [x] 画像端の外で text 生成(visible だが PNG export は画像内のみ rasterize、Phase 1 では非問題)
- [x] 連続 Auto-next(矢印 → text Enter → 別の矢印 → text Enter)— ref が単発 `true → false` で連続呼出にも対応

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
pnpm -F @snap-share/web test -- src/lib/__tests__/autoNextOffset.test.ts
```
EXPECT: 8 ケース全緑

### Full Unit Suite

```sh
pnpm -w test
```
EXPECT: 既存 218 件 + 新規 8 件 = 226 件全緑、回帰 0

### E2E

```sh
pnpm -F @snap-share/web test:e2e -- e2e/auto-next-arrow-text.spec.ts
```
EXPECT: 5 ケース全緑

### Full E2E Suite

```sh
pnpm -F @snap-share/web test:e2e
```
EXPECT: 既存 52 件 + 新規 5 件 = 57 件全緑、回帰 0

### Build

```sh
pnpm -w build
```
EXPECT: vite build (web) + wrangler dry-run (api) 両方緑

### Manual Validation

- [ ] `pnpm -F @snap-share/web dev` で起動 → 画像投入
- [ ] A キー → 矢印を drag → mouseup と同時に矢印終端付近に textarea が出る
- [ ] 1 文字以上打鍵 → Enter → text 確定、Toolbar で V(select)が active 表示に変わる
- [ ] A キー → 矢印 drag → 何も打鍵せず Enter → text 消失、矢印残る、tool=select
- [ ] A キー → 矢印 drag → Escape → text 消失、矢印残る、tool=select
- [ ] T キー → 通常の text 作成 → Enter → tool=**text のまま**(連続 text 作成可)
- [ ] Cmd+Z 連打 → text → 矢印 の順に巻き戻る(2 step)
- [ ] 矢印終端が画像端付近の場合に text が画像外でも崩れない目視

---

## Acceptance Criteria

- [ ] Task 1-7 の `IMPLEMENT` 全完了
- [ ] `pnpm -w typecheck` ゼロエラー
- [ ] `pnpm -w lint` クリーン
- [ ] 新規 unit test 8 ケース全緑
- [ ] 新規 E2E spec 5 ケース全緑
- [ ] 既存 unit + E2E 全緑(回帰 0)
- [ ] `pnpm -w build` 緑
- [ ] Manual Validation チェックリスト全完了
- [ ] PRD Phase 1 status が `in-progress` に更新済 + plan link 設定済

## Completion Checklist

- [ ] Auto-next-A 起動位置が `handleMouseUp` の `currentDraft.type === 'arrow'` 分岐内、既存 dispatch の直後
- [ ] text 注釈の生成は既存 `tool === 'text'` パターン(L207-222)の構造を踏襲
- [ ] `autoNextChainRef` は ref で管理(state ではない)
- [ ] tool=select 復帰は `handleTextCommit` と `handleTextCancel` の **両方** に追加
- [ ] 通常 text ツール経路(`onTextDoubleClick` / `text` ツール起因の `onStartTextEditing(id)`)では ref が立たない
- [ ] `__SNAP_SHARE_TOOL__` 命名は既存 `__SNAP_SHARE_*` 規約と整合
- [ ] Yjs mutation は既存 `annotation/add` 経路で `LOCAL_ORIGIN` ラップが効く
- [ ] HelpModal は **触らない**(Phase 5 でまとめて更新)
- [ ] PR タイトル / コミット message は日本語(CLAUDE.md communication-language ルール)、prefix は英語(`feat(phase-7.8-1):`)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `useReducer` の同期処理に違反する dispatch 順序 | L | M | 連続 4 dispatch(arrow add → text add → tool/set → select/set)が同 React event 内で安全に動く前例(Phase 7.7-2 色 UI、L233-242)を踏襲 |
| Auto-next で生成した text 座標が画像外に出る | L | L | Konva は画像外描画 OK、PNG export は image bbox のみ rasterize なので「画面では見えるが export には含まれない」現象は起こり得る → dogfood で再評価、Phase 1 では非問題として扱う |
| `autoNextChainRef.current` が同期リセットされず連続 Auto-next で異常 | L | M | ref は同 React event 内で同期更新可、commit/cancel どちらも `false` クリア後に setEditingTextId(null) するパターンで網羅 |
| 既存 text ツールの「連続 text 作成モード」を壊す | M | M | Task 5 で `onTextDoubleClick`(既存 text 編集経路)も `handleStartTextEditing(id)` 経由にすること、ただし options 省略で `autoNext=false` 扱い → ref が立たず tool 切替なし。Manual Validation チェックリストの「通常 T ツール → tool=text のまま」で確認 |
| E2E で `__SNAP_SHARE_TOOL__` が initial undefined のため flake | L | L | useEffect は初期 mount でも発火する(`store.state.tool` 初期値 'select' が即書き込まれる)、E2E は `dropImageBuffer` 後に poll するので mount 完了済み |
| Konva Stage event handler の type narrowing 失敗 | L | L | `currentDraft.type === 'arrow'` で TS 判別共用体 narrowing が効く、Phase 7.7-1 の Transformer 実装で同パターン実証済 |

## Notes

- **Phase 7.8-1 の心臓部は L300-308 の数行追加のみ**。Phase 7.7 の蓄積(text 即時編集 / TextEditorOverlay / handleTextCommit/Cancel / window expose)が完璧に Phase 7.8-1 の要件をカバーしているため、新規ロジックは「矢印 mouseup 直後に既存 text 即時編集を起動 + tool=select 復帰の ref」だけ
- **dogfood の hint**: AUTO_NEXT_TEXT_OFFSET_PX=8 は plan 段階の初期値。Phase 5 で実機 dogfood して 8/12/16 のどれが快適か再評価
- **Phase 2(B 矩形→矢印)への接続**: Phase 2 の Enter 確定経路は、矢印を `annotation/add` した後に **本 Phase で実装する Auto-next-A 経路** をそのまま呼び出す形になる(Phase 1 完了で Phase 2 の連鎖部分が再利用可能)
- **既存パターン踏襲度**: 100%。新概念ゼロ、新規ファイル 4(うち 3 つは test / lib 純関数)、既存ファイル更新 2 のみ
- **Confidence Score**: **9/10** — 単一パスでの実装可能性高。残り 1/10 のリスクは `autoNextChainRef` のリセットタイミングが Manual Validation で実機確認しきれず E2E 漏れが出る可能性(E2E の通常 T ツール回帰ケースでカバー済)
