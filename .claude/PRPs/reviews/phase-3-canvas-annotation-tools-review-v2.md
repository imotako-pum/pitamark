# Code Review v2: Phase 3 — キャンバス & 注釈ツール (Post-Fix Re-review)

**Reviewed**: 2026-05-01
**Branch**: `feat/phase-3-canvas-annotation-tools` → `main`
**Scope**: branch 全体 (41 files, +4,259 / -8 lines) + 直前 fix commit `bc8acfc`
**Decision**: **APPROVE with comments**（CRITICAL / HIGH 0 件、MEDIUM 1 件 (継続)、LOW 0 件）

## Summary

前回 review (`phase-3-canvas-annotation-tools-review.md`) と Chrome MCP での実機検証で発見された 4 つの致命的バグ（race condition / stale closure / textarea 即削除 / 画像 hit detection）はすべて修正済み。useReducer 1 個に統合した refactor は設計的にクリーンで、useRef ベースの draft / dragStart 管理も適切。残る指摘は前回 MEDIUM #2 の継続 1 件のみ。マージ可能。

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

#### 1. (継続) `annotationsReducer` の `state/replace` action が dead code

- **Location**: `apps/web/src/hooks/annotationsReducer.ts:31, 81-82` + 対応テスト `annotationsReducer.test.ts:131-145`
- **Issue**: 前回 review MEDIUM #2 で指摘した「`state/replace` action がどこからも dispatch されない」が**未対処**。今回の refactor で `useAnnotationsStore` は `useReducer(storeReducer)` に変わり、history は同 reducer 内で扱われるようになったため、`state/replace` の存在意義は完全に消失（外部から `dispatch({ type: 'state/replace', state })` を呼ぶと history を bypass して present だけハードリセットされる semi-危険な経路）。
- **Risk**: dead code は将来の reader を混乱させる + `state/replace` を誰かが呼び始めると history が壊れる潜在バグ。
- **Suggested fix**:
  - **A) 削除**: `AnnotationsAction` union から `state/replace` を外し、reducer の case と対応テストも削除。
  - **B) 残すなら**: コメントで「Phase 4 で外部システム（Yjs / WebSocket）からスナップショット流入用に予約」明示。
- **影響範囲**: `state/replace` を外部から呼んでいる箇所は皆無 (grep で検証済)。削除しても挙動変わらない。

### LOW

None.

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type check | ✅ Pass | turbo (FULL TURBO cache) — 全 workspace 0 errors |
| Lint (biome) | ✅ Pass | 79 files, 0 errors |
| Tests (unit) | ✅ Pass | shared 45 + web 70 = **115 tests passing** |
| Build (vite) | ✅ Pass | gz **177.90 KB**（プラン許容 150-200 KB 範囲内） |
| Integration (E2E) | ✅ Pass | playwright chromium 4/4 |
| Manual smoke (Chrome MCP) | ✅ Verified | 矩形 / 矢印 / ハイライト / テキスト (日本語 IME) すべて画像の上で描画 OK、Undo/Redo OK |

## Bug Fixes Verified

| Bug | Symptom | Root Cause | Fix | 検証 |
|---|---|---|---|---|
| #1 | 注釈が store に追加されない | useAnnotationsStore.dispatch の closure stale state | useReducer 1 個に統合 (storeReducer) | Chrome MCP で矩形→count=1 確認 |
| #2 | handleMouseUp が draft=null を見続ける | useState の async flush と Konva listener 再 bind の race | dragStart/draft を useRef に変更 | Chrome MCP で全ツール描画 OK |
| #3 | text annotation が即削除される | mount 直後の onBlur 空文字 commit | armedRef ガード 250ms | 「こんにちは」確定確認 |
| #4 | 画像領域内で注釈描画できない | KonvaImage の listening が hit detection を吸収 | Layer + Image に listening={false} | ユーザー実機で確認済 |

## Security Audit

| Vector | Status | Notes |
|---|---|---|
| Hardcoded secrets | ✅ None | grep clean |
| SQL injection | N/A | DB 操作なし |
| XSS | ✅ Safe | TextAnnotation は Konva canvas にレンダ、textarea は `defaultValue` 経由 |
| Path traversal | N/A | fs 操作なし |
| File upload | ✅ Safe | validateImageFile で MIME 4 種 + 10MB 上限、SVG は `<img>` 経由 (script 実行されない) |
| Resource leak | ✅ Safe | ObjectURL は useRef + useEffect cleanup でペア管理 |
| Console exposure | ✅ Safe | logger.ts のみ console 使用 (`biome-ignore-all` 適用) |
| dev-only debug 残骸 | ✅ Clean | `[diag *]` ログ・`window.__store` expose すべて削除済 |

## Pattern Compliance

| Rule | Status |
|---|---|
| Immutability | ✅ All operations use spread/map/filter, no mutations |
| Type safety (no `any`) | ✅ `grep ":\\s*any"` clean |
| Naming (camelCase / PascalCase / kebab-case) | ✅ 全ファイル準拠 |
| File size (<800 lines) | ✅ 最大 264 行 (operations.test.ts) |
| Function size (<50 lines) | ✅ 最大 ~40 行 (CanvasStage handleMouseDown) |
| Nesting (<4 levels) | ✅ 最大 3 段 |
| AAA test pattern | ✅ vitest tests follow describe/it + Arrange/Act/Assert |
| Zod SSOT | ✅ packages/shared に discriminated union 集約 |
| Konva に CSS変数を渡さない | ✅ colors.ts に hex 集約 |
| `e.cancelBubble = true` (shape クリック) | ✅ 各 shape で実装 |
| INPUT/TEXTAREA キーボードガード | ✅ useKeyboardShortcuts で実装 |
| useReducer ベースの state 管理 (race condition 回避) | ✅ useAnnotationsStore で統合 |
| ref ベースの sync 値 (handler closure 問題回避) | ✅ CanvasStage で実装 |
| Konva の listening 制御 (画像 hit detection) | ✅ ImageLayer で実装 |

## Files Reviewed (差分対象)

### Source — fix commit `bc8acfc` で変更
- `apps/web/src/components/canvas/CanvasStage.tsx` — Modified (refs + instrumentation 削除)
- `apps/web/src/components/canvas/ImageLayer.tsx` — Modified (listening={false})
- `apps/web/src/components/canvas/TextEditorOverlay.tsx` — Modified (armedRef 250ms ガード)
- `apps/web/src/hooks/useAnnotationsStore.ts` — Modified (useReducer 統合)
- `apps/web/src/hooks/useHistory.ts` — Deleted (dead code)

### Source — Phase 3 ブランチ全体
- 28 added, 4 modified（前回 review v1 と同範囲）

### Docs
- `.claude/PRPs/reports/phase-3-canvas-annotation-tools-report.md` — Modified (Post-Implementation Bugs セクション追記)
- `.claude/PRPs/reviews/phase-3-canvas-annotation-tools-review.md` — Added (前回 review)
- `.claude/PRPs/reviews/phase-3-canvas-annotation-tools-review-v2.md` — Added (本レポート)

## Recommendation

**APPROVE with comments** — マージ可能。MEDIUM #1 (state/replace dead code) は merge を block しないが、PR 投稿前 or merge 直後に対処推奨:

- **オプション A (推奨、最小修正)**: `state/replace` action を `AnnotationsAction` union と reducer の case + テストから削除。15 行程度の clean up。
- **オプション B**: `state/replace` の存在理由を 1 行コメントで明示（"future Yjs snapshot ingestion"）。

これ以外は新たな問題なし。Phase 3 は実装完了。

## Next Steps

- [ ] (任意) MEDIUM #1 をオプション A or B で対処
- [ ] `gh pr create` で main 向け PR 作成
- [ ] PR マージ時に PRD Phase 3 ステータスを `in-progress` → `complete` に更新
- [ ] Phase 4（Yjs/CRDT 同期）プラン作成
