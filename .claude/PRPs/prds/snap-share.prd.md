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

- [ ] パスワード保護の実装位置: ルーム作成時オプション or 全ルーム必須
- [ ] ルームTTL: 24時間 / 7日 / オーナー指定の妥当値
- [ ] PNG エクスポート時の元画像解像度保持の方針
- [ ] スパム/悪用対策: Cloudflare Turnstile / レート制限 / SHA-256 ハッシュブラックリストの優先度
- [ ] アナリティクス選定: Cloudflare Web Analytics（無料・cookieless）で十分か

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
| 3 | キャンバス & 注釈ツール | Konva実装 + 4種注釈 + Undo/Redo | in-progress | with 2.5 | 1 | [phase-3-canvas-annotation-tools.plan.md](../plans/phase-3-canvas-annotation-tools.plan.md) |
| 4 | リアルタイム同期 | Durable Object WS + y-durableobjects 統合 + Awareness | pending | - | 2, 3 | - |
| 5 | パスワード保護 + TTL | ルーム作成時パスワード + Argon2 + DO TTL | pending | with 6 | 4 | - |
| 6 | エクスポート + UI仕上げ | PNG export + 日本語UI + レスポンシブ + shadcn適用 | pending | with 5 | 4 | - |
| 7 | 公開準備 | スパム対策 + Cloudflare Analytics + READMEドキュメント | pending | - | 5, 6 | - |
| 8 | dogfood & 計測 | オーナー自身が2週間業務利用、メトリクス改善 | pending | - | 7 | - |

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

**Phase 8: dogfood & 計測（〜2週間）**
- Goal: 仮説の一次検証
- Scope: オーナー自身の業務利用、コア指標の集計、必要な小修正
- Success signal: オーナーが「日常的に使える」と判断、月3回利用が達成

### Parallelism Notes

- **Phase 2 と 3 は並行可**: 画像アップロード（API側）と キャンバス（フロント側）は独立
- **Phase 2.5 は Phase 3 着手前の先行推奨**: Phase 2.5 が ~2日で済む上、Phase 3 のフロント実装が `hc` 型推論を最初から使える方が手戻りがない
- **Phase 5 と 6 は並行可**: バックエンド（パスワード/TTL）とUI仕上げは独立
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
| ライセンス | 未決（OSS方針） | MIT / Apache 2.0 / BUSL | 公開時に決定、デフォルトMIT想定 |
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
