# Plan: Phase 10.B — 公開リリース最低限整備

## Summary

Phase 10 PRD（`phase-10-direction.prd.md`）で確定した「公開した瞬間に問われるもの」を **オーナー確認不要で自走できる範囲** だけ先行実装する。具体的には以下 6 件:

1. **TTL 仕様変更**: default `24h` / max `7d` / `POST /rooms` body に `ttlMs` (optional, ms) 追加。
2. ~~CHANGELOG.md 新設~~ → **2026-05-05 ロールバック判断**: タグ未作成段階での先行起票はリンク 404 で実用性ゼロ。公開リリース直前 (Phase 10.F or v1.0.0 タグ作成時) に初版起票する方針へ変更。Phase 10.B では起票しない。
3. **TOS / プライバシーポリシー (drafts)**: `docs/legal/terms-ja.md` / `docs/legal/privacy-ja.md` を作成（個人運営・cookieless・TTL 24h-7d・通報窓口・免責・知的財産）。Web ルーティングは Phase 10.D（公開ドメイン確定）後に追加するのでここでは静的 markdown のみ。
4. **通報窓口**: README に「通報窓口」セクション追記 + `.github/ISSUE_TEMPLATE/abuse-report.yml` 設置（labels: `report-abuse`）。
5. **OGP / favicon / meta description**: `apps/web/index.html` に OGP/Twitter card/meta description を追加。OGP image はアプリ名確定（10.D）後に作成するため当面 placeholder。
6. **`snap-share.prd.md` 反映**: Phase 10.B 完了分の Decisions Log + Open Questions 状態同期。

並走で進められる Phase 10.D（アプリ名 + ドメイン）/ 10.E（i18n）は **本 plan 対象外**:
- 10.D は「ブレスト + オーナー直感判断」が必須（PRD `Q4` で確定）
- 10.E は ADR-0004 で軽量自作 dict 方針確定済だが、UI 文言の網羅作業はオーナー目視確認の余地あり、本 plan が green merge されてから別 plan で着手する

## User Story

As snap-share の オーナー（公開リリース直前の主実装者）,
I want 公開した瞬間に法務・スパム対策・運用指標で問われる事項のうち、確認不要で自走可能な部分が **コミット可能な状態** に揃っていてほしい,
So that オーナーは「アプリ名 + ドメイン (10.D) のブレスト」「i18n の文言レビュー (10.E)」に集中できる。

## Problem → Solution

### Current（feat/phase-10-launch-prep ブランチ起点）

- **TTL**: `wrangler.toml` に `ROOM_TTL_MS = 604800000` (7d) ハードコード、`POST /rooms` で TTL を上書きする手段なし。フリーミアム実装時に拡張余地ゼロ
- **CHANGELOG**: 不在。リリース時の差分が git log のみ、ユーザーが読む差分が存在しない
- **法務文書**: TOS / プライバシーポリシー存在せず、公開リリース時に法的・倫理的な根拠が不在
- **通報窓口**: README に窓口記載なし、`.github/ISSUE_TEMPLATE/` も bug-report のみ（abuse 向けが不在）
- **OGP / meta**: `apps/web/index.html` は Vite 初期テンプレートに近く、SNS 共有時の見栄え未調整、SEO description も不在
- **PRD**: Phase 10.B 着手前の状態（Open Questions に CHANGELOG version 番号未確定が残る）

### Desired（Phase 10.B 完了時点）

- **TTL**:
  - `packages/shared` に `DEFAULT_ROOM_TTL_MS = 24h` / `MAX_ROOM_TTL_MS = 7d` を export
  - `room-service.create(file, opts)` の opts に `ttlMs?: number` を追加、validate (positive integer ≤ MAX) して採用、未指定なら `deps.ttlMs` (= env default = 24h) にフォールバック
  - `POST /rooms` の multipart body に `ttlMs` (string) optional フィールド追加、空 / 未指定なら default、不正値は `400 INVALID_REQUEST`
  - `wrangler.toml` の `ROOM_TTL_MS = 86400000` (24h)、test helpers の DEFAULT_TTL_MS も 24h
  - shared / api / e2e のテストが緑
- **CHANGELOG.md**:
  - Keep a Changelog 形式の skeleton（`Unreleased` + `[v0.9.0-mvp] - 2026-05-05`）
  - Phase 0〜8 までの milestone を遡及記録（features 単位、各 commit へのリンクは過剰なので Phase 単位に集約）
  - Open Question「v0.1.0 / v0.9.0-mvp / v1.0.0 のどれか」を **v0.9.0-mvp 起点 → Phase 10 完了で v1.0.0** に確定（Phase 10 PRD Decisions Log と整合）
- **法務文書**:
  - `docs/legal/terms-ja.md`: 個人運営、サービス内容、利用条件、禁止事項、免責、知的財産、改定、適用法
  - `docs/legal/privacy-ja.md`: 取得情報、利用目的、cookie 不使用、Cloudflare 利用、保存期間 (24h/7d)、第三者提供なし、開示請求、改定、連絡先
  - 内容は「公開リリース最低限」に絞る（GDPR / CCPA / COPPA 等の grandstanding は扱わない、必要時に追記）
  - 未確定箇所（運営者氏名 / 連絡先メアド / カスタムドメイン）は `[TBD: Phase 10.D 後に確定]` でマーク
- **通報窓口**:
  - `README.md` に「## 通報・不具合連絡」セクション追加（GitHub Issue 経由 + `report-abuse` ラベル明記、緊急時は個人メアド `[TBD]`）
  - `.github/ISSUE_TEMPLATE/abuse-report.yml`: GitHub Issue Forms 形式、labels に `report-abuse` 自動付与
- **OGP / favicon / meta description**:
  - `apps/web/index.html` の `<head>` に description / og: / twitter: 一式
  - title は当面 "snap-share — 画像にサクッと注釈、URL 一発共有"（10.D で名称変更時に再調整）
  - favicon は既存 `apps/web/public/` を確認し、最低限 `<link rel="icon">` で参照
  - OGP image は当面省略（アプリ名 + ロゴ確定後に作成）。`<meta property="og:image">` も省略 → 公開リリース直前 (10.F) で再評価
- **`snap-share.prd.md`**:
  - Open Questions の「CHANGELOG version 番号」を `[x]` 化、決定値を本文に追記
  - Decisions Log にエントリ追加（CHANGELOG version、TTL 実装完了、通報窓口暫定済）
  - Phase 10 行の status 欄に Phase 10.B 完了済の進捗注記（in-progress ステータス維持、全部完了時に complete に変更）

### Acceptance（受け入れ条件）

- [ ] **TTL**:
  - [ ] `packages/shared/src/room.ts` に `MAX_ROOM_TTL_MS` 追加、`DEFAULT_ROOM_TTL_MS = 24 * 60 * 60 * 1000` に変更
  - [ ] `RoomCreateOptions` に `ttlMs?: number` 追加、`room-service.create` で validate + clamp
  - [ ] `POST /rooms` form schema に `ttlMs` (string, optional, regex `/^\d+$/`) 追加
  - [ ] `wrangler.toml` の `ROOM_TTL_MS = 86400000`、`apps/api/src/__tests__/helpers/build-env.ts` の `DEFAULT_TTL_MS = 24 * 60 * 60 * 1000`
  - [ ] 既存テスト（`packages/shared` / `apps/api`）が更新済 + 新規テスト 4 件 (default / explicit valid / over-max / non-integer)
- [x] ~~**CHANGELOG.md**~~ → **2026-05-05 ロールバック**: タグ未作成での起票は実用性ゼロにつき Phase 10.F へ後ろ倒し
- [ ] **法務文書**:
  - [ ] `docs/legal/terms-ja.md` 新規（10 セクション以上）
  - [ ] `docs/legal/privacy-ja.md` 新規（保存期間 24h/7d / cookieless / 第三者提供なしを明記）
  - [ ] 未確定箇所は `[TBD: ...]` で明示
- [ ] **通報窓口**:
  - [ ] README に「通報・不具合連絡」セクション
  - [ ] `.github/ISSUE_TEMPLATE/abuse-report.yml` 新規（GitHub Issue Forms）
- [ ] **OGP / meta**:
  - [ ] `apps/web/index.html` に description / og:title / og:description / og:type / og:url (placeholder OK) / twitter:card 追加
  - [ ] `<html lang="ja">` 維持（Phase 10.E の i18n 切替 hook で動的化する伏線になるが、本 plan では静的 ja 固定）
- [ ] **PRD**:
  - [ ] `snap-share.prd.md` Open Questions の CHANGELOG 行を `[x]` 化、決定値追記
  - [ ] Decisions Log に CHANGELOG version 行追加
- [ ] **CI green**:
  - [ ] `pnpm -F @snap-share/shared test`
  - [ ] `pnpm -F @snap-share/api test`
  - [ ] `pnpm -F @snap-share/web test`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm lint`
  - [ ] `pnpm build`

## Metadata

- **Complexity**: **Medium**（コード変更は TTL のみ、残りはドキュメント整備。ただし TTL は schema/service/route/test の 4 層変更）
- **Source PRD**: `.claude/PRPs/prds/phase-10-direction.prd.md`
- **PRD Phase**: 10.B（10.D / 10.E は別 plan）
- **Branch**: `feat/phase-10-launch-prep`（PRD 単位 1 ブランチ運用、後続 10.D/10.E もここに乗る場合は別 plan として同 branch で進める）
- **Depends on**: 10.0 + 10.A（PR#16 merge 済 main）
- **Estimated Files**: 新規 5（CHANGELOG.md / terms-ja.md / privacy-ja.md / abuse-report.yml / 本 plan）+ 更新 8 前後（room.ts / room-service.ts / rooms.ts / wrangler.toml / build-env.ts / room.test.ts / room-service.test.ts / index.html / README.md / snap-share.prd.md）
- **Estimated Time**: 4-6 時間（TDD で TTL を 90 分、ドキュメント 4 種を 60 分ずつ）

---

## Implementation Steps

> 各 step 完了でコミット 1 つを作る。コミットは Phase 単位ではなく **ステップ単位** で区切る（Phase 10.B 内で 6-8 commit 程度）。

### Step 1: TTL 仕様変更（TDD）

**1-1. shared schema (packages/shared/src/room.ts)**

- `MAX_ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000` を新規 export
- `DEFAULT_ROOM_TTL_MS` を `24 * 60 * 60 * 1000` に変更
- `packages/shared/src/__tests__/room.test.ts` の `'uses 7 days as default ttl'` を `'uses 24 hours as default ttl'` + `MAX_ROOM_TTL_MS = 7 days` の 2 アサートに分割

**1-2. room-service (apps/api/src/services/room-service.ts)**

- `RoomCreateOptions` に `ttlMs?: number` 追加
- `assertValidRequestedTtlMs(ttlMs)` を追加（positive integer かつ `<= MAX_ROOM_TTL_MS`）
- `create(file, opts)` 内で `const effectiveTtlMs = opts.ttlMs ?? deps.ttlMs;` + validate
- `room.ttlMs = effectiveTtlMs` を採用（既存は `deps.ttlMs` 固定）
- `apps/api/src/__tests__/services/room-service.test.ts` に追加テスト:
  - `accepts custom ttlMs within MAX`
  - `rejects ttlMs > MAX_ROOM_TTL_MS as 400`
  - `rejects negative / NaN / non-integer ttlMs as 400`

**1-3. route (apps/api/src/routes/rooms.ts)**

- `uploadFormSchema` に `ttlMs: z.string().regex(/^\d+$/).optional().openapi(...)` 追加
- handler で `Number(ttlMs)` 変換、`opts.ttlMs` に渡す
- 上限超過は service 内 AppError(400) に委譲

**1-4. wrangler / env**

- `apps/api/wrangler.toml` の `ROOM_TTL_MS = "86400000"` (24h) + コメント `# 24 hours (default). Per-room override via POST /rooms ttlMs (max 7d).`
- `apps/api/src/__tests__/helpers/build-env.ts` の `DEFAULT_TTL_MS = 24 * 60 * 60 * 1000`

**1-5. e2e (apps/web/e2e)**

- 既存 e2e で TTL に依存するアサート（あれば）を `<= MAX` 範囲で更新。TTL 値直接 assert する箇所は通常ないので影響少と想定、grep で確認

**Verification**

```sh
pnpm -F @snap-share/shared test
pnpm -F @snap-share/api test
pnpm -F @snap-share/web test
```

**Commit**: `feat(phase-10-b): TTL 仕様変更 — default 24h / max 7d / POST /rooms ttlMs optional`

### Step 2: CHANGELOG.md 新設

- `CHANGELOG.md` をリポジトリルートに新規作成
- 構造（Keep a Changelog 1.1.0 準拠）:
  ```md
  # Changelog
  
  All notable changes to this project will be documented in this file.
  
  The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
  and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
  
  ## [Unreleased]
  
  ### Added
  - Phase 10.B: TTL の per-room 指定 (`POST /rooms` ttlMs, default 24h / max 7d)
  - Phase 10.B: TOS / プライバシーポリシー draft (docs/legal/)
  - Phase 10.B: 通報窓口 (.github/ISSUE_TEMPLATE/abuse-report.yml)
  - Phase 10.B: OGP / Twitter card / meta description (apps/web/index.html)
  
  ### Changed
  - Phase 10.B: ルーム TTL のデフォルトを 7 日 → 24 時間に変更（明示指定で max 7 日まで延長可）
  
  ## [0.9.0-mvp] - 2026-05-05
  
  Phase 0〜8 完了。MVP 機能 + 統合レビュー + 8.x 修正で公開準備完了の節目。
  
  ### Added
  - Phase 0: ...
  - Phase 1: ...
  - ...
  ```
- Phase 0〜8 の features を箇条書きで遡及（Phase 単位に集約、各 commit リンクは省略、過剰な詳細は避ける）

**Commit**: `docs(phase-10-b): CHANGELOG.md を新設 (Keep a Changelog, v0.9.0-mvp 起点)`

### Step 3: TOS / プライバシーポリシー draft

- `docs/legal/terms-ja.md` 新規:
  - 序文（個人運営、無償提供、変更権利）
  - サービス内容（画像注釈共有、TTL 24h-7d）
  - 利用条件（年齢制限なし、ただし違法行為禁止）
  - 禁止事項（著作権侵害、誹謗中傷、児童ポルノ、その他違法）
  - 免責（無保証、データ消失責任なし、TTL 期限は警告済）
  - 知的財産（注釈データはユーザーに帰属）
  - サービス変更・終了の権利
  - 通報窓口（GitHub Issue label: report-abuse）
  - 改定（変更時は CHANGELOG / GitHub に告知）
  - 適用法（日本法 / 東京地裁を専属管轄）
  - 連絡先（`[TBD: Phase 10.D 後の運営者連絡先]`）
- `docs/legal/privacy-ja.md` 新規:
  - 取得情報（IP 一時記録のみ、画像本体、注釈データ）
  - 利用目的（サービス提供、不正対策、運用改善）
  - cookie / トラッキング（cookieless 方針、Cloudflare Web Analytics 利用予定）
  - 第三者提供（しない、ただし違法な行為について司法当局からの正式な要請があれば応じる）
  - 保存期間（画像 + 注釈は最長 7 日、明示なければ 24 時間で自動破棄）
  - 開示請求（個別連絡）
  - 改定（変更時は CHANGELOG / GitHub に告知）
  - 連絡先（`[TBD: Phase 10.D 後の運営者連絡先]`）

**Commit**: `docs(phase-10-b): TOS / プライバシーポリシー draft (docs/legal/, 個人運営 + cookieless + TTL 明記)`

### Step 4: 通報窓口

- `README.md` に「## 通報・不具合連絡」セクション追加（直前 `## License` の前など、後続セクションを邪魔しない位置）
  - 通常: GitHub Issue with label `report-abuse`
  - 緊急: 個人メアド (TBD: 公開時に追記)
- `.github/ISSUE_TEMPLATE/abuse-report.yml` 新規（GitHub Issue Forms）:
  - title prefix: `[abuse]`
  - labels: `report-abuse`
  - フィールド: 対象 URL（必須） / 違反内容カテゴリ（dropdown：著作権侵害 / 誹謗中傷 / 個人情報 / 性的コンテンツ / その他） / 詳細説明 / 連絡先（任意）
- 既存 `.github/ISSUE_TEMPLATE/` を確認し、`config.yml` があれば矛盾しないように整える

**Commit**: `feat(phase-10-b): 通報窓口 (.github/ISSUE_TEMPLATE/abuse-report.yml) + README 反映`

### Step 5: OGP / favicon / meta description

- `apps/web/index.html` の `<head>` を更新:
  - `<meta name="description" content="画像にハイライト・吹き出し・矢印・テキストをオーバーレイ、URL 一発で共同編集できる軽量 Web アプリ。" />`
  - OGP: og:type=website, og:title, og:description, og:url=`[TBD: 10.D]`, og:locale=ja_JP
  - Twitter: twitter:card=summary, twitter:title, twitter:description
  - title 改善: `<title>snap-share — 画像にサクッと注釈、URL 一発共有</title>`
  - favicon: `apps/web/public/` 配下を確認し、すでに SVG/PNG があればそれ、なければ既存 logo SVG（`apps/web/src/assets/`）を public/ にコピーして参照
- `<html lang="ja">` 維持
- OGP image は省略（10.F で再評価）

**Commit**: `feat(phase-10-b): OGP / Twitter card / meta description / title (apps/web/index.html)`

### Step 6: snap-share.prd.md 反映

- Open Questions の `CHANGELOG 開始時の version 番号` 行を `[x]` 化:
  - `[x] CHANGELOG 開始時の version 番号 → **v0.9.0-mvp 起点 → Phase 10 完了で v1.0.0**（Phase 10.B Decisions Log）`
- Decisions Log にエントリ追加:
  - `CHANGELOG version (Phase 10.B)` | `v0.9.0-mvp 起点 → Phase 10 完了で v1.0.0` | `v0.1.0 / v1.0.0 直接` | `Phase 0-8 が MVP 完成、Phase 10 公開で 1.0 が自然な区切り。Phase 10 PRD Open Question Q7 確定` |
- Phase 10 行の status は `pending` → `in-progress`（Phase 10.B 着手中、10.D/E/F/G が pending のため complete にはしない）

**Commit**: `docs(phase-10-b): snap-share.prd.md 反映 (CHANGELOG version 確定 + status in-progress)`

### Step 7: 検証 + lint + build

- `pnpm test` 全 workspace
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- 失敗あれば step 内で fix → 再実行

**Commit**: 不要（最終 step に push のみ）

---

## What's NOT in This Plan

- **アプリ名再考 + ドメイン取得 (Phase 10.D)**: ブレスト + オーナー直感判断必須、本 plan では未着手
- **i18n 軽量実装 (Phase 10.E)**: ADR-0004 で方針確定済だが、文言粒度のレビューはオーナー目視必要、別 plan
- **Cloudflare Web Analytics 確認 (PRD 10.B 内)**: ダッシュボード操作が必要、別途オーナー確認待ち
- **GitHub Issue label `report-abuse` の repository 設定**: gh CLI で技術的に可能だが、shared state 変更は本 plan の commit に含めず、PR merge 後にオーナーが手動で行う
- **OGP image PNG**: アプリ名 + ロゴ確定後（10.D 完了後）に作成
- **通報窓口の連絡先メアド**: オーナー判断、`[TBD]` のまま残す
- **公開リリース実走 (Phase 10.F)**: 10.B + 10.D + 10.E すべて完了後

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 既存テストで `ttlMs` がハードコード `7 * 24 * 60 * 60 * 1000` を assert していて連鎖修正が広範囲化 | M | grep で `7 * 24 * 60 * 60 * 1000` / `604800000` を全部洗い出し、`MAX_ROOM_TTL_MS` 経由に統一する |
| `POST /rooms` の multipart 内 `ttlMs` 文字列パース失敗で 500 になる | L | regex `^\d+$` で zod 検証 → schema 段階で 400 にする |
| TOS / プライバシーポリシー draft が法的要件を満たさない | L | "draft" として位置づけ、公開リリース 10.F 直前に再レビュー（弁護士 review は MVP では行わない方針が PRD で確定済） |
| OGP image 不在で SNS 共有時に空欄になる | L | 当面 OGP image 自体を省略（meta タグからも除外）、10.F でアプリ名確定後に追加 |
| favicon が既存資産になく追加が必要 | L | apps/web/public を確認、なければ単純な SVG 作成（"S" の 1 文字グラデでも MVP 十分） |
| pnpm build が wrangler dry-run で env 変更により fail | L | wrangler.toml の string 値変更のみで型は不変、dry-run で問題出ない見込み |

## Validation Steps

```sh
# Step 1 終了時
pnpm -F @snap-share/shared test -- room
pnpm -F @snap-share/api test -- room-service rooms
# Step 2-6 の文書整備中
pnpm -F @snap-share/web build  # index.html 変更後
# 全 step 完了後
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

---

*Generated: 2026-05-05*
*Source: phase-10-direction.prd.md (Phase 10.B)*
