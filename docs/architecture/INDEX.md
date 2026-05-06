# Architecture Documentation

> snap-share / pitamark の **コード HOW + WHERE** を扱う。
> WHY 決定は `../adr/`、Phase 0 検証ログは `../spikes/REPORT.md`、運用 HOW は `../observability.md` を参照。

## 対象読者

React + Hono で業務アプリを組んだ経験のある開発者。Konva / Yjs / Cloudflare Workers / Durable Objects の前知識は不要 — 06 章で最小限に補完する。

## 30 分コース (全体像のみ)

`INDEX → 01-overview → 04-api-anatomy → 05-web-anatomy → 07-flows`

主要なコンポーネントとデータの流れが把握できる。

## 60 分コース (フル)

上記に加えて `02-monorepo-and-tooling` / `03-shared-package` / `06-realtime-and-konva` / `08-glossary-and-pitfalls` / `09-environment-and-deploy`。設計判断や未知ライブラリの最低限まで含めて理解できる。

## ファイル一覧

| ファイル | 主目的 | 想定時間 |
|---|---|---|
| [01-overview.md](./01-overview.md) | 全体像 + 主要シーケンス | 10 分 |
| [02-monorepo-and-tooling.md](./02-monorepo-and-tooling.md) | pnpm catalog / turbo / Biome / Vitest | 5 分 |
| [03-shared-package.md](./03-shared-package.md) | Zod SSOT (Annotation discriminated union) | 5 分 |
| [04-api-anatomy.md](./04-api-anatomy.md) | apps/api 全体構造 | 10 分 |
| [05-web-anatomy.md](./05-web-anatomy.md) | apps/web 全体構造 + 状態管理 2 系統 | 12 分 |
| [06-realtime-and-konva.md](./06-realtime-and-konva.md) | Konva + Yjs CRDT + DO + WS Hibernation 深堀り | 15 分 |
| [07-flows.md](./07-flows.md) | auth / upload / sync / export / TTL シーケンス図 | 8 分 |
| [08-glossary-and-pitfalls.md](./08-glossary-and-pitfalls.md) | 用語集 + ハマりポイント + Open Questions | 5 分 |
| [09-environment-and-deploy.md](./09-environment-and-deploy.md) | bindings / .dev.vars / wrangler / CI | 5 分 |

## 既存ドキュメントとの役割分担

| ドキュメント | 役割 |
|---|---|
| [README.md](../../README.md) | プロダクト紹介 + クイックスタート |
| [CLAUDE.md](../../CLAUDE.md) | エージェント向け規約 |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | 貢献手順 |
| [docs/adr/*](../adr/) | WHY 決定の凍結記録 |
| [docs/spikes/REPORT.md](../spikes/REPORT.md) | Phase 0 検証時点 |
| [docs/observability.md](../observability.md) | 運用・監視 HOW |
| **docs/architecture/* (本ディレクトリ)** | **コード HOW + WHERE** |

## 表記規約

- 言語: 日本語 (本文) / 英語 (識別子・コード片は原文ママ)
- コード参照: `apps/api/src/yjs.ts` の `SnapShareYDO` 形式 — 識別子ベース。refactor 耐性のため行番号は最小限
- 外部仕様の引用: 各章末の参考リンクから公式ドキュメントへ

## 第一弾の前提

本ドキュメントは **Phase 10.H 完了 / 10.F 着手前 (2026-05-06)** のコード基準。Phase 11+ で実装が大きく変わった場合は差分追記が必要。
