# Local Code Review: Phase 8 — 将来拡張性 (#7)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: 新規 annotation 種を追加するときの touch surface / discriminated union exhaustiveness の機能性 / 新規 API endpoint 追加時の boilerplate / Yjs migration 想定 / CLAUDE.md design rule 1〜8 の将来維持容易性
**Decision**: NEEDS_FIX
  - MEDIUM 1 件: 新規 annotation 種追加時の touch surface が **13 production files + tests = ~20 ファイル** に分散し、Phase 7.7-1 / 7.8-3 の実績からも 1 種追加で 200-400 LOC の drift が発生している
  - HIGH / CRITICAL なし

## Summary

`AnnotationSchema` discriminated union ベースの設計と `const _exhaustive: never = a` パターンは **正しく機能している**: 新しい annotation 種を `packages/shared/src/annotation.ts` に追加すると、TypeScript が **5 つの switch 文で必ずコンパイルエラーを叩き出す** (`annotationsReducer.ts:142` / `AnnotationLayer.tsx:81` / `operations.ts:36, 111` / `yjs-codec.ts:42`)。これは「忘れて壊す」リスクを構造的に潰しており、拡張性の中核として極めて健全。

ただし、**1 種追加するために触る "場所" の物理的な数が多い** (production 13 ファイル + tests ~6 ファイル = ~19-20 ファイル、~200-400 LOC)。Phase 7.7-1 (resize)、Phase 7.8-2 (Auto-next-B)、Phase 7.8-3 (font size) の実績から見ても **1 機能追加で 15-25 ファイル touched** が定常化している。これは "exhaustiveness が機能しているからこそ全箇所にコンパイルエラーが出て触らざるを得ない" 状態であり、安全だが摩擦が大きい。新規 API endpoint の追加 boilerplate (`createRoute` + handler + middleware + responses + test) は 1 endpoint あたり ~50-80 LOC で、Hono+zod-openapi のフレームワーク制約に由来し縮減余地は限定的。Yjs migration は現在 schema 変更=Y.Doc サーバー側の永続化が無いため低コスト、ただし Phase 6 以降で永続化が入ると **`yjs-codec.yMapToAnnotation` の `AnnotationSchema.safeParse` が migration の単一防壁** になる構造に依存する。

件数: CRITICAL 0 / HIGH 0 / MEDIUM 1 / LOW 4。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

**M1: 新規 annotation 種を追加するときの touch surface が 13 production ファイル + ~6 tests = 約 20 ファイルに分散している**

- **Location**: 横断的(下記すべて)
  - `packages/shared/src/annotation.ts:3` (`ANNOTATION_TYPES` 配列)
  - `packages/shared/src/annotation.ts:79-84` (`AnnotationSchema` discriminated union)
  - `apps/web/src/domain/annotation/operations.ts:23-40` (`moveAnnotation` switch)
  - `apps/web/src/domain/annotation/operations.ts:100-115` (`setColor` switch)
  - `apps/web/src/domain/annotation/yjs-codec.ts:9-46` (`annotationToYMap` switch)
  - `apps/web/src/domain/annotation/yjs-codec.ts:49-101` (`yMapToAnnotation` else-if chain — switch でなく if-else で **exhaustiveness が型で検査されない**)
  - `apps/web/src/domain/annotation/yjs-mutations.ts` (種別固有の mutator 群、resize 系 / arrow endpoints / set-text / set-font-size 等)
  - `apps/web/src/hooks/annotationsReducer.ts:34-61` (`AnnotationsAction` union — 種別固有のアクションがあれば追加)
  - `apps/web/src/hooks/annotationsReducer.ts:75-145` (reducer switch)
  - `apps/web/src/hooks/annotationsReducer.ts:148-158` (`COMMITTING_ACTIONS` リスト — 漏れても型チェックされない平文 array)
  - `apps/web/src/hooks/yjs-annotations-context.ts:70-130` (`applyDataAction` switch)
  - `apps/web/src/components/canvas/AnnotationLayer.tsx:32-86` (shape dispatcher switch)
  - `apps/web/src/components/canvas/shapes/<NewShape>.tsx` (新規シェイプコンポーネント)
  - `apps/web/src/components/canvas/CanvasStage.tsx:61-102` (`buildDraft<X>`)
  - `apps/web/src/components/canvas/CanvasStage.tsx:189-298` (`handleMouseDown` の `tool === 'text'` 等の分岐 + `handleMouseMove` の draft 構築)
  - `apps/web/src/components/toolbar/Toolbar.tsx:48-54` (`TOOL_DEFS` + lucide icon import)
  - `apps/web/src/hooks/useKeyboardShortcuts.ts:38-44` (`TOOL_KEY_MAP`)
  - `apps/web/src/components/dialogs/HelpModal.tsx` (`TOOL_ROWS`)
  - tests: `operations.test.ts` / `yjs-codec.test.ts` / `yjs-mutations.test.ts` / `annotationsReducer.test.ts` / `yjs-annotations-context.test.ts` / `AnnotationLayer` 系 / E2E

- **Issue**: discriminated union exhaustiveness は **5 つの switch で機能している** が、それ以外の touch site (合計 ~13-15) は型 enforcement が無いか弱い:
  1. **`yjs-codec.ts:49-98` `yMapToAnnotation` は if-else chain** — `else` 分岐で `return null` するため、新種を追加して if 節を書き忘れても **TypeScript はコンパイルエラーを出さない**。実害は「新種の Y.Map が runtime で `safeParse` 失敗 → null 返却 → サイレントに表示されない」であり、production で気付きにくい。
  2. **`COMMITTING_ACTIONS` (annotationsReducer.ts:148)** は `ReadonlyArray<AnnotationsAction['type']>` 型だが、新規 action type を **足し忘れても型チェックは通る**。漏れると history に積まれず undo/redo が壊れる。
  3. **`TOOL_KEY_MAP` (useKeyboardShortcuts.ts:38)** は `Record<string, Tool>` で網羅性 enforcement が無い。新 tool を `TOOLS` に足してもキーマッピングを足し忘れる可能性あり。
  4. **`TOOL_DEFS` (Toolbar.tsx:48)** / **`TOOL_ROWS` (HelpModal.tsx)** も同型。Toolbar / HelpModal の表示漏れは UX 退化を招く。
  5. **`CanvasStage.handleMouseDown` の draft 分岐** (`tool === 'text'` の特殊ケース + `tool === 'rectangle' / 'highlight' / 'arrow'` の `buildDraft<X>` 分岐) は文字列比較で散らかっており、新 tool を追加すると mouse 系 handler 3 箇所で touch が必要。

- **Repro (思考実験: `'ellipse'` を追加するシナリオ)**:
  1. `packages/shared/src/annotation.ts` に `EllipseAnnotationSchema` を定義し discriminated union に追加 → **5 ファイル** (`operations.ts` × 2 switch / `yjs-codec.annotationToYMap` / `annotationsReducer.ts` (新 action 不要なら 0、必要なら +switch case) / `AnnotationLayer.tsx`) でコンパイルエラーが出る → 修正
  2. `yjs-codec.yMapToAnnotation` に `else if (type === 'ellipse')` を **手動で追加** (型チェック助けなし)
  3. `yjs-mutations.ts` に種別固有の mutator (ellipse は rectangle と同型なので resize は流用可能だが、種別ごとの no-op guard `m.get('type') !== 'ellipse'` が必要)
  4. `EllipseShape.tsx` を新規作成 (RectangleShape をコピペ → 90% 流用)
  5. `CanvasStage` の `buildDraftEllipse` + `handleMouseMove` 分岐 + `useCallback` deps 更新
  6. `Toolbar.TOOL_DEFS` / `useKeyboardShortcuts.TOOL_KEY_MAP` / `HelpModal.TOOL_ROWS` を **手で同期** (型 enforcement なし)
  7. 既存テスト ~6 ファイルに ellipse ケース追加 / 新規 `EllipseShape.test.tsx` / E2E
  8. 結果: production 13 ファイル + テスト ~6 ファイル = 約 19-20 ファイル変更、~200-400 LOC 追加

  実績検証として Phase 7.8-3 のレビュー (`reviews/phase-7.8-3-font-size-ui-review.md` "Files Reviewed" 表) は **font size という annotation 種の追加ですらない単機能** で 23 ファイル変更している。1 種の annotation 追加であれば 25-30 ファイル touched が現実的見積もり。

- **Suggested Fix** (大きく 3 案):

  **案 A: yMapToAnnotation を switch + exhaustive never に書き換える** (低コスト、即時)
  ```typescript
  // yjs-codec.ts:49
  export const yMapToAnnotation = (m: Y.Map<unknown>): Annotation | null => {
    const type = m.get('type') as AnnotationKind | undefined;
    if (type === undefined) return null;
    let candidate: unknown;
    switch (type) {
      case 'rectangle': /* ... */ break;
      case 'arrow': /* ... */ break;
      case 'text': /* ... */ break;
      case 'highlight': /* ... */ break;
      default: {
        const _: never = type;
        return _;
      }
    }
    return AnnotationSchema.safeParse(candidate).success ? /* ... */ : null;
  };
  ```
  → 5 つ目の compile-time guard を追加。runtime の `safeParse` も維持されるので Yjs migration 安全網は維持。

  **案 B: TOOL ↔ AnnotationKind の対応と TOOL_DEFS / TOOL_KEY_MAP / TOOL_ROWS を `Record<Tool, ...>` 型で強制** (中コスト)
  ```typescript
  // Toolbar.tsx
  const TOOL_DEFS: Readonly<Record<Tool, ToolDef>> = {
    select: { ... },
    rectangle: { ... },
    /* ... */
  };
  ```
  → 新 tool 追加時に Record に key 追加が **型強制** される。HelpModal / useKeyboardShortcuts も同型化。`Object.values(TOOL_DEFS)` で配列 iteration 維持。

  **案 C: `COMMITTING_ACTIONS` を switch 経由で導出** (低コスト)
  ```typescript
  // annotationsReducer.ts
  export const isCommittingAction = (action: AnnotationsAction): boolean => {
    switch (action.type) {
      case 'tool/set':
      case 'select/set':
      case 'active-color/set':
      case 'active-font-size/set':
        return false;
      case 'annotation/add':
      case 'annotation/remove':
      /* ... 残り全部 */
        return true;
      default: {
        const _: never = action;
        return _;
      }
    }
  };
  ```
  → 新規 action 追加時にこの switch も exhaustiveness で叩かれる。配列ベースの「足し忘れ」が型レベルで不可能になる。

  3 案合計でも **修正規模は 80-150 LOC**、touch site は変わらないが **「忘れたら気付かない」場所が `~5 → ~1` に減る** ため拡張性が大幅向上。

- **Severity**: MEDIUM — production を壊す現存バグではないが、**「新 annotation 種の追加」は次の Phase で起こり得るユースケース** (circle / freehand / arrow-双方向 等) であり、CLAUDE.md design rule 1 が前提とする exhaustiveness の網が **3-4 箇所抜け** ている。Phase 8.x で着手する価値あり。

### LOW

**L1: API ルート追加時の boilerplate が 1 endpoint = 約 50-80 LOC**
- **Location**: `apps/api/src/routes/rooms.ts:62-249` の 3 つの `createRoute` + 3 つの `.openapi(...)` chain
- **Issue**: 新規 endpoint 追加には (1) `createRoute({ method, path, tags, middleware, request, responses })` の OpenAPI スキーマ 30-50 行 + (2) handler 関数 15-30 行 + (3) `.openapi()` chain での hook (error envelope mapping) + (4) test。**zod-openapi の `.openapi()` chain は型推論を維持するために必要悪** であり、Hono BP 観点での縮減余地はほぼ無い。`buildRoomService` / `buildPasswordService` / `buildTokenService` のような service factory パターンは健全。1 endpoint = 50-80 LOC は他の Hono+zod-openapi プロジェクトと同等、許容範囲。
- **Suggested Fix**: 不要 (framework-bound)。ただし 5 endpoint 超の急増があれば `lib/createCrudRoute.ts` のような macro 化を再検討。
- **Human Friction**: false
  - 改修時必読: yes — `routes/rooms.ts` は Hono の中核ファイル、新 endpoint 追加で必ず読む
  - 再発生コスト: low — boilerplate は手で書くが 1 ファイル内で完結、自動化で潰せる類ではない
  - 認知負荷増: no — `.openapi()` chain の理由がコメント (`rooms.ts:170-174`) で明示されている

**L2: Yjs persistence が無い現状では migration コストはゼロだが、`yMapToAnnotation` の `safeParse` が migration の単一防壁になっている**
- **Location**: `apps/web/src/domain/annotation/yjs-codec.ts:99-100`
- **Issue**: 現状 Y.Doc は ephemeral (WebSocket 切断で消える) のため schema migration 概念は不要。ただし将来的に R2 / KV / Durable Objects 永続化を入れた場合、**過去フォーマットの Y.Map を読み戻す際の唯一の防壁が `AnnotationSchema.safeParse` で null 返却** する仕組みになる。サイレントに drop されるため、ユーザーの古い annotation が「無くなる」事故が起き得る。migration 戦略 (e.g., `version` フィールドを Y.Map に持たせる / fallback parser を `safeParse` 失敗時に呼ぶ) が **構造として未準備**。
- **Suggested Fix**: 永続化の Phase に入る前に以下のいずれかを採用:
  1. Y.Map に `version: number` フィールドを足し、`yMapToAnnotation` で version スイッチ
  2. `AnnotationSchema` の前段に「過去スキーマからのアダプタ」レイヤを差し込む shape を整備
  3. `safeParse` 失敗時に warning ログ + DLQ 的な retain logic を組む
- **Human Friction**: false
  - 改修時必読: no — Yjs 永続化を入れる Phase まで触らない
  - 再発生コスト: high — 永続化を入れた後に対策しようとすると User データに対する後方互換 migration になり工数高
  - 認知負荷増: no — 現状コードは何も悪くない、将来要件のための準備の話
  - **判定**: 2 軸 yes/high → 本来 true 寄りだが、改修時必読=no が強く効くので false。永続化の Plan で個別に扱う前提

**L3: `CanvasStage` の `tool === 'text'` 特殊分岐 + `buildDraft<X>` の文字列分岐が 3 箇所に散在**
- **Location**: `apps/web/src/components/canvas/CanvasStage.tsx:229-244` (text の特殊ケース) / `:295-298` (`buildDraftRectangle/Highlight/Arrow` への 3 分岐)
- **Issue**: 新 tool を追加するとき、(1) `handleMouseDown` で text のような特殊ケース有無の判断、(2) `handleMouseMove` の `else if` chain に 1 行追加、(3) `useCallback` deps、(4) `buildDraft<X>` 関数を新規作成 — の 4 箇所に手を入れる必要がある。`tool` の文字列比較で網羅性が型強制されない。
- **Suggested Fix**: `Record<Exclude<Tool, 'select' | 'text'>, (start, x, y, color) => Annotation>` 型の draft factory map を作って `handleMouseMove` を `factories[tool]?.(...)` に簡素化。text の特殊ケースは別 helper に切り出し。
- **Human Friction**: true
  - 改修時必読: yes — `CanvasStage.tsx` (537 LOC) は新 tool 追加時に必ず読む中核ファイル
  - 再発生コスト: med — 1 ファイル内の局所修正だが draft 系は 3 箇所同時に直す必要
  - 認知負荷増: yes — 「text だけなぜ別扱いか」が現状コメントだけでは新規参加者に分かりにくい (`text` は drag 不要 = mousedown でその場確定 という暗黙ルール)
  - **判定**: 3 軸とも yes/med 以上 → true、Phase 8.x 候補

**L4: `ANNOTATION_TYPES` 配列と `Tool` ユニオン (`select` を含む) の関係が手動同期**
- **Location**: `packages/shared/src/annotation.ts:3` (`ANNOTATION_TYPES`) と `apps/web/src/hooks/annotationsReducer.ts:15` (`TOOLS`)
- **Issue**: `ANNOTATION_TYPES = ['rectangle', 'arrow', 'text', 'highlight']` と `TOOLS = ['select', 'rectangle', 'arrow', 'text', 'highlight']` の関係は「`Tool = 'select' | AnnotationKind`」だが、shared 側は AnnotationKind だけ exposed していて web 側が `'select'` を独自に prepend している。**両方を手動メンテナンスしている** ので、新 annotation 種を shared に足したら web 側 `TOOLS` も手で追記する必要があり、忘れると型は通るが UI から選べない。
- **Suggested Fix**: `apps/web/src/hooks/annotationsReducer.ts` で `export const TOOLS = ['select', ...ANNOTATION_TYPES] as const;` のように import + spread して導出。
- **Human Friction**: false
  - 改修時必読: yes — 新 annotation 種追加時に必ず touch
  - 再発生コスト: low — 1 行の置換、自動 lint で潰せる
  - 認知負荷増: no — 文脈から自明、コメントで補足可能

## Resolution Update

### Phase 8.x branch `fix/phase-8-x-fixes` (commit 8: extensibility friction reduction)

| Finding | Resolution | Files touched |
|---|---|---|
| **M1** 案 A: `yMapToAnnotation` if-else | switch + `const _exhaustive: never = type` で網羅性をコンパイル時 enforce。Annotation union 拡張時に case 漏れがエラー化。runtime safeParse は維持 | `apps/web/src/domain/annotation/yjs-codec.ts` |
| **M1** 案 B: `TOOL_DEFS` / `TOOL_KEY_MAP` / `TOOL_ROWS` 配列 | `Readonly<Record<Tool, ToolDef>>` / `Readonly<Record<Tool, string>>` + 逆引き Map / `Readonly<Record<Tool, Row>>` 化。新 `Tool` 追加で key 漏れがコンパイル時エラー化。iteration 順序は `TOOLS` (= `['select', ...ANNOTATION_TYPES]`) に従う | `apps/web/src/components/toolbar/Toolbar.tsx` / `apps/web/src/hooks/useKeyboardShortcuts.ts` / `apps/web/src/components/dialogs/HelpModal.tsx` |
| **M1** 案 C: `COMMITTING_ACTIONS` 配列 | `isCommittingAction(action)` を switch + never で導出、配列定数撤去。新 action variant 追加で「committing or UI-only」をここで明示する必要が出る | `apps/web/src/hooks/annotationsReducer.ts` |
| **L3** CanvasStage `tool === 'text'` 特殊分岐 + else if chain | `DRAFT_BUILDERS: Readonly<Record<Exclude<Tool, 'select' \| 'text'>, DraftBuilder>>` で drag-based tool を集約。`select` (drag なし) と `text` (mousedown 確定) は型レベルで除外。新 drag-based tool 追加で Record 漏れがエラー化 | `apps/web/src/components/canvas/CanvasStage.tsx` |
| **L4** `ANNOTATION_TYPES ↔ TOOLS` 手動同期 | `TOOLS = ['select', ...ANNOTATION_TYPES] as const` で `packages/shared` から導出、手動 sync 撤廃 | `apps/web/src/hooks/annotationsReducer.ts` |
| L1 / L2 (HF=false) | Backlog (Phase 9 後) | — |

これにより、新 annotation 種を `ANNOTATION_TYPES` に追加すると以下の **5 箇所すべて** がコンパイル時エラーで「触るべき場所」を教えてくれる構造になった: `yMapToAnnotation` switch / `TOOL_DEFS` / `TOOL_KEYS` / `TOOL_ROW_BY_TOOL` / `DRAFT_BUILDERS` (drag-based なら) + `applyDataAction` switch (既に exhaustive)。「忘れたら気付かない場所」5 → 0。

(Phase 8.x で M1 / L3 を fix する Plan が立った時点で更新)

---
*Generated: 2026-05-04*
*Reviewer: everything-claude-code:architect agent*
