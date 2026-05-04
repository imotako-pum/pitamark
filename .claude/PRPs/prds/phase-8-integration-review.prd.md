# Phase 8: 統合レビュー（観察のみ）

## Problem Statement

snap-share は Phase 0 〜 Phase 7.8 で MVP がほぼ完成し、Phase 9 dogfood に入る直前まで来ている。一方で実装の大半は Claude Code 主体で進められ、コードベースは production だけで ~14k LOC（apps/web 9.7k / apps/api 3.7k / packages/shared 0.8k）に肥大化した。各 Phase の `/code-review` は通っているが、Phase 単位レビューは **Phase 間の重複・矛盾・SSOT 違反・モダン性の劣化・拡張性の欠落** を構造的に見つけられない。結果として「動くが、人間の実装者として改修できるか自信が持てない」状態のまま Phase 9 dogfood に進もうとしている。

## Evidence

- ユーザー証言（2026-05-04）: 「動いているがコードベースが肥大化し、私のレビューが追いついてないので不安」「ほぼ Claude Code 実装しているが、人間の実装者も改修しやすいか確認したい」
- ユーザー証言（同）: 「Phase 単位レビューでは Phase 間の重複・矛盾を見つけられない」「SSOT 違反は単一 Phase からは見えづらい」
- 静的シグナル実測（2026-05-04, `apps/` `packages/` 配下）:
  - `as any` / `@ts-ignore` / `@ts-expect-error` / TODO / FIXME / HACK / XXX = **すべて 0** 🟢（Phase 単位 review が機能してきた証拠）
  - `as unknown` = **58** ⚠️（double-cast 中間として deliberate な可能性も含む、要 triage）
  - `as <Type>` 全体 = **363** ⚠️（`as const` / `as HTMLElement` 等の安全系を含む、要 triage）
  - `biome-ignore` = **26** ⚠️（1 件ずつ disable 理由を確認したい）
- PRP 整理状況の即時確認（Phase 8 着手前の cleanup pass で発見）:
  - `snap-share.prd.md` の Phase status table が 7.7 / 7.8 を反映しないまま放置（commit `9748246` で解消済）
  - `plans/phase-7.6-...plan.md` が完了済なのに `completed/` へ未移動（同じ commit で解消済）
  - サブフェーズの review 抜け（7.7-1/-2/-3, 7.8-5）/ umbrella report 不在（7.7, 7.8）/ 命名揺れ（`local-review-phase-*` / `phase-7.6-partial-implementation-review`）
- リポジトリ規模（2026-05-04）: TS/TSX 209 ファイル、合計 ~21,533 LOC（テスト含む）

## Proposed Solution

「Phase 単位レビューでは見えない横断的な健全性」を **13 観点** に分解し、各観点に専門 agent または手動 review を割り当てて並列実行する。各レビューは既存雛形（`reviews/phase-7.8-3-font-size-ui-review.md` 形式）に従って Severity / Location (file:line) / Issue / Suggested Fix を揃え、最後に統合 report で **「Phase 8.x で着手すべき finding 一覧 + 推奨着手順」** を提示する。

LOW finding には **「human friction」フラグ** を付与し、人間が改修するときの摩擦になる項目だけ Phase 8.x で着手する（純粋 cosmetic は backlog）。これにより Phase 8 自体は **観察のみ** の one-shot review として完結し、修正は Phase 8.x で別ブランチ・別 PR に切り出す（memory: 1 Phase = 1 ブランチ = 1 PR）。

## Key Hypothesis

我々は **13 観点の横断 review + 「human friction LOW」filter** が、**「Claude Code 主体で書かれた肥大化コードベースに対する漠然とした不安」を文書で解消** すると信じる。

検証ポイント:
- Phase 8 完了直後にレビュー成果物を読み、Phase 8.x で「何をどの順番で直すか」を **30 分以内に決められる**
- Phase 9 dogfood 開始時に「コード起因の問題」と「UX 起因の問題」を切り分ける一次資料が手元にある
- 「人間の実装者が改修できるか」を **finding 単位で言語化** できている

## What We're NOT Building

- **実コードの修正** — Phase 8.x で別ブランチ・別 PR に切り出す
- **dogfood 実走** — Phase 9 のスコープ
- **継続的レビュー基盤** — Phase 8 は one-shot review、CI/CD 上の自動レビュー化は別 Phase 判断
- **frozen archive の touch** — `reviews/local-review-phase-*` / `phase-7.6-partial-implementation-review.md` の rename や統一化はしない（参照ゼロ、historical artifact 扱い）
- **cosmetic LOW の修正** — 「human friction」フラグが付かない LOW は backlog 行き、Phase 9 dogfood 後に再判断
- **retroactive review 作成** — 7.7-1/-2/-3, 7.8-5 の review を後から書き起こさない（観点 #12 PRP 整理状況 review で "process 観察" として記録するに留める）
- **新規観点の発明** — 既存ルール（`.claude/rules/{typescript,web,common}/`）と過去 review 雛形に乗る観点に限定。新規パターン提案は別 Phase

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| 13 観点すべての review 文書化 | 100%（13 ファイル + 統合 report 1 ファイル） | `.claude/PRPs/reviews/phase-8-*.md` のファイル数 |
| 各 finding に Severity / Location / Issue / Suggested Fix が揃う | 100%（漏れ 0） | 統合 report での lint check（手動 or 軽量 script） |
| Phase 8.x 着手判断にかかる時間 | **30 分以内**（統合 report 読了後） | オーナー自己計測 |
| LOW finding に「human friction」フラグが付与されている率 | 100% | 統合 report の各 LOW 行に flag 列あり |
| CRITICAL / HIGH 検出時の対応 | Phase 9 dogfood 開始前に Phase 8.x で全件解消 | Phase 8.x 着手 PR の数と marge 状態 |
| MEDIUM 検出時の対応 | Phase 9 dogfood 開始前に Phase 8.x で全件解消 | 同上 |
| LOW 検出時の対応 | 「human friction」フラグ付きのみ Phase 8.x、それ以外は backlog 行き | 統合 report の最終セクション「Phase 8.x 候補一覧」 |

## Open Questions

- [ ] **13 観点が網羅か?** — i18n / CI 健全性 / ドキュメント整合性 / observability の追加検討（Plan 着手前に確定）
- [ ] **観点間の重複境界** — モダン性 #2 vs React/Hono #3,#4、SSOT #1 vs 拡張性 #7 の線引き（Plan で詰める）
- [ ] **agent 並列実行の整合性** — 別 session で agent を回した場合、finding の重複・矛盾を merge する手順
- [ ] **Phase 8.x の PR 分割単位** — 観点ごと / Severity ごと / hot path ごと（Phase 8 完了後の判断）
- [ ] **「human friction」基準の客観化** — 改修時に必ず読む箇所か / 再発生コストが高いか / 認知負荷を増やすか の 3 軸スコア化を Plan で具体化

---

## Users & Context

### Primary User

- **Who**: オーナー（= 主実装者 = レビュー責任者）自身
- **Current behavior**: Phase 単位で `/code-review` を回してきたが、横断観点（SSOT 違反 / Phase 間の重複・矛盾 / 肥大化に伴う負債）は単一 Phase からは見えない
- **Trigger**: MVP がほぼ完成し、Phase 9 dogfood に進もうとしている瞬間
- **Success state**: 13 観点で「修正対象 issue が一意に特定できている」レビュー成果物が手元にあり、Phase 8.x で着手できる

### Job to Be Done

> **When** MVP がほぼ完成し Phase 9 dogfood に進もうとしているとき、
> **I want to** リポジトリ全体を一度俯瞰して 13 観点でレビューし、
> **so I can** Claude Code 主体で書いてきた肥大化コードベースに対する不安を解消し、人間の実装者として改修可能な状態を文書で担保できる。

### Non-Users（明示的に対象外）

- 外部 OSS contributor — まだ存在しない、Phase 9 以降の検討事項
- CI/CD 上で継続実行する自動レビュー基盤 — Phase 8 は one-shot
- Phase 9 dogfood 中に新規発生する個別バグ — Phase 9 のスコープ
- frozen archive（過去 review の命名揺れ等）の touch 対象者 — 参照ゼロの historical artifact

---

## Solution Detail

### 13 観点（Core Capabilities）

| # | 観点 | 主担当 agent (案) | 既存ルール参照 |
|---|---|---|---|
| 1 | SSOT 遵守（`packages/shared` 中心、重複/漏れ） | architect | `common/coding-style.md`（DRY） |
| 2 | モダン性（2026 ベスト寄りの library 選定・version・API 鮮度） | modernity audit（手動 + Context7） | (新規、Plan で確定) |
| 3 | **React ベストプラクティス**（hooks 規律 / 状態管理 / `useState` vs `useRef` / React 19 idioms / `react-konva` 連携） | typescript-reviewer | `typescript/hooks.md`, `typescript/patterns.md`, CLAUDE.md cross-cutting design rules |
| 4 | **Hono ベストプラクティス**（`createRoute({ middleware })` / `@hono/zod-openapi` / `hc<AppType>` / Workers binding / middleware composition） | typescript-reviewer | CLAUDE.md API conventions, `Decisions Log` の middleware 配線 |
| 5 | その場しのぎ実装（TODO/FIXME/`@ts-ignore` 残置・回避策の固定化） | code-reviewer | `common/coding-style.md` |
| 6 | 型の健全性（`any`/`unknown`/`as` キャストの不必要な使用） | typescript-reviewer | `typescript/coding-style.md`, `tsconfig.base.json`（`noUncheckedIndexedAccess` 等） |
| 7 | 将来拡張性（annotation/collab/API 追加の容易性） | architect | (新規、Plan で確定) |
| 8 | テスト網羅（unit / integration / e2e、golden path カバレッジ） | code-reviewer | `common/testing.md`, `web/testing.md` |
| 9 | a11y（キーボード操作 / ARIA / reduced-motion） | a11y-architect | `web/coding-style.md`（semantic HTML）, `web/testing.md`（a11y） |
| 10 | bundle・perf（web のサイズ予算 / Konva・Yjs の遅延ロード余地） | performance-optimizer | `web/performance.md`（CWV 目標 / bundle budget） |
| 11 | ログ・エラー envelope の一貫性（`apps/api/src/lib/error.ts` 体系遵守） | code-reviewer | CLAUDE.md API conventions |
| 12 | `.claude/PRPs/` 整理状況（命名 / cleanup / review 漏れ） | (手動 or 軽量 agent) | (本 PRD 自体が部分観察済) |
| 13 | security（CSP / 入力検証 / R2・Worker 周辺の権限境界 / Turnstile / Rate Limit） | security-reviewer | `web/security.md`, `common/security.md` |

agent 配分は最終的に **Plan で確定**。重複境界（例: モダン性 #2 と React/Hono #3,#4）も Plan で詰める。

### MoSCoW（Phase 8 のスコープのみ）

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | 13 観点 review file（`reviews/phase-8-{axis}.md`）の生成 | ゴール直結 |
| Must | 統合 report（`reports/phase-8-integration-review-report.md`）の生成 | Phase 8.x 着手判断の単一資料 |
| Must | 各 finding に Severity / Location (file:line) / Issue / Suggested Fix が揃う | Phase 8.x の着手前提 |
| Must | LOW に「human friction」フラグ付与 | (c) 方針を物理的に Phase 8.x へ持ち込む |
| Must | 統合 report で「Phase 8.x 候補一覧 + 推奨着手順」を提示 | Vision 「文書で担保」を実現 |
| Should | agent 並列実行による実時間短縮 | Plan で詰める |
| Should | review file naming 規約（`phase-8-{axis}.md`）の確立 | アーカイブ整合性 |
| Could | Triage pass を独立 sub-step に切る（review 前） | Plan で判断 |
| Won't | 実コードの修正 | Phase 8.x のスコープ |
| Won't | dogfood 実走 | Phase 9 のスコープ |
| Won't | 継続的レビュー基盤 | one-shot |
| Won't | frozen archive の touch / rename | historical artifact |
| Won't | 純粋 cosmetic LOW の修正（Phase 8.x でも） | backlog |
| Won't | 7.7-1/-2/-3 / 7.8-5 の retroactive review 作成 | 観点 #12 で「process 観察」として記録 |

### MVP Scope（このレビュー手法が機能する最小単位）

1 観点を end-to-end で完走させる:

1. 該当観点の専門 agent（例: typescript-reviewer for #6 型の健全性）を 1 走らせる
2. `reviews/phase-8-{axis}.md` を雛形（`phase-7.8-3-*` 形式）で生成
3. Triage pass: false positive 除外 + 「human friction LOW」フィルタを適用
4. 残った findings に Severity / Location / Issue / Suggested Fix が揃う

これを **template** として残り 12 観点に並列展開する。

### Review Flow（クリティカルパス）

```
[Triage 先行 pass: 静的シグナル raw scan]
   ↓ 363 as / 58 as unknown / 26 biome-ignore を categorize
   ↓ 既知 false positive を除外
[13 観点 deep review（並列実行）]
   ↓ agent / 手動で観点ごとに review file 生成
   ↓ 各 finding に Severity + human friction flag
[統合 report]
   ↓ 観点間の重複・矛盾を merge
   ↓ Phase 8.x 候補一覧 + 推奨着手順を確定
[Phase 8.x kickoff（別 PR）]
```

---

## Technical Approach

**Feasibility**: **HIGH**

### Architecture Notes

- **review file location**: `.claude/PRPs/reviews/phase-8-{axis}.md`（13 ファイル）
- **統合 report location**: `.claude/PRPs/reports/phase-8-integration-review-report.md`
- **review 雛形**: `reviews/phase-7.8-3-font-size-ui-review.md` を最新かつ最も網羅的な形式として参照
- **Severity 体系**: 既存 review と同じく CRITICAL / HIGH / MEDIUM / LOW
- **Phase 8.x 着手フィルタ**:
  - CRITICAL / HIGH / MEDIUM は無条件に Phase 8.x 着手
  - LOW は「human friction」フラグ true のみ Phase 8.x 着手、false は backlog
- **「human friction」客観化（Plan で具体化）**: 暫定 3 軸案 — 改修時に必ず読む箇所か / 再発生コストが高いか / 認知負荷を増やすか

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| LOW=0 のバー × 447 yellow markers × 13 観点 で **Phase 8.x の修正工数が膨らむ** | H | (c) 方針：「human friction」フラグで cosmetic を backlog 行きに、Phase 8.x の volume を制御 |
| review レポートの **粒度がバラつく**（観点ごとに専門 agent が変わる） | M | Plan で **共通 finding template** を確定（Severity / Location / Issue / Repro / Suggested Fix） |
| **観点間の重複**（例: モダン性 #2 と React/Hono #3,#4 / SSOT #1 と 拡張性 #7） | M | Plan で **観点境界の明確化表** を先に作る、統合 report で merge |
| agent 並列で review を回した結果の **整合性確認が後手になる** | M | Plan で「triage 先行 → deep review → 統合 merge」の 3 段構えを規定 |
| 13 観点で**取りこぼし観点**が後から発覚する | M | Open Questions に「13 観点が網羅か?」を残し、Plan 着手前に最終確認 |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently
  DEPENDS: phases that must complete first
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 8.0 | PRD 整理 + Phase 8 ブランチ確立 | snap-share.prd.md desync 解消 / 7.6 plan 移動 / Phase 7.7・7.8・8・9 を table 反映 | complete | - | - | (本 PRD 自体、commits `9748246` `1012c29` `96f5f66`) |
| 8.A | Triage 先行 pass | 静的シグナル raw scan / categorize / false positive 除外 / 観点境界の確定 | in-progress | - | 8.0 | [plan](../plans/phase-8-integration-review.plan.md) (umbrella) |
| 8.B | 13 観点 deep review | 観点ごとに専門 agent or 手動 review、`reviews/phase-8-{axis}-review.md` 生成 | pending | with 観点間 | 8.A | [plan](../plans/phase-8-integration-review.plan.md) (umbrella) |
| 8.C | 統合 report 生成 | 観点間の重複・矛盾 merge / Phase 8.x 候補一覧 + 推奨着手順 | pending | - | 8.B | [plan](../plans/phase-8-integration-review.plan.md) (umbrella) |

### Phase Details

**Phase 8.0: PRD 整理 + Phase 8 ブランチ確立（complete）**
- Goal: Phase 8 の作業基盤を整える
- 完了内容（commits `9748246`, `1012c29`）:
  - `snap-share.prd.md` の Phase status table を 7.7 / 7.8 / 8 / 9 に追従
  - `phase-7.6-...plan.md` を `plans/completed/` へ移動
  - 13 観点の確定（React / Hono を独立観点として追加）
- Success signal: 本 PRD が `feat/phase-8-integration-review` ブランチで生成され、Phase status table が現実と一致

**Phase 8.A: Triage 先行 pass**
- Goal: 13 観点 deep review に入る前に、静的シグナルの categorize と false positive 除外を完了させる
- Scope:
  - `as <Type>` 363 hits を `as const` / `as HTMLElement` 等の安全系と `as <UserType>` の要 review 系に分離
  - `as unknown` 58 hits を double-cast 中間 / 単独 unknown キャスト で分類、後者は要 review に
  - `biome-ignore` 26 hits の disable 理由を 1 件ずつ確認、無理由なら要 review
  - 13 観点間の境界を明文化（例: 「モダン性 #2 はバージョン pin と非推奨 API 利用、React/Hono #3,#4 は idiom 規律」）
  - 「human friction」3 軸スコア化（改修時必読 / 再発コスト / 認知負荷）の運用定義を確定
- Success signal:
  - signal categorize 表が `reviews/phase-8-triage.md` として完成
  - 観点境界表が確定し、deep review で重複しない
  - 「human friction」スコアの運用ルールが Plan に明記される

**Phase 8.B: 13 観点 deep review（並列実行）**
- Goal: 13 観点すべてで review file を生成する
- Scope:
  - 観点 1 SSOT / 7 拡張性 → architect agent（並列可、観点境界を尊重）
  - 観点 2 モダン性 → 手動 + Context7 で library 鮮度確認
  - 観点 3 React / 4 Hono / 6 型 / 8 テスト網羅 / 11 エラー envelope → typescript-reviewer / code-reviewer
  - 観点 5 その場しのぎ実装 → code-reviewer
  - 観点 9 a11y → a11y-architect
  - 観点 10 bundle・perf → performance-optimizer（必要なら `pnpm build` の実走付き）
  - 観点 12 PRP 整理状況 → 手動 or 軽量 agent
  - 観点 13 security → security-reviewer
  - 各 review file は雛形に従い Severity / Location / Issue / Suggested Fix を揃える
  - LOW finding に「human friction」フラグを付与
- Success signal:
  - `reviews/phase-8-{axis}.md` が 13 ファイル生成
  - 観点ごとの finding 数が summary 化されている
  - 共通 template に従っており粒度が揃っている

**Phase 8.C: 統合 report 生成**
- Goal: 13 観点の review 結果を 1 つの判断資料に集約する
- Scope:
  - 観点間の重複・矛盾の merge（同じ finding が複数観点で挙がっていれば 1 つに統合）
  - 全 finding を Severity でソート
  - LOW については「human friction」フラグごとに分離、Phase 8.x 候補と backlog を明示
  - **Phase 8.x 推奨着手順** を提示（PR 分割単位の暫定提案）
  - Phase 9 dogfood の Go/No-Go 判断材料セクションを設ける
- Success signal:
  - `reports/phase-8-integration-review-report.md` が完成
  - オーナーが 30 分以内に Phase 8.x の着手順を決められる
  - CRITICAL / HIGH / MEDIUM の件数 + LOW の human friction true 件数が明示される

### Parallelism Notes

- **Phase 8.A は逐次**: deep review に入る前提条件のため、並列化しない
- **Phase 8.B 内は観点間で並列可**: agent 並列実行でセッション数を増やせる（コスト/時間トレードオフ）
- **Phase 8.C は逐次**: B の全成果が前提

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Phase 8 のスコープ | 観察のみ（修正は Phase 8.x） | review + 修正を 1 Phase で / review のみで完結 | memory: 1 Phase = 1 ブランチ = 1 PR、観察と修正を混ぜると 1 PR が肥大化 |
| LOW の扱い | 「human friction」フラグ true のみ Phase 8.x 着手、false は backlog | LOW=0 を維持し全件着手 / LOW を観察のみ | (c) 方針を採用、Vision「人間が改修できるか」直結項目だけ着手し、cosmetic は据え置き |
| 観点数 | 13（React / Hono を独立観点として追加） | 11（モダン性に React/Hono を含める） / 14+ | idiom 規律はバージョン選定と独立した品質軸。i18n / CI / observability は Open Question で追加判断 |
| review file naming | `phase-8-{axis}.md` | `phase-8-{number}-{axis}.md` / `phase-8/{axis}.md` | 既存 review との整合性、`{axis}` で内容が即座に識別可能 |
| 統合 report の粒度 | finding を Severity ソート + LOW を human friction で分離 | 観点ごとに章立て / Phase 8.x ごとにグルーピング | Phase 8.x 着手判断の最短経路 |
| frozen archive | touch しない（rename / 統一なし） | 命名統一 / 古い `local-review-*` を削除 | 参照ゼロ、historical artifact、Phase 8 のスコープ外 |
| retroactive review | 作成しない（process 観察に留める） | 7.7-1/-2/-3 / 7.8-5 を後追い review | 観点 #12 で「process miss」として記録すれば足りる、書き起こしは情報価値が低い |

---

## Research Summary

### 既存資産（Phase 8 で再利用）

- **`.claude/rules/{typescript,web,common}/`**: 13 観点のうち #1, #3, #4, #5, #6, #8, #9, #10, #13 のチェックリスト相当
- **過去 review 雛形**: `reviews/phase-7.8-3-font-size-ui-review.md` が最新かつ最も網羅的な形式
- **CLAUDE.md cross-cutting design rules**: 観点 #3 React / #4 Hono / #1 SSOT の判定基準
- **`Decisions Log`（snap-share.prd.md）**: 観点 #2 モダン性 / #4 Hono の確定事項を遡及確認するソース

### 静的シグナルスナップショット（2026-05-04）

- production LOC: apps/web 9.7k / apps/api 3.7k / packages/shared 0.8k = ~14k
- yellow markers: `as <Type>` 363 / `as unknown` 58 / `biome-ignore` 26 = **447 件** が Phase 8.A の triage 対象
- red markers: 0（Phase 単位 review が機能してきた証拠）

### Tech stack snapshot（観点 #2 モダン性の入口）

| 項目 | 採用 | 2026-01 時点ノート |
|---|---|---|
| TypeScript | 5.6.3（catalog） | 5.7 系が出ているので軽い chore で更新可能 |
| React / react-konva | 19.2 / 19.2 | current |
| Konva | 10.2 | current（10.x 最新系） |
| Yjs / y-websocket | 13.6 / 3.0 | current |
| Vitest | 4.1 | current（4.x 最新系） |
| Hono ecosystem | zod-openapi 1.3 / scalar 0.10 | 移り変わり早い領域、要鮮度確認 |
| Biome | 2.2（root devDep）/ 2.4.13（Decisions Log） | バージョン記述が pin 不一致、観点 #12 で整える対象 |

---

*Generated: 2026-05-04*
*Status: DRAFT - needs validation*
