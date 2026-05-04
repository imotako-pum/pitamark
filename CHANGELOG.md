# Changelog

このプロジェクトのすべての notable な変更を本ファイルに記録する。

フォーマットは [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) を、
バージョニングは [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) を採用する。

> **運用方針**:
>
> - 各リリースは `[X.Y.Z] - YYYY-MM-DD` 見出しで切る。
> - `Unreleased` セクションに作業中の変更を蓄積し、リリース時に確定見出しへ昇格する。
> - 変更カテゴリ: `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`。
> - 0.x の間は破壊的変更でも minor を上げない場合がある。`v1.0.0` 以降は SemVer を厳格に守る。

---

## [Unreleased]

### Added

- Phase 10.B: `POST /rooms` で `ttlMs` (ms, optional) を受け付け、ルーム単位で TTL を上書き可能 (default 24h / max 7d)。
- Phase 10.B: ルートに `CHANGELOG.md` を新設し、Phase 0〜10 の milestone を遡及記録。
- Phase 10.B: `docs/legal/terms-ja.md` / `docs/legal/privacy-ja.md` の draft を追加 (個人運営・cookieless・TTL 24h-7d)。
- Phase 10.B: 通報窓口 (`.github/ISSUE_TEMPLATE/abuse-report.yml` + `report-abuse` label) を追加、README 反映。
- Phase 10.B: `apps/web/index.html` に description / OGP / Twitter card / 改訂 title を追加。

### Changed

- Phase 10.B: ルーム TTL のデフォルトを 7 日から 24 時間に短縮。明示的に `ttlMs` 指定で max 7 日まで延長可能。フリーミアム機能で MAX 緩和を予定。

### Documentation

- Phase 10.0 / 10.A: `phase-10-direction.prd.md` で公開リリース最低限整備 + i18n + ブランディング方針を確定。
- Phase 10.0: ADR-0003 (Web vs Desktop) を `Status: on hold` で起票、Mac spike を Phase 11+ 候補へ後回し。
- Phase 10.0: ADR-0004 (i18n 戦略) を `Status: Accepted` で起票、軽量自作 dict + 日英 2 言語に確定。

---

## [0.9.0-mvp] - 2026-05-05

Phase 0〜8 完了時点のスナップショット。MVP 機能 + 統合レビュー + 8.x 修正で「公開準備が完了した節目」を表す。

### Added

- **Phase 0**: 技術スパイク (Yjs + Durable Object 疎通 PoC、Konva 最小描画確認、shadcn 採用判断)。
- **Phase 1**: turborepo + pnpm workspace + Vite + Hono + Biome + Vitest + GitHub Actions CI + Zod v4 SSOT。
- **Phase 2**: 画像アップロード基盤 — Cloudflare R2 バインディング + `POST /rooms` + ルーム作成エンドポイント。
- **Phase 2.5**: API モダン化 — `@hono/zod-openapi` 移行 + `hc<AppType>` 型安全クライアント + Scalar `/api/docs` ([ADR-0002](docs/adr/ADR-0002-hono-zod-openapi-tanstack-stack.md))。
- **Phase 3**: Konva ベースのキャンバス + 4 種注釈 (矩形 / 矢印 / テキスト / ハイライト) + Undo / Redo。
- **Phase 4**: リアルタイム同期 — Durable Object WebSocket Hibernation + `y-durableobjects` 統合 + Awareness カーソル。
- **Phase 5**: パスワード保護ルーム — PBKDF2-SHA256 (210k iter) ハッシュ + ルーム作成時オプション + 入室画面 + DO Alarms による TTL 自動破棄。
- **Phase 6**: PNG エクスポート + 日本語 UI + レスポンシブ対応 + shadcn 適用。
- **Phase 7**: 公開準備 — Cloudflare Turnstile + Workers Rate Limit + 画像 SHA-256 ブラックリスト + Cloudflare Web Analytics + README。
- **Phase 7.5**: 本番プロビジョニング + 観測 + E2E 拡充 — 本番 Cloudflare リソース確定 + KPI / ダッシュボード設計 + クリティカルパス E2E。
- **Phase 7.6**: 手動 QA + バグ回収 + E2E 強化。
- **Phase 7.7**: UX 基盤改善 — 注釈リサイズ + 色変更 UI + ズーム / パン / fit-to-viewport + ショートカット完結 + チートシート Modal。
- **Phase 7.8**: 次手予測 UX — Auto-next (矢印→テキスト / 矩形→矢印) + フォントサイズ UI + dogfood / Help 準備。
- **Phase 8**: 統合レビュー (観察のみ) — 13 観点横断 + 73 finding 抽出 + Phase 8.x 修正方針確定。

### Changed

- **Phase 8.x**: 統合レビュー結果に基づき、HIGH 7 件 / MEDIUM 21 件 / LOW (HF=true) 9 件の計 37 finding を全件 close (PR #15)。
  主な改修: WebSocket 認証を 1-shot 60s ticket に変更 (JWT を upgrade URL に乗せない、KV `WS_TICKETS`)、エラーメッセージから user-controlled MIME / env var name を削除、CSP / HSTS / response headers 統一、SHA-256 prefix のみログ、画像書き込み前の Turnstile / blocklist 検証で orphan 防止、API レスポンス schema を `packages/shared` に集約。
- **Phase 8.0**: PRD Phase status table desync と plan 命名揺れを解消、umbrella report 必須化を Phase 9 以降に明文化。

### Security

- **Phase 5**: PBKDF2-SHA256 210k iter (OWASP 2023 推奨) でパスワード保護を実装。
- **Phase 7**: Cloudflare Turnstile + Workers Rate Limit (CREATE_ROOM 5/min, AUTH 10/min, SYNC 30/min) + 画像 SHA-256 KV ブラックリスト。
- **Phase 8.x**: WebSocket 認証で JWT を upgrade URL に乗せない 1-shot ticket 方式に変更、エラーメッセージから user-controlled / env var 情報を削除、orphan R2 オブジェクト防止、log redaction 統一。

### Documentation

- ADR-0001: oRPC 採用検討 (採用見送り、`@hono/zod-openapi` + `hc` を選択)。
- ADR-0002: Hono + Zod-OpenAPI + TanStack Query スタック確定。
- Phase 0〜8 各 phase に PRD / plan / report / review を `.claude/PRPs/` 配下で運用。

---

## バージョニング方針

- `0.x.y`: MVP 開発期間 (Phase 0〜8)、API は不安定。
- `0.9.0-mvp`: Phase 0〜8 完了時点のスナップショット (本リリース)。
- `1.0.0`: Phase 10 (公開リリース + i18n + ブランディング) 完了で確定予定。
- `1.x` 以降: SemVer 厳格運用。breaking change は major、新機能は minor、bug fix は patch。

[Unreleased]: https://github.com/imotako-pum/snap-share/compare/v0.9.0-mvp...HEAD
[0.9.0-mvp]: https://github.com/imotako-pum/snap-share/releases/tag/v0.9.0-mvp
