# Implementation Report: Phase 7.7-1 注釈リサイズ

## Summary
Konva.Transformer を **rectangle / highlight** に統合(8 ハンドル + Shift 比率固定 + Alt 中心基点が Konva デフォルトで自動対応)、**arrow** には from/to の 2 端点 Circle ハンドルを実装した。reducer / Yjs mutation / Yjs⇔reducer 橋は既に存在していたため、本フェーズの主体は (1) UI 配線(Shape ↔ AnnotationLayer ↔ CanvasStage)、(2) reducer / mutation のシグネチャに `x/y` を追加して Transformer ドラッグ中の位置追従を可能にすること、(3) 単体 + E2E テストの整備であった。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium(予測通り) |
| Confidence | 8/10 | 9/10(想定外の問題なし) |
| Files Changed (UPDATE) | 6 | 14(reducer/operations/Yjs シグネチャ拡張で既存テスト 4 ファイルも更新) |
| Files Changed (CREATE) | 4 | 4(Rect/Highlight/Arrow テスト + E2E spec) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | RectangleShape に Konva Transformer 統合 | Complete | useRef + useEffect + onTransformEnd + boundBoxFunc |
| 2 | HighlightShape に Konva Transformer 統合 | Complete | RectangleShape と同パターン |
| 3 | ArrowShape に from/to 端点 Circle 追加 | Complete | cancelBubble で Arrow draggable と event 競合回避 |
| 4 | colors.ts に HANDLE_FILL/RADIUS/STROKE_WIDTH/MIN_RESIZE_SIZE 追加 | Complete | 4 定数を追加(plan は 1 定数想定だったが関連定数を集約) |
| 5 | AnnotationLayer に新コールバック追加 | Complete | onResizeRectangle / onResizeHighlight / onArrowEndpoints の 3 props |
| 6 | CanvasStage に dispatch ラッパー追加 | Complete | useCallback 3 個追加 |
| 7 | Reducer / Yjs mutation シグネチャ拡張 | Complete | resize-rect / resize-highlight に x/y 追加。既存テスト 4 ファイル同時更新 |
| 8 | Shape 単体テスト 3 ファイル作成 | Complete | Rect 5 / Highlight 3 / Arrow 5 テスト |
| 9 | E2E テスト追加 | Complete | annotation-resize.spec.ts に 3 chromium テスト |
| 10 | 全体検証 | Complete | typecheck / lint / test / E2E / build 全緑 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | Pass | turbo 4 タスク全緑(api / web / shared) |
| Lint (biome ci) | Pass | `biome check --write .` で import order 6 件自動修正後、再検証クリーン |
| Unit Tests | Pass | web 23 ファイル / 168 テスト全緑(新規 13 テスト追加) |
| Build | Pass | vite build 成功 / wrangler dry-run 成功 |
| E2E (新規) | Pass | annotation-resize.spec.ts 3 chromium テスト緑 |
| E2E (regression) | Pass | 35 chromium テスト全緑(mobile-chrome 25 件は既存通り skip) |

## Files Changed

| File | Action | 概要 |
|---|---|---|
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | UPDATED | Transformer 追加 + onTransformEnd + onResize prop(+97行) |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | UPDATED | 同上(+95 行) |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | UPDATED | from/to Circle 端点ハンドル + onArrowEndpoints prop(+97 行) |
| `apps/web/src/components/canvas/AnnotationLayer.tsx` | UPDATED | 3 新コールバック props 追加 + 各 Shape へ流入(+15 行) |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATED | 3 useCallback dispatch ラッパー追加(+45 行) |
| `apps/web/src/components/canvas/colors.ts` | UPDATED | HANDLE_FILL / HANDLE_RADIUS / HANDLE_STROKE_WIDTH / MIN_RESIZE_SIZE 追加(+9 行) |
| `apps/web/src/domain/annotation/operations.ts` | UPDATED | resizeRectangle / resizeHighlight に x/y 引数追加 |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | UPDATED | resizeRectangleY / resizeHighlightY に x/y 引数追加 |
| `apps/web/src/hooks/annotationsReducer.ts` | UPDATED | resize-rect / resize-highlight action 型に x/y 追加 |
| `apps/web/src/hooks/yjs-annotations-context.ts` | UPDATED | applyDataAction の resize 系 case を新シグネチャに合わせる |
| `apps/web/src/domain/annotation/__tests__/operations.test.ts` | UPDATED | resize テストを x/y 込みで再記述 |
| `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` | UPDATED | 同上 |
| `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` | UPDATED | 同上 |
| `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` | UPDATED | 同上 |
| `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx` | CREATED | 5 テスト(Transformer attach/detach、boundBoxFunc、onResize 計算) |
| `apps/web/src/components/canvas/__tests__/HighlightShape.test.tsx` | CREATED | 3 テスト(Transformer attach/detach、onResize 計算) |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | CREATED | 5 テスト(Circle 表示、from/to ドラッグ、cancelBubble) |
| `apps/web/e2e/annotation-resize.spec.ts` | CREATED | 3 E2E(矩形・ハイライト・矢印リサイズ) |

## Deviations from Plan

1. **`MIN_RESIZE_SIZE` を colors.ts に集約** — plan では「Task 1 のローカル定数 `MIN_SIZE = 5`」想定だったが、boundBoxFunc から触る + 将来のテストでも参照するため、`colors.ts` に他のハンドル定数(HANDLE_FILL/RADIUS/STROKE_WIDTH)と同じく集約。プロジェクトの「定数は colors.ts に hex literal で集約」規約(CLAUDE.md ルール 4)とも整合。
2. **`ignoreStroke` を Transformer に追加** — plan 未記載。Konva.Transformer のデフォルトでは selected stroke ぶんバウンディングボックスが膨らみハンドルがズレるため、stroke を含めない指定を追加(react-konva 公式の慣例)。
3. **Shape の `forwardRef` モック方式を `vi.hoisted` で実装** — plan の TEST_STRUCTURE_UNIT 例は単純な `vi.mock` パターンだったが、ref の useImperativeHandle で stub object を露出する必要があったため、`vi.hoisted` で capture オブジェクトを共有する形に発展。
4. **Biome の自動 import 並び替え** — `biome check --write` で 6 ファイル自動修正(`type` 直前 import の並び替えなど)。コード意味は変わらず。

## Issues Encountered

1. **既存スキーマの楕円・直線が無いことに plan 段階で気付き、PRD/plan を訂正済** — 実装着手前に発覚し scope を「既存 4 種(rect/highlight/arrow/text)のうち resize 対象 3 種」に絞ったため、実装時にブロッカーなし。テキストは fontSize ベースで Phase 7.7 スコープ外。
2. **reducer/mutation シグネチャ拡張で既存テスト 4 ファイル更新が必要** — plan の Risk #2 で予測済。同 PR で全更新し、回帰なし。
3. **vitest run コマンドがパス引数を受け付けない**(turbo 経由 `pnpm test -- src/foo` は全テスト実行)— 検証は `pnpm vitest run <path>` で直接実行。実装フローには影響なし。

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx` | 5 | Transformer attach/detach、rotate/flip 無効、boundBoxFunc 最小サイズ、onResize 計算 |
| `apps/web/src/components/canvas/__tests__/HighlightShape.test.tsx` | 3 | Transformer attach/detach、onResize 計算 |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | 5 | Circle 表示有無、from/to drag → onArrowEndpoints、cancelBubble |
| `apps/web/e2e/annotation-resize.spec.ts` | 3(chromium) | 矩形 / ハイライト / 矢印 to 端点 のリサイズが store snapshot に反映 |

## Acceptance Criteria

- [x] 矩形 / ハイライトに Konva Transformer 8 ハンドル(Shift/Alt 自動対応)
- [x] 矢印に from/to の 2 端点 Circle ハンドル
- [x] リサイズ操作が Yjs 経由で他クライアントに同期(既存 mutation 流用、既存 room-share E2E が緑のため経路保全)
- [x] Undo/Redo がリサイズも対象(COMMITTING_ACTIONS に既登録、reducer 経路は変更なし)
- [x] テキスト注釈の挙動は変更なし(annotation-tools E2E が緑)
- [x] 単体テスト 3 ファイル + E2E 1 ファイル追加
- [x] 全 validation コマンド緑

## Next Steps
- [ ] `/code-review` で実装内容のレビュー
- [ ] `/prp-pr` で PR 作成(または手動 commit + push)
- [ ] PRD Phase 1 status を `in-progress` → `complete` に更新
- [ ] Phase 2 (A2 色変更 UI + Schema 拡張) の plan 作成

---
*Generated: 2026-05-03*
*Branch: feat/phase-7.7-1-annotation-resize*
