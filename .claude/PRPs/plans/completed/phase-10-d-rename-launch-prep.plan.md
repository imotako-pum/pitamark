# Plan: Phase 10.D — リネーム + 公開準備 (ドメイン非依存)

## Summary

Phase 10 PRD で `pitamark.app` 確定 (2026-05-05) を受け、**ドメイン取得を待たずに** コードベースを `pitamark` 名義に揃え、公開時の SEO/法務/アセット雛形を整える umbrella plan。スコープは「ドメイン取得後にしか確定できない値の置換」(法務運営者連絡先 / `og:url` / Turnstile site key / CORS / Web Analytics token / 本番タグ) を **含まない** — それらは新 Phase 10.F に切り出し済。

本 plan は 1 ブランチ (`feat/phase-10-d-rename-launch-prep`) で step ごと commit、PR は phase 単位 1 つで投げる (memory: PRP は PRD 単位で 1 ブランチ 1 PR)。

## User Story

As snap-share の オーナー (公開リリース直前の主実装者),
I want コードベース / ドキュメント / アセットが `pitamark` ブランドで揃い、ドメイン取得を急がなくても「公開直前」の状態が見える形になっていてほしい,
So that ドメイン取得 (10.F) は本番デプロイ + v1.0.0 タグだけに集中して実行でき、リネームでブロックされない。

## Problem → Solution

### Current (main branch、Phase 10.B/E 完了直後)

- **パッケージ名**: ルート `snap-share` + workspace `@snap-share/{web,api,shared}`、import 経路も全て `@snap-share/*`
- **可視 UI**: `AppShell.tsx` h1 / `EditorShell.tsx` h1 / `index.html` title・og 系 / `i18n/{ja,en}.ts` の `common.appName` がいずれも "snap-share"
- **生成物識別子**: PNG エクスポートファイル名が `snap-share-{roomId}-{ts}.png`
- **ストレージキー**: `localStorage` の `snap-share-lang` / `snap-share/user-v1` (既存ユーザーが踏むと preference / presence が消える)
- **API 内部識別子**: `/health` の `service: 'snap-share-api'`、OpenAPI doc title `'snap-share API'`、vitest project name `'snap-share/virtualize-cloudflare-workers'`
- **法務文書**: `docs/legal/{terms,privacy}-ja.md` 本文とタイトルにサービス名 "snap-share"、英訳 draft 不在
- **SEO 資産**: `robots.txt` / `sitemap.xml` / JSON-LD / `<link rel="canonical">` 全て不在、`og:image` 不在 (置けば 404)、favicon は SVG 1 枚のみ (apple-touch-icon 不在)
- **GitHub Issue Templates**: `abuse-report.yml` のサービス名・URL 例が "snap-share"
- **README**: コマンド例 / 公開デモ URL placeholder / GitHub URL がすべて旧名
- **ADR**: アプリ名・ドメイン選定の決定が `phase-10-naming.md` という作業メモのみで、ADR としては未起票
- **CHANGELOG**: ファイル不在 (10.F まで保留する方針が PRD Decisions Log に確定)

### Desired (Phase 10.D 完了時点)

- **コードベース全体の `pitamark` 化**:
  - Workspace package 名を `@pitamark/{web,api,shared}` にリネーム、ルート `package.json` を `pitamark`、turborepo / pnpm-workspace の参照経路と lockfile 再生成 (内部識別子のため breaking ではない)
  - 可視 UI 表記を `t('common.appName')` 経由に統一、dict 値を `pitamark` に変更 (Tagline は引き続き「画像URL一発で共同注釈」で OK)
  - Export PNG ファイル名プレフィックスを `pitamark-{roomId}-{ts}.png` に
  - API 内部識別子 (health の `service` フィールド / OpenAPI title / vitest project name) を `pitamark` 系に
- **localStorage key 移行**:
  - 旧キー (`snap-share-lang` / `snap-share/user-v1`) → 新キー (`pitamark-lang` / `pitamark/user-v1`) に **読み取り時にフォールバック → 書き込みは新キー** で one-shot migration
  - 既存ユーザーが踏んでも language preference / presence identity を失わない
- **R2 / Worker / Pages 名は 10.F 送り**:
  - `apps/api/wrangler.toml` の `name = "snap-share-api"` / R2 binding `bucket_name = "snap-share-images"` / `CORS_ALLOWED_ORIGINS` の `snap-share.pages.dev` 系は **本 plan では触らない** (Cloudflare 側のリソース recreate / DNS 切替を伴う = ドメイン取得タイミングと一致するため 10.F に集約)
  - その判断を `wrangler.toml` の comment + 本 plan の NOT Building に明記
- **GitHub repo 名は別件**:
  - `imotako-pum/snap-share` → `imotako-pum/pitamark` への repo rename はオーナー手動操作 (GitHub Settings) で、本 plan の scope 外。README / Issue Template の URL は **repo rename 済を前提に書き換える** (GitHub の自動 redirect が当面救済)
- **ADR-0005 起票**:
  - `docs/adr/ADR-0005-app-naming-and-domain.md` を新規作成、Status: **accepted** (取得自体は 10.F だが、選定意思決定は確定済)
  - `phase-10-naming.md` の議論サマリ + クリアランス + Decisions Log を ADR フォーマットに圧縮
- **OGP / favicon アセット**:
  - `apps/web/public/og-image.png` (1200×630, ロゴ + tagline) 作成 → `<meta property="og:image">` を index.html に有効化
  - `<meta name="twitter:card">` を `summary` → `summary_large_image` に切替
  - `apps/web/public/apple-touch-icon.png` (180×180) 作成、index.html に `<link rel="apple-touch-icon">` 追加
  - `og:url` は `%VITE_PUBLIC_URL%` テンプレ経由 (10.F でビルド時置換)
- **SEO 雛形**:
  - `apps/web/public/robots.txt` 新規 (`User-agent: *` + `Allow: /` + `Disallow: /r/` + sitemap 参照)。`/r/` ルームページはルーム ID 漏洩 + 古い注釈の意図せぬ公開を避けるため exclude
  - `apps/web/public/sitemap.xml` 新規 (`/` のみ、`%VITE_PUBLIC_URL%` 差し込み)
  - `apps/web/index.html` に JSON-LD `SoftwareApplication` schema を inline (`name` `description` `url` `applicationCategory` `operatingSystem`)、`<link rel="canonical" href="%VITE_PUBLIC_URL%/">` 追加
  - sitemap.xml + robots.txt が静的アセットとして `_headers` の Content-Type を奪われないよう Pages 側の挙動確認
- **法務文書**:
  - 既存 `terms-ja.md` / `privacy-ja.md` 本文の "snap-share" を "pitamark" に置換、運営者連絡先 + 確定ドメインは引き続き `[TBD: Phase 10.F]` placeholder 維持
  - `docs/legal/terms-en.md` / `privacy-en.md` 英訳 draft を新規作成 (LLM 翻訳ベース、オーナー後続レビュー前提)、ja 版と key 構造を揃える
  - 公開ルーティング (Web 側 `/legal/*`) は 10.F でドメインと共に行う想定なので、本 plan では markdown のみ
- **i18n 化漏れ追跡**:
  - `AppShell.tsx` h1 / `EditorShell.tsx` h1 が `t('common.appName')` 経由になっているか
  - その他 `aria-label` / `title` / `placeholder` のハードコード残骸を grep ベース全数チェック
  - 残骸が見つかったら ja.ts / en.ts に key 追加 + 該当箇所差替え
- **CHANGELOG 雛形**:
  - **ファイル新設しない**。PRD Decisions Log で「公開リリース直前 (Phase 10.F or v1.0.0 タグ作成時) まで起票しない」が確定済、起票テンプレートも別ファイルに置かない
  - 「Phase 10.F で起票時に参照する遡及記録ソース」として `phase-10-direction.prd.md` の Phase 10 sub-phase table + 各 phase の Decisions Log で十分 (本 plan では明示的にこれを確認するだけ)
- **PRD / 作業メモの追従**:
  - `phase-10-direction.prd.md` の Phase 10.D status を `pending` → `complete` (本 plan 完了時点で)
  - `phase-10-naming.md` の「次のアクション」のリネーム実装行 + ADR-0005 起票行に `[x]` 化
  - `snap-share.prd.md` Implementation Phases / Decisions Log の必要箇所を反映

### Acceptance (受け入れ条件)

- [ ] **ADR-0005**:
  - [ ] `docs/adr/ADR-0005-app-naming-and-domain.md` Status: accepted で起票
  - [ ] Context / Decision / Consequences / Alternatives / クリアランス調査結果 / Related Links を網羅
- [ ] **Workspace package rename**:
  - [ ] `package.json` (root) の `name` / `description` が `pitamark` 系
  - [ ] `apps/{web,api}/package.json` `packages/shared/package.json` の `name` が `@pitamark/*`
  - [ ] 全 import path が `@pitamark/*` (zero hits for `@snap-share/` outside historical docs)
  - [ ] `pnpm install` で lockfile 再生成、`pnpm test` 全 workspace 緑
  - [ ] `.github/workflows/ci.yml` の `--filter` 指定が `@pitamark/*`
- [ ] **可視 UI / 生成物**:
  - [ ] `AppShell.tsx` h1 / `EditorShell.tsx` h1 が `t('common.appName')` 経由
  - [ ] `i18n/ja.ts` / `i18n/en.ts` の `common.appName` 値が `'pitamark'`
  - [ ] `apps/web/index.html` の title / `og:site_name` / `og:title` / `twitter:title` が pitamark + tagline
  - [ ] `lib/exportPng.ts` の `buildExportFilename` プレフィックスが `pitamark-`
  - [ ] e2e spec のファイル名 regex (`golden-path.spec.ts` / `keyboard-shortcuts.spec.ts` / `room-create.spec.ts`) も `pitamark-` に
  - [ ] unit test (`exportPng.test.ts`) も `pitamark-` 期待値で更新
- [ ] **localStorage migration**:
  - [ ] `i18n/index.ts` の `STORAGE_KEY` が `pitamark-lang`、初回起動時に旧 `snap-share-lang` を読んで新キーに書き戻し旧キー削除
  - [ ] `lib/local-user.ts` の `STORAGE_KEY` が `pitamark/user-v1`、同様に migration ロジック
  - [ ] migration 用の unit test 2 件 (旧キーが存在 → 新キーに移動 + 旧キー削除 / 新キーのみ存在 → migration 走らない)
  - [ ] e2e / unit test の旧キー setItem を新キーに書き換え
- [ ] **API 内部識別子**:
  - [ ] `apps/api/src/index.ts` の health response `service` が `pitamark-api`
  - [ ] `apps/api/src/lib/openapi.ts` の OpenAPI doc title が `pitamark API`
  - [ ] `apps/api/vitest.config.ts` の vitest project name 内部識別子も整合 (任意、見送り可)
  - [ ] `apps/api/__tests__/health.test.ts` / `__tests__/openapi.test.ts` の expected 文字列を更新
  - [ ] `LOCAL_ORIGIN = Symbol('snap-share/local')` の symbol description を `'pitamark/local'` に (識別子内容は内部、互換性影響なし)
- [ ] **OGP / favicon**:
  - [ ] `apps/web/public/og-image.png` (1200×630, PNG) 配置
  - [ ] `apps/web/public/apple-touch-icon.png` (180×180) 配置
  - [ ] `apps/web/index.html` に `<meta property="og:image" content="%VITE_PUBLIC_URL%/og-image.png">` + 縦横 size meta 追加
  - [ ] `<meta name="twitter:card">` が `summary_large_image`
  - [ ] `<meta name="twitter:image">` 追加
  - [ ] `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` 追加
- [ ] **SEO 雛形**:
  - [ ] `apps/web/public/robots.txt` 新規 (Allow + Disallow `/r/` + sitemap)
  - [ ] `apps/web/public/sitemap.xml` 新規 (`/` のみ、`%VITE_PUBLIC_URL%` テンプレ)
  - [ ] index.html に JSON-LD `SoftwareApplication` inline (`name=pitamark` / `description` / `url=%VITE_PUBLIC_URL%` / `applicationCategory=MultimediaApplication` / `operatingSystem=Web`)
  - [ ] index.html に `<link rel="canonical" href="%VITE_PUBLIC_URL%/">`
  - [ ] `apps/web/public/_headers` で sitemap.xml / robots.txt の Content-Type が壊れていないこと (Pages デフォルト挙動確認)
- [ ] **法務文書**:
  - [ ] `docs/legal/terms-ja.md` の "snap-share" を "pitamark" に置換 (タイトル / 本文 / GitHub URL は repo rename 想定で `imotako-pum/pitamark` に)
  - [ ] `docs/legal/privacy-ja.md` 同上
  - [ ] `docs/legal/terms-en.md` 新規 (ja 版の英訳、運営者連絡先は `[TBD: Phase 10.F]` で揃える)
  - [ ] `docs/legal/privacy-en.md` 新規 (同上)
  - [ ] en draft が DeepL / GPT 翻訳ベースであることを heading コメントに明示 (オーナー後続レビュー前提)
- [ ] **GitHub Issue Templates / README**:
  - [ ] `.github/ISSUE_TEMPLATE/abuse-report.yml` の service name + URL 例を `pitamark` 系に
  - [ ] `.github/ISSUE_TEMPLATE/config.yml` の `discussions` URL を `imotako-pum/pitamark` に
  - [ ] `README.md` のタイトル / `pnpm -F @pitamark/*` / GitHub URL 全件を更新、公開デモ URL placeholder は引き続き TBD のまま
  - [ ] `.github/PULL_REQUEST_TEMPLATE.md` 内の言及も確認
- [ ] **i18n 化漏れ追跡**:
  - [ ] `grep -E "['\"][ぁ-んァ-ヶ一-龠][^'\"]*['\"]" apps/web/src --include="*.tsx" --include="*.ts"` で残ハードコード文字列が 0 件 (test / i18n 自体除く)
  - [ ] 漏れが見つかれば key 追加 + ja/en に対訳追加 + 該当箇所 `t()` 化
- [ ] **PRD / 作業メモ反映**:
  - [ ] `phase-10-direction.prd.md` の Phase 10.D 行を `complete` に + 本 plan の link を PRP 列に
  - [ ] `phase-10-naming.md` の「次のアクション」section チェックボックス更新
  - [ ] `snap-share.prd.md` Phase 10 ladder + Decisions Log の rename 完了行追記
- [ ] **CI green**:
  - [ ] `pnpm typecheck` (root)
  - [ ] `pnpm lint`
  - [ ] `pnpm test` (3 workspace 全部)
  - [ ] `pnpm test:e2e` (Playwright chromium)
  - [ ] `pnpm build` (vite + wrangler dry-run)

## Metadata

- **Complexity**: **Large** (umbrella、新規 7 ファイル + 更新 30+ ファイル、ただし各 step は独立でリスク低)
- **Source PRD**: `.claude/PRPs/prds/phase-10-direction.prd.md` Phase 10.D
- **Related**: `.claude/PRPs/prds/phase-10-naming.md` (議論記録)
- **PRD Phase**: 10.D (10.B / 10.E 完了済 / 10.F は本 plan 完了後)
- **Branch**: `feat/phase-10-d-rename-launch-prep` (PRD 単位 1 ブランチ運用)
- **Depends on**: 10.A (PR#16 merge 済 main) + 10.B (PR#17 merge 済 main) + 10.E (apps/web/src/i18n/ 実装済) + `pitamark.app` 確定 (`phase-10-naming.md` 2026-05-05)
- **Estimated Files**: 新規 8 (ADR-0005 / og-image.png / apple-touch-icon.png / robots.txt / sitemap.xml / terms-en.md / privacy-en.md / 本 plan) + 更新 35 前後 (全 package.json / 全 i18n 利用ファイルの appName 経路 / index.html / exportPng / e2e spec 3 / unit test 数件 / wrangler.toml comment / openapi.ts / health.test.ts / openapi.test.ts / yjs-mutations.ts / vitest.config.ts / local-user.ts / i18n/index.ts / 既存 legal ja 2 / abuse-report.yml / issue templates config.yml / PULL_REQUEST_TEMPLATE.md / README.md / phase-10-direction.prd.md / phase-10-naming.md / snap-share.prd.md / その他)
- **Estimated Time**: 6-9 時間 (ADR 1h / package rename + lockfile 1h / UI / export / API 内部識別子 1h / localStorage migration + test 1h / OGP+favicon アセット制作 1.5h / SEO 雛形 1h / 法務 en draft 1.5h / i18n 漏れ + grep + dict 拡張 1h / PRD/作業メモ反映 + CI 緑化 30m)

## Architecture Notes

### リネーム影響範囲の三層

| 層 | 例 | 本 plan の扱い |
|---|---|---|
| **コード内部識別子** (再生成可、停止時間ゼロ) | package name / import path / Symbol description / vitest project name / OpenAPI title / health service field | **本 plan で全置換** |
| **可視ユーザー文字列** (UI / 生成ファイル / SNS) | h1 / index.html title・og 系 / Export PNG filename / アセット (og-image / favicon) | **本 plan で全置換** |
| **外部リソース / インフラ命名** (CF resource recreate 必要) | wrangler.toml `name` / R2 bucket name / Pages project name / Custom domain / Turnstile site key / CORS allow list | **10.F 送り** (ドメイン取得と同タイミングで) |

### localStorage migration 戦略

旧キー読み込み時のフォールバック実装パターン:

```ts
const NEW_KEY = 'pitamark-lang';
const LEGACY_KEY = 'snap-share-lang';

const readLangFromStorage = (): Lang | null => {
  try {
    const v = window.localStorage.getItem(NEW_KEY);
    if (isLang(v)) return v;
    // Migrate one-shot: copy legacy → new, delete legacy.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (isLang(legacy)) {
      window.localStorage.setItem(NEW_KEY, legacy);
      window.localStorage.removeItem(LEGACY_KEY);
      return legacy;
    }
  } catch {}
  return null;
};
```

特性:
- 旧キー → 新キー の copy + 旧削除を 1 回で行う (副作用 1 回のみ)
- localStorage 例外時は無視 (privacy mode 等)
- 単純で test 可能 (`__resetI18nForTesting` の延長で同じパターンが使える)
- `LEGACY_KEY` 定数は `i18n/index.ts` 内に閉じ、移行完了後 (Phase 11+ で十分時間が経ったら) 削除可能

`local-user.ts` の `STORAGE_KEY = 'snap-share/user-v1'` も同パターン。

### ADR-0005 の構成

`phase-10-naming.md` の以下を ADR フォーマットに圧縮:

- Context: snap-share 旧名の問題 (英動詞 + share 構造 / `snap-share.pages.dev` という「Pages 仮設」感 / 商標独自性弱い) + 改名の主目的
- Decision: `pitamark.app` (+ `pitamark.com` 並行取得)、Status: accepted
- Alternatives: A 路線 (英連語 = 全滅) / B 路線 (純造語 = 除外) / C 路線 (γ 単独 = `kakomi` のみ生存) / D 路線 (和+英連語 = 採用、`pitamark` vs `kakomark` の比較)
- Consequences: ブランド再構築コスト / 既存 link / SEO 影響軽減 (個人開発 + Phase 8 完了直後の低トラフィック) / 商標登録は Phase 11+ オプション
- Clearance Results: WHOIS / 既存サービス / USPTO / GitHub の 4 軸調査結果
- Related: ADR-0003 / ADR-0004 / phase-10-direction.prd.md / phase-10-naming.md

ADR-0001〜0004 と整合する見出し構造 (`# ADR-NNNN: ...` / `**Date** **Status** **Deciders** **Related**` / `## Context` / `## Decision` / `## Alternatives Considered` / `## Consequences` / `## References`) を採用。

### OGP 画像の生成方針

オーナー手動 design (Figma / Sketch / etc.) は本 plan では行わない。代替案:

- **Option 1: 単純な暫定アセット (推奨)**: 1200×630 単色背景 + ロゴ SVG (favicon.svg を流用) + tagline テキストの最低限の合成 PNG。SVG → PNG 変換ツール (rsvg-convert, ImageMagick, headless Chromium) で生成、デザインは Phase 10.F or 公開後に差替え可能。
- **Option 2: フルデザイン**: 配色・レイアウト・フォントを真面目に詰める。本 plan のスコープに収まらないため見送り。

→ Option 1 で進める。実装は `apps/web/public/og-image.png` に Phase 10.D 完了時点で置く (生成手順を ADR or `docs/.tmp/` ノートに残す)。後で差替えれば良いので OGP 配置自体を blocker にしない。

`apple-touch-icon.png` は favicon.svg からの 180×180 raster export で十分。

### CHANGELOG 取扱の念押し

PRD Decisions Log で「Phase 10.F or v1.0.0 タグ作成時に初版起票」が確定済 + memory `feedback_changelog_premature.md` で再確認済。本 plan では:

- ファイル新設しない
- 「起票テンプレ」「下書き」も別ファイルに置かない
- Phase 0〜10 milestone の遡及ソースは PRD と git log で十分という前提を保持

CHANGELOG 起票 NOT Building を本 plan の `## NOT Building` に明示する。

### GitHub repo rename の扱い

`imotako-pum/snap-share` → `imotako-pum/pitamark` への repo rename は GitHub Settings からのオーナー操作 (= web UI 操作) で、本 plan の自動化スコープ外。ただし README / Issue Template / 法務文書の URL は **rename 後の URL を前提に書き換える** (GitHub の `git push` / link redirect は 1 年以上保持されるため、PR merge と repo rename の前後関係が逆転しても許容範囲)。

repo rename 自体はオーナーが Phase 10.D の PR merge 前後の任意のタイミングで実行する想定。本 plan の Acceptance には含めない (= owner 手動作業として `phase-10-naming.md` の Open Questions に残し、別途オーナーが実行)。

## NOT Building (本 plan で扱わない)

- **Cloudflare 側リソース recreate** (Worker `name` / R2 bucket / Pages project / Custom domain / Turnstile site key / CORS allow list) — 10.F のスコープ
- **本番 deploy / v1.0.0 タグ / GitHub Release / CHANGELOG 起票** — 10.F のスコープ
- **GitHub repo rename** (`imotako-pum/snap-share` → `imotako-pum/pitamark`) — オーナー手動操作 (本 plan は rename 後 URL を前提に書く)
- **Web 側 `/legal/*` ルーティング追加** — ドメイン確定 + Pages 配信パスと一緒に 10.F で対応
- **法務 ja 文書の運営者連絡先 / 確定ドメイン埋込** — `[TBD]` 維持、10.F 確定
- **法務 en draft の人手レビュー / lawyer-grade refinement** — オーナー後続作業 (本 plan は LLM 翻訳 draft を出すまで)
- **正式商標登録** (USPTO / JPO / EUIPO) — Phase 11+ 事業化判断後 (`phase-10-naming.md` の通り)
- **OGP デザイン本気詰め** — 暫定アセット差替え可能設計、デザインは 10.F or 公開後に再評価
- **CHANGELOG 雛形ファイル / 起票テンプレ準備** — PRD Decisions Log で否決済、起票自体が 10.F
- **i18n 3 言語以上対応** — Phase 11+ (ADR-0004 で確定済)
- **PNG エクスポートファイル名の旧命名互換 alias** — 旧名で生成された PNG を rename することは技術的に不可、ファイル名命名は今後の生成物のみ変わる (既存 download 済 PNG はそのまま)

## Patterns to Mirror

### ADR フォーマット

```
// SOURCE: docs/adr/ADR-0004-i18n-strategy.md (lines 1-10)
# ADR-NNNN: <タイトル>

**Date**: YYYY-MM-DD
**Status**: <proposed | accepted | rejected | superseded | on hold>
**Deciders**: imotako (PM/Dev)
**Related**: <他 ADR / PRD / Phase へのリンク>

---

## Context
## Decision
## Alternatives Considered
## Consequences
## References
```

### i18n key 追加パターン

```ts
// SOURCE: apps/web/src/i18n/ja.ts (lines 1-20) + keys.ts (entire file)
// 1. ja.ts に key を追加 (TS が en.ts に同 key の存在を要求)
// 2. en.ts に対訳を追加
// 3. 利用箇所で const t = useTranslation(); t('common.appName')
```

### localStorage 利用パターン

```ts
// SOURCE: apps/web/src/i18n/index.ts (lines 22-42)
const STORAGE_KEY = 'snap-share-lang'; // ← rename 対象
const detectInitialLang = (): Lang => {
  if (typeof window === 'undefined') return 'ja';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {}
  // ...
};
```

### Vite 環境変数差し込み

```html
<!-- SOURCE: apps/web/index.html (lines 16, 38) -->
<meta property="og:url" content="%VITE_PUBLIC_URL%" />
<!-- ↑ ビルド時に置換される。本 plan で og:image / canonical / sitemap も同パターン -->
```

### PNG エクスポートファイル名

```ts
// SOURCE: apps/web/src/lib/exportPng.ts (lines 13)
// 現状:  return roomId ? `snap-share-${roomId}-${ts}.png` : `snap-share-${ts}.png`;
// 変更後: return roomId ? `pitamark-${roomId}-${ts}.png` : `pitamark-${ts}.png`;
```

## Files to Change

### 新規作成

| ファイル | 役割 |
|---|---|
| `docs/adr/ADR-0005-app-naming-and-domain.md` | アプリ名 + ドメイン確定 ADR |
| `apps/web/public/og-image.png` | OGP 画像 1200×630 (暫定) |
| `apps/web/public/apple-touch-icon.png` | iOS ホーム画面アイコン 180×180 |
| `apps/web/public/robots.txt` | クロール制御 + sitemap 参照 |
| `apps/web/public/sitemap.xml` | サイトマップ (`/` のみ、テンプレ URL) |
| `docs/legal/terms-en.md` | 利用規約英訳 draft |
| `docs/legal/privacy-en.md` | プライバシーポリシー英訳 draft |

### 更新

| ファイル | 内容 |
|---|---|
| `package.json` | `name` / `description` を pitamark 系 |
| `pnpm-workspace.yaml` | catalog コメント等の名称参照確認 (本質的変更は不要見込み) |
| `apps/web/package.json` | `name` を `@pitamark/web` + workspace dep の `@snap-share/*` → `@pitamark/*` |
| `apps/api/package.json` | 同上 (`@pitamark/api` + dep) |
| `packages/shared/package.json` | `name` を `@pitamark/shared` |
| `pnpm-lock.yaml` | `pnpm install` で再生成 |
| `apps/web/src/components/app-shell/AppShell.tsx` | h1 を `t('common.appName')` 経由に |
| `apps/web/src/pages/EditorShell.tsx` | h1 を `t('common.appName')` 経由に |
| `apps/web/src/i18n/ja.ts` / `en.ts` | `common.appName` を `'pitamark'` |
| `apps/web/src/i18n/index.ts` | `STORAGE_KEY` を `pitamark-lang` + legacy migration |
| `apps/web/src/lib/local-user.ts` | `STORAGE_KEY` を `pitamark/user-v1` + legacy migration |
| `apps/web/src/lib/exportPng.ts` | filename prefix を `pitamark-` |
| `apps/web/src/lib/__tests__/exportPng.test.ts` | 期待値を `pitamark-` に |
| `apps/web/src/i18n/__tests__/i18n.test.tsx` | localStorage key + migration test |
| `apps/web/src/lib/__tests__/local-user.test.ts` | localStorage key + migration test |
| `apps/web/src/components/{toolbar,room-gate,dialogs,...}/__tests__/*.test.tsx` | 既存 `setItem('snap-share-lang', ...)` を新キーに |
| `apps/web/e2e/landing.spec.ts` | h1 期待文字列を `pitamark` に |
| `apps/web/e2e/i18n.spec.ts` | localStorage key を新キーに |
| `apps/web/e2e/golden-path.spec.ts` / `keyboard-shortcuts.spec.ts` / `room-create.spec.ts` / `room-export-receiver.spec.ts` | PNG ファイル名 regex を `^pitamark-` に |
| `apps/web/index.html` | title / og:* / twitter:* / JSON-LD / canonical / apple-touch-icon / og:image |
| `apps/web/vite.config.ts` | コメント内 workspace 名参照の更新 (機能影響なし) |
| `apps/web/src/styles/tokens.css` | コメント内 "snap-share" 言及更新 |
| `apps/web/playwright.config.ts` | `pnpm -F @pitamark/{api,web} dev` |
| `apps/api/src/index.ts` | health の `service: 'pitamark-api'` |
| `apps/api/src/lib/openapi.ts` | OpenAPI doc title `'pitamark API'` |
| `apps/api/src/lib/bindings.ts` / `cors.ts` | コメント内の `snap-share.pages.dev` 例示を更新 (CORS 実値は 10.F) |
| `apps/api/src/__tests__/health.test.ts` / `openapi.test.ts` | 期待値更新 |
| `apps/api/src/__tests__/lib/cors.test.ts` / `images.test.ts` | テストデータ内のオリジン例を新名に (実値置換ではなくテスト fixture 更新) |
| `apps/api/vitest.config.ts` | vitest project name 内部識別子更新 (任意) |
| `apps/api/wrangler.toml` | コメント内の旧名言及更新 + 「`name` / R2 bucket / CORS は 10.F で更新」と注記。**`name` / R2 bucket / CORS_ALLOWED_ORIGINS の実値は触らない** |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | `Symbol('snap-share/local')` → `Symbol('pitamark/local')` |
| `docs/legal/terms-ja.md` | サービス名置換、GitHub URL を `imotako-pum/pitamark` に |
| `docs/legal/privacy-ja.md` | 同上 |
| `.github/ISSUE_TEMPLATE/abuse-report.yml` | サービス名 + URL 例 |
| `.github/ISSUE_TEMPLATE/config.yml` | discussions URL |
| `.github/ISSUE_TEMPLATE/bug_report.md` / `feature_request.md` | 言及があれば置換 |
| `.github/PULL_REQUEST_TEMPLATE.md` | 言及があれば置換 |
| `.github/workflows/ci.yml` | `--filter @pitamark/web` |
| `README.md` | タイトル / コマンド / GitHub URL / リンク全件 |
| `.claude/PRPs/prds/phase-10-direction.prd.md` | Phase 10.D row を complete + PRP link |
| `.claude/PRPs/prds/phase-10-naming.md` | 「次のアクション」チェックボックス更新 |
| `.claude/PRPs/prds/snap-share.prd.md` | Phase 10.D 完了反映 + Decisions Log 整合 |

## Implementation Steps

> 各 step 完了でコミット 1 つ作成。step 単位 commit を厳守 (PR 全体は 1 つ)。

### Step 1: ADR-0005 起票

**目的**: アプリ名 + ドメインの選定意思決定を ADR フォーマットで固定化。

- `docs/adr/ADR-0005-app-naming-and-domain.md` を新規作成
- ADR-0004 のフォーマットを mirror、Status は **accepted** (取得自体は 10.F だが、選定は確定済)
- `phase-10-naming.md` の「議論サマリ」「TLD 比較」「クリアランス調査結果」「Decisions Log」を ADR の各 section に圧縮
- Related Links に ADR-0003 / ADR-0004 / phase-10-direction.prd.md / phase-10-naming.md
- **commit**: `docs(adr): ADR-0005 アプリ名 + ドメイン (pitamark.app) を accepted で起票`

### Step 2: Workspace package rename

**目的**: pnpm workspace + lockfile を `@pitamark/*` に揃える。

- `package.json` (root): `name` `description` 更新
- `apps/web/package.json` / `apps/api/package.json` / `packages/shared/package.json`: `name` を `@pitamark/*` + workspace dep 経路 `@snap-share/*` → `@pitamark/*`
- 全 import path の `@snap-share/` を `@pitamark/` に一括置換 (sed / find -name "*.ts*"):
  - `apps/web/src/**` (約 25 ファイル)
  - `apps/api/src/**` (約 10 ファイル)
  - `apps/web/e2e/**` (該当あれば)
- `apps/web/playwright.config.ts` の `pnpm -F @snap-share/{web,api}` を `@pitamark/*` に
- `apps/web/vite.config.ts` のコメント内 workspace 言及を更新
- `.github/workflows/ci.yml` の `--filter @snap-share/web` を `@pitamark/web` に
- `pnpm install` で `pnpm-lock.yaml` 再生成
- `pnpm typecheck` 全 workspace で通ることを確認
- **commit**: `refactor(phase-10-d): workspace package を @pitamark/* にリネーム`

### Step 3: 可視 UI 表記の i18n 化 + dict 値変更

**目的**: 「snap-share」というハードコード表記を `t('common.appName')` 経由に統一し、dict 値を `pitamark` に。

- `apps/web/src/components/app-shell/AppShell.tsx`: `<h1>snap-share</h1>` → `<h1>{t('common.appName')}</h1>` (既存の `useTranslation` import 追加)
- `apps/web/src/pages/EditorShell.tsx` line ~510: 同様に `t('common.appName')` 経由に
- `apps/web/src/i18n/ja.ts` / `en.ts` の `common.appName` 値を `'pitamark'` に変更
- `apps/web/index.html`:
  - `<title>` を `pitamark — 画像URL一発で共同注釈`
  - `og:site_name` `og:title` `twitter:title` を pitamark + tagline
  - `<html lang="ja">` 維持 (i18n 切替で動的化されるが initial は ja でよい)
- e2e `landing.spec.ts` の h1 期待値を `pitamark` に
- 既存 unit test (`AppShell` / `EditorShell` 関連) で h1 / title を assert している箇所があれば同期
- **commit**: `feat(phase-10-d): 可視 UI 表記を pitamark に変更 (common.appName 経由)`

### Step 4: API 内部識別子の rename

**目的**: health endpoint / OpenAPI doc / vitest project / Symbol 識別子の "snap-share" を "pitamark" に。

- `apps/api/src/index.ts`: `service: 'snap-share-api'` → `'pitamark-api'`
- `apps/api/src/lib/openapi.ts`: `title: 'snap-share API'` → `'pitamark API'`
- `apps/api/vitest.config.ts`: `name: 'snap-share/virtualize-cloudflare-workers'` → `'pitamark/virtualize-cloudflare-workers'` (任意、内部識別子のみ)
- `apps/web/src/domain/annotation/yjs-mutations.ts`: `Symbol('snap-share/local')` → `Symbol('pitamark/local')` (Symbol description のみ、互換影響なし)
- `apps/api/src/__tests__/health.test.ts` / `openapi.test.ts` の期待値更新
- **commit**: `refactor(phase-10-d): API 内部識別子 (health.service / OpenAPI title / Symbol) を pitamark に`

### Step 5: localStorage key migration

**目的**: 既存ユーザーが踏んでも language preference / presence identity を失わない one-shot migration。

- `apps/web/src/i18n/index.ts`:
  - `const STORAGE_KEY = 'pitamark-lang';`
  - `const LEGACY_STORAGE_KEY = 'snap-share-lang';`
  - `detectInitialLang` で新キー → なければ legacy → 見つかれば copy + delete legacy
  - `setLang` で書き込みは新キーのみ
- `apps/web/src/lib/local-user.ts` で同パターン (`pitamark/user-v1` + legacy `snap-share/user-v1`)
- 単体テスト 4 件追加:
  - `i18n`: 新キーのみ存在 → そのまま読む / legacy のみ存在 → 新キーに移動 + legacy 削除
  - `local-user`: 同上 2 件
- 既存テスト群 (`__tests__/*.test.tsx` で `setItem('snap-share-lang', 'ja')` している ColorPalette / FontSizeControl / Toolbar / RoomGate / HelpModal / i18n.test など 5+ ファイル) を新キーに置換
- e2e `i18n.spec.ts` の `localStorage.getItem('snap-share-lang')` を新キーに
- **commit**: `feat(phase-10-d): localStorage key を pitamark 系に rename + 旧キー migration`

### Step 6: Export PNG ファイル名 prefix

**目的**: 生成 PNG のファイル名 prefix を `pitamark-` に。

- `apps/web/src/lib/exportPng.ts`: `buildExportFilename` 内の prefix 文字列を `pitamark-` に
- `apps/web/src/lib/__tests__/exportPng.test.ts`: 期待値 4 件を更新
- `apps/web/e2e/golden-path.spec.ts` / `keyboard-shortcuts.spec.ts` / `room-create.spec.ts` / `room-export-receiver.spec.ts`: regex `^snap-share-` を `^pitamark-` に
- **commit**: `feat(phase-10-d): export PNG ファイル名 prefix を pitamark- に`

### Step 7: OGP / favicon アセット作成

**目的**: SNS シェア時のプレビューを pitamark で揃える。

- `apps/web/public/og-image.png` (1200×630) を生成:
  - 暫定: 単色背景 + favicon.svg のロゴ要素 + tagline テキスト
  - 生成手順: SVG 合成 → headless Chromium screenshot or rsvg-convert で PNG export
  - ファイルサイズ <100KB を目標 (Cloudflare Pages 配信)
- `apps/web/public/apple-touch-icon.png` (180×180) を生成 (favicon.svg ベース)
- `apps/web/index.html` を更新:
  - `<meta property="og:image" content="%VITE_PUBLIC_URL%/og-image.png" />`
  - `<meta property="og:image:width" content="1200" />`
  - `<meta property="og:image:height" content="630" />`
  - `<meta property="og:image:alt" content="pitamark — 画像URL一発で共同注釈" />`
  - `<meta name="twitter:card" content="summary_large_image" />` (旧 `summary` から)
  - `<meta name="twitter:image" content="%VITE_PUBLIC_URL%/og-image.png" />`
  - `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`
- 生成手順 (再現性確保) を `docs/.tmp/og-image-generation.md` に記録 (本 plan のサポート資料、optional)
- **commit**: `feat(phase-10-d): OGP / apple-touch-icon アセット + index.html meta 整備`

### Step 8: SEO 雛形 (robots.txt / sitemap.xml / JSON-LD / canonical)

**目的**: 公開時の検索エンジン挙動を制御 + 構造化データを埋め込む。

- `apps/web/public/robots.txt` 新規:
  ```
  User-agent: *
  Allow: /
  Disallow: /r/
  Sitemap: %VITE_PUBLIC_URL%/sitemap.xml
  ```
  ※ `/r/:roomId` はルーム閲覧パスでルーム ID 漏洩 + 古い注釈の意図せぬ公開を避けるため exclude。`%VITE_PUBLIC_URL%` 置換は Vite が `public/` 内ファイルでは行わない可能性があるので注意 — Pages 静的配信時に sitemap URL が相対 `/sitemap.xml` で問題ないか or build スクリプトで置換するかを確認。
- `apps/web/public/sitemap.xml` 新規 (xmlns: `http://www.sitemaps.org/schemas/sitemap/0.9`、`<loc>` のみ最小):
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>%VITE_PUBLIC_URL%/</loc></url>
  </urlset>
  ```
- `apps/web/index.html` に追加:
  - `<link rel="canonical" href="%VITE_PUBLIC_URL%/" />`
  - JSON-LD inline script:
    ```html
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "pitamark",
      "description": "画像にハイライト・吹き出し・矢印・テキストをオーバーレイし、URL一発で共同編集できる、日本語ファーストの軽量Webアプリ。",
      "url": "%VITE_PUBLIC_URL%",
      "applicationCategory": "MultimediaApplication",
      "operatingSystem": "Web",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "JPY" }
    }
    </script>
    ```
- `_headers` の挙動確認: robots.txt / sitemap.xml の Content-Type は Cloudflare Pages デフォルトで text/plain / application/xml が付くはずだが、CSP との競合がないかレビュー。
- **重要**: Vite は `public/` 内 ファイルを `index.html` のように環境変数置換しない。robots.txt / sitemap.xml の `%VITE_PUBLIC_URL%` をどう扱うか:
  - **方針 A**: build script で `pnpm postbuild` 的に置換 (テンプレ → dist 出力時) — 実装コスト中
  - **方針 B**: ドメイン確定 (10.F) 時に hard-code に書き換える前提で `%VITE_PUBLIC_URL%` を placeholder のまま残す — 簡単だが 10.F で忘れると bug
  - **方針 C**: sitemap.xml / robots.txt を 10.F 時に hard-code 値で commit する (本 plan ではファイル骨格のみ作成、URL は `[TBD: Phase 10.F]` コメント) — 推奨
  - → **方針 C 採用**。robots.txt / sitemap.xml の URL 部分はコメントで TBD を明示、10.F の Acceptance に「robots.txt / sitemap.xml の URL を確定値置換」を追加する想定 (これも `phase-10-direction.prd.md` Phase 10.F の Scope に既に含まれているので追加不要)。
- **commit**: `feat(phase-10-d): SEO 雛形 (robots.txt / sitemap.xml / JSON-LD / canonical) 追加`

### Step 9: 法務文書のサービス名置換 + 英訳 draft

**目的**: 法務 ja の "snap-share" → "pitamark"、+ 英訳 draft 作成。

- `docs/legal/terms-ja.md`: タイトル + 本文の "snap-share" → "pitamark" 置換、GitHub URL を `imotako-pum/pitamark` に (repo rename 後 URL を前提)
- `docs/legal/privacy-ja.md` 同上
- `docs/legal/terms-en.md` を新規作成:
  - ja 版を LLM 翻訳 (DeepL or GPT) ベースで英訳 draft
  - 1 行目に `<!-- DRAFT: machine-translated from terms-ja.md, requires human review before public release. -->` を必ず明記
  - 運営者連絡先 / 確定ドメインは `[TBD: Phase 10.F]` で揃える
  - 言い回しは ja 版と整合 (見出し対応 / 章構造 mirror)
- `docs/legal/privacy-en.md` 同上
- **commit**: `feat(phase-10-d): 法務文書を pitamark に rename + en draft (machine-translated) 追加`

### Step 10: GitHub Issue Templates / README / CI 反映

**目的**: GitHub 経由の連絡窓口 + ドキュメント上の名前 / URL 一掃。

- `.github/ISSUE_TEMPLATE/abuse-report.yml`: description / placeholder / URL 例の "snap-share" → "pitamark"
- `.github/ISSUE_TEMPLATE/config.yml`: discussions URL を `imotako-pum/pitamark` に
- `.github/ISSUE_TEMPLATE/bug_report.md` / `feature_request.md`: 言及があれば置換
- `.github/PULL_REQUEST_TEMPLATE.md`: 言及があれば置換
- `README.md` 全置換:
  - タイトル `# pitamark`
  - description 文 (`snap-share monorepo (turborepo)` → `pitamark monorepo (turborepo)`)
  - コマンド例 `pnpm -F @snap-share/*` → `pnpm -F @pitamark/*`
  - GitHub URL `imotako-pum/snap-share` → `imotako-pum/pitamark`
  - 公開デモ URL placeholder は引き続き `TBD (Phase 10.F)` 維持
  - `wrangler r2 bucket create snap-share-images` のような操作コマンドの例は **更新しない** (実バケットの現在名で残す、10.F で更新)
- **commit**: `chore(phase-10-d): README + GitHub templates の rename 反映`

### Step 11: i18n 化漏れ追跡

**目的**: Phase 10.E で取りこぼしたハードコード文字列がないか網羅 grep。

- `grep -rEn "['\"][ぁ-んァ-ヶ一-龠][^'\"]*['\"]" apps/web/src --include="*.tsx" --include="*.ts"` で `__tests__/` `i18n/` を除外して残ハードコードを抽出
- 0 件であれば PRD/作業メモ反映に進む
- 1 件以上見つかったら:
  - i18n key を ja.ts に追加
  - en.ts に対訳追加
  - 該当箇所を `t('...')` 経由に
  - 関連 unit test 追加
- 観察した snap-share → pitamark のリネーム漏れも同 grep で確認 (`grep -rn "snap-share" apps/ packages/ docs/legal/ --exclude-dir=__tests__`)
- **commit**: `refactor(phase-10-d): i18n ハードコード文言 + リネーム漏れの追跡 (見つかれば修正、なければ verification commit)`

### Step 12: PRD / 作業メモ反映 + CI 緑化

**目的**: PRD と作業メモを現実と一致させる + 全 CI green を確認。

- `phase-10-direction.prd.md`:
  - Phase 10.D 行の Status を `pending` → `complete`
  - PRP 列に `[phase-10-d-rename-launch-prep.plan.md](../plans/phase-10-d-rename-launch-prep.plan.md)`
- `phase-10-naming.md` の「次のアクション」section チェックボックス更新:
  - ADR-0005 起票 `[ ]` → `[x]`
  - リネーム実装 `[ ]` → `[x]`
- `snap-share.prd.md`:
  - Phase 10 ladder の Phase 10.D 完了反映
  - Decisions Log にリネーム完了日 + commit hash
  - Open Questions に repo rename ステータス追加 (もし phase-10-naming.md 内 Open Questions が残っていれば連動)
- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e` / `pnpm build` を順次実行、全 green 確認
- **commit**: `docs(phase-10-d): PRD / 作業メモ更新 + Phase 10.D complete マーク`

### (Optional) Step 13: GitHub repo rename の owner 通知

本 plan の scope 外だが、PR description に「merge 後にオーナーが GitHub Settings で `imotako-pum/snap-share` → `imotako-pum/pitamark` に repo rename を実行してください」を明記。

## Testing Strategy

### Unit Tests

| Test | 対象 | 期待 |
|---|---|---|
| `i18n.test.tsx` legacy migration | localStorage に `snap-share-lang=en` のみ存在 | `pitamark-lang=en` が書き込まれ、`snap-share-lang` が削除される、初期 lang は `en` |
| `i18n.test.tsx` no migration | localStorage に `pitamark-lang=ja` のみ存在 | 既存値そのまま、legacy keys 触らない |
| `local-user.test.ts` legacy migration | `snap-share/user-v1` に既存 user data | `pitamark/user-v1` に移動 + 旧キー削除 |
| `local-user.test.ts` no migration | `pitamark/user-v1` のみ | 既存値そのまま |
| `exportPng.test.ts` filename | `buildExportFilename(now, 'abc123')` | `'pitamark-abc123-20260501-153012.png'` |
| `health.test.ts` service field | GET /health | `service: 'pitamark-api'` |
| `openapi.test.ts` doc title | OpenAPI doc | `info.title: 'pitamark API'` |

### Integration / E2E

| Test | 対象 | 期待 |
|---|---|---|
| `landing.spec.ts` h1 | landing ページ h1 | `pitamark` を含む |
| `golden-path.spec.ts` filename | PNG download filename | `^pitamark-[A-Za-z0-9_-]{21}-\d{8}-\d{6}\.png$` |
| `keyboard-shortcuts.spec.ts` filename | 同上 | 同上 |
| `room-create.spec.ts` filename | 同上 | 同上 |
| `room-export-receiver.spec.ts` filename | 受信側 PNG | `^pitamark-` |
| `i18n.spec.ts` storage key | localStorage | `pitamark-lang` キーで読み書き |

### Edge Cases Checklist

- [ ] localStorage 例外 (privacy mode / sandboxed iframe) で migration が壊れない (既存 i18n.test.tsx の例外パスをそのまま流用)
- [ ] 旧キー `snap-share-lang` に不正値 (`'fr'` 等) が入っていた場合 — `isLang` 判定で reject し migration 走らない
- [ ] OGP image が見つからない場合 (404) — twitter:card は `summary_large_image` 指定でも image 不在で fallback 表示するか確認、暫定は image を確実に配置
- [ ] sitemap.xml / robots.txt の `%VITE_PUBLIC_URL%` placeholder が production deploy 時に置換されないリスク — 10.F の Acceptance で確実に hard-code 値置換 (本 plan では TBD コメント明示のみ)
- [ ] PNG ファイル名 regex が大文字小文字で誤検知しない — 既存 regex `[A-Za-z0-9_-]{21}` 維持
- [ ] `pnpm install` 後の lockfile 差分が `@snap-share/*` 完全消滅していること — `grep "@snap-share" pnpm-lock.yaml` で 0 件確認

## Validation Commands

### Static Analysis

```bash
pnpm typecheck
```

EXPECT: ゼロ型エラー (全 workspace)

```bash
pnpm lint
```

EXPECT: biome ci で WARN 0 / ERROR 0

### Unit Tests

```bash
pnpm -F @pitamark/shared test
pnpm -F @pitamark/api test
pnpm -F @pitamark/web test
```

EXPECT: 全 PASS。新規 migration test 4 件 PASS、期待値変更済 test 全件 PASS。

### E2E Tests

```bash
pnpm test:e2e
```

EXPECT: 全 spec 緑。Playwright chromium で landing / golden-path / keyboard-shortcuts / room-create / room-export-receiver / i18n / landing-password-toggle 全件 PASS。

### Build

```bash
pnpm build
```

EXPECT: vite (web) + wrangler dry-run (api) ともに success、bundle に snap-share 文字列残存なし (`grep -r "snap-share" apps/web/dist` で 0 件 — ただし dist 内 SVG / inline 文字列で historical comment が残るのは ok、可視文字列のみチェック)。

### Manual Verification

- [ ] `pnpm dev` で web (localhost:5173) を開き、ヘッダ h1 が `pitamark` 表示
- [ ] 言語切替 → reload で localStorage に `pitamark-lang` が書かれている (devtools Application タブ)
- [ ] PNG エクスポートの download filename が `pitamark-...png`
- [ ] `view-source:localhost:5173` で `<title>pitamark — ...</title>` `<meta property="og:image" content="/og-image.png">` (or %VITE_PUBLIC_URL% placeholder) `<link rel="canonical">` JSON-LD inline 確認
- [ ] `localhost:5173/og-image.png` が 200 で表示 (1200×630 画像)
- [ ] `localhost:5173/apple-touch-icon.png` が 200
- [ ] `localhost:5173/robots.txt` が `User-agent: *` で 200
- [ ] `localhost:5173/sitemap.xml` が xml で 200
- [ ] localStorage に `snap-share-lang=en` を手動セット → reload → `pitamark-lang=en` に migrate されて `snap-share-lang` が消える

## Acceptance Criteria

- [ ] 全 step の commit が分離済 (12-13 commit、step 12 の PRD 反映で完了マーク)
- [ ] 全 validation commands pass
- [ ] 新規ファイル 7 + 更新ファイル 35 前後が変更済
- [ ] 旧名 (`snap-share` / `@snap-share/`) の grep が以下のみ残ること:
  - `pnpm-lock.yaml` の **削除済リソース履歴部分** (なし、再生成で消える)
  - 完了済 PRD / plan / report (`PRPs/prds/snap-share.prd.md` の本文中のドメイン履歴記録 / 過去 phase plan の commit ref / `PRPs/plans/completed/*` の歴史記録)
  - `docs/adr/ADR-0001`〜`ADR-0004` の歴史記録 (rename しない)
  - `phase-10-naming.md` の「snap-share 旧名」議論部分 (歴史記録)
  - `wrangler.toml` の `name = "snap-share-api"` / R2 bucket / CORS hardcoded 値 (10.F 送り、本 plan で **意図的に残す**)
  - `apps/api/src/__tests__/lib/cors.test.ts` の `snap-share.pages.dev` テストフィクスチャ (実値が変わるのは 10.F のため fixture も 10.F で更新)
  - `apps/api/src/__tests__/images.test.ts` 同上
- [ ] CHANGELOG.md ファイル不在 (PRD Decisions Log 通り、10.F まで保留)
- [ ] CI green (typecheck / lint / test / test:e2e / build)
- [ ] PRD `phase-10-direction.prd.md` の Phase 10.D が `complete` で本 plan link が PRP 列に記載

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `pnpm install` lockfile 再生成で予期しない upgrade | L | M | catalog: pin で固定済、再生成後の diff を一読 |
| localStorage migration の競合 (新旧両方が存在する場合) | L | M | 新キー優先 → なければ legacy → 新キーに copy + legacy 削除、明示的優先順位を test で固定 |
| OGP 画像生成手順がオーナー環境で再現できない | M | L | 暫定アセットなので差替え可能、生成手順を docs/.tmp に残す + 完成 PNG を commit |
| robots.txt の `Disallow: /r/` が SNS シェア時 OGP プレビューに影響 | L | L | OGP 取得は ルートページ `/` のみがシェア対象 (ルームページがシェア対象になる時は別 plan で再検討) |
| Vite が `public/` 内 robots.txt / sitemap.xml の `%VITE_PUBLIC_URL%` を置換しない | H | M | TBD コメント明示で 10.F に hard-code 値置換を委譲、本 plan ではファイル骨格のみ |
| 法務 en draft の翻訳精度が低く誤解を招く | M | M | DRAFT コメント明示 + Phase 10.F or 11 で human review、公開時にリンクを `[TBD]` のままにすれば 公開しても被害なし |
| `pnpm test:e2e` が flaky で false negative | M | L | 失敗時は 1 回 retry、それでも失敗なら spec 単独で確認 |
| GitHub repo rename と PR merge の前後で URL が壊れる | L | L | GitHub redirect が 1 年以上保つ、merge 後にオーナーが手動 rename する想定で PR description に明記 |
| `@snap-share/api` を type import している `@hono/zod-openapi` の `AppType` 型推論が壊れる | L | H | rename 後に `apps/web/src/lib/api-client.ts` の `import type { AppType } from '@pitamark/api'` で型解決確認、`pnpm typecheck` で fail-fast |
| `apps/api/wrangler.toml` の `name = "snap-share-api"` を残すことで dev 環境と prod 環境の Worker name が乖離 | L | L | dev 環境 (wrangler dev) では name に依存しない、本 plan は意図的に残し PRD で 10.F 移管を明記 |

## Notes

- **branch-per-phase 運用の確認**: memory `feedback_branch_per_phase.md` 通り、本 plan は `feat/phase-10-d-rename-launch-prep` ブランチ 1 つで step 単位 commit、PR は phase 完了で 1 つ。10.F は別ブランチ。
- **CHANGELOG ロールバック判断との整合**: PRD Decisions Log で確定済の「Phase 10.F or v1.0.0 タグ作成時まで起票しない」を本 plan も忠実に守る。
- **rename の partial 性**: 本 plan は「ドメインに依存しない rename」のみ実施し、Cloudflare 側リソース (Worker name / R2 bucket / Pages project) は意図的に snap-share 命名のまま維持する。これは 10.F でドメイン取得と同タイミングで recreate or alias 設定するための予約であり、PRD `phase-10-direction.prd.md` Phase 10.F の Scope と一致する。
- **OGP 暫定アセットの差替え可能性**: 本 plan で配置する og-image.png はあくまで「公開時に SNS スクレイパが破損プレビューを生成しない」という最低限の役割。本格デザインは 10.F もしくは公開後の任意タイミングで差替え予定。
- **歴史記録の保護**: 完了済 PRD / plan (`PRPs/plans/completed/*`) / 過去 ADR (`ADR-0001`〜`ADR-0004`) / phase-10-naming.md の議論サマリ部分は **意図的に rename しない**。これらは Phase 10.D 時点の歴史記録として価値があり、後から見て「いつ・なぜ snap-share から pitamark になったか」を追跡可能にするため。
