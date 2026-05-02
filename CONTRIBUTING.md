# Contributing to snap-share

snap-share は **個人 OSS** です。バグ報告・改善提案・PR、すべて歓迎します。
このリポジトリは [日本語ファースト](./CLAUDE.md#communication-language) で運用しているので、
Issue / PR / コメントはすべて日本語で OK（英語でも受け付けます）。

## はじめに

何か直したい / 試したい場合は、まず [Issue Tracker](https://github.com/imotako-pum/snap-share/issues) を覗いてください。
すでに同じ話題が走っているか、あるいは「自分が一番手」かが分かります。

何も Issue が無い段階の小さな PR でも問題ありません。ただし大きめの変更は、
事前に Issue で目的・スコープを共有してから取り掛かったほうが手戻りが減ります。

## ローカル開発セットアップ

最短手順は [README.md](./README.md#local-development) を参照。

```sh
pnpm install
pnpm dev          # apps/web (5173) + apps/api (8787)
pnpm test         # vitest 全 workspace
pnpm test:e2e     # Playwright (Chromium のみ)
pnpm typecheck    # tsc --noEmit
pnpm lint         # biome ci .
```

Node 22+ と pnpm 10 が必須です（`packageManager` で固定済み）。

## PRP ワークフロー

このリポジトリは PRD → Plan → Implement → Report → Review → PR の
[PRP ワークフロー](./.claude/PRPs/) で進めています。

| フォルダ | 用途 |
|---|---|
| `.claude/PRPs/prds/` | フェーズごとの製品要件 |
| `.claude/PRPs/plans/` | 進行中の実装計画。完了したら `plans/completed/` へ移動 |
| `.claude/PRPs/reports/` | 実装報告（plan からの逸脱・検証結果） |
| `.claude/PRPs/reviews/` | コードレビュー成果物 |
| `.claude/rules/` | コーディングルール（common + 言語別） |

Claude Code を使っている場合は次のスラッシュコマンドが便利です。

- `/everything-claude-code:prp-prd` — 新規 PRD ドラフト
- `/everything-claude-code:prp-plan` — Plan 作成
- `/everything-claude-code:prp-implement` — Plan を実装
- `/everything-claude-code:code-review` — 差分の code review
- `/everything-claude-code:prp-pr` — PR 作成

PRP を使わない小さい Issue / PR でももちろん OK です。

## ブランチ命名

プレフィックスを付けて意図を明確に：

- `feat/<scope>-<short-desc>` — 新機能
- `fix/<scope>-<short-desc>` — バグ修正
- `refactor/<scope>-<short-desc>` — 振る舞いを変えない内部改善
- `docs/<short-desc>` — ドキュメントのみ
- `chore/<short-desc>` — リリース・依存更新・CI など

## Conventional Commits

コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/)
スタイルを採用しています。type は英語、本文は日本語。

```
feat(phase-7): Cloudflare Turnstile を `POST /rooms` に統合
fix(canvas): モバイル Safari でハイライトが描画されない問題を修正
docs(readme): 本番デプロイ手順を追記
refactor(api): rooms ルートの zod スキーマを共通化
```

詳しくは [.claude/rules/common/git-workflow.md](./.claude/rules/common/git-workflow.md) を参照。

## PR チェックリスト

PR を投げる前に確認してください：

- [ ] `pnpm typecheck` が緑
- [ ] `pnpm lint` が緑
- [ ] `pnpm test` が緑（影響範囲のテストを足してあれば尚良い）
- [ ] UI 変更があれば `pnpm -F @snap-share/web test:e2e` も緑
- [ ] `pnpm build` が緑
- [ ] CHANGELOG / README は変更不要 or 必要なら更新済み
- [ ] secret / API キー / IP / メールアドレスが diff に紛れていない

PR テンプレ（`.github/PULL_REQUEST_TEMPLATE.md`）にも上記が含まれています。

## レビュー方針

主要な観点：

1. **読みやすさ** — 命名と関数分割。`.claude/rules/common/coding-style.md` 参照
2. **テスタビリティ** — 純関数で書けるロジックは純関数に
3. **型安全** — `any` 禁止、`unknown` で受けて narrow
4. **セキュリティ** — secrets / IP / hash 等の機微情報をログに残さない
5. **逸脱は明示的に** — Plan から逸脱した場合は PR 本文 / report で WHAT と WHY を残す

## Code of Conduct

[Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)
を採用します。要約：誰に対しても敬意を持って、技術的な議論は技術的な内容に絞って。

## ライセンス

このリポジトリへのコントリビュートは、すべて [MIT ライセンス](./LICENSE) のもとで
配布されることに同意したものとみなします。

## 質問・相談

- バグ・機能要望: [Issues](https://github.com/imotako-pum/snap-share/issues)
- 雑談・質問: [Discussions](https://github.com/imotako-pum/snap-share/discussions)
（まだ enable していない場合は Issue でも OK）
