# Plan: Phase 8 — 統合レビュー（観察のみ）

## Summary

Phase 8 PRD で確定した 13 観点の横断レビューを **(8.A) Triage 先行 pass → (8.B) 観点別 deep review × 13（並列）→ (8.C) 統合 report** の 3 段で実施し、`reviews/phase-8-*-review.md` 14 本 + `reports/phase-8-integration-review-report.md` 1 本を生成する。**実コード変更ゼロ**。LOW finding には「human friction」3 軸スコア（改修時必読 / 再発生コスト / 認知負荷増）に基づくフラグを付与し、Phase 8.x で着手すべき finding を統合 report で一覧化する。Plan 完了 ≠ 修正完了；修正は Phase 8.x で別ブランチ・別 PR に切り出す。

## User Story

As snap-share の オーナー兼 Phase 9 dogfood の唯一の被験者,
I want 13 観点の横断 review 成果物を「30 分以内に読み解いて Phase 8.x の着手順が決まる」形式で揃え、Claude Code 主体で書かれた肥大化コードベース（~14k LOC production）に対する漠然とした不安を文書で解消したい,
So that Phase 9 dogfood を「コード起因 vs UX 起因」の問題切り分けが可能な状態で開始でき、人間の実装者として改修可能であることを文書で担保できる。

## Problem → Solution

### Current（Phase 7.8 完了 + Phase 8.0 PRD 整理完了時点）

- **コードベース規模**: production だけで ~14k LOC（apps/web 9.7k / apps/api 3.7k / packages/shared 0.8k）。Phase 0 〜 Phase 7.8 まで Claude Code 主体で実装され、Phase 単位の `/code-review` は通っているが、**Phase 間の重複・矛盾・SSOT 違反・モダン性劣化・拡張性欠落** は構造的に検出されていない。
- **静的シグナル状況**:
  - red markers: `as any` / `@ts-ignore` / `@ts-expect-error` / TODO / FIXME / HACK / XXX = **すべて 0** 🟢（Phase 単位 review が機能してきた証拠）
  - yellow markers: `as <Type>` 363 件 / `as unknown` 58 件 / `biome-ignore` 26 件 = **計 447 件が triage 未済**
  - サンプル偏り（事前確認）: `as unknown` 上位 10 件のうち 9 件が E2E `window as unknown as Record<string, unknown>` の deliberate な使用、`biome-ignore` 上位 10 件のうち 9 件が `noNonNullAssertion` + 明示理由付き。**triage 後の真の review-worthy 件数は 447 より大幅に少ない見込み**。
- **PRP 整理状況**:
  - Phase 8.0（commits `9748246`, `1012c29`, `96f5f66`）で `snap-share.prd.md` の Phase status table desync と `phase-7.6-...plan.md` の completed/ 移動は解消済
  - 残課題（Phase 8 review で観察対象）: サブフェーズ review 抜け（7.7-1/-2/-3, 7.8-5）/ umbrella report 不在（7.7, 7.8）/ 命名揺れ（`local-review-phase-*` / `phase-7.6-partial-implementation-review`）
- **過去 review 雛形**: `reviews/phase-7.8-3-font-size-ui-review.md` が最新かつ最も網羅的な形式（CRITICAL / HIGH / MEDIUM / LOW + Location / Issue / Repro / Suggested Fix + Resolution Update セクション）。これを Phase 8 review 共通 template として採用。
- **既存ルール資産**: `.claude/rules/{typescript,web,common}/*.md` が 13 観点のうち #1, #3, #4, #5, #6, #8, #9, #10, #13 のチェックリスト相当。
- **Hot files が判明済**（>150 LOC のソースファイル）:
  - apps/web/src/pages/EditorShell.tsx (542) — observations #1, #3, #5, #7
  - apps/web/src/components/canvas/CanvasStage.tsx (537) — observations #3, #6, #10
  - apps/api/src/routes/rooms.ts (249) — observations #4, #11, #13
  - apps/web/src/hooks/useYjsAnnotationsStore.ts (200) — observations #1, #3, #6, #7
  - apps/web/src/pages/RoomEditor.tsx (194) — observations #3, #5
  - apps/api/src/services/room-service.ts (189) — observations #4, #11, #13
  - apps/web/src/lib/api-client.ts (171) — observation #4 (hc 型推論)
  - apps/web/src/hooks/useKeyboardShortcuts.ts (168) — observations #3, #9
  - apps/web/src/hooks/annotationsReducer.ts (161) — observations #1, #7
  - apps/web/src/lib/colorCycle.ts / yjs-mutations.ts / Toolbar.tsx 等は 150 前後

### Desired（Phase 8 完了時点）

- **`reviews/phase-8-{axis}-review.md` が 14 本完成**（観点 13 + triage 1 = 14）
  - すべて雛形 (`phase-7.8-3-...`) に従う
  - 各 finding に Severity / Location / Issue / Repro（必要なら）/ Suggested Fix / Human Friction (LOW のみ) が揃う
  - 観点境界に沿って finding が配置されている（重複は 8.C で merge）
- **`reports/phase-8-integration-review-report.md` が完成**
  - 全 finding を Severity でソートした summary 表
  - LOW を Human Friction フラグごとに分離
  - **Phase 8.x 推奨着手順**（PR 分割単位の暫定提案）
  - Phase 9 dogfood の **Go/No-Go 判断材料セクション**
- **PRD Phase 8 status が `pending` → `complete`** に更新（Plan 実行開始時に `in-progress`、完了時に `complete`）
- **Phase 8.x の着手判断が 30 分以内** で可能（オーナー自己計測）
- **CRITICAL / HIGH / MEDIUM の総件数 + LOW の Human Friction true 件数** が統合 report の冒頭に明示

### Acceptance（受け入れ条件）

- [ ] `.claude/PRPs/reviews/phase-8-{triage,ssot,modernity,react,hono,band-aids,typesafety,extensibility,tests,a11y,perf,error-envelope,prp-hygiene,security}-review.md` の **14 ファイルすべてが存在**
- [ ] 各ファイルに **Decision (APPROVE / BLOCK / NEEDS_FIX) / Summary / Findings** の主要セクションが揃う
- [ ] 各 finding に **Severity / Location (file:line) / Issue / Suggested Fix** が揃う（Repro は必要時）
- [ ] LOW finding に **Human Friction フラグ (true/false) と 3 軸スコア** が付与
- [ ] `.claude/PRPs/reports/phase-8-integration-review-report.md` に以下が含まれる:
  - [ ] 全 finding 件数サマリ（観点 × Severity の matrix）
  - [ ] CRITICAL / HIGH / MEDIUM の全リスト
  - [ ] LOW を Human Friction フラグごとに分離した 2 リスト
  - [ ] **Phase 8.x 推奨着手順**（PR 分割単位の暫定提案）
  - [ ] Phase 9 dogfood Go/No-Go 判断
- [ ] `snap-share.prd.md` の Phase 8 行が `pending` → `complete`、Plan link 追加済
- [ ] `phase-8-integration-review.prd.md` の Implementation Phases table が 8.A/8.B/8.C すべて `complete` に更新
- [ ] **実コードの差分は `.claude/PRPs/` 配下のみ**（apps/ packages/ 配下は無変更）

## Metadata

- **Complexity**: **Large**（13 観点 × ~14k LOC × 447 yellow markers triage、ただしコード差分はゼロ）
- **Source PRD**: `.claude/PRPs/prds/phase-8-integration-review.prd.md`
- **PRD Phase**: 8.A + 8.B + 8.C（umbrella plan、Phase 8 全体で 1 PR）
- **Depends on**: Phase 8.0（complete: PRD 整理 + ブランチ確立）
- **Parallel within**: 8.B 内の 13 観点は観点間で並列可能（agent 並列実行で短縮）
- **Estimated Files**: 新規 15 ファイル（`reviews/phase-8-*-review.md` × 14 + `reports/phase-8-integration-review-report.md` × 1）+ 更新 2 ファイル（`snap-share.prd.md` / `phase-8-integration-review.prd.md`）= **17 ファイル**
- **Estimated Time**: 観点ごとの review に 30〜60 分、triage 60 分、統合 report 60 分 → 計 8〜12 時間（agent 並列なら 4〜6 時間）

---

## UX Design

**N/A — internal review process, no end-user UX change**

レビュー実行は `.claude/PRPs/reviews/` と `.claude/PRPs/reports/` への文書追加のみ。`apps/` `packages/` 配下のコードは無変更。

---

## Mandatory Reading

実施者（オーナー or レビュー agent）が Plan 実行前に必ず読むべきファイル:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/phase-8-integration-review.prd.md` | all | 13 観点の定義 / Human Friction フィルタ / Acceptance Criteria の正本 |
| P0 | `.claude/PRPs/reviews/phase-7.8-3-font-size-ui-review.md` | all | review file の最新かつ最も網羅的な雛形 — Phase 8 全 review file の format ソース |
| P0 | `CLAUDE.md` | all | cross-cutting design rules / API conventions / 観点 #1 #3 #4 #11 の判定基準ソース |
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | Decisions Log section (lines 345-373) | 観点 #2 modernity / #4 Hono の確定事項 — 「現状はこの選択でロックしている」基準 |
| P1 | `.claude/rules/typescript/coding-style.md` | all | 観点 #6 型 / #5 その場しのぎ実装 のチェックリスト |
| P1 | `.claude/rules/typescript/hooks.md` | all | 観点 #3 React のチェックリスト |
| P1 | `.claude/rules/typescript/patterns.md` | all | 観点 #3 React / #7 拡張性 のチェックリスト |
| P1 | `.claude/rules/typescript/security.md` | all | 観点 #13 security のチェックリスト |
| P1 | `.claude/rules/typescript/testing.md` | all | 観点 #8 テスト網羅 のチェックリスト |
| P1 | `.claude/rules/web/coding-style.md` | all | 観点 #5 その場しのぎ実装 / #9 a11y のチェックリスト |
| P1 | `.claude/rules/web/design-quality.md` | all | 観点 #5 その場しのぎ実装 / #9 a11y のチェックリスト |
| P1 | `.claude/rules/web/hooks.md` | all | 観点 #3 React の web 拡張 |
| P1 | `.claude/rules/web/patterns.md` | all | 観点 #3 React / #7 拡張性 / #9 a11y |
| P1 | `.claude/rules/web/performance.md` | all | 観点 #10 bundle・perf のチェックリスト + CWV 目標 |
| P1 | `.claude/rules/web/security.md` | all | 観点 #13 security の web 拡張 (CSP / Forms / Headers) |
| P1 | `.claude/rules/web/testing.md` | all | 観点 #8 テスト網羅 / #9 a11y / #10 perf |
| P1 | `.claude/rules/common/coding-style.md` | all | 観点 #1 SSOT (DRY / immutability) / #5 / #6 |
| P1 | `.claude/rules/common/code-review.md` | all | review プロセスの正本 |
| P1 | `.claude/rules/common/security.md` | all | 観点 #13 security の横断ルール |
| P1 | `.claude/rules/common/testing.md` | all | 観点 #8 テスト網羅 / 80% カバレッジ目標 |
| P2 | 既存 review 全 16 ファイル (`reviews/*.md`) | summary | 過去 finding と被る/被らないの判断材料、retroactive review 観察 |
| P2 | `pnpm-workspace.yaml` の `catalog:` | all | 観点 #2 modernity の version pin 確認 |
| P2 | `apps/api/src/lib/error.ts` | all | 観点 #11 error envelope の正本 |
| P2 | `apps/api/wrangler.toml` | all | 観点 #13 security の Workers binding 確認 |
| P2 | `apps/web/_headers` | all | 観点 #13 security の CSP 確認 |
| P2 | `tsconfig.base.json` | all | 観点 #6 型の `noUncheckedIndexedAccess` 等の前提 |
| P2 | `biome.json` | all | 観点 #5 / #12 の lint policy 確認 |

## External Documentation

観点 #2 modernity の review 中のみ Context7 を使用:

| Topic | Source | Key Takeaway |
|---|---|---|
| TypeScript 5.7+ release notes | Context7 (`typescript`) | catalog 5.6.3 → 5.7 化の差分 / 非推奨 API 把握 |
| React 19.2+ idioms | Context7 (`react`) | useTransition / Actions / React Compiler 期待値 / use() hook |
| Hono 4.x ecosystem | Context7 (`hono`) / Context7 (`@hono/zod-openapi`) | 非推奨 API / middleware composition の推奨形 |
| Konva 10.x | Context7 (`konva`) | 10.2 → 10.x 最新の差分 |
| Yjs 13.x | Context7 (`yjs`) | 13.6 → 13.x 最新の差分 / y-protocols 整合 |
| Cloudflare Workers / Durable Objects | Context7 (`@cloudflare/workers-types`) | compat date 影響 / Hibernation API 安定性 |
| Vitest 4.x | Context7 (`vitest`) | 4.1 → 4.x 最新の差分 |
| Biome 2.4+ | Context7 (`biome`) | 2.2 (root) / 2.4.13 (Decisions Log) 不一致の解消方針 |

その他観点では external research 不要 — 既存内部パターンと既存ルールで判定可能。

---

## Patterns to Mirror

### REVIEW_FILE_FORMAT
SOURCE: `.claude/PRPs/reviews/phase-7.8-3-font-size-ui-review.md:1-25`

```markdown
# Local Code Review: Phase 8 — [Axis name]

**Reviewed**: 2026-MM-DD
**Branch**: feat/phase-8-integration-review
**Scope**: [審査範囲、観点境界に沿った hot files / hot dirs を列挙]
**Decision**: APPROVE | BLOCK | NEEDS_FIX
  - APPROVE: 該当観点で CRITICAL / HIGH / MEDIUM すべて 0、または事前に既知の話のみ
  - NEEDS_FIX: MEDIUM 以上の finding が発見された（Phase 8.x で対応する）
  - BLOCK: CRITICAL があり Phase 9 dogfood に進めない（緊急修正パッチが必要）

## Summary
[1-3 段落の総括: 観点全体の verdict、key signals、件数 (CRITICAL/HIGH/MEDIUM/LOW)]

## Findings

### CRITICAL
None. / [もしあれば下の FINDING_TEMPLATE に従う]

### HIGH
None. / ...

### MEDIUM
None. / ...

### LOW
None. / ...

## Resolution Update
[Phase 8.x で修正された後、Phase 8.x 着手側の Plan/Implement で追記]
```

### FINDING_TEMPLATE
SOURCE: `.claude/PRPs/reviews/phase-7.8-3-font-size-ui-review.md:33-80` （M1 finding を抽象化）

```markdown
**[Severity Code]: [短い title]**

- **Location**: `apps/web/src/.../File.tsx:LL-LL`
- **Issue**: [問題の説明 — 何が悪く、なぜ問題なのか]
- **Repro** (再現可能な場合のみ):
  1. [手順 1]
  2. [手順 2]
  3. [期待挙動 vs 実挙動]
- **Suggested Fix**:
  ```typescript
  // [修正コード片 — 必須ではないがあれば望ましい]
  ```
  または [概念レベルの修正方針]
- **Human Friction** (LOW のみ): true / false
  - 改修時必読: yes / no
  - 再発生コスト: high / med / low
  - 認知負荷増: yes / no
  - **判定 rule**: 上記 3 軸のうち **2 つ以上が "yes/high"** なら true

[CRITICAL / HIGH / MEDIUM では Human Friction 行は不要 — どのみち Phase 8.x で着手する]
```

### TRIAGE_TABLE_FORMAT
8.A の `phase-8-triage-review.md` で生成する categorize 表:

```markdown
## Signal Categorization

### `as <Type>` (363 hits)
| Pattern | Count | Sample (file:line) | Category | Phase 8.B で扱う観点 |
|---|---|---|---|---|
| `as const` | 13 | foo.ts:42 | safe / 型 narrowing | (excluded — review-worthy 0) |
| `as HTMLElement` / `as Element` | NN | bar.ts:88 | DOM API の仕様 | (excluded — DOM 型推論ギャップ) |
| `as <UserType>` | NN | baz.ts:120 | 要 review | #6 typesafety |
| `as unknown as <Type>` | 28 | qux.ts:99 | double-cast | #6 typesafety （deliberate? 確認） |
| ... | ... | ... | ... | ... |

### `as unknown` (58 hits)
| Pattern | Count | Sample | Category | Phase 8.B で扱う観点 |
|---|---|---|---|---|
| E2E `window as unknown as Record<string, ...>` | NN | e2e/foo.spec.ts:17 | E2E test ハッチ — deliberate | (excluded) |
| 単独 `as unknown` (cast 経由なし) | NN | bar.ts:33 | 要 review | #6 typesafety |
| ... | ... | ... | ... | ... |

### `biome-ignore` (26 hits)
| Pattern | Count | Sample | Category | Phase 8.B で扱う観点 |
|---|---|---|---|---|
| `noNonNullAssertion` + 明示理由 | NN | colorCycle.ts:11 | deliberate, 理由文付き | (low priority — #5 で文面 sanity check のみ) |
| 理由なし / 不十分 | NN | qux.ts:50 | 要 review | #5 band-aids |
| ... | ... | ... | ... | ... |

## 観点境界マップ
[Phase 8.B 各観点の境界 — どの finding がどの観点に属すか優先順位を確定]

| Topic | 主観点 | 副次的に拾う観点 | 観点境界の引き方 |
|---|---|---|---|
| Yjs ドキュメント管理 | #1 SSOT | #3 React, #6 typesafety, #7 拡張性 | Yjs 設計上の SSOT は #1 / hooks 規律は #3 / unknown キャストは #6 / 注釈追加容易性は #7 |
| エラー envelope | #11 error envelope | #4 Hono, #13 security | レスポンス形式は #11 / Hono middleware 配線は #4 / 情報漏洩は #13 |
| ColorPalette / FontSizeControl | #3 React | #9 a11y, #1 SSOT | hooks 規律 / 状態管理は #3 / role="group" + aria-label は #9 / activeColor SSOT は #1 |
| middleware composition | #4 Hono | #11 error envelope, #13 security | 配線方式は #4 / エラー伝搬は #11 / 認可は #13 |
| ... | ... | ... | ... |

## Human Friction 3 軸スコアの運用定義

LOW finding にのみ適用。以下 3 軸を yes/no（または high/med/low）で評価:

1. **改修時必読 (yes/no)**: その finding が出ている箇所のコードを、関連機能を改修するときに必ず読むか?
   - yes 例: 中核ファイル (EditorShell.tsx, CanvasStage.tsx, rooms.ts) 内、SSOT スキーマ周辺
   - no 例: e2e fixture 内、test helper 内、archive 扱いの module
2. **再発生コスト (high/med/low)**: 同じパターンが将来再発するとき、どのくらいの修正/リワークが必要か?
   - high: 設計レベルの直し、複数ファイルに波及
   - med: 1 ファイル内の局所修正
   - low: cosmetic、エディタ内置換 1 回
3. **認知負荷増 (yes/no)**: その finding を残したまま改修すると、人間の実装者が「なぜこうなっているのか」を理解するのに時間がかかるか?
   - yes 例: 不要な `as unknown` キャスト、命名揺れ、コメントなしの workaround
   - no 例: 標準パターンの軽微な逸脱、数値リテラルの定数化漏れ

**判定 rule**: 3 軸のうち **2 つ以上が "yes/high"** なら `Human Friction = true`、そうでなければ `false`。

`true` のみ Phase 8.x で着手、`false` は backlog 行き。
```

### INTEGRATION_REPORT_FORMAT
8.C の `phase-8-integration-review-report.md` で生成する統合 report 構造:

```markdown
# Report: Phase 8 — 統合レビュー

**Date**: 2026-MM-DD
**Branch**: feat/phase-8-integration-review
**Scope**: 13 観点の横断レビュー
**Decision (overall)**: APPROVE-WITH-FOLLOWUPS | BLOCK-PHASE9-START

## TL;DR
[Phase 9 dogfood に進めるか? / Phase 8.x で何枚 PR を切るべきか? を 3 行で]

## 件数サマリ

| 観点 | CRITICAL | HIGH | MEDIUM | LOW (HF=true) | LOW (HF=false) | 計 |
|---|---|---|---|---|---|---|
| #1 SSOT | 0 | 1 | 2 | 3 | 5 | 11 |
| #2 modernity | ... | ... | ... | ... | ... | ... |
| ... | ... | ... | ... | ... | ... | ... |
| **合計** | **N** | **N** | **N** | **N** | **N** | **N** |

## CRITICAL 一覧
[該当があれば Phase 9 dogfood 開始ブロック。各 finding の summary + 該当 review file へのリンク]

## HIGH 一覧
[各 finding の summary + 該当 review file へのリンク]

## MEDIUM 一覧
[同上]

## LOW (Human Friction = true) 一覧 — Phase 8.x 候補
[同上]

## LOW (Human Friction = false) 一覧 — Backlog（Phase 9 dogfood 後に再判断）
[同上]

## Phase 8.x 推奨着手順（PR 分割単位の暫定提案）

### Phase 8.x-1: [テーマ]
- 含める finding: ...
- 想定差分規模: ...
- 推奨 agent / 担当: ...
- ブランチ案: `fix/phase-8-x-1-...`

### Phase 8.x-2: [テーマ]
...

[3-5 PR を想定。観点別 / Severity 別 / hot path 別のいずれかで切る]

## Phase 9 dogfood Go/No-Go 判断
- **Go condition**: CRITICAL = 0 かつ HIGH ≤ N（事前合意）
- **判断結果**: Go / No-Go
- **No-Go の場合の解除条件**: ...

## 観点間の重複・矛盾の merge 記録
[同じ finding が複数観点で挙がった場合、どれをマスターにし、どれを削ったか]

## Open Items
[Phase 8.x にも Phase 9 にも送らない、別途方針を決めるべき事項]
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Phase 8 行 status を `pending` → `in-progress` (Task 1) → `complete` (Task 19) |
| `.claude/PRPs/prds/phase-8-integration-review.prd.md` | UPDATE | Implementation Phases table の 8.A/8.B/8.C status を順次更新、Plan link を追加 |
| `.claude/PRPs/reviews/phase-8-triage-review.md` | CREATE | 8.A 出力: signal categorize / 観点境界 / Human Friction 運用定義 |
| `.claude/PRPs/reviews/phase-8-ssot-review.md` | CREATE | 観点 #1 SSOT 遵守 |
| `.claude/PRPs/reviews/phase-8-modernity-review.md` | CREATE | 観点 #2 モダン性 (library 選定 / version / API 鮮度) |
| `.claude/PRPs/reviews/phase-8-react-review.md` | CREATE | 観点 #3 React ベストプラクティス |
| `.claude/PRPs/reviews/phase-8-hono-review.md` | CREATE | 観点 #4 Hono ベストプラクティス |
| `.claude/PRPs/reviews/phase-8-band-aids-review.md` | CREATE | 観点 #5 その場しのぎ実装 |
| `.claude/PRPs/reviews/phase-8-typesafety-review.md` | CREATE | 観点 #6 型の健全性 |
| `.claude/PRPs/reviews/phase-8-extensibility-review.md` | CREATE | 観点 #7 将来拡張性 |
| `.claude/PRPs/reviews/phase-8-tests-review.md` | CREATE | 観点 #8 テスト網羅 |
| `.claude/PRPs/reviews/phase-8-a11y-review.md` | CREATE | 観点 #9 a11y |
| `.claude/PRPs/reviews/phase-8-perf-review.md` | CREATE | 観点 #10 bundle・perf |
| `.claude/PRPs/reviews/phase-8-error-envelope-review.md` | CREATE | 観点 #11 ログ・エラー envelope 一貫性 |
| `.claude/PRPs/reviews/phase-8-prp-hygiene-review.md` | CREATE | 観点 #12 .claude/PRPs/ 整理状況 |
| `.claude/PRPs/reviews/phase-8-security-review.md` | CREATE | 観点 #13 security |
| `.claude/PRPs/reports/phase-8-integration-review-report.md` | CREATE | 8.C 出力: 統合 report + Phase 8.x 候補一覧 + Go/No-Go 判断 |

**合計**: 新規 15、更新 2 = **17 ファイル**。**`apps/` `packages/` 配下は touch しない**。

## NOT Building

- **実コードの修正** — Phase 8.x のスコープ
- **dogfood 実走** — Phase 9 のスコープ
- **継続的レビュー基盤** (CI 上の自動レビュー化、定期実行 hook 等) — one-shot で十分
- **frozen archive の touch** — `reviews/local-review-phase-*.md` / `phase-7.6-partial-implementation-review.md` の rename / 統一はしない（参照ゼロ、historical artifact）
- **純粋 cosmetic LOW の修正** (Phase 8.x でも) — `Human Friction = false` のものは backlog 行き、Phase 9 dogfood 後に再判断
- **retroactive review 作成** (7.7-1/-2/-3 / 7.8-5 の遡及 review) — 観点 #12 prp-hygiene-review で「process miss」として記録するに留める
- **新規観点の発明** — 既存ルール (`.claude/rules/`) と過去 review 雛形に乗る観点に限定
- **PRP workflow の改訂提案** (`/prp-prd` / `/prp-plan` の skill 自体を弄る) — 観点 #12 で「次回への学び」として記録するに留める

---

## Step-by-Step Tasks

### Task 1: PRD Phase 8 status を `in-progress` に更新

- **ACTION**: `snap-share.prd.md` の Phase 8 行 status を `pending` → `in-progress` に変更し、PRP plan link を `[prd]` の隣に追加。`phase-8-integration-review.prd.md` の Implementation Phases table の 8.A 行 status を `pending` → `in-progress` に変更し、`PRP Plan` 欄に Plan link を追加。
- **IMPLEMENT**:
  - `snap-share.prd.md`: `| 8 | ... | pending | - | 7.8 | [prd](./phase-8-integration-review.prd.md) |` → `| 8 | ... | in-progress | - | 7.8 | [prd](./phase-8-integration-review.prd.md) / [plan](../plans/phase-8-integration-review.plan.md) |`
  - `phase-8-integration-review.prd.md`: 8.A 行 `pending → in-progress`、`PRP Plan` 列 `TBD → [plan](../plans/phase-8-integration-review.plan.md)`
- **MIRROR**: 既存 Phase row の format
- **VALIDATE**: `git diff` で 2 ファイルそれぞれ 1 行差分のみであることを確認

### Task 2: 8.A-1 — Signal raw collection

- **ACTION**: 363 `as` / 58 `as unknown` / 26 `biome-ignore` を file:line 単位で収集し、一時メモとして残す（最終 review file には summary のみ載せる）
- **IMPLEMENT**:
  ```bash
  mkdir -p .claude/.tmp
  grep -rn --include='*.ts' --include='*.tsx' -E '\bas\s+\w+' apps packages > .claude/.tmp/phase-8-as-cast.txt
  grep -rn --include='*.ts' --include='*.tsx' -E '\bas\s+unknown\b' apps packages > .claude/.tmp/phase-8-as-unknown.txt
  grep -rn --include='*.ts' --include='*.tsx' -E 'biome-ignore' apps packages > .claude/.tmp/phase-8-biome-ignore.txt
  ```
- **MIRROR**: なし（一時メモ作業）
- **GOTCHA**: `.claude/.tmp/` を `.gitignore` 済か確認、未済なら追加（または `.tmp/` 配下を gitignore に列挙）。最終 review file には raw データを貼らず、件数 + 代表サンプル + categorize 結果のみ
- **VALIDATE**: 各 raw file の行数が EXPLORE 段階の件数 (363 / 58 / 26) と一致

### Task 3: 8.A-2 — Categorize signals

- **ACTION**: raw collection を「safe / review-worthy / deliberate / 未確定」の 4 カテゴリに分類
- **IMPLEMENT**:
  - `as <Type>` を以下に分類:
    - safe: `as const` / `as HTMLElement` / `as Element` / `as readonly [...]` 等の TS/DOM 型推論ギャップを埋める用途
    - deliberate: E2E `window as unknown as Record<...>` / Yjs `Map<unknown>` ↔ Type 変換等の boundary キャスト
    - review-worthy: ユーザー定義型へのキャスト、`as <UnionMember>`、絞り込みなしの cast
    - 未確定: 周辺コードを読まないと判断つかないもの
  - `as unknown` も同様に分類（多くは E2E test の deliberate と推測）
  - `biome-ignore` は disable コメントの理由文を読み、「明示理由付き」と「無理由 / 弱い理由」に分類
- **MIRROR**: TRIAGE_TABLE_FORMAT
- **GOTCHA**: review-worthy の総数を確定する作業 — これが観点 #6 typesafety / #5 band-aids の deep review 対象数の上限。100 件超なら Plan の estimate を見直す
- **VALIDATE**: 各 categorize 表の合計が raw collection の件数と一致 (loss なし)

### Task 4: 8.A-3 — 観点境界マップ作成

- **ACTION**: 13 観点間のオーバーラップ領域を明文化、どの finding がどの観点に属すか優先順位を確定
- **IMPLEMENT**: TRIAGE_TABLE_FORMAT の「観点境界マップ」表を埋める。少なくとも以下のオーバーラップは明示:
  - SSOT #1 vs 拡張性 #7: `packages/shared` 設計、annotation Schema
  - モダン性 #2 vs React #3 / Hono #4: version pin（#2）vs idiom 規律（#3 #4）
  - React #3 vs a11y #9: ColorPalette / FontSizeControl / Toolbar の role + aria
  - Hono #4 vs エラー envelope #11 vs security #13: middleware 配線
  - その場しのぎ #5 vs 型 #6: `as` キャスト by 理由
  - テスト網羅 #8 vs perf #10 vs a11y #9: e2e テストの責任範囲
  - PRP 整理 #12 vs その他全観点: process miss の記録は #12、コードレベルは各観点
- **MIRROR**: 既存 PRD の Decisions Log の形式（| Decision | Choice | Alternatives | Rationale |）に近い表
- **VALIDATE**: 各 hot file (EditorShell.tsx 等) について、それを deep review する観点が一意に決まる

### Task 5: 8.A-4 — Human Friction 3 軸スコア運用定義

- **ACTION**: 「改修時必読 / 再発生コスト / 認知負荷増」の判定基準を運用化、判定 rule を確定
- **IMPLEMENT**: TRIAGE_TABLE_FORMAT の「Human Friction 3 軸スコアの運用定義」セクションを埋める。判定 rule = 3 軸のうち 2 つ以上が "yes/high" なら true。各軸の yes / no の境界例 (中核ファイル / E2E fixture / archive) を Plan の段階で確定。
- **MIRROR**: なし（運用定義の新規制定）
- **VALIDATE**: 8.B 各観点の deep review で LOW finding に対し、運用定義に従って 3 軸スコアと最終フラグを 1 件ずつ判定できる

### Task 6: 8.A-5 — `phase-8-triage-review.md` の最終生成

- **ACTION**: Task 2-5 の出力を統合した review file を `reviews/phase-8-triage-review.md` として書き出す
- **IMPLEMENT**: REVIEW_FILE_FORMAT に従い、Decision = APPROVE（triage は finding 検出フェーズではないため）、Summary に triage 結果のサマリ、Findings セクションは空 (該当なしのまま)、追加で「Signal Categorization」「観点境界マップ」「Human Friction 3 軸スコア運用定義」セクションを後続に持つ
- **MIRROR**: REVIEW_FILE_FORMAT + TRIAGE_TABLE_FORMAT
- **VALIDATE**: file が存在、必要セクションがすべて揃う、運用定義が後続 review で使用可能

### Task 7: 8.A 完了マーク

- **ACTION**: `phase-8-integration-review.prd.md` の Implementation Phases table で 8.A 行を `in-progress` → `complete` に、8.B 行を `pending` → `in-progress` に更新
- **VALIDATE**: PRD diff が 2 行のみ

### Task 8 〜 20: 8.B — 観点別 deep review × 13

各観点の deep review は **以下の共通テンプレート** に従う。観点間で並列実行可（agent 並列または逐次でも可）。

#### 共通テンプレート（各 review task）

- **ACTION**: `reviews/phase-8-{axis}-review.md` を REVIEW_FILE_FORMAT に従って生成。Triage 結果と観点境界マップを参照し、該当観点に属する finding のみ列挙。
- **IMPLEMENT**:
  1. Mandatory Reading の P0 + 該当観点の P1 ルールを再読
  2. 観点境界マップで「自観点 - 他観点」境界を確認
  3. Hot files + 必要に応じて関連ファイルを read
  4. (該当する場合) 専門 agent を起動して review 委譲
  5. 各 finding を FINDING_TEMPLATE で記述
  6. LOW finding には Human Friction 3 軸スコアを付与
  7. 観点全体の Decision (APPROVE / NEEDS_FIX / BLOCK) を確定
  8. PRD `phase-8-integration-review.prd.md` の進捗メモを更新（任意）
- **MIRROR**: REVIEW_FILE_FORMAT, FINDING_TEMPLATE
- **GOTCHA**: 観点境界を超えた finding を見つけたら、適切な観点 review で扱うべきものとして記録のみし、自分の review file には書かない（後続観点担当が拾う）
- **VALIDATE**: ファイル生成、必要セクション揃う、Decision 明示

#### Task 8: #1 SSOT — `phase-8-ssot-review.md`

- **担当 (案)**: `architect` agent
- **Hot files / 領域**:
  - `packages/shared/src/index.ts` 全体（特に `RoomSchema`, `AnnotationSchema`, MIME / size 定数）
  - `apps/web/src/hooks/useAnnotationsStore.ts` / `useYjsAnnotationsStore.ts` / `annotationsReducer.ts` / `historyReducer.ts`
  - `apps/web/src/domain/annotation/yjs-mutations.ts`
  - `apps/api/src/routes/rooms.ts` / `apps/api/src/services/room-service.ts`
  - `apps/web/src/lib/api-client.ts`
  - `apps/web/src/components/canvas/colors.ts`（CLAUDE.md 設計ルール 4: Konva CSS variable 解決不可のため hex 同期）
- **観点境界からの除外**: 拡張性 #7（拡張可否）、React #3（hooks 規律）、Hono #4（API 境界）は副次観察に留める
- **チェックリスト**:
  - [ ] Zod スキーマ駆動の SSOT が `packages/shared/src/index.ts` 中心になっているか
  - [ ] `z.infer<typeof Schema>` で型を導出しているか（手書き type が混在していないか）
  - [ ] API 境界で `Schema.parse` が runtime 検証として機能しているか
  - [ ] `apps/web` `apps/api` で同名・同義の型定義が並走していないか
  - [ ] `colors.ts` の hex と `tokens.css` の OKLCH の同期が手動 sync ルール通りに維持されているか（CLAUDE.md 設計ルール 4）
  - [ ] catalog で集約されているはずの version pin が個別 `package.json` に逸脱していないか（cross-cutting design rule 6）

#### Task 9: #2 モダン性 — `phase-8-modernity-review.md`

- **担当 (案)**: 手動 + Context7
- **Hot files / 領域**:
  - `package.json` (root + 各 workspace) と `pnpm-workspace.yaml` の `catalog:`
  - `apps/web/vite.config.ts` / `apps/api/wrangler.toml`
  - `tsconfig.base.json` と各 tsconfig
  - `biome.json`
- **観点境界からの除外**: idiom 規律は React #3 / Hono #4 で扱う。モダン性は **version pin と非推奨 API 利用** に限定。
- **チェックリスト**:
  - [ ] catalog の version pin が 2026-01 時点の latest 系から大きく離れていないか
    - TypeScript 5.6.3 → 5.7+ への upgrade コスト評価
    - React / react-konva 19.2 → 19.x latest
    - Konva 10.2 → 10.x latest
    - Yjs 13.6 → 13.x latest
    - Hono ecosystem (zod-openapi 1.3 / scalar 0.10) の鮮度
    - Vitest 4.1 → 4.x latest
  - [ ] root devDep の Biome 2.2 と Decisions Log の 2.4.13 の不一致をどう解消するか
  - [ ] catalog で集約されているべき deps が個別記述されていないか
  - [ ] 非推奨 API 利用（React 18 idioms / Hono 旧 API / Konva 旧 API 等）の有無

#### Task 10: #3 React ベストプラクティス — `phase-8-react-review.md`

- **担当 (案)**: `typescript-reviewer` agent + 手動
- **Hot files / 領域**:
  - `apps/web/src/pages/EditorShell.tsx` (542 LOC) ← **重点**
  - `apps/web/src/pages/RoomEditor.tsx` / `LocalEditor.tsx`
  - `apps/web/src/components/canvas/CanvasStage.tsx` (537 LOC)
  - `apps/web/src/components/canvas/AnnotationLayer.tsx` / `ImageLayer.tsx`
  - `apps/web/src/components/dialogs/HelpModal.tsx`
  - `apps/web/src/components/empty-state/DropZone.tsx`
  - `apps/web/src/components/toolbar/Toolbar.tsx` / `ColorPalette.tsx` / `FontSizeControl.tsx`
  - `apps/web/src/components/room-gate/RoomGate.tsx`
  - `apps/web/src/hooks/*` 全部
- **観点境界**: a11y #9（ARIA / role）と SSOT #1（state 設計）は副次的、idiom 規律 (rules of hooks / 状態管理 / `useState` vs `useRef`) は #3 主観点
- **チェックリスト**:
  - [ ] Rules of hooks 違反（条件付き hook 呼び出し / 早期 return 後の hook）の有無
  - [ ] `useState` vs `useRef` の使い分け（CLAUDE.md 設計ルール 3）— drag-time mutable は ref、render-trigger は state
  - [ ] `useReducer` / `useCallback` / `useMemo` の適切な使用 — 過剰 memoization も逆 anti-pattern
  - [ ] `useEffect` の依存配列、cleanup の有無
  - [ ] `<Konva.Image>` の `listening={false}` 等、Konva 連携固有の落とし穴（CLAUDE.md 設計ルール 5）
  - [ ] React 19 idioms 活用機会（`useTransition` / `useDeferredValue` / `use()` hook）の有無
  - [ ] children prop 設計、composition vs prop drilling のバランス
  - [ ] event handler の closure 鮮度問題

#### Task 11: #4 Hono ベストプラクティス — `phase-8-hono-review.md`

- **担当 (案)**: `typescript-reviewer` agent + 手動
- **Hot files / 領域**:
  - `apps/api/src/routes/rooms.ts` (249 LOC) ← **重点**
  - `apps/api/src/index.ts`
  - `apps/api/src/middleware/*` 全部
  - `apps/api/src/lib/error.ts` / `apps/api/src/lib/zod-openapi-helpers.ts` 等
  - `apps/web/src/lib/api-client.ts` (171 LOC、`hc<AppType>` 利用箇所)
  - `apps/api/src/services/room-service.ts` (189 LOC)
- **観点境界**: error envelope の **形式** は #11、Hono の middleware 配線方式と RPC 型推論は #4 主観点
- **チェックリスト**:
  - [ ] `createRoute({ middleware })` 配線が `.use()` chain になっていないか（snap-share Decisions Log で確認済の policy）
  - [ ] `@hono/zod-openapi` 経由のルート定義が漏れなく zod schema 駆動か
  - [ ] `app.doc31` / Scalar UI が typed `AppType` を leak させていないか（CLAUDE.md API conventions）
  - [ ] `hc<AppType>` で型推論が壊れていないか（response type の `any` 化など）
  - [ ] middleware の composition 順序が意図通りか（CORS → RL → Turnstile → route handler 等）
  - [ ] Workers binding（R2 / KV / DO / RL）の使用が wrangler.toml と一致するか
  - [ ] エラーレスポンスが共通 envelope (`{ ok: false, error: { code, message } }`) を経由するか

#### Task 12: #5 その場しのぎ実装 — `phase-8-band-aids-review.md`

- **担当 (案)**: `code-reviewer` agent
- **Hot files / 領域**: triage 結果から「無理由 / 弱い理由」の `biome-ignore` 該当箇所、過去 review で `Resolution Update` を持つ箇所、Yjs / Konva 連携の workaround
- **観点境界**: 型系の `as` キャストは #6、retroactive review 不在は #12
- **チェックリスト**:
  - [ ] `biome-ignore` 26 件のうち、理由文が説得的か / 無理由 or 弱い理由のものはあるか
  - [ ] commit history に「revert」「fix」「hotfix」の連鎖はあるか — 直近で回避策が固定化していないか
  - [ ] Phase 7.6 の hotfix 系 (既知-1 tainted canvas / 既知-2 password UI / 既知-3 image clear) は根本解決されているか、それとも回避策が残っているか
  - [ ] 試験的 fix → revert の痕跡（`.gitignore` 配下の `.tmp/` / コメントアウト）の残存有無
  - [ ] CLAUDE.md design rule 1〜8 を逸脱した workaround の有無

#### Task 13: #6 型の健全性 — `phase-8-typesafety-review.md`

- **担当 (案)**: `typescript-reviewer` agent
- **Hot files / 領域**: triage 結果から「review-worthy」categorize された `as` / `as unknown` 該当箇所
- **観点境界**: SSOT #1（型と Schema の対応）と React #3（component prop 型）は副次観察
- **チェックリスト**:
  - [ ] triage で review-worthy にした `as <UserType>` を 1 件ずつ判定 — その場しのぎ / 設計上必要な boundary キャスト / 不要キャスト
  - [ ] `as unknown` を 1 件ずつ判定 — E2E のフレーム外接続は OK、単独 `unknown` キャストは要検討
  - [ ] `noUncheckedIndexedAccess` を活かして `array[i]` 後の undefined 処理が漏れていないか
  - [ ] `verbatimModuleSyntax` で `import type` が漏れていないか（biome 自動 fix が機能しているはずだが残り)
  - [ ] tuple 型が `number[]` に潰れていないか（CLAUDE.md TypeScript quirks）

#### Task 14: #7 将来拡張性 — `phase-8-extensibility-review.md`

- **担当 (案)**: `architect` agent
- **Hot files / 領域**:
  - `packages/shared/src/index.ts` の AnnotationSchema discriminated union（拡張性の中核 — CLAUDE.md design rule 1）
  - `apps/web/src/hooks/annotationsReducer.ts` の switch exhaustiveness
  - `apps/web/src/components/canvas/AnnotationLayer.tsx` の shape dispatcher
  - `apps/web/src/domain/annotation/yjs-mutations.ts`
  - `apps/api/src/routes/rooms.ts` のエンドポイント追加余地
- **観点境界**: SSOT #1（型分離）は副次、React #3（component composition）も副次、純粋に「新規 annotation 種 / 新規エンドポイント / 新規 collab feature をどれだけ容易に追加できるか」の構造評価
- **チェックリスト**:
  - [ ] 新規 annotation 種を追加する際の「触る箇所一覧」を列挙、ドット数が爆発していないか
  - [ ] discriminated union exhaustiveness（`const _: never = a` 風）が機能しているか
  - [ ] 新規 API エンドポイント追加時の boilerplate 量
  - [ ] Yjs マイグレーションが必要になった際の対応容易性
  - [ ] CLAUDE.md design rule 1〜8 が将来拡張時に維持しやすい構造か

#### Task 15: #8 テスト網羅 — `phase-8-tests-review.md`

- **担当 (案)**: `code-reviewer` agent + 手動
- **Hot files / 領域**:
  - すべての `__tests__/` ディレクトリ
  - `apps/web/e2e/*.spec.ts` 全部
  - 各 hook / reducer / Zod schema の test
  - playwright.config.ts / vitest.config.ts
- **観点境界**: a11y test #9 と perf test #10 は副次観察、unit / integration / e2e のカバレッジ評価が主観点
- **チェックリスト**:
  - [ ] `common/testing.md` の 80% カバレッジ目標に達しているか（実測 or 概算）
  - [ ] golden path（D&D → 注釈 → エクスポート / room 共有 → 同期 / パスワード保護）の e2e カバレッジ
  - [ ] reducer / Zod schema の unit test が discriminated union 全パターンを叩いているか
  - [ ] Yjs ↔ local reducer の二重 path のテスト粒度（`useAnnotationsStore` vs `useYjsAnnotationsStore`）
  - [ ] Phase 7.6 で追加された再発防止 e2e（ImageLayer crossOrigin / password UI 可視性 / image clear 挙動）が機能維持しているか
  - [ ] tests のメンテコスト（snapshot / mock の堅牢性）

#### Task 16: #9 a11y — `phase-8-a11y-review.md`

- **担当 (案)**: `a11y-architect` agent
- **Hot files / 領域**:
  - `apps/web/src/components/dialogs/HelpModal.tsx`（modal の focus trap）
  - `apps/web/src/components/toolbar/Toolbar.tsx` / `ColorPalette.tsx` / `FontSizeControl.tsx`（role / aria-label）
  - `apps/web/src/components/room-gate/RoomGate.tsx`（form a11y）
  - `apps/web/src/hooks/useKeyboardShortcuts.ts`（キーボード操作）
  - `apps/web/src/styles/*` の reduced-motion 対応
- **観点境界**: React #3（hooks 規律）と test #8（a11y test）は副次
- **チェックリスト**:
  - [ ] WCAG 2.2 / `web/coding-style.md` の semantic HTML 推奨に従っているか
  - [ ] キーボード完結 golden path（Phase 7.7 で達成想定）が実装上維持されているか
  - [ ] ARIA role / aria-label の適切性、`role="group"` 系 (`useSemanticElements` ignore の理由) の妥当性
  - [ ] focus trap / focus restore (modal 系) の実装
  - [ ] `prefers-reduced-motion` 対応（CSS / JS 両方）
  - [ ] color contrast (Tailwind v4 token vs Konva hex の整合)

#### Task 17: #10 bundle・perf — `phase-8-perf-review.md`

- **担当 (案)**: `performance-optimizer` agent
- **Hot files / 領域**:
  - `apps/web/vite.config.ts`（chunking / dynamic import）
  - `apps/web/src/main.tsx` の entry chain
  - Konva / Yjs / lucide-react の import 粒度
  - すべての `.tsx` で `lazy()` / `Suspense` 使用箇所（あるなら）
- **観点境界**: a11y reduced-motion #9 / test perf #8 は副次
- **チェックリスト**:
  - [ ] `web/performance.md` の bundle budget（Landing < 150KB / App < 300KB）に達しているか — 実測 (`pnpm build` 後の output size)
  - [ ] Konva (152.7 KB gz, Decisions Log の Phase 0 実測) を `dynamic import` でコード分割できる箇所はあるか
  - [ ] Yjs / y-websocket の lazy load 余地
  - [ ] lucide-react の tree shake が機能しているか（icon 単位 import になっているか）
  - [ ] Core Web Vitals 目標（LCP < 2.5s / INP < 200ms / CLS < 0.1）の見込み
  - [ ] `useImage` の crossOrigin / lazy 等、image loading 戦略

#### Task 18: #11 ログ・エラー envelope 一貫性 — `phase-8-error-envelope-review.md`

- **担当 (案)**: `code-reviewer` agent
- **Hot files / 領域**:
  - `apps/api/src/lib/error.ts`（envelope 正本）
  - `apps/api/src/middleware/*`
  - `apps/api/src/routes/rooms.ts` のエラー return path 全部
  - `apps/api/src/services/room-service.ts` の throw / return path
  - `apps/web/src/lib/api-client.ts` のエラーハンドリング
  - `apps/web/src/lib/logger.ts`
- **観点境界**: Hono middleware 配線 #4 / security 情報漏洩 #13 は副次
- **チェックリスト**:
  - [ ] 全 API エラーが `{ ok: false, error: { code, message } }` 形式を経由するか
  - [ ] エラーコード (`INVALID_REQUEST`/`UNSUPPORTED_MEDIA_TYPE`/`PAYLOAD_TOO_LARGE`/`NOT_FOUND`/`INTERNAL`) の使い分けが正しいか
  - [ ] `apps/web` 側で envelope を見て UI 表示する path が一貫しているか
  - [ ] log のレベル使い分け、機密漏洩の有無
  - [ ] `console.log` 残存の有無（`web/coding-style.md` の `noConsole: warn` に従うか）

#### Task 19: #12 .claude/PRPs/ 整理状況 — `phase-8-prp-hygiene-review.md`

- **担当 (案)**: 手動
- **Hot files / 領域**: `.claude/PRPs/` 配下全部
- **観点境界**: コードレベルの band-aid #5 は副次、ここでは PRP プロセス・命名・cleanup・review 漏れ・retroactive review 不在を扱う
- **チェックリスト**:
  - [ ] 7.7-1/-2/-3 / 7.8-5 の review 不在を「process miss」として記録（retroactive review は作成しない方針）
  - [ ] 7.7 / 7.8 の umbrella report 不在をどう扱うか（required vs optional の方針確定）
  - [ ] `local-review-phase-N.md` 等の命名揺れ — frozen archive 扱いで放置
  - [ ] `phase-7.6-partial-implementation-review.md` の命名 — frozen archive
  - [ ] `plans/` 配下に未移動の完了済 plan がないか（Phase 8.0 で 7.6 を移動済）
  - [ ] `reports/` の命名揺れ（umbrella vs sub-phase）
  - [ ] PRP workflow 自体への学び（次回 Phase に活かすメモ）

#### Task 20: #13 security — `phase-8-security-review.md`

- **担当 (案)**: `security-reviewer` agent
- **Hot files / 領域**:
  - `apps/web/_headers`（CSP / HSTS）
  - `apps/api/src/middleware/*`（Turnstile / RL / CORS）
  - `apps/api/wrangler.toml`（Workers binding 権限境界）
  - `apps/api/src/services/room-service.ts`（パスワードハッシュ / NanoID）
  - `apps/api/src/storage/*`（R2 / KV 操作）
  - `apps/web/src/components/turnstile/*`
- **観点境界**: error envelope の情報漏洩 #11 / Hono middleware 配線 #4 は副次
- **チェックリスト**:
  - [ ] CSP の nonce / origin allowlist の妥当性（`web/security.md` 推奨）
  - [ ] HSTS / X-Content-Type-Options / X-Frame-Options / Referrer-Policy の設定
  - [ ] Turnstile の widget config と secret 検証の対応
  - [ ] Rate Limiting の binding が三層（IP / SHA / Turnstile）構成を維持しているか
  - [ ] パスワードハッシュ（PBKDF2 → Argon2 への移行検討、Decisions Log との突合）
  - [ ] R2 / KV / DO の権限境界（最小権限の原則）
  - [ ] CORS allowlist が production / preview を意図通り分離しているか
  - [ ] `apps/web/.env.production` を git に commit していない運用が維持されているか
  - [ ] Workers `env` から secret を直接 log している箇所がないか
  - [ ] OWASP Top 10 のうち web アプリに該当する項目（XSS / CSRF / SSRF / IDOR）の検証

### Task 21: 8.B 完了マーク

- **ACTION**: `phase-8-integration-review.prd.md` の Implementation Phases table で 8.B 行を `in-progress` → `complete` に、8.C 行を `pending` → `in-progress` に更新
- **VALIDATE**: PRD diff が 2 行のみ

### Task 22: 8.C — 統合 report 生成

- **ACTION**: 13 review file + triage を統合し、`reports/phase-8-integration-review-report.md` を生成
- **IMPLEMENT**: INTEGRATION_REPORT_FORMAT に従い:
  1. 件数サマリ表（観点 × Severity matrix）
  2. CRITICAL / HIGH / MEDIUM 一覧（各 review file への deep link）
  3. LOW を Human Friction フラグごとに分離した 2 リスト
  4. 観点間で重複した finding の merge 記録（同じ finding が複数 review に挙がっていれば 1 つに統合、master を確定）
  5. **Phase 8.x 推奨着手順**（PR 分割単位、想定差分規模、推奨 agent / 担当、ブランチ案）
  6. Phase 9 dogfood Go/No-Go 判断（Go condition と判断結果）
  7. Open Items（Phase 8.x にも Phase 9 にも送らない方針未定事項）
- **MIRROR**: INTEGRATION_REPORT_FORMAT
- **GOTCHA**: PR 分割単位は 3-5 PR 程度を目安に。観点ごと（13 PR）は過多、Severity ごと（4 PR）は混乱、推奨は **「テーマ×Severity ハイブリッド」**（例: 8.x-1 = SSOT/拡張性 critical 系、8.x-2 = React/a11y med 系、8.x-3 = perf 系、8.x-4 = security 系、8.x-5 = LOW HF=true 残置 cleanup）
- **VALIDATE**:
  - file が存在
  - 件数サマリの観点別合計が各 review file の件数と一致
  - Phase 8.x 候補一覧の各 finding が Severity と Human Friction で正しくフィルタされている
  - 30 分以内に着手順が決められる構造か（実測: オーナーが読み下す）

### Task 23: 8.C 完了マーク

- **ACTION**: `phase-8-integration-review.prd.md` の Implementation Phases table で 8.C 行を `in-progress` → `complete` に更新
- **VALIDATE**: PRD diff が 1 行のみ

### Task 24: PRD Phase 8 を `complete` に更新

- **ACTION**: `snap-share.prd.md` の Phase 8 行 status を `in-progress` → `complete` に変更し、`PRP Plan` 列を `[prd] / [plan] / [report]` 構造に更新
- **IMPLEMENT**:
  - `snap-share.prd.md`: status `in-progress → complete`、PRP Plan 列 `[prd]... / [plan]... / [report](../reports/phase-8-integration-review-report.md)`
- **VALIDATE**: `git diff` で 1 行差分のみ

### Task 25: Plan 完了 commit + PR 作成 (オプション)

- **ACTION**: 全タスクが緑なら commit & push、PR 作成
- **IMPLEMENT**:
  - commit message 例: `feat(phase-8): 統合レビュー完了 — 13 観点 review + 統合 report 生成`
  - PR タイトル: `Phase 8: 統合レビュー（観察のみ）— 13 観点 / Phase 8.x 候補抽出`
  - PR 本文: 統合 report の TL;DR + 件数サマリ + Phase 8.x 推奨着手順を貼る
- **GOTCHA**: PR 作成は **オーナーの explicit 指示後**。Plan 実行 agent / Claude が勝手に push してはいけない（CLAUDE.md / common/git-workflow.md）

---

## Testing Strategy

Phase 8 はコード変更ゼロのため、伝統的な unit/integration/e2e テストは新規作成しない。**「成果物 (review files + integrated report) が format に従っているか」の structural validation** を行う。

### Document Validation

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| 14 review file の存在確認 | `ls .claude/PRPs/reviews/phase-8-*.md` | 14 行 | - |
| 統合 report の存在確認 | `ls .claude/PRPs/reports/phase-8-integration-review-report.md` | 1 ファイル | - |
| 各 review に必須セクション | `grep -l '^## Findings' reviews/phase-8-*-review.md` | 14 ヒット | - |
| 各 finding の Location 形式 | `grep '^- \*\*Location\*\*' reviews/phase-8-*-review.md` | `file.ext:LL` 形式 | LL なし、複数行 LL-LL も可 |
| LOW finding に Human Friction | `grep -A 5 '^### LOW' reviews/phase-8-*-review.md \| grep 'Human Friction'` | LOW があればフラグ必須 | LOW=0 のレビューもあり得る |
| 統合 report の Phase 8.x 候補 | `grep '^### Phase 8.x-' reports/phase-8-integration-review-report.md` | 3-5 ヒット | テーマ次第で 1〜10 |
| 件数サマリの整合性 | 統合 report の matrix 合計 vs 各 review の件数 | 一致 | - |

### Edge Cases Checklist

- [ ] 観点横断で重複した finding を merge 後、件数サマリで重複カウントしていないか
- [ ] LOW Human Friction = false が backlog 行きと統合 report で明示されているか
- [ ] CRITICAL を発見した場合、Phase 9 dogfood の Go/No-Go = No-Go と判断しているか
- [ ] 観点間の finding 移送（A 観点で発見 → B 観点に属すと判断）が記録されているか
- [ ] triage で「未確定」分類された signal が deep review でクローズされているか

---

## Validation Commands

### Static Analysis (review file 構造)

```bash
# 14 review file の存在確認
ls .claude/PRPs/reviews/phase-8-{triage,ssot,modernity,react,hono,band-aids,typesafety,extensibility,tests,a11y,perf,error-envelope,prp-hygiene,security}-review.md
```
EXPECT: 14 ファイルすべて存在、エラーなし

```bash
# 統合 report の存在確認
ls .claude/PRPs/reports/phase-8-integration-review-report.md
```
EXPECT: ファイル存在

```bash
# 各 review file が必須セクションを持つ
for f in .claude/PRPs/reviews/phase-8-*-review.md; do
  echo "=== $f ==="
  grep -c '^## Findings' "$f" && echo "  has Findings" || echo "  MISSING Findings"
  grep -c '^\*\*Decision\*\*' "$f" && echo "  has Decision" || echo "  MISSING Decision"
done
```
EXPECT: 14 ファイル × Findings + Decision の組み合わせがすべて存在

### Code Diff Verification

```bash
# Phase 8 ブランチで apps/ packages/ に変更がないことを確認
git diff main...HEAD --stat -- apps packages
```
EXPECT: 変更なし（空の出力）

```bash
# 変更は .claude/PRPs/ 配下のみ
git diff main...HEAD --stat | grep -v '\.claude/PRPs/'
```
EXPECT: 空の出力（PRD 整理 commit で snap-share.prd.md だけ apps/api 領域外に変更があるが、これは想定範囲）

### Manual Validation

- [ ] 統合 report を読んで、**30 分以内に Phase 8.x の着手順が決められる**（オーナー実測）
- [ ] CRITICAL / HIGH / MEDIUM の finding がすべて Phase 8.x 候補に入っている
- [ ] LOW (HF=true) のみ Phase 8.x 候補、LOW (HF=false) は backlog 行きが明示されている
- [ ] 観点境界マップに沿った整合性（同じ finding が複数 review に重複していない、または merge 記録がある）
- [ ] PRD `snap-share.prd.md` の Phase 8 行が `complete`、`phase-8-integration-review.prd.md` の 8.A/8.B/8.C もすべて `complete`

### Type Check / Test Suite (sanity)

実コード変更がないので失敗しない想定。念のため:

```bash
pnpm typecheck
```
EXPECT: 通る（Phase 7.8 完了時点と同じ）

```bash
pnpm test
```
EXPECT: 通る（変更なしのため）

```bash
pnpm lint
```
EXPECT: 通る（review file は markdown、biome 対象外）

```bash
pnpm build
```
EXPECT: 通る（変更なしのため）

---

## Acceptance Criteria

- [ ] 14 review file (`reviews/phase-8-*-review.md`) が存在
- [ ] 統合 report (`reports/phase-8-integration-review-report.md`) が存在
- [ ] 各 review file が REVIEW_FILE_FORMAT に従う
- [ ] 各 finding が FINDING_TEMPLATE に従う（Severity / Location / Issue / Suggested Fix）
- [ ] LOW finding に Human Friction フラグが付与
- [ ] 統合 report に Phase 8.x 推奨着手順 + Phase 9 Go/No-Go が含まれる
- [ ] PRD Phase 8 status `complete`
- [ ] PRD Implementation Phases 8.A/8.B/8.C すべて `complete`
- [ ] `apps/` `packages/` 配下に差分なし
- [ ] オーナーが 30 分以内に Phase 8.x 着手順を決められる

## Completion Checklist

- [ ] All tasks (1-24) completed
- [ ] All validation commands pass
- [ ] No code changes outside `.claude/PRPs/`
- [ ] No type errors
- [ ] No lint errors
- [ ] PR 作成は **オーナーの explicit 指示後** に Task 25 として実施（automation はしない）

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| triage の categorize が主観的になり review-worthy 件数を誤認 | M | M | 8.A 段階で 363 件を 4 カテゴリに分類した内訳を `phase-8-triage-review.md` に明示、オーナー確認ポイントとする |
| 13 観点で finding 件数が想定外に多く、Phase 8.x が肥大化 | H | H | LOW Human Friction フィルタで cosmetic を切り捨てる。それでも多い場合は Plan 完了後にオーナー判断で再フィルタ |
| 観点間の重複が merge できず、統合 report の件数サマリが不正確に | M | M | Task 22 (8.C) で merge 記録セクションを必須化、観点境界マップ (Task 4) で先回り |
| agent 並列実行が finding 粒度を揃えられず後で統合困難 | M | L | 共通テンプレート (REVIEW_FILE_FORMAT / FINDING_TEMPLATE) を Plan に明記済、agent 起動時に必ず参照させる |
| Plan 実行中に 13 観点の網羅性が不足と判明（i18n / CI / observability 等） | M | M | Open Question で未確定。Plan 実行開始前にオーナーに最終確認、追加観点があれば 14 観点目以降を追加 |
| Plan 完了後 Phase 8.x への着手単位 (PR 分割) でオーナー判断が割れる | L | L | 8.C で「暫定提案」として提示、最終決定は Phase 8.x kickoff 時のオーナー判断 |
| Context7 経由の modernity 確認で対象 library のドキュメント取得失敗 | L | M | Plan 実行時にフォールバック (各 library 公式 docs / GitHub release notes 直接参照) |

## Notes

### Plan の特殊性

Phase 8 はコード生成ではなくレビュー成果物生成のため、伝統的な「実装 plan」とは性質が異なる:

- **Patterns to Mirror** は **document format pattern**（コードパターンではない）
- **Files to Change** はすべて新規 markdown ファイル（既存 PRD 2 ファイルの status 更新を除く）
- **Testing Strategy** は **document validation**（functional test ではない）

### agent 並列実行の運用

8.B の 13 観点は観点間で並列可能。実行戦略の選択肢:
- **strategy A: 全並列**（13 agent を同時起動）— 最速だが、agent 間の context 共有がないので observation 境界違反の merge が後手
- **strategy B: バッチ並列**（4-5 観点ずつ並列）— バランス型、観点境界マップ (Task 4) を踏まえてバッチ単位で見直し可
- **strategy C: 全逐次** — 最遅だが、前の観点の発見を次の観点に活かせる

**推奨**: strategy B。Task 4 で観点境界を先に固めた上で、関連性の高い観点を同バッチに入れて並列実行。例:
- Batch 1: #1 SSOT + #7 拡張性 (architect 観点)
- Batch 2: #3 React + #6 typesafety (typescript-reviewer 観点)
- Batch 3: #4 Hono + #11 error envelope (Hono 周辺)
- Batch 4: #9 a11y + #10 perf (web 品質観点)
- Batch 5: #5 band-aids + #8 tests + #2 modernity + #12 prp-hygiene (横断観察)
- Batch 6: #13 security (独立)

### Phase 8.x への引き渡し

Plan 完了後 (= Phase 8 完了後)、Phase 8.x の着手は別 Plan が必要。各 Phase 8.x は:
- 1 ブランチ = 1 PR（memory ルール）
- 統合 report の Phase 8.x 候補一覧から 1 テーマを切り出し
- `/everything-claude-code:prp-plan` で個別 plan 作成
- 修正は普通の TDD で実施

### Plan 自体の self-validation

この Plan は「30 分以内に Phase 8 全体が実行可能か」がオーナーレビュー時の確認ポイント。実行前に以下を確認すべき:
- [ ] 13 観点の Hot files / 担当 agent / チェックリストで「何を見るか」が一意に決まる
- [ ] Triage rule (categorize / 観点境界 / Human Friction) が運用可能な粒度で定義されている
- [ ] Phase 8.x への引き渡し path（統合 report の Phase 8.x 候補一覧）が明示されている

これらが「不明な点が出たら Plan を更新」レベルでクリアできていれば、Plan 実行 (`/prp-implement`) に進める。
