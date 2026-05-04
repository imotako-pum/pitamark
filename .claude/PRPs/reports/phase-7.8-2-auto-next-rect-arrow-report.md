# Implementation Report: Phase 7.8-2 Auto-next-B 矩形→矢印 次手予測

## Summary

矩形を描き終わった瞬間、既定矢印プレビュー(半透明、ヤジリ = 矩形右辺中央、尾 = 右下 45° 100px)を表示し、Enter で確定 → Phase 7.8-1 Auto-next-A に連鎖して text 編集を起動するように。BS / Esc / 別ツールキー / マウス mousedown / handleClearImage の 5 経路でキャンセルでき、Cmd+Z で text → 矢印 → 矩形 の 3 段巻き戻しになる。新規ロジックは `EditorShell` の pending state + 5 経路のキャンセル + `useKeyboardShortcuts` の Enter binding のみで、Phase 7.8-1 で完成済みの Auto-next-A 連鎖を 100% 再利用。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium (250-350 LOC) | Medium (286 新規 + 271 更新 = 557 LOC、想定上振れだが test/comment が嵩んだ範囲) |
| Confidence | 8/10 | 9/10 (上方修正 — Phase 7.8-1 の蓄積が完璧に活き、唯一の引っかかりは想定済の既存 E2E 2 件のみ) |
| Files Created | 3 | 3 (`autoArrowDefault.ts` / `.test.ts` / `auto-next-rect-arrow.spec.ts`) |
| Files Updated | 4 | 6 (`CanvasStage.tsx` / `EditorShell.tsx` / `useKeyboardShortcuts.ts` / `.test.tsx` + Deviation #1 で `annotation-tools.spec.ts` / `keyboard-shortcuts.spec.ts`) |
| 新規 Unit Test | 10 (autoArrowDefault 5 + useKeyboardShortcuts 5) | 10 (予定どおり) |
| 新規 E2E Test | 8-9 | 9 (予定どおり) |
| 既存 E2E への影響 | 「既存 E2E 回帰」を Risks に明記 | **2 件**(`annotation-tools.spec.ts:109` / `keyboard-shortcuts.spec.ts:60`)— 各 Esc を 1 回挟むパターンで対応 |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | 純関数 `computeAutoArrowDefault` 新規作成 | [done] Complete | `apps/web/src/lib/autoArrowDefault.ts` 29 行 + 定数 `AUTO_ARROW_DEFAULT_LENGTH_PX=100` |
| 2 | 純関数 unit test | [done] Complete | 5 ケース全緑 (右辺中央 / 平行移動 / 距離一致 / 45° / 決定的) |
| 3 | `useKeyboardShortcuts` に Enter binding | [done] Complete | `onConfirmAutoArrow` props + `!mod && key==='Enter' && !shiftKey` 分岐 |
| 4 | `useKeyboardShortcuts` test 追加 | [done] Complete | 5 ケース追加 (Enter 発火 / undefined / Shift+Enter / Cmd+Enter / input フォーカス時) |
| 5 | CanvasStage に pending props + プレビュー描画 | [done] Complete | 半透明 Layer + handleMouseDown 冒頭でキャンセル + handleMouseUp rectangle 経路 |
| 6 | EditorShell に pending state + handlers | [done] Complete | ref+state 二重管理 + handleAutoNextRectangle + handleConfirmAutoArrow + 各キャンセル経路拡張 + window expose |
| 7 | E2E spec `auto-next-rect-arrow.spec.ts` | [done] Complete | 9 ケース全緑 |
| 8 | PRD Phase 2 status 更新 | [done] Complete | `pending` → `complete` + plan/report リンク (Task 9 で fix) |
| 9 | 全体回帰 (typecheck/lint/test/e2e/build) | [done] Complete | 既存 2 件 E2E は Esc 挟みで修正、最終的に全緑 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | [done] Pass | `pnpm -w typecheck` ゼロエラー |
| Lint | [done] Pass | `pnpm -w lint` (biome ci) クリーン |
| Unit Tests | [done] Pass | 238 件全緑 (既存 228 + 新規 10) |
| Build | [done] Pass | `pnpm -w build` (vite + wrangler dry-run) 緑 |
| E2E | [done] Pass | 全 66 件緑 (既存 57 + 新規 9)、回帰 0 (Deviation #1 で 2 件修正後) |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `apps/web/src/lib/autoArrowDefault.ts` | CREATED | +29 |
| `apps/web/src/lib/__tests__/autoArrowDefault.test.ts` | CREATED | +40 |
| `apps/web/e2e/auto-next-rect-arrow.spec.ts` | CREATED | +217 |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATED | +81 / -? (+ pending Layer + handleMouseDown / handleMouseUp 拡張 + props 追加) |
| `apps/web/src/pages/EditorShell.tsx` | UPDATED | +130 / -? (pending state + 5 ハンドラ + window expose) |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | UPDATED | +16 / -0 (Enter binding) |
| `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` | UPDATED | +41 / -0 (Enter binding 5 件) |
| `apps/web/e2e/annotation-tools.spec.ts` | UPDATED | +6 / -0 (Deviation #1 で Esc 挟み) |
| `apps/web/e2e/keyboard-shortcuts.spec.ts` | UPDATED | +5 / -0 (Deviation #1 で Esc 挟み) |
| `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` | UPDATED | +1 / -1 (Phase 2 status + リンク) |

## Deviations from Plan

### Deviation #1 — 既存 E2E 2 件が pending クリア優先で回帰、Esc 挟みで対応

- **WHAT**: plan の Risks に「既存 E2E が『矩形 add のみ』を期待していて pending 立つことで失敗 (M/L)」と明記していたが、実際に 2 件で発覚 — `annotation-tools.spec.ts:109` (Delete ボタンで矩形削除) / `keyboard-shortcuts.spec.ts:60` (Esc で選択解除)
- **WHY**: handleDelete / handleEscape がともに pending クリアを最優先する設計のため、矩形描画直後の最初の BS / Delete / Esc は pending クリアに吸収される。これは仕様通り(BS で pending クリア → 矩形は残る = ユーザーの直感)で正しい挙動だが、既存 spec はその挙動を考慮していなかった
- **対応**: Phase 7.8-1 と同じ作法で各 spec に `await page.keyboard.press('Escape');` を 1 回挟んで pending クリア後に元の経路へ進ませた。コメントで Phase 7.8-2 仕様を明記
- **影響**: 既存 spec の意図(Delete ボタン UI のロックイン / Esc キーで選択解除)は変わらず、ロック内容が「pending クリア後の挙動」に拡張された形

## Issues Encountered

### Issue #1: 既存 E2E 2 件回帰 (Deviation #1 で対処)

- **Symptom**: 1 周目の full E2E suite で `annotation-tools.spec.ts:109` (Delete ボタンクリック後 0 件期待が 1 件のまま) と `keyboard-shortcuts.spec.ts:60` (Esc で削除ボタン disabled 期待が enabled のまま) の 2 件が失敗
- **Root Cause**: handleDelete / handleEscape の pending 優先分岐が、矩形描画直後の最初の操作を吸収。仕様通りで実装は正しい
- **Resolution**: 各 spec に Esc を 1 回挟む(Phase 7.8-1 と同じパターン)で対応。Deviation #1 として記録

### Issue #2: なし

予定どおり 1 周目の new E2E spec は 9 件全緑、確認すべき残課題は無し。

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/web/src/lib/__tests__/autoArrowDefault.test.ts` | 5 件 | 右辺中央配置 / 平行移動 / 距離一致 / 45° / 決定的 |
| `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` (Enter binding 追加) | 5 件 | Enter 発火 + preventDefault / undefined で no-op / Shift+Enter 除外 / Cmd+Enter 除外 / input フォーカス時無効化 |
| `apps/web/e2e/auto-next-rect-arrow.spec.ts` | 9 件 | pending 立ち上げ / Enter 確定 / text "OK" → tool=select / BS キャンセル / Esc キャンセル / V キーキャンセル / mousedown キャンセル / Cmd+Z 3 段巻き戻し / 連続 Auto-next-B |

既存 E2E 修正による変化:
- `annotation-tools.spec.ts:109`: 1 件更新 (Delete ボタン UI ロック — Esc を 1 回挟む)
- `keyboard-shortcuts.spec.ts:60`: 1 件更新 (Esc で選択解除 — Esc を 2 回押す: 1 回目 pending、2 回目 選択解除)

## Next Steps

- [ ] `/everything-claude-code:code-review` で内部レビュー
- [ ] `/everything-claude-code:prp-commit` で commit (コミットメッセージ案: `feat(phase-7.8-2): 矩形→矢印 Auto-next 次手予測`)
- [ ] dogfood: 既定矢印 100px 長 / 右下 45° の妥当性確認 (Phase 5 で 80/100/120 比較)
- [ ] dogfood: pending 中に Cmd+Z で矩形を消した時の「孤立矢印」感を観察 (plan Risks 参照、要望出れば pending 自動クリアを Phase 5 で追加)
- [ ] Phase 7.8-3 (フォントサイズ UI) の plan 作成 — Phase 7.8-2 で確立した state 管理パターンを再利用可能

## Notes

- **Phase 7.8-2 の心臓部**: EditorShell の pending state + `handleConfirmAutoArrow` の連続 4 dispatch (arrow add → stopUndoCapture → text add → tool/set + select/set) + 5 経路のキャンセル(Esc / Delete / SetTool / mousedown / handleClearImage)。Phase 7.8-1 の Auto-next-A 経路を 100% 再利用しつつ、確定タイミングを「mouseup」ではなく「Enter」に置き換えただけのシンプル設計
- **`pointerAtBeginning` 反転の活用**: Phase 7.8-1 で `from = ヤジリ` に反転済 → Phase 7.8-2 では「ヤジリ = 矩形右辺中央」を `from` で表現でき、Auto-next-A の text 位置 (`to + offset` = 尾の延長線上 = 矩形から離れる方向) がユーザーの意図と一致
- **pending state の置き場所**: CanvasStage 内で完結させる選択肢もあったが、(1) EditorShell の useKeyboardShortcuts 配線で参照する必要がある (Enter binding を pending != null のときだけ provide)、(2) handleEscape / handleDelete / handleSetTool の pending 優先分岐が EditorShell 側にある、の 2 点から EditorShell に集中させた方が依存関係が明示的になる
- **stopUndoCapture を 2 回呼ぶ**: 矩形 add 直後 (handleAutoNextRectangle 内) と arrow add 直後 (handleConfirmAutoArrow 内)。これで 矩形 / 矢印 / text の 3 段独立 undo step が成立。Yjs UndoManager の captureTimeout を 2 箇所で fix する作法は Phase 7.8-1 の確立パターンを踏襲
- **Confidence 9/10 の振り返り**: plan の Mandatory Reading に必要なファイルが網羅されており、実装中に追加検索や仕様判断が一切不要だった。Risks に明記した「既存 E2E 回帰」だけが想定通り発生し、想定通りの修正で対応できた。Phase 7.8-1 の蓄積(autoNextChainRef / stopUndoCapture / pointerAtBeginning / window expose 規約)が plan の前提として完璧に記述されていたのが大きい
