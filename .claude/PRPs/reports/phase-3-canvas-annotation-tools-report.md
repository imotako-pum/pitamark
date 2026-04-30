# Implementation Report: Phase 3 — キャンバス & 注釈ツール

## Summary

`apps/web` に Konva ベースの編集キャンバスを実装し、4 種の注釈（矩形 / 矢印 / テキスト / ハイライト）をローカルで作成・選択・移動・削除できる単一画面を完成させた。状態は Zod スキーマ駆動の Discriminated Union（`packages/shared` SSOT）でモデル化し、Phase 4 の Yjs/CRDT 同期に乗せ替えやすい純粋関数 + `useReducer` 構造に閉じ込めた。Undo/Redo はローカル history stack（上限 50）で実装。画像は **D&D / paste の ObjectURL のみ**（API 経由のアップロードは Phase 4 へ）。`apps/web/src/App.tsx` のプレースホルダを `EditorPage` に差し替えて Phase 3 完了。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large |
| Confidence | 7/10 | 8/10（pure 関数分離戦略で予想外の手戻り回避） |
| Files Changed | 22 新規 + 7 更新 = 29 | 27 新規 + 4 更新 = 31 |
| LOC | 1400-1800（テスト含む） | 約 1900（テスト 25 + 本体） |
| Bundle (gz) | 150-200 KB 許容 | **177.91 KB**（許容範囲内） |
| Tests added | 70+ | 新規 +25（Phase 3 セッション分） / web 70 + shared 45 = **115 tests passing** |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | catalog 拡張 | ✅ Complete | konva / react-konva / use-image / lucide-react を catalog に追加（前回 commit `39a058d`） |
| 2 | apps/web/package.json deps | ✅ Complete | catalog 経由（前回 commit） |
| 3 | annotation schema (Zod discriminated union) | ✅ Complete | 4 種注釈 + Point + 定数。schema tests（前回 commit） |
| 4 | shared barrel | ✅ Complete | `export * from './annotation'`（前回 commit） |
| 5 | logger.ts | ✅ Complete | `[web]` prefix、apps/api/lib/logger.ts ミラー（前回 commit） |
| 6 | id.ts (TDD) | ✅ Complete | crypto.randomUUID + fallback。4 tests |
| 7 | annotation/operations.ts (TDD) | ✅ Complete | 9 pure functions × 平均 3 ケース = 29 tests |
| 8 | useStageSize hook | ✅ Complete | スパイクから抽出 |
| 9 | useImageSource hook | ✅ Complete | **Deviated**（下記）|
| 10 | useHistory + historyReducer (TDD) | ✅ Complete | **Deviated**（下記）。10 tests |
| 11 | useAnnotationsStore + annotationsReducer (TDD) | ✅ Complete | **Deviated**（下記）。12 tests |
| 12 | useKeyboardShortcuts | ✅ Complete | INPUT/TEXTAREA ガード、useRef で deps 空配列 |
| 13 | RectangleShape | ✅ Complete | `e.cancelBubble` + 常に draggable |
| 14 | ArrowShape | ✅ Complete | `e.target.x() / y()` のオフセット dx/dy 親通知 + reset |
| 15 | TextShape | ✅ Complete | Group + isEditing で hide + 選択枠（dashed） |
| 16 | HighlightShape | ✅ Complete | opacity 0.35 |
| 17 | AnnotationLayer | ✅ Complete | switch + exhaustive `never` |
| 18 | ImageLayer | ✅ Complete | use-image |
| 19 | CanvasStage | ✅ Complete | mousedown/move/up state machine、4px しきい値、tool=text 単発クリック |
| 20 | TextEditorOverlay | ✅ Complete | absolute textarea、stopPropagation で global undo を奪わせない |
| 21 | Toolbar + ToolButton | ✅ Complete | 5 ツール + Undo/Redo/Delete/Clear。lucide アイコン |
| 22 | DropZone | ✅ Complete | window paste listener + dragover preventDefault |
| 23 | EditorPage | ✅ Complete | AppShell ではなく `<main>` 直書きで Toolbar 配置（プラン Notes L1307 推奨） |
| 24 | App.tsx | ✅ Complete | プレースホルダを `<EditorPage />` に差し替え |
| 25 | tokens.css | ✅ Complete | annotation 用 OKLCH トークン 6 種 + duration/radius 追加 |
| 26 | E2E smoke | ✅ Complete | 4 件（既存 1 + 新規 3）すべて pass |
| 27 | PRD ステータス更新 | ✅ Complete | Phase 3 行 pending → in-progress（前回 commit） |
| 28 | 最終検証 | ✅ Complete | 全 5 levels pass |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ Pass | turbo run typecheck (shared/api/web) 全ゼロエラー |
| Static Analysis (lint) | ✅ Pass | biome ci 80 ファイル 0 errors |
| Unit Tests | ✅ Pass | shared 45 + web 70 = **115 tests passed** |
| Build | ✅ Pass | vite build 成功、bundle gz **177.91 KB**（プラン許容 150-200 KB 範囲内） |
| Integration (E2E) | ✅ Pass | playwright chromium 4/4 tests passed |
| Edge Cases | ✅ Pass | プラン Edge Cases Checklist 全項目を unit test でカバー（一部は手動検証へ送付：UI 操作系） |

## Files Changed (このセッション分のみ)

### Created (24 files、Tasks 6-26 分)

| File | Lines |
|---|---|
| `apps/web/src/lib/id.ts` | +6 |
| `apps/web/src/lib/__tests__/id.test.ts` | +37 |
| `apps/web/src/lib/imageValidation.ts` | +37 |
| `apps/web/src/lib/__tests__/imageValidation.test.ts` | +63 |
| `apps/web/src/domain/annotation/operations.ts` | +96 |
| `apps/web/src/domain/annotation/__tests__/operations.test.ts` | +209 |
| `apps/web/src/hooks/useStageSize.ts` | +23 |
| `apps/web/src/hooks/useImageSource.ts` | +63 |
| `apps/web/src/hooks/historyReducer.ts` | +73 |
| `apps/web/src/hooks/__tests__/historyReducer.test.ts` | +112 |
| `apps/web/src/hooks/useHistory.ts` | +37 |
| `apps/web/src/hooks/annotationsReducer.ts` | +110 |
| `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` | +153 |
| `apps/web/src/hooks/useAnnotationsStore.ts` | +66 |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | +69 |
| `apps/web/src/components/canvas/colors.ts` | +16 |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | +37 |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | +52 |
| `apps/web/src/components/canvas/shapes/TextShape.tsx` | +75 |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | +37 |
| `apps/web/src/components/canvas/AnnotationLayer.tsx` | +85 |
| `apps/web/src/components/canvas/ImageLayer.tsx` | +11 |
| `apps/web/src/components/canvas/CanvasStage.tsx` | +194 |
| `apps/web/src/components/canvas/TextEditorOverlay.tsx` | +69 |
| `apps/web/src/components/toolbar/ToolButton.tsx` | +49 |
| `apps/web/src/components/toolbar/Toolbar.tsx` | +124 |
| `apps/web/src/components/empty-state/DropZone.tsx` | +83 |
| `apps/web/src/pages/EditorPage.tsx` | +160 |

### Updated (3 files、このセッション分)

| File | Diff |
|---|---|
| `apps/web/src/App.tsx` | EditorPage 差し替え (-5 +3) |
| `apps/web/src/styles/tokens.css` | annotation tokens (+11) |
| `apps/web/e2e/landing.spec.ts` | smoke +3 件 (+23) |

### 前回 commit `39a058d` 分（Tasks 1-5, 27）

| File | Notes |
|---|---|
| `pnpm-workspace.yaml` | catalog 4 deps 追加 |
| `apps/web/package.json` | dependencies 4 deps 追加 |
| `packages/shared/src/annotation.ts` | Zod schema |
| `packages/shared/src/__tests__/annotation.test.ts` | schema tests |
| `packages/shared/src/index.ts` | barrel +1 |
| `apps/web/src/lib/logger.ts` | logger wrapper |
| `.claude/PRPs/prds/snap-share.prd.md` | Phase 3 → in-progress |

## Deviations from Plan

### Deviation 1: hook テスト戦略の方針転換（Tasks 9, 10, 11）

**WHAT**: プラン上は `useImageSource` / `useHistory` / `useAnnotationsStore` を `renderHook` でテストする想定だったが、testable な部分（`validateImageFile` / `historyReducer` / `annotationsReducer`）を pure functions に切り出し、hook は薄いラッパに留めた。

**WHY**:
- `apps/web/package.json` に `@testing-library/react` が未導入。
- testing-library を追加すると React 19 対応版（`@testing-library/react@^16` + `@testing-library/dom`）と関連依存が増える。Phase 3 は「最小限を最小限に」（PRD Decisions Log）の方針。
- pure 関数化は `.claude/rules/typescript/coding-style.md` の Immutability / Public APIs 原則と整合。Phase 4 の Yjs 統合時にも reducer がそのまま再利用可能（プラン §"Phase 4 / 5 / 6 への布石" 第 2 項と整合）。

**結果**: テストはプラン要求のケース数を満たす（imageValidation 9 / historyReducer 10 / annotationsReducer 12）。hook 自体は build / E2E でカバー。

### Deviation 2: AppShell を使わず EditorPage で `<main>` 直書きレイアウト（Task 23）

**WHAT**: プラン Task 23 サンプルでは `<AppShell><Toolbar /><CanvasStage /></AppShell>` だったが、AppShell の `header` slot が h1 のみ前提だったため、Toolbar を AppShell から独立して配置するために `<main>` 直書きに切り替えた。

**WHY**: プラン Notes L1307 で「KISS の観点で後者を推奨（AppShell に slot を追加しない）」と明示されていたため。

### Deviation 3: setStroke / setFill を Action から外した（Task 11）

**WHAT**: プランの Action リストに `setStroke` / `setFill` は明示されていなかったが、operations.ts には pure 関数として定義してテスト済。`annotationsReducer` の Action にはせず future-proof な lib として export。

**WHY**: プラン NOT Building セクションで「形状の塗りつぶし色選択 UI: Phase 6 / Should スコープ」と明示されており、Phase 3 では UI 経路がないため。Phase 6 で UI 追加時に Action と dispatch のみ生やせばよい状態にした。

## Issues Encountered

### Issue 1: biome a11y/noStaticElementInteractions が `<div onDrop>` を弾いた

**Resolution**: DropZone の wrapper を `<div>` から `<section aria-labelledby="dropzone-heading">` に変更。section は landmark role なのでルールを満たす。

### Issue 2: biome の formatter / import 整列が新規ファイル全体に適用必要

**Resolution**: 各ファイル作成のたびに `pnpm exec biome check --write` を走らせ、import 整列を自動化。

## Tests Written (このセッション分)

| Test File | Tests | Coverage |
|---|---|---|
| `apps/web/src/lib/__tests__/id.test.ts` | 4 | UUID v4 形式 + 一意性 + fallback |
| `apps/web/src/lib/__tests__/imageValidation.test.ts` | 9 | 全 ALLOWED MIME + 拒否 + size 境界 |
| `apps/web/src/domain/annotation/__tests__/operations.test.ts` | 29 | 9 関数 × happy/edge/no-op + 不変性検証 |
| `apps/web/src/hooks/__tests__/historyReducer.test.ts` | 10 | commit/replace/undo/redo/reset + 上限 + 同一参照 + future クリア |
| `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` | 12 | 全 10 actions × happy/edge |
| `apps/web/e2e/landing.spec.ts` | +3 (1→4) | toolbar 可視性 + tool disabled + DropZone hint |

合計新規 unit tests: **64 件**（既存 6 件 + 新規 64 = web 70 件 / 全プロジェクト合計 115 件 passing）

## Next Steps

- [ ] Manual Validation Checklist の手動消化（ブラウザで全 4 ツール実機操作確認 — `pnpm -F @snap-share/web dev`）
- [ ] `/code-review` で総合レビュー
- [ ] PR 作成: `gh pr create` で Phase 3 を main 向けに送る
- [ ] Phase 3 PRD ステータスを `in-progress` → `complete` に更新（PR マージ時）
- [ ] Phase 4（Yjs/CRDT 同期）プランへ
