# snap-share

> 画像にハイライト・吹き出し・矢印・テキストをオーバーレイし、URL一発で共同編集できる、日本語ファーストの軽量Webアプリ。

## Problem Statement

リモートワークの平社員が上司や同僚に画像で説明・相談したい瞬間、現状は「Excelに画像貼って図形で囲む」「Slack/Teamsで長文を打つ」といった手間のかかる代替手段に流れてしまい、結果として画像を使わず文字だけで伝える → 認識ズレ・往復増 → アドバイス取得が遅延する、というコストを払っている。既存の海外SaaS（Markup.io / Pastel等）はサインアップ必須・有料・英語UIで、信頼感と手軽さの両立ができていない。

## Evidence

- ユーザー（オーナー）自身の原体験: 「なんだかんだでExcelに画像貼って図形で囲んでしまっている」
- 「画面共有を上司に依頼するのは気が引ける」という心理的ハードルの観察
- 競合5社（[AnnotateWeb](https://annotateweb.com/), [Collabshot](https://www.collabshot.com/), [Markup Hero](https://markuphero.com/), [ScreenClip](https://screenclip.com/), [Webvizio Free](https://webvizio.com/free-image-annotation-tool/)）が「画像注釈 × URL共有 × 共同編集」スポットを既に占めているが、いずれも英語UI / 日本語サポート薄 / OSSなし
- 仮説段階: 日本語ベースの安心感 + Shottr級の軽量UX + ログイン不要は実証されておらず、MVPで検証する

## Proposed Solution

画像をD&Dまたはクリップボード貼付でアップロードすると即時にルームURLが発行され、URLを知っている人がブラウザでアクセスするだけで Yjs / CRDT による同時編集が始まる。注釈ツールは矩形・矢印・テキスト・ハイライトの4種に限定し、Shottr相当の軽量UXを目指す。サーバはCloudflare Workers + Durable Objects（WebSocket Hibernation）+ R2 でフルマネージド・低コスト構成。永続化はせずTTL方式（24h or 7日）でクラウドコストを抑え、月額$30以内で運用する。**英語ツールへの不信感を持つ日本のリモートワーカー**に対する「最小限の動作で完結する第一選択肢」を狙う。

## Key Hypothesis

軽量かつ最適なUX + パスワード保護付きルームを提供すれば、日本のリモートワーカー（Teams/Slackメイン）はExcel図形やTeams長文をやめて画像注釈をsnap-shareで完結させるようになる。
**検証指標**: オーナー自身が日常業務で月3回以上自然にリピート使用するかを一次基準とし、副次的に GA等で月間ユニーク訪問者100人 / リピート率20% を測る。

## What We're NOT Building

- **画像ファイル自体の編集（フィルタ・リサイズ・色補正等）** — Shottr/CleanShot/Photoshopの領域。スコープ膨張を避ける
- **動画注釈** — 技術スコープと工数が一段階大きい
- **30+ファイル形式対応（PSD, AI等）** — Markup.ioの差別化領域。個人開発で太刀打ちしない
- **オフラインデスクトップアプリ** — Web前提（vs Collabshot）
- **永続ストレージ（MVP段階）** — TTL方式でコスト最適化、ニーズ確認後に Could で検討
- **エンタープライズ向け機密管理** — 厳格な情報統制が必要なユースケースは対象外

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| オーナーの月間自発利用回数 | 3回以上/月（v1リリース後3ヶ月） | 自己申告ログ |
| 月間ユニーク訪問者 | 100 UU/月（リリース6ヶ月後） | Cloudflare Analytics |
| ルーム作成→共有→2人目アクセス到達率 | 30%以上 | Workers ログ集計 |
| 月額インフラコスト | $30以下 | Cloudflareダッシュボード |
| 初期画面ロード（LCP） | 2秒以内 | Lighthouse / Real User Monitoring |
| 同期遅延（操作→他クライアント反映） | 200ms以内（同一リージョン） | カスタム計測 |

## Open Questions

- [x] パスワード保護の実装位置: **ルーム作成時オプション** で確定（Phase 5 で実装済、Decisions Log 参照）
- [x] ルームTTL: **デフォルト 24h / max 7d、フリーミアムで無制限** で確定（Phase 10 で仕様変更、Decisions Log 参照）
- [ ] PNG エクスポート時の元画像解像度保持の方針 (dogfood/公開後の数字で判断)
- [ ] スパム/悪用対策: Cloudflare Turnstile / レート制限 / SHA-256 ハッシュブラックリストの優先度 (公開後の実発生で判断)
- [ ] アナリティクス選定: Cloudflare Web Analytics（無料・cookieless）で十分か (Phase 10.G 観察期間で判断)
- [x] 公開ドメイン候補 + アプリ名再考 → **`pitamark.app`** (+ `.com` 並行取得) で確定 (2026-05-05)、詳細: [phase-10-naming.md](phase-10-naming.md)、ADR-0005 起票 + ドメイン取得 + リネーム実装は次セッション
- [x] i18n 戦略の確定 → **軽量自作 dict + 日英 2 言語** ([ADR-0004 accepted](../../../docs/adr/ADR-0004-i18n-strategy.md))、Phase 10.E で実装
- [x] Web vs デスクトップ方針 → **Phase 10 では Web 単独確定**、Mac spike は Phase 11+ 候補へ後回し ([ADR-0003 on hold](../../../docs/adr/ADR-0003-web-vs-desktop-direction.md))
- [x] 収益化スタンス C の撤退条件 → **半年で月 1000 円なし → B 修正検討**、Phase 11 起票時 (Phase 10.G 完了後) に判断
- [ ] 収益化現実見立て: 観察データに基づく C 維持 / B 修正の最終判断 (Phase 11 起票時)
- [x] CHANGELOG 開始時の version 番号 → **v0.9.0-mvp 起点 → Phase 10 完了で v1.0.0** で確定 (Decisions Log 参照)。ただし **ファイル新設は公開リリース直前 (Phase 10.F / v1.0.0 タグ時) まで保留** — タグ未作成段階での先行起票はリンク 404 で実用性ゼロのため (2026-05-05 ロールバック判断)

---

## Users & Context

### Primary User

- **Who**: リモートワーク中心の日本企業の平社員（Teams or Slack ヘビーユーザー、非エンジニア含む）
- **Current behavior**:
  - 上司に相談する時は画面共有を依頼することに気が引け、Teams長文に逃げる
  - 説明資料は Excel に画像を貼って図形ツールで囲む
  - 既存の海外注釈ツールは「英語 / 登録必須 / 有料」で躊躇する
- **Trigger**: 「このバナーのこの部分どう思いますか？」「ここのレイアウト、こうしたい」と画像で伝えたい瞬間
- **Success state**: 画像をD&D → URL受取 → 相手にURL送信 → 30秒以内に2人で共有空間に注釈

### Job to Be Done

> 相談やアドバイスを求める時、Teamsで長文を打つ代わりに、画像で相手の解像度を高めた前提で会話したい。そうすれば手戻りが減り、上司の負担を最小化しつつ自分の理解も早く進む。

### Non-Users（明示的に対象外）

- 専門的な画像編集（フィルタ/補正/合成）をしたい人 → Photoshop / Affinity / GIMP の領域
- 厳格な機密情報を取り扱う必要がある人 → エンタープライズ専用ツールへ
- 大規模デザインチームで Figma に既に集約されている人 → Figma/FigJamで完結
- 動画注釈ニーズの人 → Vimeo Review / Frame.io の領域
- モバイル中心ユーザー（v1） → レスポンシブはShouldだがデスクトップ優先

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| **Must** | 画像アップロード（D&D + クリップボード貼付） | エントリポイントそのもの |
| **Must** | ルームURL自動発行・即共有 | 差別化の中核「URL一発」 |
| **Must** | リアルタイム同時編集（Yjs/CRDT + WebSocket） | 価値命題 + 技術アピール |
| **Must** | 注釈ツール4種（矩形・矢印・テキスト・ハイライト） | Shottr級の最小機能セット |
| **Must** | 他ユーザーカーソル/Awareness表示 | 共同編集の体感品質 |
| **Must** | PNGエクスポート | 結果を持ち帰る基本動作 |
| **Must** | パスワード保護付きルーム | 仮説に組み込まれた差別化要素 |
| **Must** | 日本語UI | プライマリユーザー要件 |
| **Should** | レスポンシブ対応（タブレット閲覧） | 共有相手の閲覧シーン |
| **Should** | JPEG / PNG / SVG 入力対応 | 業務シーン頻度の高い形式 |
| **Should** | 英語UIフォールバック | ノイズなく対応 |
| **Should** | Undo/Redo | 編集の最低限のUX |
| **Could** | 認証・権限管理（個人アカウント） | ニーズ顕在化したら |
| **Could** | フリーミアム / 広告 | 収益化の選択肢 |
| **Could** | 永続ルーム | コスト負担の設計次第 |
| **Could** | コメントスレッド（注釈ピン） | リクエスト次第 |
| **Won't** | 画像ファイル自体の編集 | スコープ外 |
| **Won't** | 動画注釈 | スコープ外 |
| **Won't** | 30+ファイル形式対応 | 個人開発の現実 |

### MVP Scope（2ヶ月で動くもの）

1. 画像アップ → ルームURL発行 → ブラウザで開く
2. ルーム参加者全員でリアルタイム同時編集（Yjs）
3. 注釈4種（矩形・矢印・テキスト・ハイライト）
4. 他ユーザーカーソル表示
5. PNGエクスポート
6. ルームパスワード保護（オプション）
7. ルームTTL（暫定 7日）
8. 日本語UI

### User Flow（クリティカルパス）

```
[トップページ訪問]
   ↓ D&D or paste 画像
[画像アップロード（R2 直送）]
   ↓ 自動でルームURL発行
[ルーム画面表示]
   ↓ URLコピー → Teams/Slackで共有
[相手がURLクリック]
   ↓ パスワードがあれば入力
[2人で同時編集 / カーソル可視]
   ↓
[PNGエクスポート / 完了]
```

---

## Technical Approach

**Feasibility**: HIGH

### スタック確定事項

| レイヤ | 採用 | 備考 |
|---|---|---|
| Frontend | Vite + React + TanStack Router + TypeScript | 確定 |
| 状態同期 | Yjs (CRDT) | 確定 |
| Canvasレンダリング | Konva（自前UI） | オーナー経験あり、~80KB gz、軽量UX重視で確定 |
| API | Hono on Cloudflare Workers | 確定 |
| WebSocket同期 | Cloudflare Durable Objects + Hibernation API | [`y-durableobjects`](https://github.com/napolab/y-durableobjects) ベース |
| 画像ストレージ | Cloudflare R2 | 10GB無料 + エグレス無料 |
| 認証（後段） | better-auth | Could スコープ時 |
| スタイリング | Tailwind + shadcn 検討中 | shadcn 採用は Phase 0 で確定 |
| テスト | Vitest + Playwright | 確定 |
| Lint/Format | Biome | 確定 |
| Monorepo | turborepo | 確定 |

### Architecture Notes

- **CRDT永続化戦略**: Durable Object 内で Yjs ドキュメントをメモリ保持、Hibernation 中もWS接続維持。一定時間アイドル後に DO Storage に圧縮スナップショット保存し、TTL（7日）で自動破棄
- **画像配信**: クライアント → Workers 経由で R2 アップロード（presigned URL検討）。R2のエグレス無料を活かし直接配信
- **ルームID**: NanoID 21文字 + パスワードハッシュ（任意）の二段
- **SSOT**: 共有型（Schema, ルーム状態の型定義）は `packages/shared` に集約

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Konva自前UIの実装工数膨張 | M | 注釈4種に絞る、Should以下は v1.x へ繰り延べ |
| Yjs ドキュメント肥大化でDO Storage超過 | M | 1ルーム上限サイズ + スナップショット圧縮 + TTL自動破棄 |
| 公開URLのスパム/悪用 | M | Turnstile + IPレート制限 + 画像SHAブラックリスト + 通報機能 |
| 個人開発の工数オーバーラン | H | MVP厳守、Should以下は v1.x へ繰り延べ |
| WebSocket Hibernation 課金理解誤りでコスト増 | L | 実装後に1週間 dogfooding でメトリクス監視 |
| パスワード保護の実装複雑度 | M | Phase 4以降に着手、Argon2 / bcrypt + ルーム単位 |

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
| 0 | 技術スパイク | shadcn採用判断 + Yjs+DO最小疎通PoC + Konva最小描画確認 | complete | - | - | [phase-0-tech-spike.plan.md](../plans/completed/phase-0-tech-spike.plan.md) / [report](../reports/phase-0-tech-spike-report.md) / [spike-report](../../../docs/spikes/REPORT.md) |
| 1 | モノレポ初期化 | turborepo + Vite/Hono workspace + Biome + Vitest + CI + pnpm catalog + Zod v4 SSOT | complete | - | 0 | [phase-1-monorepo-init.plan.md](../plans/completed/phase-1-monorepo-init.plan.md) / [report](../reports/phase-1-monorepo-init-report.md) |
| 2 | 画像アップロード基盤 | R2バインディング + Workers API + ルーム作成エンドポイント | complete | with 3 | 1 | [phase-2-image-upload.plan.md](../plans/completed/phase-2-image-upload.plan.md) / [report](../reports/phase-2-image-upload-report.md) |
| 2.5 | API モダン化 | `@hono/zod-openapi` 移行 + `hc` 型安全クライアント配線 + Scalar `/api/docs` ([ADR-0002](../../../docs/adr/ADR-0002-hono-zod-openapi-tanstack-stack.md)) | complete | with 3 | 2 | [phase-2.5-api-modernization.plan.md](../plans/completed/phase-2.5-api-modernization.plan.md) / [report](../reports/phase-2.5-api-modernization-report.md) |
| 3 | キャンバス & 注釈ツール | Konva実装 + 4種注釈 + Undo/Redo | complete | with 2.5 | 1 | [phase-3-canvas-annotation-tools.plan.md](../plans/completed/phase-3-canvas-annotation-tools.plan.md) / [report](../reports/phase-3-canvas-annotation-tools-report.md) |
| 4 | リアルタイム同期 | Durable Object WS + y-durableobjects 統合 + Awareness | complete | - | 2, 3 | [phase-4-realtime-sync.plan.md](../plans/completed/phase-4-realtime-sync.plan.md) / [report](../reports/phase-4-realtime-sync-report.md) |
| 5 | パスワード保護 + TTL | ルーム作成時パスワード + PBKDF2 + DO Alarm TTL | complete | with 6 | 4 | [phase-5-password-protection-ttl.plan.md](../plans/completed/phase-5-password-protection-ttl.plan.md) / [report](../reports/phase-5-password-protection-ttl-report.md) |
| 6 | エクスポート + UI仕上げ | PNG export + 日本語UI + レスポンシブ + shadcn適用 | complete | with 5 | 4 | [phase-6-export-ui-polish.plan.md](../plans/completed/phase-6-export-ui-polish.plan.md) / [report](../reports/phase-6-export-ui-polish-report.md) |
| 7 | 公開準備 | スパム対策 + Cloudflare Analytics + READMEドキュメント | complete | - | 5, 6 | [phase-7-public-launch.plan.md](../plans/completed/phase-7-public-launch.plan.md) / [report](../reports/phase-7-public-launch-report.md) / [review](../reviews/phase-7-public-launch-review.md) |
| 7.5 | 本番プロビジョニング + 観測 + E2E 拡充 | Cloudflare 本番リソース確定 + KPI/ダッシュボード設計 + クリティカルパス E2E | complete (Track A 実機オペ + smoke / 発見バグの回収は 7.6 へ持ち越し) | - | 7 | [plan](../plans/completed/phase-7.5-production-provisioning.plan.md) / [report](../reports/phase-7.5-production-provisioning-report.md) |
| 7.6 | 手動 QA + バグ回収 + E2E 強化 | 本番環境での網羅的な手動探索テスト + 検出したバグ全件 hotfix + 再発防止のための E2E 拡充 | complete | - | 7.5 | [plan](../plans/completed/phase-7.6-manual-qa-bug-recovery.plan.md) / [report](../reports/phase-7.6-manual-qa-bug-recovery-report.md) / [review](../reviews/phase-7.6-partial-implementation-review.md) |
| 7.7 | UX 基盤改善 | 注釈リサイズ + 色変更 UI + ズーム/パン/fit-to-viewport + ショートカット完結 + チートシート Modal（4 サブプラン） | complete | - | 7.6 | [prd](./phase-7.7-ux-foundation.prd.md) / sub: [7.7-1](../plans/completed/phase-7.7-1-annotation-resize.plan.md) ・ [7.7-2](../plans/completed/phase-7.7-2-color-palette.plan.md) ・ [7.7-3](../plans/completed/phase-7.7-3-zoom-pan-fit.plan.md) ・ [7.7-4](../plans/completed/phase-7.7-4-shortcut-cheatsheet.plan.md) |
| 7.8 | 次手予測 UX | Auto-next 次手予測（矢印→テキスト / 矩形→矢印）+ フォントサイズ UI + dogfood/Help 準備（4 サブプラン、Smart snap は 7.8-4 として stash 化し見送り） | complete | - | 7.7 | [prd](./phase-7.8-predictive-ux.prd.md) / sub: [7.8-1](../plans/completed/phase-7.8-1-auto-next-arrow-text.plan.md) ・ [7.8-2](../plans/completed/phase-7.8-2-auto-next-rect-arrow.plan.md) ・ [7.8-3](../plans/completed/phase-7.8-3-font-size-ui.plan.md) ・ [7.8-5](../plans/completed/phase-7.8-5-dogfood-help.plan.md) |
| 8 | 統合レビュー（観察のみ） | リポジトリ全体の SSOT / モダン性 / React ベストプラクティス / Hono ベストプラクティス / その場しのぎ実装 / 型キャスト / 拡張性 / テスト網羅 / a11y / bundle・perf / エラー envelope 一貫性 / PRP 整理状況 / security の 13 観点横断レビュー。実コードの修正は Phase 8.x で別ブランチ・別 PR に切り出す | complete | 8.x: 37 finding 全件解消 (PR #15 merge, bundle gz 283→85KB) | 7.8 | [prd](./phase-8-integration-review.prd.md) / [plan](../plans/completed/phase-8-integration-review.plan.md) / [report](../reports/phase-8-integration-review-report.md) / [8.x plan](../plans/completed/phase-8-x-fixes.plan.md) / [8.x report](../reports/phase-8-x-fixes-report.md) / 14 reviews in `reviews/phase-8-*-review.md` |
| 9 | (廃止) dogfood & 計測 | **Phase 10 に内包**（process 軽量化方針、公開リリース + Analytics 観察に置換）。当初想定の「2 週間 dogfood + closed beta」は廃止 | superseded | - | 8 | [phase-10-direction.prd.md](./phase-10-direction.prd.md) |
| 10 | 公開リリース + i18n + ブランディング (Web 単独) | 公開リリース最低限整備 (TOS/プライバシー/通報窓口) + i18n 軽量実装 (日英) + アプリ名確定 + リネーム + 公開準備 (ドメイン非依存) + タッチデバイス操作最適化 + ランディング条件付き拡張 + AdSense slot 予約 + ドメイン取得 + 本番デプロイ + 1 ヶ月 Analytics 観察。CHANGELOG は 10.F (タグ作成時) まで保留。**Mac spike は Q9 で Phase 11+ 候補へ後回し**。**2026-05-05 再分割: 旧 10.D (アプリ名 + ドメイン取得 + リネーム実装) を 10.D = リネーム + 公開準備 (ドメイン非依存) と 10.F = ドメイン取得 + DNS + Pages 本番 + v1.0.0 タグ に切り分け、ドメイン取得待ちで 10.D が止まらないようにした**。**2026-05-06 追加: 10.H = ランディング条件付き拡張 + AdSense slot 予約 を 10.F の前段に新設 (公開直前の第一印象 + 後付け CLS 悪化回避を先払い)**。**2026-05-09 追加: 10.I = タッチデバイス操作最適化を 10.H の前段に新設 (実機検証で「テキスト以外のアノテーションが描けない」破綻を確認、v1.0.0 必須 blocker として格上げ)。Phase 7.7/7.8 の Won't「タッチ最適化はしない」を本 Phase で方針転換**。**2026-05-09 追加: 10.J = Touch UX Standards Compliance を 10.I の後段 / 10.H の前段に新設 (10.I で機能パリティは達成したが実機 UX 標準未達と判明、Konva paired binding + 長押しコンテキストメニュー + 実機 QA Must 化で本物の touch UX 達成を担う)** | in-progress (10.B: TTL+法務 draft+通報窓口+OGP 完了、CHANGELOG ロールバック / 10.D: pitamark.app 確定 + リネーム実装 (workspace `@pitamark/*` / 可視 UI / Export PNG / localStorage migration / OGP+apple-touch-icon / SEO 雛形 / 法務 ja rename + en draft / ADR-0005 accepted) 完了 / 10.E: 自作 dict + LangToggle + 310 unit + 4 e2e で完了、英訳 draft はレビュー待ち / 10.I: complete (PR #21 merge 済、機能パリティ達成、UX 達成は 10.J へ) / 10.J: PRD draft + ADR-0007 起票完了、Plan + 実装 pending / 10.H: PRD draft + plan draft 完了 (12 task umbrella plan)、実装 pending (10.J 完了後に着手) / 10.F: ドメイン取得 + 本番デプロイ + Cloudflare リソース recreate (Worker / R2 / CORS) + CHANGELOG 起票 + v1.0.0 タグ pending / 10.G pending) | 10.B/D/E 並走可、10.I 完了済、10.J は単独 (10.I 完了後 / 10.H 前)、10.H は 10.J 完了後 (10.F 前) | 8 | [phase-10-direction.prd.md](./phase-10-direction.prd.md) / [phase-10-i prd](./phase-10-i-touch-optimization.prd.md) / [phase-10-j prd](./phase-10-j-touch-ux-standards.prd.md) / [phase-10-h prd](./phase-10-h-landing-and-ad-slots.prd.md) / [ADR-0003 (on hold)](../../../docs/adr/ADR-0003-web-vs-desktop-direction.md) / [ADR-0004 (accepted)](../../../docs/adr/ADR-0004-i18n-strategy.md) / [ADR-0005 (accepted)](../../../docs/adr/ADR-0005-app-naming-and-domain.md) / [ADR-0006 (accepted)](../../../docs/adr/ADR-0006-pointer-events-unification.md) / [ADR-0007 (proposed)](../../../docs/adr/ADR-0007-touch-ux-standards.md) / [phase-10-b plan](../plans/completed/phase-10-b-launch-prep.plan.md) / [phase-10-d plan](../plans/completed/phase-10-d-rename-launch-prep.plan.md) / [phase-10-e plan](../plans/completed/phase-10-e-i18n.plan.md) |
| 11 | 次フェーズ確定 (収益化 / 品質 / Mac 再検討) | Phase 10.G 観察結果で C スタンス維持 / B 修正 (撤退条件: 半年で月千円なし) を判断、次の実装方向 (better-auth + 永続ルーム / Mac spike 再開 / SEO 深掘り 等) を決定 | pending | - | 10 | TBD (Phase 10.G 完了後に起票) |

### Phase Details

**Phase 0: 技術スパイク（〜2日）**
- Goal: Must要件を満たす最小コード一式の動作確認 + 残る技術選定の確定
- Scope:
  - Konva最小実装（画像表示 + 矩形描画 + ドラッグ移動）
  - y-durableobjects 公式サンプルの localhost 動作確認
  - shadcn/ui の Vite 統合の摩擦確認（採用 or Tailwindのみで進めるか判断）
- Success signal: 上記3つが `apps/web` プロトタイプ内で動作し、shadcn採用可否が確定する

**Phase 1: モノレポ初期化（〜5日）**
- Goal: 開発基盤の確定、CI green
- Scope: turborepo + apps/web + apps/api + packages/shared、Biome、Vitest、Playwrightセットアップ、GitHub Actions
- Success signal: `pnpm test` がCIで通り、空のVite画面とHonoエンドポイントが動く

**Phase 2: 画像アップロード基盤（〜5日、Phase 3と並行）**
- Goal: 画像をR2に保存し、ルームを発行できる
- Scope: R2バインディング、Workers `/upload` & `/rooms`、NanoIDルームID、サイズ制限（10MB）、形式バリデーション
- Success signal: 画像をPOSTしてR2 URL + roomId が返り、`/rooms/:id` で画像メタが取れる

**Phase 2.5: API モダン化（〜2日、Phase 3と並行可だが先行推奨）**
- Goal: クライアント↔サーバ間の型安全契約を確立し、Phase 3 以降の Web 実装で `hc` を使えるようにする
- Scope:
  - `@hono/zod-openapi` への移行（既存3ルート: `POST /rooms` / `GET /rooms/:id` / `GET /rooms/:id/image`）
  - `@scalar/hono-api-reference` で `/api/docs` を mount（dev/staging のみ）
  - `apps/api/src/index.ts` から `AppType` を export
  - `apps/web` 側に `hc<AppType>` ベースの API クライアント配線（`packages/shared` か `apps/web/src/lib`）
- Success signal:
  - 既存 `apps/api/src/__tests__/` が無改変で緑
  - `/api/docs` で 3ルートの仕様が表示される
  - `apps/web` から `api.rooms[':id'].$get()` 呼び出しで `Room` 型が完全に推論される
- 参照: [ADR-0002](../../../docs/adr/ADR-0002-hono-zod-openapi-tanstack-stack.md)

**Phase 3: キャンバス & 注釈ツール（〜10日、Phase 2と並行）**
- Goal: ローカルで4種の注釈を編集できる
- Scope: Canvasコンポーネント、矩形/矢印/テキスト/ハイライト、選択/移動/削除、Undo/Redo、ローカル状態のみ
- Success signal: 1ユーザーで全注釈ツールがバグなく動作、UX計測で各操作3クリック以内

**Phase 4: リアルタイム同期（〜10日）**
- Goal: 複数クライアントで注釈が同期し、カーソル共有される
- Scope: Durable Object + WebSocket Hibernation、y-durableobjects 統合、Awareness（カーソル/色）、再接続
- Success signal: 2タブ間で注釈追加が200ms以内に反映、片方を5分放置→DO Hibernation→復帰可能

**Phase 5: パスワード保護 + TTL（〜5日、Phase 6と並行）**
- Goal: ルームに任意パスワード設定できる、7日でTTL自動破棄
- Scope: Argon2ハッシュ、ルーム作成時オプション、入室画面、DO Alarms による TTL
- Success signal: パスワード付きルームに正答以外で入れない、7日経過後アクセスでルーム消滅確認

**Phase 6: エクスポート + UI仕上げ（〜7日、Phase 5と並行）**
- Goal: 公開可能なUI品質
- Scope: PNGエクスポート、日本語UI、レスポンシブ（タブレット閲覧）、shadcn適用、トップページ
- Success signal: スマホで閲覧可能、PNG出力で全注釈が損なわれない、UIが「最小限を最小限に」を体現

**Phase 7: 公開準備（〜5日）**
- Goal: パブリック公開できる状態
- Scope: Turnstile、レート制限、Cloudflare Analytics、README/CONTRIBUTING/LICENSE、Cloudflare Pagesデプロイ
- Success signal: 本番URLでスパム経路が塞がれており、READMEで個人開発として恥ずかしくない説明

**Phase 7.5: 本番プロビジョニング + 観測 + E2E 拡充（〜5日）**
- Goal: Phase 8 dogfood を開始するための物理的・運用的前提を揃える
- 背景: Phase 7 で「コード上は公開可能」になったが、本番 Cloudflare リソースは未確定 / KPI 未定義 / E2E は smoke 1 件のみ。dogfood を「感想で終わる 2 週間」にしないために、計測設計と回帰検知をここで先回り。
- Scope:
  - **A. Cloudflare 本番設定（必須）**
    - R2 bucket / Durable Object migration / KV namespace (`IMAGE_BLOCKLIST`) / Rate Limiting binding ×3 (`RL_CREATE_ROOM_*`) を本番作成し `wrangler.toml` の placeholder（`REPLACE_WITH_PRODUCTION_*`）を確定値に差し替え
    - Turnstile site key / secret を発行、`apps/web` の `.env.production` と `wrangler secret put TURNSTILE_SECRET` に注入
    - Cloudflare Web Analytics token 発行 → CI で `VITE_CF_ANALYTICS_TOKEN` 注入
    - Cloudflare Pages プロジェクト作成、`apps/web/dist` をデプロイ、`_headers` の CSP が反映されているか実機検証
    - Workers route / カスタムドメイン or workers.dev URL 確定（Turnstile site の host 制約に影響）
    - GitHub Actions の本番 secrets を投入し、main マージで自動デプロイ可能にする（or 手動 tag 運用を確定）
    - README / CONTRIBUTING のデプロイ手順を実機オペで再検証し、`wrangler secret put` の手順をドキュメント化
  - **B. 観測 / KPI 設計（dogfood 合否を後付けにしないために必須）**
    - dogfood で見る KPI の事前定義: rooms 作成成功率 / 画像アップロード成功率 / p95 WebSocket RTT / Rate Limit ヒット率 / Turnstile fail 率 / 画像 SHA-256 重複率 / 24h 後の room 残存率
    - エラーバジェット / 撤退ライン: rooms 作成成功率 < 99% / p95 WS RTT > 500ms 等で改修着手
    - Cloudflare Web Analytics でのダッシュボード組み立て（Page views / 主要 referer / device 比率）
    - `wrangler tail` で見るログ項目を確定（`error.code` / `RL` / `turnstile` 結果）
  - **C. E2E 拡充（review LOW-3 / Phase 1 の宿題回収）**
    - クリティカルパス: 画像貼付 → 注釈 → PNG エクスポート / 共有リンク作成 → 別コンテキストで参加 → 同期反映 / パスワード付きルーム作成 → ゲート通過
    - awareness 出退室 / 再接続シナリオ
    - Turnstile / Rate Limit を test 用 site key (`1x00000000000000000000AA`) と bypass モードで E2E 経路に組み込む
    - Firefox / WebKit を chromium に追加するか判断（Phase 1 で「Phase 6 後に拡張」と明記）
    - モバイル viewport の Playwright screenshot 回帰
  - **D. レビュー残課題の刈り取り**
    - Phase 7 review の LOW-1〜4 の要否判断（LOW-1 KV placeholder は A で自動解消、LOW-2/3/4 は要否判断）
- Success signal:
  - 本番 URL で rooms 作成 → 閲覧 → 注釈 → PNG エクスポート / 共有 → 別ブラウザ参加が踏める
  - KPI ダッシュボードが「数字が読める」状態で見える（測定設計の検証は dogfood 開始時点でできる）
  - クリティカルパス E2E が緑、CI 経由で main マージごとに走る
- 非スコープ（Phase 8 で扱う）:
  - dogfood で「実際に発生した問題」への小修正
  - README の英語化 / privacy ページの追加（公開規模が固まってから判断）

**Phase 7.6: 手動 QA + バグ回収 + E2E 強化（〜5日）**
- Goal: Phase 7.5 で整えた本番環境を「ユーザー操作で踏み倒しても壊れない」状態にし、再発防止の自動回帰網を併せて整える
- 背景: Phase 7.5 の本番スモーク（`docs/.tmp/cloudflare-runbook.md` の A7-1 系）を踏み始めた時点で 3 件の不具合が即座に検出された。これは「コード/docs 完了 ≠ 動く」という乖離が現状残っていることを意味する。発見済 3 件だけでなく、本番環境で網羅的に手動テストを行えばさらに別の不具合が出る蓋然性が高い。dogfood 開始前に「全部洗い出す → 全部直す → E2E でロックする」を独立フェーズで回す。
- Scope:
  - **A. Track A 実機オペの完了確認**
    - `wrangler r2 bucket create snap-share-images` / `wrangler kv namespace create IMAGE_BLOCKLIST` / Turnstile widget 作成 / CF Web Analytics token 発行 / Pages プロジェクト + Git 連携 / `cd apps/api && pnpm wrangler deploy`
    - すでに踏んだ箇所は最新状態の確認のみで通過。未踏部分は README runbook 通りに実行
    - 本番 API `https://snap-share-api.<account>.workers.dev/health` が 200 を返すこと、本番 web `https://snap-share.pages.dev` が読み込まれることを最終確認
  - **B. 網羅的な手動 QA（探索的テスト）**
    - `docs/.tmp/cloudflare-runbook.md` の A7-1 以降を起点に、本番 URL で全ユーザー導線を踏み倒す
    - 観点: 画像 D&D / paste / クリア / 差し替え、注釈 4 種の作成 / 選択 / 移動 / 削除、Undo/Redo、共有 URL の発行 / 別ブラウザでの参加 / リアルタイム同期 / awareness、PNG エクスポート（送信側 / 受信側 / 公開ルーム / パスワード保護ルーム）、TTL、Turnstile / Rate Limit、CSP / HSTS / response headers
    - デバイス観点: デスクトップ Chrome / Safari / Firefox、iOS Safari、Android Chrome、タブレット
    - 検出したバグは GitHub issue として全件起票し、`reports/phase-7.6-*.md` に網羅表でリンク
    - 既知の入口バグ（Phase 7.5 で発見済）:
      - **既知-1. 画像エクスポート失敗（tainted canvas）** — 公開ルームの受信側で `Failed to execute 'toBlob' ... Tainted canvases may not be exported.`。原因特定済（`apps/web/src/components/canvas/ImageLayer.tsx` の `useImage(src)` に `crossOrigin='anonymous'` が無いため、本番の cross-origin 画像取得で canvas が tainted 化）。試験的に修正 → revert したコミット `2e2d533` が参考実装。preview URL では `VITE_API_URL` が空のため再現せず、本番 (`snap-share.pages.dev`, build env で `VITE_API_URL=workers.dev` 注入) でのみ顕在化する点に注意
      - **既知-2. パスワード設定 UI が画面に出ない** — Phase 5 機能のローカルでも再現する既存バグ。原因切り分け未着手
      - **既知-3. 画像クリアが効かない** — Phase 4 / 6 周辺機能のローカルでも再現する既存バグ。原因切り分け未着手
  - **C. バグ全件 hotfix**
    - B で起票した issue を全部直す。「3 件だけ」ではなく **B で発見した分は全部** が対象
    - 各 hotfix は「再現 spec → 修正 → 緑」の TDD でクローズ
    - severity が低いものは Phase 8 follow-up に回しても良いが、その場合は明示的に `phase-7.6-*.md` に「Phase 8 へ送る理由」を記録
  - **D. E2E 強化（再発防止）**
    - C で直したバグごとに対応する E2E spec を `apps/web/e2e/` に追加 — 「次にこのバグが入ったら CI で落ちる」状態にする
    - 重要シナリオで未カバーだったものを優先: 受信側エクスポート / パスワード設定 UI / 画像クリア / 画像差し替え / 共有 URL の cross-origin 経路
    - Firefox / WebKit プロジェクト追加の判断（Phase 7.5 で「Phase 8 dogfood 後に判断」としていたが、本番バグが実機ブラウザ依存だった場合はここで前倒し）
    - macOS / Linux 両方で snapshot が緑になる仕組みを最終調整（Phase 7.5 持ち越しの `room-mobile` Linux snapshot を含む）
  - **E. 検収ゲート**
    - 全 hotfix が main にマージされ、本番再デプロイ後に B の手動 QA を再走 → 全緑
    - 新設 E2E spec が CI Linux で緑
    - スモーク結果と E2E カバレッジ差分を `reports/phase-7.6-*.md` に貼り、Phase 8 dogfood の Go/No-Go 判断材料にする
- Success signal:
  - 本番 URL で B の手動 QA が clean run で全緑、検出バグが 0 件で 1 サイクル踏める状態
  - C で起票したバグ issue が全部 close（または明示的に Phase 8 送り）
  - D で追加した E2E spec が CI で緑、`apps/web/e2e/` のカバレッジが「7.6 で発見したバグの再発を CI で検知できる」状態
- 非スコープ（Phase 8 で扱う）:
  - dogfood 中に新規発生する不具合の小修正
  - 観測 KPI の実値レビュー（Phase 8 で初回計測）
  - パフォーマンス最適化（CLS / LCP 等の数値改善は Phase 8 で観測してから判断）

**Phase 7.7: UX 基盤改善（4 サブプラン）**
- Goal: Phase 7.6 dogfood で発覚した「業界標準の基本操作の欠落（リサイズ / 色 / ズーム / キーボード完結）」を埋め、Phase 7.8 予測 UX の土台を作る
- Scope:
  - 7.7-1: 注釈リサイズ（Konva `Transformer` + Arrow 端点ハンドル）
  - 7.7-2: 色変更 UI（5-7 色固定パレット）+ Schema 統一（`stroke`/`fill` → `color`）
  - 7.7-3: ズーム / パン / fit-to-viewport（Stage transform、Cmd+0/1、Space+drag、wheel/Shift+wheel）
  - 7.7-4: ショートカット網羅 + `?` キーで起動するチートシート Modal
- Success signal: マウスを 1 度も握らずに「画像投入 → 注釈 4 種配置 → 色変更 → リサイズ → PNG エクスポート」の golden path を完遂できる / 5000×5000 px 画像でも初期表示が viewport にフィット
- 詳細: [phase-7.7-ux-foundation.prd.md](./phase-7.7-ux-foundation.prd.md)

**Phase 7.8: 次手予測 UX（4 サブプラン、7.8-4 は見送り）**
- Goal: 業界標準を満たした Phase 7.7 の上で「画像注釈に特化した『使いたくなる』」体験へ引き上げる、半歩先回りの予測 UX を導入
- Scope:
  - 7.8-1: 矢印 → テキスト Auto-next 次手予測（矢印終端から空テキスト即時作成 + IME 起動）
  - 7.8-2: 矩形 → 矢印 Auto-next 次手予測（矩形右辺中央にヤジリ固定で矢印ツールへ自動切替）
  - 7.8-3: フォントサイズ変更 UI（`[A-][18px][A+]` + `/` shortcut）
  - 7.8-4: Smart snap — plan 作成済だが実装見送り、stash 化（複雑度に対して 7.8 のスコープ感「半歩先回り」を超えると判断）
  - 7.8-5: HelpModal「次手予測」セクション追記 + dogfood 準備
- Success signal: 「画像投入 → 矢印+テキスト 3 連発 → エクスポート」を 15 秒以内に完遂 / 次手予測が「邪魔」と感じる頻度 1 セッション 1 回未満
- 詳細: [phase-7.8-predictive-ux.prd.md](./phase-7.8-predictive-ux.prd.md)

**Phase 8: 統合レビュー（観察のみ）**
- Goal: MVP がほぼ完成した時点で、肥大化したコードベースを一度俯瞰し、Phase 9 dogfood に進む前に「Claude Code 主体で書かれたコードが、人間の実装者にとっても改修しやすいか」を文書化する
- Scope:
  - 13 観点の横断レビュー: SSOT 遵守 / モダン性（2026 ベスト寄りのライブラリ選定・API 利用）/ React ベストプラクティス（hooks 規律・状態管理パターン・`useState` vs `useRef` の使い分け・React 19 idioms / `react-konva` 連携）/ Hono ベストプラクティス（`createRoute({ middleware })` 配線・`@hono/zod-openapi` 利用・`hc<AppType>` 型安全クライアント・Workers binding 利用・middleware composition 順序）/ その場しのぎ実装の有無（TODO/FIXME/`@ts-ignore` 残置・回避策の固定化）/ 型の健全性（`any`/`unknown`/`as` キャストの不必要な使用）/ 将来拡張性（annotation/collab/API 追加の容易性）/ テスト網羅（unit/integration/e2e、golden path カバレッジ）/ a11y（キーボード操作・ARIA・reduced-motion）/ bundle・perf（web のサイズ予算・Konva/Yjs の遅延ロード余地）/ ログ・エラー envelope の一貫性（`apps/api/src/lib/error.ts` 体系遵守）/ `.claude/PRPs/` 配下の整理状況（命名・cleanup・review 漏れ）/ security（CSP・入力検証・R2/Worker 周辺の権限境界）
  - 観点ごとの review レポート（`.claude/PRPs/reviews/phase-8-{観点}.md`）+ 統合 report（`.claude/PRPs/reports/phase-8-integration-review-report.md`）の生成
- Success signal: CRITICAL / HIGH / MEDIUM / LOW すべて 0 件まで観察文書化されている（= 修正対象 issue が一意に特定でき、Phase 8.x で着手できる状態）
- 非スコープ:
  - 実コードの修正 — Phase 8.x で別ブランチ・別 PR に切り出す（memory: 1 Phase = 1 ブランチ = 1 PR）
  - dogfood 実走 — Phase 9 で扱う

**Phase 9: dogfood & 計測（〜2週間）**
- Goal: 仮説の一次検証
- Scope: オーナー自身の業務利用、コア指標の集計、必要な小修正
- Success signal: オーナーが「日常的に使える」と判断、月3回利用が達成

### Parallelism Notes

- **Phase 2 と 3 は並行可**: 画像アップロード（API側）と キャンバス（フロント側）は独立
- **Phase 2.5 は Phase 3 着手前の先行推奨**: Phase 2.5 が ~2日で済む上、Phase 3 のフロント実装が `hc` 型推論を最初から使える方が手戻りがない
- **Phase 5 と 6 は並行可**: バックエンド（パスワード/TTL）とUI仕上げは独立
- **Phase 7.5 内の A / B / C は並行可**: A（CF プロビジョニング）と C（E2E 拡充）は実装担当が分かれるため独立、B（KPI 設計）はドキュメント作業で並走可能。ただし「dogfood 開始」のゲートは A と B が揃うこと（C は「追従できていれば良い」位置づけ）
- 個人開発・週15h想定だが、並行可能枠を活用すれば実質ピッチを上げられる

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 永続化戦略 | TTL（暫定7日） | 永続保存 / 24h | $30/月予算とCloud費用削減を優先、ニーズ顕在化後に有料機能化 |
| 認証 | MVPでは無し（パスワード保護のみ） | better-auth導入 | 「登録不要」が差別化、認証は Could |
| 同期方式 | Yjs + Durable Objects (Hibernation) | y-webrtc / Liveblocks / Hocuspocus | 個人開発で課金がidle時ゼロ、技術アピール狙い、CFスタック整合 |
| 画像ストレージ | Cloudflare R2 | S3 / Workers KV | エグレス無料、10GB無料、CFスタック整合 |
| 言語ファースト | 日本語 | 英語ファースト | プライマリユーザー要件、競合との差別化 |
| Canvas SDK | Konva（自前UI） | tldraw / Excalidraw / Fabric | オーナー経験あり、~80KB gz、Shottr級「軽量感」を実現するためUIを完全自前制御 |
| ライセンス | **MIT 確定（Phase 7）** | Apache 2.0 / BUSL | 個人 OSS、依存ライブラリ（hono / yjs / konva / shadcn 全部 MIT or Apache 2.0）と互換、`LICENSE` をリポジトリ直下に追加 |
| UIコンポーネント | **shadcn/ui 採用**（Tailwind v4 + 自前所有モデル） | 自前UIコンポーネント / Material UI / Chakra | Phase 0 スパイクで Vite + Tailwind v4 + Radix の組合せが動作確認済、コードを所有できる shadcn モデルが「最小限を最小限に」に整合 |
| React バージョン | **React 19 + react-konva 19** | React 18 LTS | Phase 0 で react-konva 18 が npm 上に LTS 提供されておらず、19 系が事実上の最新唯一の選択肢 |
| Konva バンドル | gz 152.7 KB（Phase 0 実測） | — | PRD 当初想定 ~80KB は Konva 単体の話。React + react-konva + use-image 含めて 150KB 前後。Phase 6 で `dynamic import` によるコード分割を必須タスク化 |
| `packages/shared` のビルド | **`main: src/index.ts` 直参照（ビルド省略）** | tsup / esbuild で d.ts + js 出力 | Vite/Vitest はソース直参照で動作、ビルドステップ不要で KISS。型は `tsc --noEmit` でチェック |
| `apps/web` の TypeScript 構成 | **単一 `tsconfig.json` + `tsc --noEmit`** | composite + project references で `tsc -b` | composite が `.d.ts`/`.js` を src/ に emit しビルド成果物が散乱したため Phase 1 で単一 tsconfig 化。Phase 6 で shadcn 拡張時に再分割を検討 |
| Biome バージョン / ルール | **2.4.13、`useConst` のみ（noVar 削除済）、`noConsole: warn`** | ESLint + Prettier | biome 2.x で `noVar` は廃止（`useConst` が同等以上）。`organizeImports` は `assist` 経由 |
| Playwright ブラウザ | **chromium のみ（Phase 1）** | webkit / firefox 同時 | Phase 1 の E2E は smoke 1 件のみ。Phase 6 UI 仕上げ後に拡張 |
| 共有依存のバージョン管理 | **pnpm catalog 採用**（`pnpm-workspace.yaml` の `catalog:` セクション） | 各 workspace で個別記述 / npm overrides | `typescript` は 4 workspace 共有 / `vitest` は 3 workspace / `zod` は Phase 2/4/5 で広がる予定。1 行更新で全 workspace に伝播 |
| バリデーションライブラリ | **Zod v4（`^4.4`）** | Zod v3 / Yup / Valibot | Phase 1 時点 latest 4.4.1。parse 7-14× 高速化、bundle ~50% 削減。`RoomSchema` レベルの API は v3/v4 共通のため移行コスト無し |
| SSOT 戦略 | **`packages/shared` は Zod スキーマ駆動**。型は `z.infer<typeof RoomSchema>` で導出、API 境界では `RoomSchema.parse` で runtime 検証 | 素の TypeScript type のみ / 型と検証を二重定義 | `.claude/rules/typescript/coding-style.md` 推奨、Phase 2 の `POST /rooms` body validation・Phase 5 のパスワード validation・Phase 4 の Yjs ペイロード境界検証を見越して Phase 1 で確立。Hono との統合は `@hono/zod-validator` 経由（Phase 2 で導入予定） |
| スパム対策階層（Phase 7） | **Workers Rate Limiting + Cloudflare Turnstile + 画像 SHA-256 ブラックリスト の三層** | IP-only RL のみ / WAF / 認証必須化 | 各層が独立に fail / disable 可能、運用負荷最小、Workers binding で実装簡素 |
| アナリティクス（Phase 7） | **Cloudflare Web Analytics（cookieless）** | Plausible / GA4 / Umami | CF スタック整合 + cookie 同意不要 + 無料、ビルド時に `data-cf-beacon` token 注入 |
| ルート middleware 配線（Phase 7） | **`createRoute({ middleware })` フィールドで宣言** | `OpenAPIHono.use()` を chain | `.use()` が chained 型推論を `any` に潰し `hc<AppType>` クライアントの型情報が壊れる。Plan 段階のリスク予測通り |
| 本番デプロイ運用（Phase 7.5） | **手動 `wrangler deploy` (API) + Pages Git 連携 (Web)** | `main` push の auto-deploy via GitHub Actions | 個人開発で main = production の関係が緊密。dogfood 中に「壊れたコードを押し戻したい」場面で手動が早い。GitHub Actions に `CLOUDFLARE_API_TOKEN` を入れる追加リスクも避ける。Web は静的なので Pages Git 連携で十分 |
| `apps/web/.env.production` の取り扱い（Phase 7.5） | **commit せず Pages build env のみで管理** | リポジトリにコミットして履歴で追跡 | site key / analytics token は public bundle に焼かれるので秘匿性は低いが、本番 URL を git 履歴に残す副作用を避ける。`.env.example` にエントリは残し、本番値は Pages settings に投入する |
| E2E プロジェクト構成（Phase 7.5） | **chromium + mobile-chrome（Pixel 5 emulation）** | Firefox / WebKit を同時追加 | Phase 7.5 の主目的は本番プロビジョニングと観測設計。webServer multi-process 化と新 spec 4 件追加と同時に WebKit を入れると flake リスクが上がる。Firefox / WebKit は Phase 8 dogfood 後に判断 |
| 観測手段（Phase 7.5） | **Cloudflare Web Analytics + `wrangler tail` のみ** | Sentry / Datadog / Workers Logpush | 月額 $0〜$30 制約と「最小限を最小限に」の方針。dogfood 規模での十分性を docs/observability.md で言語化、必要が顕在化したら Phase 8 follow-up で再評価 |
| 収益化スタンス（Phase 10） | **C（本気の事業化）を当面維持** | A（趣味・OSS のみ）/ B（インフラ相殺だけ） | オーナー発言「目標ないと今後のやる気がね」。撤退条件は Phase 11 PRD で明文化（"半年で月千円なし → B 修正" 等の数字基準） |
| ランニングコスト現実（Phase 10） | **月 $5 以下が実体**（PRD 当初 $30 想定の 17%） | $30 上限を維持し process を厚く積む | Cloudflare Workers/R2/Pages free tier 内、DO も dogfood 規模で $0、カスタムドメインのみ年 2-3k 円。コスト現実に process 軽量化を整合させる |
| dogfood の取り扱い（Phase 10） | **「2 週間 dogfood + closed beta」は廃止**、公開リリース + Analytics 観察 1 ヶ月に置換 | 純 dogfood 維持 / closed beta 必須化 | コスト $5/月で重い process は釣り合わない、公開直行の方が判断材料早い。Phase 9 を superseded、Phase 10 に内包 |
| TTL 仕様（Phase 10） | **デフォルト 24h / max 7d / フリーミアムで無制限** | 現行 hardcoded 7d 維持 / オーナー指定一律 | オーナー指示。フリーミアム伏線、`POST /rooms` body の `ttlMs` optional 化で実装、Phase 10.B でコード変更 |
| CHANGELOG 運用開始（Phase 10） | **Keep a Changelog 形式 + semver タグ運用** | 開始しない / 別形式 (Conventional Changelog 自動生成等) | オーナー指示。手動運用で「人間が読む差分」を優先、Phase 0〜10 milestone を遡及記録 |
| 通報窓口（Phase 10） | **当面 GitHub Issue label `report-abuse` or 個人メアド**、将来 Google Forms 等 | 即フォーム化 / 不要論 | 公開初期は spam リスク低、シンプル運用を優先。公開拡大時に再判断 |
| 形態方針（Phase 10、初版） | ~~Phase 10.C で Tauri Mac spike 1-2 週間 → ADR-0003 で確定~~ → **Q9 で Web 単独確定、Mac spike は Phase 11+ 候補へ後回し** ([ADR-0003 on hold](../../../docs/adr/ADR-0003-web-vs-desktop-direction.md)) | spike 必須 / 即 Mac 主軸 / 永久 Web のみ | オーナー判断 (2026-05-05): 「Mac はやっぱ後回し、一旦全部 Web で、製品化は確実に Web が先」。Phase 10 集中度確保 + 公開後の数字で再判断 |
| i18n 戦略（Phase 10） | **Phase 10.E で軽量自作 dict + 日英 2 言語を実装** ([ADR-0004 accepted](../../../docs/adr/ADR-0004-i18n-strategy.md))、3 言語以上で i18next 移行 | 即 i18next / 即 lingui / やらない / Phase 11 送り | snap-share 規模 (推定 100-200 キー) で OSS 依存追加の overkill 回避、段階拡張可能。Q9 で Web 単独確定し独立実行可になった |
| 撤退条件 (Phase 10) | **半年で月 1000 円なし → B (相殺) 修正検討**、Phase 11 起票時 (Phase 10.G 完了後) に判断 | 1 年で月 5 千円 / Phase 11 で総合判断のみ / 設定なし | オーナー指示 (Q8)。タイトだが基準として明確、無限延長を回避 |
| アプリ名再考の手順 (Phase 10.D) | **Phase 10.D 実行時にブレスト**（事前準備しない、その場感覚優先） | 事前 Q&A / オーナー宿題 / AI 候補 generation | オーナー判断 (Q4)、判断時の鮮度 > 事前準備の効率 |
| dogfood 残置度 (Phase 10) | **「気が向いたら」残す + 詰まった瞬間メモ継続**、強制 process 廃止 | 完全 0 / 軽量 1 週間版 / 強制 2 週間維持 | オーナー判断 (Q3)。自然利用は restrict しない |
| CHANGELOG 起票タイミング (Phase 10.B 内で再判断) | **公開リリース直前 (Phase 10.F or v1.0.0 タグ作成時) まで起票しない** | Phase 10.B で先行起票 / Conventional Changelog 自動生成 / 起票しない | タグ未作成の段階で `[Unreleased]: .../compare/v0.9.0-mvp...HEAD` を貼ってもリンクが 404 になり実用性ゼロ。Decisions Log と PRD で意思決定はトレース済、git log で git の差分は読める。タグ運用が現実化した時点 (Phase 10.F) で初版起票する |
| Phase 10.B 着手範囲 (CHANGELOG ロールバック後) | **TTL 仕様変更 + 法務 draft + 通報窓口 + OGP/meta** の 4 項目を自走実装 (1 PR にまとめる) | 全 6 項目 / 各項目を別 PR | feedback memory「PRP は PRD 単位で 1 ブランチ 1 PR」。CHANGELOG は時期尚早につき 10.F へ後ろ倒し、Cloudflare Analytics 確認はオーナーダッシュボード操作必須、GitHub label 設定も shared state 変更なので人手作業として PR merge 後に分離 |
| Phase 10.D 再定義 (2026-05-05) | **旧 10.D「アプリ名 + ドメイン取得 + リネーム実装」を 10.D「リネーム + 公開準備 (ドメイン非依存)」と 10.F「ドメイン取得 + DNS + Pages 本番 + v1.0.0 タグ」に切り分け** | 旧定義のまま (バンドル維持) / 10.D を 3 つに分割 | オーナー意向「ドメイン取得を急がない」。バンドル維持だと取得待ちで 10.D の リネーム/SEO/法務英訳/ADR-0005 が全部ブロックする。ドメイン非依存タスクを先行実行可にして、ドメイン取得は 10.F で集中対応に切り分ける。詳細 sub-phase 定義は [phase-10-direction.prd.md](./phase-10-direction.prd.md) |
| Phase 10.I 新設 (2026-05-09) | **タッチデバイス操作最適化を Phase 10.H の前段に新設、Phase 10.F (v1.0.0) の必須 blocker に追加** | 10.H と並走 / 7.9 として遡及挿入 / v1.0.0 後の高速 follow up | 実機検証 (iPhone Safari + Pixel Chrome) で「テキスト以外のアノテーション (矩形/矢印/ハイライト) が描けない」破綻を発見。原因は `apps/web/src/components/canvas/CanvasStage.tsx:488-501` で touch / pointer 系 prop が一切未配線、テキストだけ `Group draggable` で例外的に動いていた。Pointer Events 一本化 + 2-finger pinch + 44px hit area + bottom toolbar で復旧する。10.H ランディングがモバイル bottom toolbar 前提でレイアウト設計できるよう先行配置。Phase 7.7 / 7.8 の Won't「タッチ最適化はしない」は本 Phase で方針転換 (デスクトップ優先方針は維持、adaptive sizing で両立)。詳細は [phase-10-i-touch-optimization.prd.md](./phase-10-i-touch-optimization.prd.md) |
| Phase 10.J 新設 (2026-05-09) | **Touch UX Standards Compliance を Phase 10.I の後段 / Phase 10.H の前段に新設、Phase 10.F (v1.0.0) の必須 blocker に追加** | 10.I-5 として sub-phase 内で追加 / Phase 10.K として後送 / Phase 11+ に持ち越し | Phase 10.I (PR #21 merge 済) は機能パリティ (描画 / 移動 / リサイズ / pinch) を達成したが、実機 (iPhone Safari + Android Chrome) で touch UX 業界標準 (Keynote / Slides / Figma / Excalidraw / tldraw) に達していないことが 2026-05-09 のユーザー実機検証で判明。真の root cause: (a) Konva の `onClick` は mouse 専用、touch は `onTap` が別経路で発火する規約が全 Shape で未対応 → 実機でシングルタップ shape 選択が不可、(b) 長押しコンテキストメニュー皆無 (Phase 10.I PRD で Won't 化したが業界標準では事実上必須)、(c) E2E が `page.mouse` 経由で発火しており `dispatchEvent('touchstart')` 経路に未対応で実機保証になっていない。Phase 10.J で **paired binding 規約 (`onClick + onTap`) + 長押しコンテキストメニュー (500ms / 6px slop) + Transformer coarse anchor 20px + dispatchEvent E2E 経路 + 実機 QA Must 化** を導入し、本物の touch UX を達成。Phase 10.I PRD の Won't「長押しメニュー」は本 Phase で方針転換 (誤発火対策は実装で工夫、Excalidraw / tldraw 業界標準値で収束)。Phase 10.I を sub-phase 拡張せず別 PRD にした理由は、Phase 10.I の Acceptance Criteria は「機能パリティ」で達成済 (PR #21 merge 済) で、UX 達成は別 PRD レベルの問題範囲のため。詳細は [phase-10-j-touch-ux-standards.prd.md](./phase-10-j-touch-ux-standards.prd.md) / [ADR-0007](../../../docs/adr/ADR-0007-touch-ux-standards.md) |

---

## Research Summary

### Market Context

- 「画像注釈 × URL共有 × リアルタイム共同編集」スポットには既に5社（[AnnotateWeb](https://annotateweb.com/), [Collabshot](https://www.collabshot.com/), [Markup Hero](https://markuphero.com/), [ScreenClip](https://screenclip.com/), [Webvizio Free](https://webvizio.com/free-image-annotation-tool/)）存在
- いずれも英語UI / 日本語サポート薄 / OSSなし
- リッチ系（[Markup.io](https://www.markup.io/) $79/月、[Pastel](https://www.commentblocks.com/) $35/月、[BugHerd](https://bugherd.com/)等）はB2Bデザインフィードバック向け、価格帯が個人ユーザーに合わない
- 差別化軸: **日本語ファースト × Shottr級UX × OSS公開 × Yjsベースの技術アピール**

### Technical Context

- **Yjs エコシステム成熟**: 週900k DL、[Excalidraw / Proton Docs / Nextcloud](https://docs.yjs.dev/) で実運用
- **CF Workers + Yjs**: [`y-durableobjects`](https://github.com/napolab/y-durableobjects) と [`yjs-cf-ws-provider`](https://github.com/TimoWilhelm/yjs-cf-ws-provider) の2実装が公開済み、WebSocket Hibernation 対応
- **CF Durable Objects 2026 アップデート**: `web_socket_auto_reply_to_close` フラグがデフォルト有効化（compat date 2026-04-07以降）、CLOSING状態が高速化
- **R2 コスト**: 無料枠 10GB + エグレス完全無料 → 個人開発の理想形
- **Canvas SDK選定**: Konvaに確定（~80KB gz、オーナー経験あり、UIを完全自前で制御することで「軽量感」を担保）。tldraw（~300KB+ gz）は機能リッチだが本プロダクトのMVPには過剰
- **コスト試算**: MVP想定（〜100 active users）で月額 **$0**、$30予算で数千ユーザーまで余裕

---

*Generated: 2026-04-30*
*Status: DRAFT - needs validation*
