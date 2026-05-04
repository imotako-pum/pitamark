# Local Code Review: Phase 8 — PRP 整理状況 (#12)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: `.claude/PRPs/{prds,plans,reports,reviews}/` の全体構成 / 命名揺れ / cleanup miss / process miss / Phase 8.0 で実施した整理の記録
**Decision**: NEEDS_FIX
  - MEDIUM 1 (umbrella report 不在の policy 確定が必要)
  - LOW 5

## Summary

`.claude/PRPs/` 配下の構成を inventory した結果、Phase 8.0 で実施した整理 (`snap-share.prd.md` desync fix / `phase-7.6-...plan.md` の completed/ 移動 / Phase 8 + 9 の reservation) は完了済。Phase 7.7 / 7.8 の Phase status table 反映、Phase 8 の PRD/Plan link 追加もすべて反映済。

残課題として **process miss が 4 系統**:

1. **サブフェーズ review 抜け**: 7.7-1 / 7.7-2 / 7.7-3 / 7.8-5 の review file が `reviews/` に存在しない (4 件)。一方 7.7-4 / 7.8-1 / 7.8-2 / 7.8-3 は review 完備。理由は明示されていないが、推察として「実装規模が小さく code-review skip した」or「review は走らせたが artifact 化を忘れた」のどちらか。triage 段階で **「retroactive 作成しない、process miss として記録」** 方針確定済。
2. **umbrella report 不在**: Phase 7.5 / 7.6 には parent phase の report (`phase-7.5-...-report.md` / `phase-7.6-...-report.md`) が存在するが、Phase 7.7 / 7.8 はサブフェーズの report のみで umbrella なし。pattern として「umbrella report を必須化するか」の policy が未確定。
3. **命名揺れ (frozen archive 扱い)**: `reviews/local-review-phase-{0,1,2,2.5}.md` (旧命名) と `reviews/phase-7.6-partial-implementation-review.md` (固有命名) が他 review (`phase-N-{kebab}-review.md` 形式) と異なる。Phase 8 では touch しない方針 (frozen archive、参照ゼロ)。
4. **`phase-7.8-5-dogfood-checklist.md`** は他 sub-phase report が `phase-N-X-{name}-report.md` 形式なのに対し `-checklist.md` 接尾辞。dogfood 用の checklist という性質ゆえだが、命名 family の例外として記録。

加えて positive observations:
- Phase 8.0 で snap-share.prd.md の Phase status table を 7.7 / 7.8 / 8 / 9 に追従させた cleanup は **本 review の事前作業として価値が大きく**、commit `9748246` / `1012c29` / `96f5f66` で履歴に残っている。
- Phase 8 内部で 8.A / 8.B / 8.C の sub-step を **umbrella plan 1 ファイル** に集約した構造は、各 sub-step が密結合 (8.A 出力 → 8.B 入力) なため適切な選択。Phase 7.7 / 7.8 (sub-step が独立) では sub-plan 分割が適切だった。**「結合度に応じて umbrella vs sub-plan を選ぶ」原則の言語化** が次回以降の Phase に有用。

件数: CRITICAL 0 / HIGH 0 / MEDIUM 1 / LOW 5、合計 6 件。

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

**M1: umbrella report の必須化 policy が未確定 — Phase 7.7 / 7.8 で抜け、今後も再発リスク**

- **Location**: `.claude/PRPs/reports/` 全体構成
  - Phase 7.5 / 7.6 → umbrella report あり
  - Phase 7.7 / 7.8 → umbrella report **なし** (サブフェーズ report 4 + dogfood-checklist のみ)
- **Issue**:
  Phase 単位の振り返り情報 (Acceptance に対する達成度 / 全 sub-phase の merge 結果 / 次フェーズへの引き継ぎ事項) が Phase 7.7 / 7.8 については **どこにも書かれていない**。各 sub-phase report はあるが、それらを横串でまとめる文書がないため、後から「Phase 7.7 で何が完了したか」「7.8 全体の所要時間/工数/品質状況」を確認するには 4 ファイル + PRD の Phase Details を読む必要がある。
  Phase 8 の deep review でも、`phase-8-tests-review.md` (#8) で「Phase 7.6 hotfix の再発防止 e2e が機能維持しているか」を確認するために umbrella report があれば一発参照できる場面で、サブフェーズ 4 つを順に追う羽目になった。
  Phase 9 dogfood 以降も「sub-plan 分割パターン」が続けば再発する。
- **Suggested Fix**:
  CLAUDE.md の workflow conventions 節 (or `.claude/rules/common/development-workflow.md`) に以下を追記:

  > **umbrella report の必須化**: 親 Phase が複数 sub-phase に分かれた場合 (例: Phase 7.7-1〜7.7-4)、各 sub-phase report に加えて親 Phase の **umbrella report** を `reports/phase-N-umbrella-report.md` または `reports/phase-N-summary.md` で作成する。内容:
  > - Phase 全体の Acceptance Criteria 達成度 (table)
  > - 全 sub-phase の deliverable 概要と link
  > - Phase 内で発見された未解決事項 / 次フェーズへの引き継ぎ
  > - 工数 (commit 数 + LOC + duration) の retrospective

  Phase 7.7 / 7.8 の retroactive umbrella report 作成は **Phase 8 のスコープ外** (PRD で明示的に NOT Building としている)。**Phase 9 以降から適用** が現実的。
- 重要度判定理由: Phase 単位の振り返り情報が散逸する構造的問題。次の Phase 9 dogfood で「Phase 7.7 で何を達成したか」を即座に参照できないと、「dogfood 中のバグが Phase 7.7 起因か 7.8 起因か」の切り分けに時間がかかる。MEDIUM 相当。

### LOW

**L1: サブフェーズ review 抜け 4 件 — process miss として記録のみ、retroactive 作成しない**

- **Location**:
  - `phase-7.7-1-annotation-resize` — review なし
  - `phase-7.7-2-color-palette` — review なし
  - `phase-7.7-3-zoom-pan-fit` — review なし
  - `phase-7.8-5-dogfood-help` — review なし
- **Issue**:
  他のサブフェーズ (`phase-7.7-4`, `phase-7.8-1/2/3`) は `reviews/phase-N-X-{kebab}-review.md` で review file が揃っているのに、上記 4 件のみ抜け。理由は記録に残っていない。
  影響:
  - 当該 sub-phase で発見された finding が文書化されていないため、Phase 8 の deep review (本 phase) で **そのコードを初見で追う必要があった** (本来なら過去 review との差分で進められた)
  - `/code-review` スキル運用上の「review 必須化」が機能していないことを示唆
- **Suggested Fix**:
  - retroactive review 作成は **しない** (Phase 8 PRD で NOT Building 明示)
  - PRP workflow にチェック追加: `/prp-implement` の Phase 5 (REPORT) で「review file が `reviews/` に存在するか」を確認、ない場合は `/code-review` を必須実行する gate を追加
- **Human Friction**: false
  - 改修時必読: no — 過去 review なので新規改修時に読む必要は薄い (現コードを直接読む)
  - 再発生コスト: low — 個別 review 作成のコストは低い (1 件 30 分程度)
  - 認知負荷増: no — 各 sub-phase の plan / report があるため文脈は追える
  - **判定**: 3/3 とも no/low → false (Phase 8.x backlog ではなく **PRP workflow の改善** として `/prp-implement` skill 改訂時に対応)

**L2: `reviews/local-review-phase-{0,1,2,2.5}.md` の旧命名 — frozen archive 扱い**

- **Location**: `.claude/PRPs/reviews/local-review-phase-{0,1,2,2.5}.md` の 4 ファイル
- **Issue**:
  Phase 0-2.5 の review が `local-review-phase-N.md` という古い命名で残っており、Phase 3 以降の `phase-N-{kebab}-review.md` 形式と不整合。Phase 8 整理時に grep で参照ゼロを確認済 (frozen archive)。
- **Suggested Fix**:
  Phase 8 PRD で「frozen archive、touch しない」方針確定済。残し続ける。次回 PRP 整理を行う Phase (Phase 9.x など) で「historical artifact 移動先 (`reviews/archive/` 等) を作るか?」を判断。
- **Human Friction**: false (3 軸とも no/low、参照ゼロ archive)

**L3: `phase-7.6-partial-implementation-review.md` の固有命名 — frozen archive**

- **Location**: `.claude/PRPs/reviews/phase-7.6-partial-implementation-review.md`
- **Issue**:
  他 Phase 7.x の review が `phase-7.5-...-review.md` / `phase-7.7-4-...-review.md` 形式なのに対し、これだけ `partial-implementation` という曖昧な接尾辞 (内容は Phase 7.6 が完了前の途中状態を review した artifact)。
- **Suggested Fix**:
  frozen archive 扱い。完了後の review として `phase-7.6-manual-qa-bug-recovery-review.md` が **無い** ことが本質的問題だが、umbrella report (M1) が解消されればそちらで補える。
- **Human Friction**: false

**L4: `phase-7.8-5-dogfood-checklist.md` の `-checklist` 接尾辞 — 命名 family の例外**

- **Location**: `.claude/PRPs/reports/phase-7.8-5-dogfood-checklist.md`
- **Issue**:
  他 sub-phase report が `phase-N-X-{name}-report.md` 形式なのに対し、これだけ `-checklist.md` 接尾辞。dogfood 実施用のチェックリスト (実行待ち TODO list) という性質に合わせた命名。`phase-7.8-5-dogfood-help-report.md` (実装 report) が並走しており、機能的には適切だが命名 family の例外として記録。
- **Suggested Fix**:
  そのまま維持。`-checklist` は「実行待ちの TODO list」、`-report` は「実装完了報告」という命名 family の **第二系列** として将来も使う想定なら、`.claude/rules/common/development-workflow.md` に明文化。
- **Human Friction**: false

**L5: Phase 内 sub-step を umbrella plan 1 ファイルにするか sub-plan 分割するかの policy が未明文化**

- **Location**: `.claude/PRPs/plans/completed/` 全体
  - umbrella 単一 plan 例: `phase-2-image-upload`, `phase-7.6-manual-qa-bug-recovery` (中で A/B/C/D/E sections)
  - sub-plan 分割例: `phase-7.7-{1,2,3,4}`, `phase-7.8-{1,2,3,5}`
  - 本 Phase 8 は umbrella を選択 (8.A/8.B/8.C が密結合のため)
- **Issue**:
  分割 vs 統合の判断基準が暗黙的。Phase 7.7 / 7.8 では「sub-feature が独立に merge 可能」だったため sub-plan 分割が選ばれ、Phase 8 では「triage → review → 統合 が密結合」だったため umbrella が選ばれた。本判断は妥当だが、policy として明文化されていない。
- **Suggested Fix**:
  CLAUDE.md or `.claude/rules/common/development-workflow.md` に追記:
  > **umbrella plan vs sub-plan の選択基準**:
  > - **umbrella plan**: sub-step が密結合 (前 step 出力 → 次 step 入力 / 同 PR で merge / 単独で価値が出ない) → 1 ファイル `phase-N.plan.md`
  > - **sub-plan 分割**: sub-feature が独立 (個別に merge 可能 / それぞれが単独で価値を出す) → `phase-N-{1,2,...}.plan.md`
- **Human Friction**: false (3 軸とも no/low)

## Resolution Update

(Phase 8.x or Phase 9 以降で各 finding 対応後に追記)

---

## Phase 8.0 で実施した整理の記録

整理して綺麗にした内容を以下に明示 (本 Phase 内ですでに完了):

| 整理項目 | commit | 概要 |
|---|---|---|
| `snap-share.prd.md` の Phase status table desync 解消 | `9748246` | Phase 7.6 status を complete に / Phase 7.7・7.8・8・9 を table に追加 / 旧 Phase 8 を 9 へ rename |
| `phase-7.6-...plan.md` の `completed/` 移動 | `9748246` (同 commit 内) | Phase 7.6 が完了済なのに `plans/` 直下に残置していたものを `plans/completed/` へ |
| Phase 8 観点に React / Hono ベストプラクティスを追加 | `1012c29` | 11 観点 → 13 観点に拡張 |
| Phase 8 PRD link を Phase status table に反映 | `96f5f66` | TBD → `[prd](./phase-8-integration-review.prd.md)` |
| Phase 8 Plan link を Phase status table と PRD Implementation Phases に反映 | `068d180` | Plan 生成時に Phase 8 status を `pending` → `in-progress` に |

## Process miss の記録 (retroactive 作成しない)

| Phase | 抜け項目 | 理由推察 | Phase 8 でどう扱ったか |
|---|---|---|---|
| 7.7-1 (annotation-resize) | review file 不在 | 不明 (実装規模小 + skip した可能性) | retroactive 作成せず、本 review file (`#12`) で記録のみ |
| 7.7-2 (color-palette) | review file 不在 | 不明 | 同上 |
| 7.7-3 (zoom-pan-fit) | review file 不在 | 不明 | 同上 |
| 7.8-5 (dogfood-help) | review file 不在 | 不明 | 同上 |
| 7.7 (umbrella) | umbrella report 不在 | 不明 (sub-plan 分割パターンの policy 未確定) | M1 で扱う |
| 7.8 (umbrella) | umbrella report 不在 | 同上 | M1 で扱う |

---
*Generated: 2026-05-04*
*Reviewer: 手動 (Phase 8.0 で部分観察済を統合)*
