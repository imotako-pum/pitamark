# Implementation Report: Phase 7.7-2 色変更 UI + Schema 拡張

## Summary
全 4 種注釈(矩形/矢印/テキスト/ハイライト)で `stroke` / `fill` フィールドを `color` に統一(未リリースのためマイグレーション不要)。Toolbar に 7 色固定パレット + 「新規デフォルトに設定」「選択中の注釈に適用」の 2 ボタンを追加。デフォルトは sync(矩形/矢印/テキスト)= 赤、highlight = 黄(独立)。reducer に `default-color/set-sync` / `default-color/set-highlight` / `annotation/set-color` の 3 actions を追加し、`annotation/set-color` だけが Yjs に persist + Undo 対象、`default-color/*` は UI-only。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large(予測通り) |
| Confidence | 7/10 | 9/10(plan の段階的順序で grep 漏れなし) |
| Files Changed | 12 UPDATE / 3 CREATE | 19 UPDATE / 4 CREATE(useYjsAnnotationsStore + 既存 E2E 2 件 + ColorPalette テストディレクトリ) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | shared スキーマで stroke/fill → color に統一 | Complete | |
| 2 | shared テスト fixture を color に | Complete | 「rejects malformed stroke color」を「rejects malformed color」にリネーム |
| 3 | yjs-codec のキー名を color に統一 | Complete | annotationToYMap / yMapToAnnotation 両方 |
| 4 | setAnnotationColorY mutation 追加 | Complete | 全タイプ共通(type guard 不要) |
| 5 | yjs-mutations / yjs-codec テストを color に更新 | Complete | yjs-codec テストの fixture 漏れを発見して同時更新 |
| 6 | operations で setColor に統合 | Complete | setStroke / setFill 削除 |
| 7 | operations テスト更新 | Complete | setStroke/setFill describe 削除、setColor describe 追加 |
| 8 | annotationsReducer に defaultColors と新 actions 追加 | Complete | DefaultColors 型もここで export |
| 9 | annotationsReducer テスト追加 | Complete | isCommittingAction の挙動も検証 |
| 10 | yjs-annotations-context に annotation/set-color 追加 | Complete | default-color/* は UI-only として早期 return |
| 11 | yjs-annotations-context テスト | Complete | UI-only ガードも明示的にテスト |
| 12 | colors.ts に COLOR_PALETTE / デフォルト追加 + 旧定数掃除 | Complete | STROKE_RECTANGLE 等 4 定数削除、COLOR_PALETTE / DEFAULT_*_COLOR 追加 |
| 13 | CanvasStage.buildDraft* を defaultColors 経由に | Complete | text 注釈作成箇所も同時更新 |
| 14 | Shape 4 + TextEditorOverlay で color に統一 | Complete | TextEditorOverlay は plan に明記なかったが grep で発見 |
| 15 | ColorPalette コンポーネント新規作成 | Complete | shadcn Button + Tooltip 流用、size="icon-sm" |
| 16 | Toolbar に ColorPalette を組み込む | Complete | 既存 [Tools] | [History/Delete] の後ろに Divider + ColorPalette |
| 17 | EditorShell で color state を配線 | Complete | tool === 'highlight' で highlight default、それ以外は sync default |
| 18 | ColorPalette 単体テスト | Complete | 7 テスト(render / pick / 2 ボタン dispatch / disabled) |
| 19 | E2E annotation-color.spec.ts | Complete | 4 chromium テスト(デフォルト色 / デフォルト変更 / 選択中適用 / sync-highlight 独立性) |
| 20 | 全体検証 | Complete | typecheck / lint / test / build / E2E 全緑 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | Pass | turbo 4 タスク全緑 |
| Lint (biome ci) | Pass | exit 0(`useSemanticElements` 1 件は biome-ignore で対応、warning 0) |
| Unit Tests | Pass | shared 68 + web 184 = 252 全緑(新規 21 テスト追加) |
| Build | Pass | vite build + wrangler dry-run 成功 |
| E2E (新規) | Pass | annotation-color.spec.ts 4 chromium 緑 |
| E2E (regression) | Pass | 全 39 chromium 緑(既存 35 + 新 4)、修正 2 件含む |

## Files Changed

| File | Action | 概要 |
|---|---|---|
| `packages/shared/src/annotation.ts` | UPDATED | 4 注釈型 stroke/fill → color |
| `packages/shared/src/__tests__/annotation.test.ts` | UPDATED | fixture 統一 |
| `apps/web/src/domain/annotation/yjs-codec.ts` | UPDATED | Y.Map キー stroke/fill → color |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | UPDATED | setAnnotationColorY 追加 |
| `apps/web/src/domain/annotation/operations.ts` | UPDATED | setStroke/setFill 削除、setColor に統合 |
| `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` | UPDATED | fixture + setAnnotationColorY テスト |
| `apps/web/src/domain/annotation/__tests__/yjs-codec.test.ts` | UPDATED | fixture を color に |
| `apps/web/src/domain/annotation/__tests__/operations.test.ts` | UPDATED | setColor describe |
| `apps/web/src/hooks/annotationsReducer.ts` | UPDATED | DefaultColors 型 + 3 actions + COMMITTING_ACTIONS |
| `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` | UPDATED | 新 actions のテスト + isCommittingAction |
| `apps/web/src/hooks/yjs-annotations-context.ts` | UPDATED | annotation/set-color bridge、default-color/* は no-op |
| `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` | UPDATED | UI-only ガードと set-color のテスト |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | UPDATED | defaultColors local state、default-color/* dispatch ハンドリング |
| `apps/web/src/components/canvas/colors.ts` | UPDATED | 4 旧定数削除、COLOR_PALETTE / DEFAULT_*_COLOR 追加 |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATED | buildDraft* に color 引数、defaultColors から読む |
| `apps/web/src/components/canvas/TextEditorOverlay.tsx` | UPDATED | annotation.fill → annotation.color |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | UPDATED | annotation.stroke → annotation.color |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | UPDATED | 同上 |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | UPDATED | annotation.fill → annotation.color |
| `apps/web/src/components/canvas/shapes/TextShape.tsx` | UPDATED | 同上 |
| `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx` | UPDATED | fixture 修正 |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | UPDATED | 同上 |
| `apps/web/src/components/canvas/__tests__/HighlightShape.test.tsx` | UPDATED | 同上 |
| `apps/web/src/components/toolbar/Toolbar.tsx` | UPDATED | ColorPalette セクション追加、props 拡張 |
| `apps/web/src/pages/EditorShell.tsx` | UPDATED | pickedColor state、3 ハンドラ追加 |
| `apps/web/e2e/landing.spec.ts` | UPDATED | "選択" を `exact: true` で「選択中の注釈に色を適用」と区別 |
| `apps/web/e2e/keyboard-shortcuts.spec.ts` | UPDATED | isPressed ヘルパーも `exact: true` |
| `apps/web/src/components/toolbar/ColorPalette.tsx` | CREATED | 7 色 swatch + 2 適用ボタン UI |
| `apps/web/src/components/toolbar/__tests__/ColorPalette.test.tsx` | CREATED | 7 テスト |
| `apps/web/e2e/annotation-color.spec.ts` | CREATED | 4 E2E テスト |

## Deviations from Plan

1. **TextEditorOverlay の更新が plan に明記されていなかった** — `apps/web/src/components/canvas/TextEditorOverlay.tsx:50` で `annotation.fill` を参照していたため同時更新。事前 grep で発見しタスクに追加。
2. **useYjsAnnotationsStore の更新が plan に明記されていなかった** — このファイルが local UI state(tool/selectedId)を実体化している。defaultColors も同様に追加する必要があった(useStateRef 経由)。typecheck エラーで判明 → ref パターンで対応。
3. **既存 E2E 2 件(landing / keyboard-shortcuts)で regression** — 新ボタン "選択中の注釈に色を適用" の `aria-label` が "選択" を含むため、既存テストの strict mode locator が衝突。`exact: true` 追加で対応。
4. **biome の useSemanticElements 警告** — `<div role="group">` を `<fieldset>` にせよという lint。`fieldset` だと form 由来のスタイルを引き継ぐので不適切と判断し `biome-ignore` で例外。
5. **HANDLE 系定数の plan 想定** — colors.ts に `MIN_RESIZE_SIZE` を Phase 7.7-1 で追加済(plan #4)、本フェーズではそのまま流用。Phase 7.7-1 の deviations と整合。

## Issues Encountered

1. **useStateRef setter が functional updater を受け付けない**(typecheck エラー)→ ref を取得して `setDefaultColors({ ...defaultColorsRef.current, sync: ... })` のパターンに変更。
2. **vitest 経由のパス指定が turbo 越しで効かない**(`pnpm test -- src/foo` で全テスト実行)→ `cd apps/web && pnpm vitest run <path>` で直接実行し対応。
3. **PreToolUse hook が DOM 全置換 idiom をブロック** → `while(document.body.firstChild) removeChild` で書き直し。
4. **biome の `noNonNullAssertion` warning** → `COLOR_PALETTE[0]!` を `COLOR_PALETTE[0] ?? '#000000'` に変更してフォールバック明示。

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `packages/shared/src/__tests__/annotation.test.ts` | 既存 22 を更新 | スキーマの color 統一 |
| `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` | +2(setAnnotationColorY) | 全タイプ更新 + unknown id no-op |
| `apps/web/src/domain/annotation/__tests__/operations.test.ts` | +5(setColor)、-3 削除 | 全 4 型対応 |
| `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` | +5 | default-color/* + annotation/set-color + isCommittingAction |
| `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` | +1、既存 1 拡張 | annotation/set-color が Yjs 反映、default-color/* が UI-only |
| `apps/web/src/components/toolbar/__tests__/ColorPalette.test.tsx` | +7(新規) | render / pick / 2 ボタン dispatch / disabled |
| `apps/web/e2e/annotation-color.spec.ts` | +4(新規 chromium) | デフォルト色 / デフォルト変更 / 選択中適用 / sync-highlight 独立 |

## Acceptance Criteria

- [x] Task 1-20 完了
- [x] 全 validation コマンド緑
- [x] スキーマが `color` で統一(stroke/fill 削除)
- [x] 7 色固定パレット + 2 適用ボタン UI
- [x] デフォルト: sync = 赤(`#e74c3c`)、highlight = 黄(`#f5d142`)
- [x] 「新規デフォルトに設定」「選択中の注釈に適用」両方動作
- [x] sync(rect/arrow/text)と highlight でデフォルトが独立
- [x] Undo/Redo がリサイズも色変更も対象に含む(annotation/set-color が COMMITTING_ACTIONS)
- [x] 既存 E2E regression なし(2 件は exact: true で適応的に修正)
- [x] PRD の Phase 2 status を `pending` → `complete` に更新

## Next Steps
- [ ] Phase 7.7-3 (B1 ズーム/パン) の plan 作成
- [ ] 全 Phase 完了後にまとめて code-review + PR(branch: feat/phase-7.7-ux-foundation)

---
*Generated: 2026-05-03*
*Branch: feat/phase-7.7-ux-foundation*
