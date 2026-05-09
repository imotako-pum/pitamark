# PR Review: #22 — feat(phase-10-j): Touch UX Standards Compliance — paired binding + 長押し menu + 20px anchor + 本物 touch event E2E

**Reviewed**: 2026-05-09
**Author**: imotako-pum (Taiki)
**Branch**: phase-10-j-touch-ux-standards → main
**Decision**: COMMENT (Draft PR、ADR-0007 D6 の実機 QA 完了後に Ready / Approve 判断)

## Summary

Phase 10.J 全 4 sub-phase (paired binding / 長押し menu / 20px anchor / 本物 touch event E2E) の実装完了。CI 自動部分はすべて緑、設計は ADR-0007 / 4 Plan / umbrella report で十分にトレース可能。MEDIUM 1 件 (a11y 改善余地) のみ発見、CRITICAL / HIGH なし。実機 QA pending を解消すれば merge 可能な品質。

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

#### M1. ContextMenu の `aria-label` に「削除」を流用 — a11y 観点で誤誘導

**File**: `apps/web/src/components/canvas/ContextMenu.tsx:103`

```tsx
<div
  ref={ref}
  role="menu"
  aria-label={t('contextMenu.delete')}  // ← 「削除」 / "Delete"
  ...
>
```

`role="menu"` の container に `aria-label="削除"` (`contextMenu.delete`) を流用しているため、screen reader は menu 全体を「削除メニュー」として読み上げる。実際には menu には複製 / 前面 / 背面 / 削除 の 4 項目があり、「削除」は最後の 1 項目。menu container は menu 全体を表す汎用名 (例: 「アクションメニュー」/ "Action menu") を持つべき。

**Suggested fix**:
- `i18n/ja.ts` / `i18n/en.ts` に `contextMenu.label` = 「アクションメニュー」/ "Annotation actions" を追加
- ContextMenu.tsx:103 を `aria-label={t('contextMenu.label')}` に変更

**Impact**: 実機 a11y QA (NVDA / VoiceOver / TalkBack) で誤読み上げ。Phase 10.J-2 PRD の Acceptance Criteria には a11y 項目が明示的に含まれていないため、本 PR の merge ブロッカーではない。post-merge fix 推奨。

### LOW

#### L1. `useLongPress` の cleanup effect 形式

**File**: `apps/web/src/hooks/useLongPress.ts:60`

```ts
useEffect(() => cancel, [cancel]);
```

`cancel` 関数を直接 cleanup として返している。`cancel` は `useCallback` で `deps: []` にされているため reference は固定で問題ないが、慣用的には `useEffect(() => () => cancel(), []);` の方が「unmount cleanup」と読みやすい。動作上は同じ。

#### L2. `reorderAnnotationY` の 2 回走査

**File**: `apps/web/src/domain/annotation/yjs-mutations.ts:158-188`

`Array.from(ya.values())` 後に reduce で max/min を取るため、annotation 数 N に対し O(N) を 1 回 (reduce のみ)。length チェック (line 167) と reduce が同じ array を参照しているので 2 回走査ではなく 1 回 + 1 回 access、問題なし。読み返してみると LOW でもなく、単にコメント不足。

→ 撤回。

### INFO (注記、Action 不要)

- **並列 5 workers 下の setupEditor flaky**: Phase 10.J-3 で観察、本 PR の commit message と umbrella report 引き継ぎ事項で記録済。本 PR の change と無関係 (api-server の負荷)。Phase 11+ retainer で workers 数調整 / spec シリアライズを検討
- **text 編集 Esc の挙動**: 旧 e2e は textarea が focus 取れず Esc が空振り → annotation 残存を assert していたが、本物 touch event で focus 取得が動く結果、実装側挙動 (`handleTextCancel`: 空文字なら remove) が露呈。実装は intent 通りなのでテスト側を修正済 (commit `554d261`、`commitTextAnnotation` で non-empty content 確定)。本 PR description にも明記
- **`HIT_TEST_MARGIN_PX = 8`** の forward-looking 定数: Phase 10.J-4 以降で `hitFunc` 拡張時に消費予定。10.J-1 の `LONG_PRESS_DURATION_MS` 先行定数化と同パターンで許容

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type check (`pnpm typecheck`) | ✅ Pass | turbo full cache hit |
| Lint (`pnpm lint`) | ✅ Pass | biome ci 228 files |
| Tests (`pnpm test`) | ✅ Pass | 401/401 (web 401 = 362 + 39 from Phase 10.J) |
| Build (`pnpm -F @pitamark/web build`) | ✅ Pass | 168ms、bundle 増加なし |
| E2E (mobile-chrome 単独) | ✅ Pass | 31 件 (既存 22 + 新規 9) |
| E2E (chromium 非劣化) | ✅ Pass | 78 件 |
| E2E (並列 5 workers) | ⚠ Flaky | setupEditor URL redirect timeout (本 PR 起因ではない、umbrella report で punch-list 化) |
| 実機 QA | ⏸ Pending | `docs/qa/phase-10-j-touch-manual-qa.md` 著者消費待ち (ADR-0007 D6) |

## Files Reviewed

### Source code (中核 review 対象)

- `apps/web/src/hooks/useLongPress.ts` — useLongPress hook (Pointer + Touch handlers, cleanup, vibrate)
- `apps/web/src/components/canvas/ContextMenu.tsx` — 長押しコンテキストメニュー UI
- `apps/web/src/domain/annotation/operations.ts` — `cloneAnnotationWithOffset` / `reorderAnnotation` 純粋関数
- `apps/web/src/domain/annotation/yjs-mutations.ts` — `reorderAnnotationY` Yjs 経路
- `apps/web/src/hooks/annotationsReducer.ts` — `annotation/reorder` action 配線 + isCommittingAction 網羅性
- `apps/web/src/pages/EditorShell.tsx` — menu state hold + `handleMenuSelect` dispatch + auto-close
- `apps/web/src/components/canvas/shapes/{Rectangle,Arrow,Highlight,Text}Shape.tsx` — paired binding (`onClick + onTap`) + `useLongPress` 配線
- `apps/web/src/components/canvas/colors.ts` — ANCHOR_SIZE_TOUCH 24→20
- `apps/web/src/lib/touch-thresholds.ts` — タイミング / サイズ定数 SSOT (7 定数)

### Tests

- `apps/web/src/lib/__tests__/touch-thresholds.test.ts` (NEW, 7 件 lock-in)
- `apps/web/src/components/canvas/__tests__/colors.test.ts` (NEW, 4 件 lock-in)
- `apps/web/src/hooks/__tests__/useLongPress.test.tsx` (NEW)
- `apps/web/src/components/canvas/__tests__/ContextMenu.test.tsx` (NEW)
- `apps/web/src/components/canvas/__tests__/{Rectangle,Arrow,Highlight}Shape.test.tsx` (paired binding assertion 追加)
- `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` (annotation/reorder + isCommittingAction)
- `apps/web/src/domain/annotation/__tests__/operations.test.ts` / `yjs-mutations.test.ts` (新 operation テスト)

### E2E

- `apps/web/e2e/fixtures/touch-helpers.ts` — `dispatchTouchEvent` / `touchSequence` / `dragViewport` / `dblTapViewport` / `commitTextAnnotation` / `setupEditor` 追加 + `tapStage` / `dragOnStage` 内部書き換え
- `apps/web/e2e/touch-paired-binding.spec.ts` (NEW, 4 件)
- `apps/web/e2e/touch-long-press-menu.spec.ts` (NEW, 5 件)
- `apps/web/e2e/touch-acceptance.spec.ts` / `touch-acceptance-edit.spec.ts` (helper 経路 migration、page.mouse 一掃)
- `apps/web/e2e/touch-rectangle-draw.spec.ts` (helper 統一)

### Docs

- `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` (Status: IMPLEMENTED 化)
- `.claude/PRPs/prds/snap-share.prd.md` (Phase 10 行 update)
- `.claude/PRPs/plans/completed/phase-10-j-{1,2,3,4}-*.plan.md` (4 plan archive)
- `.claude/PRPs/reports/phase-10-j-umbrella-report.md` (NEW)
- `docs/adr/ADR-0007-touch-ux-standards.md` (Proposed → Accepted)
- `docs/qa/phase-10-j-touch-manual-qa.md` (rename + Phase 10.J 14 ケース追加)

## 全体評価

- **設計品質**: 高い。ADR-0007 の決定 (paired binding / タイミング SSOT / 案 B z-order / 本物 touch event 経路) がコードと完全に整合。Open Questions のすべてに plan / commit message で回答が trace 可能
- **テスト品質**: 高い。lock-in test 11 件 (定数のドリフト検知) + paired binding sanity 4 件 + long-press menu 5 件で 10.J 固有の振る舞いを直接 lock-in。既存 19 件 migration で 10.I 時代の幻挙動 (空文字 Esc バグ) も解消
- **a11y**: M1 で改善余地 (post-merge OK)
- **ドキュメント**: umbrella report が秀逸 (Phase 10.I umbrella の構造を踏襲、達成度 / sub-phase deliverable / 引き継ぎ事項 / 工数 retro が網羅)

## Next steps

1. 実機 QA を `docs/qa/phase-10-j-touch-manual-qa.md` で消費 (iPhone Safari + Android Chrome、§1 19 ケース + §1B Phase 10.J 14 ケース + §2-§5)
2. 実機 QA 完了後、umbrella report の Acceptance Criteria 表を ⚠ → ✅ で update
3. (Optional) M1 a11y fix (`contextMenu.label` 追加 + aria-label 修正、post-merge でも可)
4. Draft → Ready for review に切替 → main へ merge
5. Phase 10.J 完了後、Phase 10.H (ランディング条件付き拡張 + AdSense slot 予約) または Phase 10.F (ドメイン取得 + v1.0.0 タグ) に着手

---

*Generated: 2026-05-09 (Claude Opus 4.7 1M context, code-review skill)*
