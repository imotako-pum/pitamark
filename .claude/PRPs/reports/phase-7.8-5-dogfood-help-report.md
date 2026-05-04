# Implementation Report: Phase 7.8-5 — dogfood + チューニング + HelpModal 追記 (Task 1-4)

## Summary

Phase 7.8-5 のうち **コード変更を伴う Task 1-4 (HelpModal 追記、テスト、PRD 整合、dogfood checklist 作成)** を実施。dogfood 実施 (Task 5) と値チューニング適用 (Task 6) は Plan 通り本 implement の範囲外で、オーナーが 1 週間運用して checklist を埋めた後に別途実施する。

Smart snap (Phase 7.8-4) は 2026-05-04 ユーザー判断で defer 確定 (stash@{0})、本 Phase はその defer 後の状態を前提に進めた。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual | Notes |
|---|---|---|---|
| Complexity | Small | Small | 一致 |
| Confidence | 9/10 | 9/10 | 既存 SECTIONS 配列に Row[] 1 つ追加 + テスト 2 件 + PRD 表更新 + 新規 md 1 件、迷う場面ゼロ |
| Files Changed | 7 (UPDATE 4, CREATE 1 + plan/report 自体) | 5 (UPDATE 3, CREATE 2) | 実コード対象は HelpModal + テストの 2 ファイル、ドキュメント (PRD + checklist) で +2、`apps/web/src/lib/{autoNextOffset,autoArrowDefault,fontSize}.ts` のコメント書換は **dogfood 結果待ち (Task 6)** で本 implement 対象外 |
| Estimated LOC | 80-150 | 約 53 行 (`git diff --stat`) | 想定下限以下、テスト追加分込み |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | HelpModal に「次手予測」セクション追加 | ✅ Complete | `PREDICT_ROWS` 定数を新設、`SECTIONS` の `テキスト` と `編集` の間に挿入、`DialogDescription` を 2 文に拡張 |
| 2 | HelpModal テストケース追加 | ✅ Complete | 新規 it ブロック 2 件 (Plan は 1 件想定だったが DialogDescription 検証も足して 2 件に増やした) + 既存 cheatsheet テストに `'次手予測'` の regression assertion 追記 |
| 3 | PRD を Smart snap defer に整合 | ✅ Complete | Phase 4 行を `deferred (2026-05-04)` + PRP Plan 列に `(skipped, stash@{0})` 注記、Phase 5 行の Depends を `1, 2, 3` に縮約、Phase 4 詳細にステータス注記、Phase 5 詳細を Smart snap 切離、Parallelism Notes 修正、Decisions Log に Smart snap defer 行追加 |
| 4 | dogfood checklist ドキュメント作成 | ✅ Complete | `.claude/PRPs/reports/phase-7.8-5-dogfood-checklist.md` を新規作成、計測指標・チューニング対象・観察ポイント・完了条件 + 実施中追記欄をテンプレ化 |
| 5 | dogfood 実施 | ⏸ Out of scope | Plan 通りオーナーが手動で 1 週間 / 30 画像実施。本 implement では起票せず |
| 6 | チューニング適用 + 完了報告 | ⏸ Out of scope | dogfood 結果次第で `autoNextOffset.ts` / `autoArrowDefault.ts` / `fontSize.ts` の値据置 or 調整 + コメント書換 + checklist の report 統合を行う |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ Pass | `pnpm -F @snap-share/web typecheck` zero error。HelpModal 編集後即時確認 + Validation phase で再確認 |
| Lint (biome) | ✅ Pass | `pnpm exec biome ci .` で 129 files checked, no fixes |
| Unit Tests (HelpModal 単体) | ✅ Pass | `pnpm vitest run src/components/dialogs/__tests__/HelpModal.test.tsx` で 5 tests pass (既存 3 + 新規 2) |
| Unit Tests (web 全体) | ✅ Pass | `pnpm test` (web) で **277 tests / 32 files pass** (regression 0) |
| Unit Tests (api) | ✅ Pass | 157 tests / 17 files pass |
| Unit Tests (shared) | ✅ Pass | 68 tests / 3 files pass |
| Build (web) | ✅ Pass | `pnpm build` → `tsc --noEmit && vite build` 成功 (918 KB bundle, gzip 283 KB — Phase 7.8-5 の編集規模では既存 warning 状態を悪化させていない) |
| Build (api wrangler dry-run) | ✅ Pass | bindings 表示後 `--dry-run: exiting now.` 正常終了 |
| Integration / E2E | ⏭ N/A | HelpModal の表示動線は unit test でカバー済 (DialogDescription / kbd 文字列)。Auto-next の挙動 E2E は Phase 7.8-1/-2 で確立済、本 Phase の変更は表示文言のみで挙動変更なしのため再実行不要 |
| Edge Cases | ⚠ Manual confirm pending | `⌫` (U+232B) のフォント表示崩れ、DialogDescription 2 文化による modal overflow 確認は **dogfood 開始前にブラウザで目視確認推奨**。unit test では文字列含有のみ確認 |

## Files Changed

| File | Action | Lines (Δ) |
|---|---|---|
| `apps/web/src/components/dialogs/HelpModal.tsx` | UPDATED | +13 |
| `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` | UPDATED | +28 |
| `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` | UPDATED | +12 / -9 (実質: Phase 4 deferred 行 / Phase 5 Depends 縮約 / Phase 4 詳細にヘッダ / Phase 5 詳細から snap 関連除去 / Parallelism Notes 修正 / Decisions Log 1 行追加) |
| `.claude/PRPs/plans/phase-7.8-5-dogfood-help.plan.md` | CREATED (前段) | +463 (plan 自体) |
| `.claude/PRPs/reports/phase-7.8-5-dogfood-checklist.md` | CREATED | +93 (dogfood 作業ノート) |

## Deviations from Plan

### Deviation 1: テスト件数 1 → 2 に増やした
- **WHAT**: Plan Task 2 は新規 it ブロックを 1 件想定だったが、`DialogDescription` の 2 文化検証用に 2 件目 (`exposes Auto-next confirm/cancel keys in the dialog description`) を追加した。
- **WHY**: DialogDescription への追記は HelpModal の発見性向上の主要部分なのに plan 想定では `data-slot="dialog-description"` への assertion がカバーされていなかった。`data-slot="dialog-title"` を使う既存 assertion パターンに揃える形で安価に追加できたため独立 it に分離した。
- **影響**: テスト件数 +1 のみ、production コードは無変更。

### Deviation 2: Task 6 (定数コメント書換) は dogfood 後に持ち越し
- **WHAT**: Plan Files to Change には `autoNextOffset.ts` / `autoArrowDefault.ts` / `fontSize.ts` を **UPDATE (条件付き)** で挙げていたが、本 implement では編集していない。
- **WHY**: コメントの「dogfood で再評価する」を実施日 + 結論に書き換える作業は dogfood 結果が出てから初めて意味があるため、Task 6 にバンドルした方が自然。Plan の Step-by-Step Tasks でも Task 6 として明示分離していた通り。
- **影響**: なし。本 implement のスコープと完了基準は Task 1-4 完了で満たす。

### Deviation 3: bundle サイズ警告は本 Phase で解消しない
- **WHAT**: `pnpm build` で `Some chunks are larger than 500 kB` warning が出る。
- **WHY**: 既存の web bundle が 918 KB (gzip 283 KB) で、CLAUDE.md の `App page < 300kb` budget を **既に Phase 7.8-3 完了時点で超過** している既知状態。Phase 7.8-5 の編集 (HelpModal +13 行) はこの状況を悪化させない。code-split は Phase 7.8 の責務外、別 phase で対応。
- **影響**: なし。

## Issues Encountered

### Issue 1: `pnpm lint` がエラー
- **症状**: `pnpm lint` 直接呼び出しで `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "lint" not found`。
- **原因**: turbo 経由で recursive 実行を試みているが workspace の `package.json` には `lint` script が無い (CLAUDE.md には「`biome ci .`」とトップレベル script として書かれている)。
- **対応**: `pnpm exec biome ci .` を直接実行。129 files checked, no fixes で pass 確認。
- **再発防止**: 今後 lint を回す場合は `pnpm exec biome ci .` を使う。`pnpm lint` の挙動は別途調査が必要だが本 Phase のスコープ外。

### Issue 2: なし以外
- HelpModal の `data-slot="dialog-description"` 属性は radix の Dialog から自動付与されており、既存テストの `[data-slot="dialog-title"]` と同じ選択方法で問題なく動作した。

## Tests Written

| Test File | New Tests | Coverage |
|---|---|---|
| `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` | 2 (`lists the Auto-next predict section ...`, `exposes Auto-next confirm/cancel keys ...`) + 既存 1 件への regression assertion | 「次手予測」セクション全 3 行のラベル + Enter / ⌫ kbd 描画 + DialogDescription への Auto-next 文言反映 |

## Next Steps

- [ ] **手動確認 (dogfood 前)**: ブラウザで `pnpm dev` → `?` を押し、`⌫` 記号がフォントで欠字していないこと、modal が viewport に収まることを目視
- [ ] **dogfood 開始**: `.claude/PRPs/reports/phase-7.8-5-dogfood-checklist.md` の「期間」「実測」「観察ログ」を 1 週間 + 30 画像で埋める
- [ ] **dogfood 完了後**: Plan Task 6 (定数チューニング適用 + コメント書換 + checklist → report 統合 + PRD §Success Metrics 反映 + Phase 5 status を `complete` に変更)
- [ ] (任意) `/code-review` で本 PR 範囲をレビュー
- [ ] dogfood 完了 + Task 6 完了の段階で `/everything-claude-code:prp-pr` で PR 化

---

*Generated: 2026-05-04 (Phase 7.8-5 implement, Task 1-4 完了時点)*
