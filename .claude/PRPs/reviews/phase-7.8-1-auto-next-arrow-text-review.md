# Code Review: Phase 7.8-1 Auto-next-A 矢印→テキスト 次手予測

**Reviewed**: 2026-05-04
**Mode**: Local Review (uncommitted changes on `feat/phase-7.8-predictive-ux`)
**Decision**: **APPROVE**(MEDIUM 1 件は本レビュー中に即時修正済)

## Summary

Phase 7.8-1 Auto-next-A 実装は plan / report の通り Phase 7.7 蓄積パターンの再利用に徹した小さな変更で、CRITICAL / HIGH の問題は無し。MEDIUM 1 件(useCallback 依存配列の最小化)は本レビュー中に修正完了。LOW 2 件は記録のみで影響軽微。実装と並走で発覚した Yjs UndoManager の captureTimeout 問題、矢印鏃方向のユーザー要望反映も適切に解決されている。

## Files Reviewed

| File | Type | LoC delta |
|---|---|---|
| `apps/web/src/lib/autoNextOffset.ts` | Added | +33 |
| `apps/web/src/lib/__tests__/autoNextOffset.test.ts` | Added | +63 |
| `apps/web/e2e/auto-next-arrow-text.spec.ts` | Added | +164 |
| `apps/web/src/components/canvas/CanvasStage.tsx` | Modified | +37 / -3 |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | Modified | +9 / -0 |
| `apps/web/src/hooks/useAnnotationsStore.ts` | Modified | +16 / -0 |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | Modified | +9 / -0 |
| `apps/web/src/pages/EditorShell.tsx` | Modified | +33 / -2 |
| `apps/web/e2e/annotation-resize.spec.ts` | Modified | +13 / -1 |
| `apps/web/e2e/annotation-tools.spec.ts` | Modified | +9 / -3 |
| `apps/web/e2e/golden-path.spec.ts` | Modified | +5 / -0 |

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM(本レビュー中に修正済)

**M-1 — `CanvasStage.handleMouseUp` の useCallback 依存配列に `store` 全体を入れていた**
- **File**: `apps/web/src/components/canvas/CanvasStage.tsx:307`
- **Issue**: `store` は useAnnotationsStore / useYjsAnnotationsStore の戻り値で毎レンダーで新オブジェクト identity になる可能性がある。`handleMouseUp` 内で実際に使用するのは `store.stopUndoCapture` のみ
- **Risk**: handleMouseUp が毎レンダー再生成 → react-konva の onMouseUp ハンドラ re-attach がレンダー毎に発生
- **Fix**: 依存を `store.stopUndoCapture` のみに絞り込み、コメント追加
- **Status**: [done] 修正済(本レビュー中)

### LOW(記録のみ)

**L-1 — `EditorShell.handleDelete` / `handleEscape` で `autoNextChainRef` クリアが無い**
- **File**: `apps/web/src/pages/EditorShell.tsx:137-154`
- **Issue**: Auto-next 中に Delete ボタンや handleEscape 経由で text 注釈が消える経路で `autoNextChainRef.current` が `true` のまま残る可能性
- **Reality**: text 編集中は textarea にフォーカスがあるため `useKeyboardShortcuts` の onDelete はガードで発火しない。Toolbar の Delete ボタンクリック時も textarea blur → `handleTextCancel` 経由でクリアされる
- **Decision**: 現実的に発火しない経路 + 過剰防御の可能性、修正は dogfood で挙動確認後に判断
- **Suggested follow-up**: Phase 5(dogfood + チューニング)で実機検証時に追加判断

**L-2 — `ArrowShape.tsx` の `pointerAtBeginning` 反転は既存矢印の見た目を変える破壊的変更**
- **File**: `apps/web/src/components/canvas/shapes/ArrowShape.tsx:46-52`
- **Issue**: 過去の dogfood で作成済の矢印データ(Yjs)も pointerAtBeginning で再描画される(座標は同じ、矢じりの向きが反転)
- **Reality**: 現状の本番運用はオーナー dogfood のみ、Phase 7.7 PRD の「未リリース → マイグレーション不要」方針と整合
- **Decision**: 許容、PRD / report Deviation #3 に明記済
- **Suggested follow-up**: なし

## Validation Results

| Check | Result |
|---|---|
| Type check (`pnpm -w typecheck`) | [done] Pass — ゼロエラー |
| Lint (`pnpm -w lint`) | [done] Pass — クリーン(`pnpm -w format` で 2 ファイル整形済) |
| Unit Tests (`pnpm -w test`) | [done] Pass — 228 件全緑(既存 218 + 新規 10) |
| E2E (`pnpm -F @snap-share/web test:e2e`) | [done] Pass — 57 件全緑(既存 52 + 新規 5、回帰 0) |
| Build (`pnpm -w build`) | [done] Pass — vite + wrangler dry-run 緑 |

## Security Review

| Category | Result |
|---|---|
| Hardcoded credentials / API keys | [done] なし |
| SQL injection | N/A(SQL なし) |
| XSS / unsafe HTML 注入 | [done] React の標準 JSX のみ使用、生 HTML 注入経路なし |
| Input validation | [done] Annotation は `packages/shared` の Zod schema で検証済 |
| Path traversal | N/A(ファイル操作なし) |
| 不安全な依存 | [done] 既存パッケージのみ、新規導入なし |

## Code Quality Review

| Category | Result |
|---|---|
| 関数長 (>50 line) | [done] 全 < 50 line(handleMouseUp が一番長く ~60 line だが既存からの拡張、可読性 OK) |
| ファイル長 (>800 line) | [done] 最長 EditorShell.tsx ~360 line |
| ネスト深さ (>4 level) | [done] max 3 level |
| エラーハンドリング | [done] useReducer / Yjs 標準経路、explicit |
| `console.log` | [done] なし(`apps/web/src/lib/logger.ts` の専用 logger 経由のみ) |
| TODO / FIXME | [done] なし(残論点は PRD Open Questions / report Notes に記録) |
| Public API JSDoc | [done] `computeAutoNextTextOffset` / `stopUndoCapture` / `onStartTextEditing` 拡張に説明コメント |
| Mutation patterns | [done] 全て immutable(spread / 新オブジェクト) |
| Emoji in code | [done] なし |

## Pattern Compliance

| Pattern | Compliance |
|---|---|
| `LOCAL_ORIGIN` で `doc.transact` ラップ(CLAUDE.md rule #8) | [done] 既存 `applyDataAction` 経路で自動適用、`stopUndoCapture` は origin 不要 |
| 単一 useReducer 内で完結(rule #2) | [done] 既存 `annotationsReducer` を変更せず |
| 連続 dispatch 内 useRef 同期(rule #3) | [done] `autoNextChainRef` / `dragStartRef` パターン踏襲 |
| Konva CSS 変数不使用(rule #4) | [done] 矢印色は既存 `colors.ts` hex literal、新規追加なし |
| `<KonvaImage>` listening=false(rule #5) | [done] 変更なし |
| Catalog-managed deps(rule #6) | [done] 新規パッケージ追加なし |
| Yjs UndoManager の trackedOrigins | [done] `LOCAL_ORIGIN` のまま、`stopCapturing` は trackedOrigins に影響しない |

## Test Coverage

| Test Type | Count | Coverage |
|---|---|---|
| Unit | 10 件 | `computeAutoNextTextOffset` 純関数の 8 方向 + degenerate / 微小 / distance=0 / 定数値域 |
| E2E (新規) | 5 件 | 基本確定 / 0 文字 Enter / 編集中 Esc / Cmd+Z 個別巻き戻し / 通常 T ツール非影響(回帰) |
| E2E (既存修正) | 3 spec 4 ケース | annotation-resize 1 / annotation-tools 2 / golden-path 1(矢印 drag 後 Esc 追加で Auto-next 副作用ガード) |

カバレッジは Phase 7.8-1 PRD の Acceptance Criteria を網羅:
- [done] 矢印 mouseup 直後の text 即時起動
- [done] tool=text 切替
- [done] 1 文字以上 Enter 確定 + tool=select 復帰
- [done] 0 文字 Enter で text 自動削除 + tool=select
- [done] 編集中 Esc で text 破棄 + tool=select
- [done] 編集中 BS は文字削除のみ(textarea 標準挙動 + `stopPropagation` で window 経由不要)
- [done] Cmd+Z 連打で text → 矢印 個別巻き戻し
- [done] Yjs 同期(既存 `applyDataAction` 経路、E2E は room モード = `/r/...` で動作)
- [done] 通常 text ツールへの非影響(回帰 spec)

## 補足: 矢印鏃位置の追加修正(Deviation #3)

ユーザーレビュー(2026-05-04)で「矢印は鏃のほうから引きたい / テキストは鏃じゃないほう」要望を受け、`ArrowShape.tsx` に `pointerAtBeginning` を追加。`computeAutoNextTextOffset` の `to - from` 方向延長計算が自動的に「尾の延長線上 = 鏃じゃないほう」となり、Auto-next-A 側の修正は不要(ユーザー予測通り「自然にそうなる」が成立)。

| 修正前 | 修正後 |
|---|---|
| `from = dragStart`, `to = mouseup` | (座標は同じ) |
| Konva default で `to` 側に矢じり = mouseup 位置に鏃 | `pointerAtBeginning=true` で `from` 側に矢じり = mousedown 位置に鏃 |
| Auto-next text = `to + offset` = 鏃の延長線上(誤 ユーザー要望と矛盾) | Auto-next text = `to + offset` = 尾の延長線上(正 鏃じゃないほう) |

## Decision

**APPROVE** — CRITICAL/HIGH 0、MEDIUM 1 件は即時修正済、LOW 2 件は記録のみで影響軽微。validation 5/5 緑、Phase 7.8-1 のスコープを完全に満たしており、Phase 2(B 矩形→矢印)に進める状態。

## Recommended Next Steps

1. [done] MEDIUM (M-1) 修正完了
2. → `/everything-claude-code:prp-commit` で commit(Phase 7.7 と同様、ブランチ単位 1 PR の方針 = `feat/phase-7.8-predictive-ux` 上に Phase 1 のコミットを 1 つ積む)
3. → 実機 dogfood: 矢印を引いて鏃位置 / Auto-next text 配置 / Cmd+Z 挙動の目視確認
4. → Phase 2(B 矩形→矢印)の plan 起こし(`/everything-claude-code:prp-plan`)
