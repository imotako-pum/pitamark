# Local Review: Phase 7.8-2 Auto-next-B 矩形→矢印 次手予測

**Reviewed**: 2026-05-04
**Branch**: `feat/phase-7.8-predictive-ux`
**Mode**: Local Review (uncommitted changes)
**Decision**: **APPROVE** with comments

## Summary

Phase 7.8-2 (B: 矩形→矢印 次手予測) の実装は plan 通りに完成し、CRITICAL / HIGH 級の問題は無い。238 unit test (新規 10) + 66 E2E test (新規 9 + 既存 2 件 Esc 挟み修正) すべて緑、typecheck/lint/build もクリーン。Phase 7.8-1 の Auto-next-A 連鎖を 100% 再利用しつつ、pending state を EditorShell に集中させることで「Enter binding が pending != null のときだけ provide される」設計が綺麗にまとまっている。dogfood で観察すべき UX 課題が 1 件 (LOW、pending 中の Cmd+Z で孤立矢印) と、保守性向上の余地が 1 件 (MEDIUM、`autoNextChainRef` 設定経路の統一) ある。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

#### M1: `handleConfirmAutoArrow` が `handleStartTextEditing` を経由せず ref を直接書き換える

- **File**: `apps/web/src/pages/EditorShell.tsx:401-402`
- **Issue**: `autoNextChainRef.current = true` を手書きしてから `setEditingTextId(textId)` を直接呼んでいる。Phase 7.8-1 の経路は `handleStartTextEditing(textId, { autoNext: true })` で同じ ref + state を 1 関数で書き換える。Phase 7.8-2 で同関数を経由しないため、ref 設定の規約が 2 箇所に分散している
  ```typescript
  // 現状 (L399-402):
  store.dispatch({ type: 'select/set', id: textId });
  setPendingAutoArrow(null);
  autoNextChainRef.current = true;
  setEditingTextId(textId);
  ```
- **Impact**: 機能は壊れない。将来 `autoNextChainRef` の責務が変わった (例: `setEditingTextId` 呼出と必ずペアにすべき) 場合、片方の経路だけ更新漏れリスク
- **Suggested fix**: `handleStartTextEditing(textId, { autoNext: true })` に置き換える:
  ```typescript
  setPendingAutoArrow(null);
  handleStartTextEditing(textId, { autoNext: true });
  ```
  これで「Auto-next chain を立てる + text 編集起動」が 1 関数に集約され、Phase 7.8-1 経路と完全対称になる
- **Priority**: 次回触る時 (Phase 7.8-3 でテキスト編集経路を再度触る時) に統一推奨。本フェーズの blocker ではない
- **Status**: ACKNOWLEDGED — 機能正常、リファクタ余地

### LOW

#### L1: `handleMouseUp` (CanvasStage.tsx) が 70 行と肥大化傾向

- **File**: `apps/web/src/components/canvas/CanvasStage.tsx:318-388`
- **Issue**: handleMouseUp が Phase 7.8-1 (arrow Auto-next) + Phase 7.8-2 (rectangle pending) の追加で 70 行超。`coding-style.md` の「Functions <50 lines」推奨に超過
- **Impact**: 可読性は維持されている (各分岐が type 判別共用体で明確)。リファクタすると plan の差分最小化方針に反する
- **Suggested fix**: `confirmDraftArrow(arrow)` / `confirmDraftRectangle(rect)` のヘルパ関数に分割。Phase 7.8-3 以降で追加分岐が必要になった時にまとめてリファクタ
- **Status**: NOTE — 既存コードの傾向継続、800 行制限以内

#### L2: `EditorShell.tsx` が 504 行と肥大化傾向

- **File**: `apps/web/src/pages/EditorShell.tsx`
- **Issue**: Phase 7.7-1 → 7.8-2 で 200 → 504 行に拡大。state / ref が 7-8 種、ハンドラが 10 種以上同居
- **Impact**: 800 行ガイドライン以内。可読性は section コメントで保たれている
- **Suggested fix**: `useEditorShellState`、`useAutoNextChain` 等の custom hook 抽出を Phase 7.8-5 (dogfood + チューニング) のタイミングで検討
- **Status**: NOTE — 太ってきたが許容範囲、Phase 7.8 完了後に再評価

#### L3: `handleConfirmAutoArrow` の `select/set: arrowId` (L382) は 2 行後に textId で上書きされる

- **File**: `apps/web/src/pages/EditorShell.tsx:382`
- **Issue**: arrow add 直後に arrowId を select するが、その 17 行後に textId で上書きされる。冗長な dispatch 1 つ
- **Impact**: 副作用なし。dispatch コスト 1 回分の無駄、ただし `select/set` は replace で history に残らないため undo/redo の挙動にも影響なし
- **Suggested fix**: 削除して直接 textId を select するか、明示的に「arrow 確定後の selectedId をログ用途で残す」コメントを追加
- **Status**: NOTE — dogfood 影響なし、削除しても動作変化なし

#### L4: pending 中に Cmd+Z で矩形を消すと「孤立矢印プレビュー」が残る

- **File**: `apps/web/src/pages/EditorShell.tsx` (handleConfirmAutoArrow / pending state)
- **Issue**: ユーザーが矩形描画 → pending 表示中に Cmd+Z → 矩形消失するが、`pendingAutoArrow` ref/state は残ったまま。Enter 確定すると「もう存在しない矩形に対する矢印」が描画される
- **Impact**: dogfood で混乱の可能性。実害は「ユーザーが意図しない位置の矢印が出る」だけ、データ破壊なし
- **Suggested fix**: `useEffect` で `annotations.length` の減少を観察し、最後の committing dispatch (= rectangle add) が undo された場合に pending クリア。または store の undo/redo callback で pending クリア
- **Priority**: dogfood 観察、頻度高ければ Phase 7.8-5 で対応
- **Status**: ACKNOWLEDGED — plan の Risks にも明記済

#### L5: `pendingAutoArrow.color` が後から色変更しても固定

- **File**: `apps/web/src/pages/EditorShell.tsx` (`handleAutoNextRectangle` snapshot)
- **Issue**: 矩形 mouseup 時の `activeColor` を pending に snapshot。Enter 確定までに C キーで色を変えても、プレビューと確定矢印は元の色のまま
- **Impact**: ユーザーは BS で消して再描画する必要がある。シンプル設計の代償
- **Suggested fix**: pending 中の C キーで pending.color も更新する仕組み追加。Phase 7.8-3 (フォントサイズ UI) で「pending 中の修正」を一般化する設計余地
- **Status**: NOTE — plan で意図的にシンプルに保つ判断、dogfood で要望出れば対応

## Validation Results

| Check | Result |
|---|---|
| Type check (`pnpm -w typecheck`) | Pass |
| Lint (`pnpm -w lint`) | Pass |
| Unit Tests (`pnpm -w test`) | Pass — 238 件全緑 (新規 10 件含む) |
| Build (`pnpm -w build`) | Pass — vite + wrangler dry-run |
| E2E (`pnpm -F @snap-share/web test:e2e`) | Pass — 全 66 件緑 (新規 9 件 + 既存 2 件修正含む) |

## Files Reviewed

| File | Change Type | Lines | Purpose |
|---|---|---|---|
| `apps/web/src/lib/autoArrowDefault.ts` | Added | 29 | 純関数: 矩形右辺中央 → 右下 45° 100px の {from, to} 計算 |
| `apps/web/src/lib/__tests__/autoArrowDefault.test.ts` | Added | 40 | 純関数 unit test 5 件 |
| `apps/web/e2e/auto-next-rect-arrow.spec.ts` | Added | 217 | E2E spec 9 件 |
| `apps/web/src/components/canvas/CanvasStage.tsx` | Modified | +81 / -? | pending Layer / handleMouseDown キャンセル / handleMouseUp rectangle 経路 |
| `apps/web/src/pages/EditorShell.tsx` | Modified | +130 / -? | pending state + 5 ハンドラ + window expose + 既存ハンドラ pending 優先化 |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | Modified | +16 / -0 | Enter binding (`onConfirmAutoArrow`) |
| `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` | Modified | +41 / -0 | Enter binding 5 件 |
| `apps/web/e2e/annotation-tools.spec.ts` | Modified | +6 / -0 | Esc 1 回挟み (Deviation #1) |
| `apps/web/e2e/keyboard-shortcuts.spec.ts` | Modified | +5 / -0 | Esc 2 回押し (Deviation #1) |
| `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` | Modified | +1 / -1 | Phase 2 status `pending` → `complete` + plan/report リンク |

## Pattern Compliance

| Aspect | Status | Notes |
|---|---|---|
| AnnotationSchema 拡張 | N/A | 既存 Rectangle / Arrow / Text スキーマで成立 |
| LOCAL_ORIGIN / Yjs transact 規約 | OK | annotation/add 経由で既存ラップが効く、stopUndoCapture で step 区切り (Phase 7.8-1 確立) |
| `<KonvaImage> listening={false}` | OK | pending Arrow Layer も `listening={false}` で hit-test を奪わない |
| Konva 色は hex literal | OK | `pendingAutoArrow.color` は activeColor (palette hex) を snapshot |
| `Readonly<{...}>` 型 | OK | `PendingAutoArrow` 含む全 type が Readonly |
| `import type` 分離 | OK | Annotation / Point / TextAnnotation / RectangleAnnotation 全て type-only import |
| `useCallback` 依存配列 | OK | 全 handler で適切に列挙、setPendingAutoArrow が stable |
| 既存 test pattern (`createRoot + act`) | OK | `@testing-library/react` 追加なし |
| biome formatter | OK | single quote / trailing comma / semicolon 維持 |
| 日本語ファースト原則 (CLAUDE.md) | OK | コメント・テスト名すべて日本語、識別子は英語 |
| `__SNAP_SHARE_*` window expose 命名 | OK | `__SNAP_SHARE_PENDING_AUTO_ARROW__` で既存規約踏襲 |

## Security Assessment

| Category | Status |
|---|---|
| Hardcoded credentials | None |
| XSS | Safe — Konva 描画のみ、外部入力経路なし |
| Injection | N/A |
| Path traversal | N/A |
| CSRF | N/A — UI のみ |
| Secret exposure | None |

## Final Verdict

**APPROVE with comments**: CRITICAL / HIGH 0 件。MEDIUM 1 件 (M1) は機能影響なしの保守性課題で次回触る時に対応推奨。LOW 5 件 (L1-L5) はいずれも既存傾向の延長 / dogfood 観察対象 / 仕様判断で本フェーズのブロッカーにならない。

> Next steps:
> - `/everything-claude-code:prp-commit` でコミット (`feat(phase-7.8-2): 矩形→矢印 Auto-next 次手予測`)
> - dogfood で L4 (孤立矢印) / L5 (色固定) の発生頻度を観察
> - Phase 7.8-3 (フォントサイズ UI) の plan 作成、または Phase 7.8 まとめて単 PR でも可
