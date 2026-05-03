# Implementation Report: Phase 7.8-1 Auto-next-A 矢印→テキスト 次手予測

## Summary

矢印を引き終わった瞬間、終点(`to`)から矢印方向に 8px 先で空 text 注釈を自動作成 + IME 即時起動する次手予測 A を実装。Phase 7.7 で完成済の text 即時編集経路(TextEditorOverlay の Enter 確定 / Esc 破棄 / 0 文字自動削除 / `stopPropagation` ガード)を完全再利用し、CanvasStage `handleMouseUp` の arrow 分岐に Auto-next 起動 + EditorShell に `autoNextChainRef` で「commit/cancel 後 tool=select 復帰」フラグを追加。Yjs UndoManager の `captureTimeout=500ms` で連続 add が 1 step に merge される問題を発見し、`stopUndoCapture` API を新規 expose して step を意図的に分離。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium(やや上振れ — Yjs UndoManager 分離対応で +2 ファイル) |
| Confidence | 9/10 | 8/10(Yjs UndoManager の captureTimeout 問題は plan で見落とし、E2E 失敗で発覚) |
| Files Created | 4 | 3(plan の予定どおり、追加無し) |
| Files Updated | 2 | 5(CanvasStage / EditorShell の plan 想定 + useAnnotationsStore / useYjsAnnotationsStore の stopUndoCapture 追加 + 既存 E2E 3 件の Auto-next 副作用対応) |
| 新規 Unit Test | 8 | **10**(plan 8 + degenerate / distance=0 の 2 ケース追加) |
| 新規 E2E Test | 5 | 5(plan どおり) |
| 既存 E2E への影響 | 0 件想定 | **3 件** が Auto-next 副作用で要更新(annotation-resize / annotation-tools / golden-path) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | 純関数 `computeAutoNextTextOffset` 新規作成 | [done] Complete | `apps/web/src/lib/autoNextOffset.ts` 33 行 + 定数 `AUTO_NEXT_TEXT_OFFSET_PX=8` |
| 2 | 純関数 unit test | [done] Complete | 10 ケース全緑(右/左/上/下/45°/長矢印/degenerate/微小/distance=0/定数) |
| 3 | `CanvasStage` の `onStartTextEditing` signature 拡張 | [done] Complete | `(id, options?: { autoNext?: boolean })` に拡張 |
| 4 | `CanvasStage.handleMouseUp` に Auto-next-A 起動分岐追加 | [done] Complete | 矢印確定後に `store.stopUndoCapture()` → text add → tool/set → select/set → onStartTextEditing |
| 5 | `EditorShell` に `autoNextChainRef` + tool=select 復帰 + `__SNAP_SHARE_TOOL__` expose | [done] Complete | `handleStartTextEditing`/`handleTextCommit`/`handleTextCancel` 経路で ref 制御、E2E 用 window expose 追加 |
| 6 | E2E spec `auto-next-arrow-text.spec.ts` 新規作成 | [done] Complete | 5 ケース全緑(基本確定 / 0 文字 Enter / 編集中 Esc / Cmd+Z / 通常 T 回帰) |
| 7 | PRD Phase 1 status 更新 | [done] Complete | `pending` → `complete` + plan/report リンク設定 |
| 8 | 全体回帰 | [done] Complete | typecheck / lint / unit / E2E / build 全緑 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | [done] Pass | `pnpm -w typecheck` ゼロエラー |
| Lint | [done] Pass | `pnpm -w lint` クリーン(`pnpm -w format` で 2 ファイル自動整形済) |
| Unit Tests | [done] Pass | 228 件全緑(既存 218 + 新規 10) |
| Build | [done] Pass | `pnpm -w build` (vite build + wrangler dry-run) 緑 |
| E2E | [done] Pass | 全 57 件緑(既存 52 + 新規 5)、回帰 0 |
| Manual Validation | (未実施 — dogfood で確認) | dev サーバ起動と golden path の手動確認は dogfood 時 |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `apps/web/src/lib/autoNextOffset.ts` | CREATED | +33 |
| `apps/web/src/lib/__tests__/autoNextOffset.test.ts` | CREATED | +63 |
| `apps/web/e2e/auto-next-arrow-text.spec.ts` | CREATED | +164 |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATED | +37 / -3 |
| `apps/web/src/pages/EditorShell.tsx` | UPDATED | +33 / -2 |
| `apps/web/src/hooks/useAnnotationsStore.ts` | UPDATED | +16 / -0 |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | UPDATED | +9 / -0 |
| `apps/web/e2e/annotation-resize.spec.ts` | UPDATED | +18 / -2 |
| `apps/web/e2e/annotation-tools.spec.ts` | UPDATED | +9 / -3 |
| `apps/web/e2e/golden-path.spec.ts` | UPDATED | +5 / -0 |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | UPDATED | +9 / -0(Deviation #3 ユーザー要望追加修正) |
| `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` | UPDATED | +1 / -1(phase 1 status + リンク) |

## Deviations from Plan

### Deviation #1 — Yjs UndoManager の `captureTimeout=500` 問題

- **WHAT**: plan では「矢印 add → text add の 2 dispatch は historyReducer の 2 commit で別 undo step になる」と仮定していたが、room モード(Yjs UndoManager 経由)では同 LOCAL_ORIGIN の連続操作が `captureTimeout: 500ms`(`yjs-annotations-context.ts:53`)で 1 step に merge され、Cmd+Z 1 回で両方が消える挙動になっていた。E2E 「Cmd+Z 連打で text → 矢印 の順に独立巻き戻し」が即座に失敗して発覚
- **WHY**: local モード(`useAnnotationsStore` + historyReducer)では確かに 2 commit に分かれるが、room モード(`useYjsAnnotationsStore` + Y.UndoManager)は別経路で plan で見落としていた。CLAUDE.md の design rule #8(LOCAL_ORIGIN ラップ)を踏襲した結果として正しい挙動だが、Auto-next には不適合
- **対応**: `AnnotationsStore` 型に `stopUndoCapture: () => void` を追加。local モードは no-op、room モードは `ctx.undoManager.stopCapturing()` を expose。CanvasStage の Auto-next 経路で「矢印 add の直後 + text add の直前」に呼ぶ。これで Phase 7.8 PRD の「グループ化しない、各注釈は独立 step」が両モードで成立
- **影響**: ファイル更新が +2 件(useAnnotationsStore / useYjsAnnotationsStore)。confidence は 9/10 → 8/10 に下方修正

### Deviation #3 — ユーザー要望: 矢印の鏃を mousedown 側(`from`)に変更

- **WHAT**: 元実装は Konva Arrow の default(`pointerAtEnding=true`)で `to` 側に矢じりを描画 → `from = dragStart`, `to = mouseup` だったため「**尾(dragStart)から鏃(mouseup)に向かって引く**」UX。ユーザー要望で「**鏃のほうから引く**」(=mousedown 位置に鏃) に変更
- **WHY**:
  - ユーザーレビュー(2026-05-04): 「矢印を引く時は、鏃のほうから(これは今回の実装ではなく、元々の実装)」「テキストは鏃じゃないほう。1 を修正すると自然にそうなる?」
  - ユーザーの意図確認(画像 [Image #2] と PRD 確定事項): 矢印の終点(=鏃) が指したい対象に刺さる構図 が業務注釈の標準
  - 同時に Auto-next-A の text 位置を「鏃じゃないほう = 尾側」にしたい要望もあったが、矢印の `pointerAtBeginning` 反転だけで自動的に達成される(=Auto-next の `to + offset` 計算は `to - from` 方向の延長 = 反転後は尾の延長線上)
- **対応**: `ArrowShape.tsx` の `<KonvaArrow>` に `pointerAtBeginning` を追加、`pointerAtEnding={false}` で打ち消し。Auto-next-A の `computeAutoNextTextOffset` / `to + offset` 計算は変更不要で、結果として text が「鏃じゃないほう = 尾の延長線上」に自然と配置される
- **影響範囲**:
  - 矢印の見た目: mousedown 位置に矢じり描画(以前は mouseup 位置)
  - 既存 Yjs データ(`from`/`to` の物理座標): 変更なし、表示のみ反転
  - dogfood 段階(オーナー利用のみ)で破壊的変更だが許容
  - E2E 全 57 件、unit 228 件、build 全緑で回帰なし

### Deviation #2 — 既存 E2E 3 件が Auto-next の意図的副作用で回帰

- **WHAT**: plan の Risks「既存 text ツールの連続 text 作成モードを壊す可能性」しか想定していなかったが、実際には「矢印を引いた直後に Auto-next で空 text が追加される」のが既存の「矢印=1 件追加」を期待する E2E と衝突
- **影響を受けた既存 spec**:
  - `annotation-resize.spec.ts:151`(矢印の to 端点ハンドル)
  - `annotation-tools.spec.ts:43`(3 ドラッグ系ツール 1 件追加)
  - `annotation-tools.spec.ts:125`(Undo / Redo 履歴)
  - `golden-path.spec.ts:27`(キーボードのみで 4 種注釈配置)
- **WHY**: Auto-next は仕様通りの挙動だが、既存 spec は「矢印=1 件」を仮定していた。Auto-next が常時 ON である Phase 7.8 後の世界では「矢印 drag → 空 text 即時編集」が標準フロー
- **対応**: 各 spec で矢印 drag 後に `page.keyboard.press('Escape')` を挟んで Auto-next の text を破棄してから assert。`annotation-resize.spec.ts` ではさらに矢印再選択(Esc 後 selectedId が null になるため矢印中点 click で再選択)を追加
- **影響**: ファイル更新が +3 件(既存 E2E spec)、Auto-next 連鎖そのものは新 spec `auto-next-arrow-text.spec.ts` でカバー済

## Issues Encountered

### Issue #1: Yjs UndoManager captureTimeout(Deviation #1 で対処)

- **Symptom**: 1 周目 E2E で「Auto-next 確定後 Cmd+Z 連打で text → 矢印 の順に独立巻き戻し」のみ失敗 — 1 回目 Cmd+Z で annotations.length が 1 ではなく 0 になった
- **Root Cause**: `Y.UndoManager` の captureTimeout(500ms)で同 LOCAL_ORIGIN 連続操作が 1 step に merge
- **Resolution**: `stopUndoCapture` API を AnnotationsStore に追加、room モードは `ctx.undoManager.stopCapturing()` を expose、Auto-next 経路の中間で呼ぶ。Deviation #1 として記録

### Issue #2: 既存 E2E 4 件回帰(Deviation #2 で対処)

- **Symptom**: 1 周目の full E2E suite で `annotation-resize` / `annotation-tools` / `golden-path` の 4 ケースが失敗
- **Root Cause**: 矢印 drag 後に Auto-next 経路で空 text が即時追加されるが、既存 spec は矢印=1 件を期待
- **Resolution**: 各 spec で矢印 drag 後に Escape キー押下で text を破棄するステップを追加(`annotation-resize.spec.ts` は加えて矢印再選択 click を追加)。Deviation #2 として記録

### Issue #3: `annotation-resize.spec.ts` で Esc 後に矢印が選択解除される

- **Symptom**: 2 周目 E2E で `annotation-resize.spec.ts:151` のみまだ失敗 — to 端点ハンドルが反応しない
- **Root Cause**: Auto-next の text を Esc で削除すると `annotation/remove` reducer が `selectedId === text.id` のとき selectedId を null にクリアする(`annotationsReducer.ts:76-81`)。結果として矢印が selectedId にならず、Transformer / Endpoint ハンドルが描画されない
- **Resolution**: Esc 後に矢印中点を `page.mouse.click` で再選択するステップを追加(stage hit-test で `handleShapeClick` が `select/set` を発火)

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/web/src/lib/__tests__/autoNextOffset.test.ts` | 10 件 | 8 方向 + degenerate / 微小ベクトル / distance=0 / 定数値域 |
| `apps/web/e2e/auto-next-arrow-text.spec.ts` | 5 件 | 基本確定 / 0 文字 Enter で text 自動削除 / 編集中 Esc / Cmd+Z 個別巻き戻し / 通常 T ツール非影響 |

既存 E2E 更新による変化:
- `annotation-resize.spec.ts`: 1 件更新(矢印 to 端点 — Esc + 再選択を追加)
- `annotation-tools.spec.ts`: 2 件更新(3 ドラッグ系 / Undo+Redo — 矢印後 Esc を追加)
- `golden-path.spec.ts`: 1 件更新(4 種注釈 — 矢印後 Esc を追加)

## Next Steps

- [ ] `/code-review` または `/everything-claude-code:code-review` で内部レビュー
- [ ] `/everything-claude-code:prp-commit` で commit(コミットメッセージ案: `feat(phase-7.8-1): 矢印→テキスト Auto-next 次手予測`)
- [ ] dogfood: 矢印終端 offset 8px が快適か(Phase 5 の dogfood で 8/12/16 比較)
- [ ] Phase 2 (B 矩形→矢印 次手予測) の plan 作成 — Phase 1 の Auto-next-A 経路を呼び出す形で連鎖実装可能(plan で確認済)

## Notes

- **Phase 1 の心臓部は `CanvasStage.handleMouseUp` の追加 30 行**。Phase 7.7 の TextEditorOverlay / handleTextCommit / handleTextCancel が完璧に再利用できた
- **Yjs UndoManager 対応** は plan で見落としたが、`stopUndoCapture` API として明示的に分離できたため Phase 2 以降でも同パターン(連続 add の独立 step 化)で活用可能
- **既存 E2E 修正** は plan で見落としたが、修正後の spec は「Auto-next 込みの新挙動に合わせて Esc で text を破棄」と意図が明確。Phase 7.8 後の世界の正しいテスト形になっている
- **Confidence 8/10 の振り返り**: plan の Mandatory Reading に `useYjsAnnotationsStore.ts` を入れていれば captureTimeout に気付けた。次回 plan で「Yjs / 状態管理が絡む箇所では UndoManager の挙動も確認する」を反映する
