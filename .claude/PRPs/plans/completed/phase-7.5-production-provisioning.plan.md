# Plan: Phase 7.5 — 本番プロビジョニング + 観測 + E2E 拡充

## Summary

Phase 7 で「コード上は公開可能」になった snap-share に対して、Phase 8 dogfood を**意味のある計測フェーズ**にするための実機・運用・回帰検知の前提を揃える。具体的には (A) Cloudflare 本番リソース（R2 bucket / Durable Object migration / KV namespace / Rate Limit binding ×3 / Turnstile widget / Web Analytics / Pages project / Workers route）を確定し `apps/api/wrangler.toml` の `REPLACE_WITH_PRODUCTION_*` placeholder と `.env.production` を本番値で固定、(B) dogfood の合否判定を後付けにしないために観測軸（KPI / SLO / エラーバジェット）と Cloudflare Web Analytics ダッシュボード設計を `docs/observability.md` に書き下ろし、(C) Phase 7 で smoke 6 件のみだった Playwright E2E を「画像貼付 → 注釈 → PNG export」「ルーム共有 → 別コンテキスト同期」「パスワードゲート通過」「awareness 出入り」「モバイル viewport」のクリティカルパスまで拡張、(D) Phase 7 review の LOW-1〜4 のうち実機オペで自動解消されるもの（LOW-1 KV placeholder）と先送り判断するもの（LOW-2/3/4）を整理する。

## User Story

As a snap-share の オーナー兼 Phase 8 dogfood の唯一の被験者,
I want 本番 Cloudflare 上で API/Web が同一ドメイン哲学で可動し、計測 KPI が dogfood 開始**前**に「数字として読める」状態で見え、CI 経由でクリティカルパスの回帰が main マージごとに検知され、Phase 7 のレビュー残課題（KV placeholder / token JSON エスケープ / Turnstile poll 上限 / WS token in query）の処遇がドキュメントされている状態にしたい。それも、コードを書き換える分量を最小限に抑え、本フェーズの中心は「実機オペレーション」と「観測設計」と「E2E 拡充」の 3 本柱に絞りたい,
So that Phase 8 を「2 週間使って感想を述べる期間」ではなく「事前定義した KPI が実数として観測されたか / SLO を割ったか / 撤退ラインを越えたか」を判定できる本来の dogfood として走らせられる。

## Problem → Solution

### Current（Phase 7 完了時点）

- **本番リソース未確定**: `apps/api/wrangler.toml:60` は `id = "REPLACE_WITH_PRODUCTION_KV_ID"` のまま。`createImageBlocklistService` は KV `get` 失敗時に fail-open するため、誤デプロイすると「ブラックリスト機能はあるがゼロ件 KV と等価」というサイレント無効状態に落ちる（Phase 7 review LOW-1）。R2 bucket / DO migration / RL ×3 namespace / Turnstile widget も「コード側は本番モードで動くが Cloudflare 上に対応リソースが存在しない」状態。
- **本番デプロイ手順が未検証**: README.md:174 以降の Production deploy 章は `wrangler r2 bucket create` / `wrangler kv namespace create` / `wrangler secret put` × 2 の順序で記述しているが、誰も実機で踏み抜いていない。Cloudflare Pages の build root（`apps/web` か `(空)` か）と `VITE_*` env 変数の組み合わせが本当に動くか未確認。
- **本番 secret / 環境変数が未投入**: `wrangler secret put ROOM_TOKEN_SECRET` と `wrangler secret put TURNSTILE_SECRET_KEY` は dev のみ。`apps/web/.env.production` は空ファイル。`VITE_CF_ANALYTICS_TOKEN` も dev では空に設定されており、本番で beacon が飛ばない。
- **GitHub Actions に本番 secret 配線なし**: `.github/workflows/ci.yml` は lint / typecheck / test / build / E2E のみ。main マージで auto deploy する経路は無い。手動 `wrangler deploy` 運用も「README に手順は書いたが誰も触っていない」状態。
- **dogfood で見る KPI が未定義**: PRD の Success Metrics（rooms 作成成功率 / WS RTT / 月額コスト / LCP）はあるが、dogfood 期間中の SLO / エラーバジェット / 撤退ラインに落ちていない。`wrangler tail` で「何を見るか」も決まっていない。Cloudflare Web Analytics のダッシュボードはデフォルト画面のみで、主要 referer / device 比率 / 離脱ポイントは可視化されていない。
- **E2E は smoke 6 件のみ**: `apps/web/e2e/landing.spec.ts:1-58` の 6 テストは「ランディング描画 / ツールバー存在 / 無画像状態の disabled / モバイル h1 hidden」のみ。`POST /rooms` を実行するパスは `test.skip` でスキップ済（`landing.spec.ts:54-58`）。同期 / Turnstile / Rate Limit / パスワードゲート / awareness は E2E カバレッジ ZERO。Phase 1 の plan に「Phase 6 後に Firefox / WebKit 拡張」「webServer に API を含める」と書いた宿題も Phase 7 まで未着手。
- **Phase 7 review LOW 残課題が宙吊り**: LOW-1（KV placeholder）/ LOW-2（`VITE_CF_ANALYTICS_TOKEN` の JS 文字列脱出可能性）/ LOW-3（Turnstile widget の 100ms × 50 attempts 上限）/ LOW-4（WS upgrade の token query string が `wrangler tail` ログに現れる）について Phase 7 report と review で「Phase 8 follow-up でも可」と判断保留した状態。

### Desired（Phase 7.5 完了時点）

- **本番リソース実在**: Cloudflare アカウントに `snap-share-images`（R2）/ `IMAGE_BLOCKLIST`（KV）/ `RL_CREATE_ROOM` `RL_AUTH` `RL_SYNC`（Workers Rate Limit binding）/ `SnapShareYDO`（Durable Object class、production migration v2 適用済）/ Turnstile widget / Cloudflare Web Analytics サイトの 7 リソースが alive。`apps/api/wrangler.toml` の `REPLACE_WITH_PRODUCTION_KV_ID` を本番 ID に差し替え済。`apps/web/.env.production` に `VITE_API_URL` / `VITE_API_WS_URL` / `VITE_TURNSTILE_SITE_KEY` / `VITE_CF_ANALYTICS_TOKEN` / `VITE_PUBLIC_URL` 全 5 つの確定値が入る。
- **production deploy が手元から踏み切れる**: `cd apps/api && pnpm wrangler deploy` で API がデプロイされ、Cloudflare Pages の Git 連携 build が `apps/web/dist` を発行する。本番 URL（`https://snap-share.pages.dev` または確定したカスタムドメイン）で D&D → ルーム作成 → 別コンテキスト参加 → PNG export → 24h 経過後の TTL 確認（dogfood で確認）まで通る。
- **CI / 自動デプロイ判断が確定**: 「main マージで auto deploy」または「手動 `wrangler deploy` 運用 + Pages の Git 連携のみ」のどちらかを Decisions Log で確定。`.github/workflows/ci.yml` に `e2e` job が残り、追加で `deploy.yml` が増えるか「手動運用」を README に明記するか、を docs まで反映。
- **観測ドキュメント存在**: `docs/observability.md`（新規）に dogfood KPI（rooms 作成成功率 / 画像アップロード成功率 / p95 WebSocket RTT / Rate Limit ヒット率 / Turnstile fail 率 / 画像 SHA-256 重複率 / 24h 後の room 残存率）と SLO / エラーバジェット（rooms 作成成功率 < 99% で改修着手 / p95 WS RTT > 500ms で改修着手 / 月額コスト > $30 で撤退検討）と「Cloudflare Web Analytics で何を見るか」「`wrangler tail` で何を grep するか」が言語化されている。`apps/api/src/lib/logger.ts` のログ structure（`error.code` / `route` / `ip`）を grep する具体クエリ例を含む。
- **クリティカルパス E2E が緑**: `apps/web/e2e/` に最低 5 spec ファイルが存在し、CI で main マージごとに走る:
  - `landing.spec.ts`（既存、UI smoke）
  - `room-create.spec.ts`（画像貼付 → `POST /rooms` 200 → `/r/:id` 遷移 → PNG export）
  - `room-share.spec.ts`（2 ブラウザコンテキストで同一ルームを開き、片方の注釈追加が他方に 200ms 以内に反映）
  - `room-protected.spec.ts`（パスワード付きルーム作成 → 別ブラウザでゲート → 正答で入室 / 誤答で `wrong-password` トースト）
  - `room-mobile.spec.ts`（375×667 / iPhone-ish viewport で landing screenshot 回帰）
  - Turnstile dev test key (`1x00000000000000000000AA`) と `BYPASS_TURNSTILE=true` を E2E 経路に組み込み、Cloudflare の本物の siteverify を呼ばずに済ませる。
- **Playwright config 拡張**: `apps/web/playwright.config.ts:projects` を chromium のみから「chromium + mobile-chrome」に拡張（Firefox / WebKit は dogfood 後のフェーズで判断、Plan で明記して NOT 判断を確定）。`webServer` を `pnpm dev`（web のみ）から「web + api を同時起動するヘルパー」に置き換え、E2E が API なしで `POST /rooms` を踏める状態を解消。
- **Phase 7 review LOW の処遇確定**:
  - LOW-1（KV placeholder）: 本フェーズ A1 / A4 で自動解消（実 ID で上書き）。
  - LOW-2（`VITE_CF_ANALYTICS_TOKEN` の JS 文字列脱出）: `apps/web/index.html:33-44` の token 注入を `JSON.stringify(t)` 化（1 文字差分）。フォーク時の安全側にしておく。
  - LOW-3（Turnstile poll 5s 上限）: dogfood 期間中に「実環境で 5s を越えるか」を計測する案件として `docs/observability.md` の follow-up リストに記録。コード変更は本フェーズでは行わない。
  - LOW-4（WS upgrade の token query string がログに残る）: `wrangler tail` のリクエストログで実際に token が出るかを Phase 7.5 の B 検証中に目視確認、Phase 8 follow-up（`Sec-WebSocket-Protocol` 経由への切替）に積むかを `docs/observability.md` の follow-up リストに記録。本フェーズでは切り替えない。

### 受け入れ条件（Acceptance）

- 本番 URL で「画像 D&D → 共有 URL 取得 → 別ブラウザで開いて 1 枚目の注釈が見える」「PNG export で注釈が焼き込まれた画像をダウンロードできる」「パスワード付きルーム作成 → 別ブラウザでゲート画面 → 正答で入室」が通る（実機チェックリストで確認）。
- `apps/api/wrangler.toml:60` に `REPLACE_WITH_PRODUCTION_*` 文字列が grep でヒットしない（残っていれば誤デプロイ予防に失敗）。
- `apps/web/.env.production` に `VITE_API_URL` / `VITE_API_WS_URL` / `VITE_TURNSTILE_SITE_KEY` / `VITE_CF_ANALYTICS_TOKEN` / `VITE_PUBLIC_URL` 5 つが「空でない」値で揃う（commit はしない場合でも `git stash`/CI secret 経由でビルド時に入る配線が動くこと）。
- `pnpm test:e2e` が CI で 5 spec 緑（chromium + mobile-chrome の 2 プロジェクト）。
- `docs/observability.md` が存在し、KPI 表 / SLO / エラーバジェット / `wrangler tail` クエリ / CF Web Analytics のダッシュボードキャプチャ or 設定手順が含まれる。
- Phase 7 review の LOW-1 が解消、LOW-2 がコード差分で解消、LOW-3 / LOW-4 が `docs/observability.md` の follow-up セクションに記載される。
- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` がすべて緑（Phase 7 比で web 側のテスト件数が +0〜+5 程度、コード変更は最小）。

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/snap-share.prd.md`
- **PRD Phase**: Phase 7.5 — 本番プロビジョニング + 観測 + E2E 拡充
- **Depends on**: Phase 7（complete: スパム多層防御 / OSS 公開資料 / `_headers` CSP）
- **Parallel with**: なし（Phase 8 dogfood は本フェーズの A + B 完了で開始可能、C は追従できていれば良い位置づけ）
- **Estimated Files**:
  - 新規: 約 6〜8（E2E spec 4 / `docs/observability.md` 1 / `apps/web/.env.production` 1 / `apps/api/.dev.vars.example` の本番手順 README 化分は更新側へ）
  - 更新: 約 5〜7（`apps/api/wrangler.toml` / `apps/web/playwright.config.ts` / `apps/web/index.html` LOW-2 / `README.md` deploy 章 / `CONTRIBUTING.md` deploy セクション / PRD phase status / `.github/workflows/ci.yml` 任意）
- **Estimated LOC**:
  - コード差分: 約 200〜400 行（E2E spec の総量がメインで 250 行前後、`playwright.config.ts` の `webServer` multi-process 化で 30 行、`index.html` LOW-2 で 1 行）
  - ドキュメント: `docs/observability.md` 約 200〜300 行 + README/CONTRIBUTING 加筆 約 80 行
- **Confidence**: **6/10** — 「実機オペレーション」と「ドキュメント」の比重が大きく、純コーディングプランより不確実性が高い。Cloudflare ダッシュボード操作で詰まる可能性（Pages の build root / Turnstile widget の Allowed hostnames / Workers route カスタムドメインの DNS 反映待ち）と、Playwright `webServer` を multi-process 化する際の `pnpm dev` 起動シーケンス（turborepo が turbo build/dev を内部で握る）の摩擦が想定される。E2E のクリティカルパスは API 起動依存があり flaky になりやすいので retry 設計と `wrangler dev` 起動の冪等化が必要。

---

## UX Design

### Before（Phase 7 完了時点）

```
┌─────────────────────────────────────────────────────────┐
│  本番 URL: 未確定（DNS 未配線、Pages project 未作成）          │
│  apps/api/wrangler.toml: KV id = REPLACE_WITH_...        │
│  apps/web/.env.production: 空                             │
│  GitHub Actions secrets: 未登録                            │
│  observability: PRD に Success Metrics があるだけ           │
│                                                          │
│  E2E: smoke 6 件（chromium のみ、API 起動なし）              │
│  ├─ landing 描画 / toolbar 存在 / disabled state          │
│  ├─ POST /rooms 経路: test.skip                          │
│  ├─ パスワードゲート: ZERO                                  │
│  ├─ 同期 / awareness: ZERO                                │
│  └─ モバイル viewport: h1 visibility のみ                   │
│                                                          │
│  Phase 7 review LOW-1〜4: 宙吊り                            │
└─────────────────────────────────────────────────────────┘
```

### After（Phase 7.5 完了時点）

```
┌─────────────────────────────────────────────────────────┐
│  本番 URL: https://snap-share.pages.dev (or custom)      │
│  ├─ R2 / KV / RL×3 / DO / Turnstile / Analytics 全て alive│
│  ├─ apps/api/wrangler.toml: KV id = <real-32-hex>        │
│  ├─ apps/web/.env.production: 5 変数すべて確定            │
│  └─ wrangler deploy が手元から / Pages は Git 連携 build  │
│                                                          │
│  Observability:                                          │
│  ├─ docs/observability.md (新規)                         │
│  │   ├─ KPI 表 7 項目 (rooms 成功率 / p95 WS RTT / ...)   │
│  │   ├─ SLO / エラーバジェット / 撤退ライン                  │
│  │   ├─ wrangler tail クエリ集 (error.code / route / RL) │
│  │   └─ CF Web Analytics ダッシュボード設定手順              │
│  └─ Phase 7 review LOW-3/4 を follow-up リスト化            │
│                                                          │
│  E2E: 5 spec / 2 project (chromium + mobile-chrome)      │
│  ├─ landing.spec.ts (既存)                                │
│  ├─ room-create.spec.ts (画像 → /r/:id → PNG)             │
│  ├─ room-share.spec.ts (2 context 同期)                  │
│  ├─ room-protected.spec.ts (gate 通過 / 拒否)             │
│  └─ room-mobile.spec.ts (375x667 screenshot)             │
│  webServer は web + api を同時起動                          │
│  Turnstile dev key + BYPASS=true で siteverify バイパス     │
│                                                          │
│  Phase 7 review LOW: 全件処遇確定                            │
│  ├─ LOW-1 → A1 で自動解消                                   │
│  ├─ LOW-2 → JSON.stringify 化 (1 文字差分)                 │
│  ├─ LOW-3 → docs/observability.md follow-up               │
│  └─ LOW-4 → docs/observability.md follow-up               │
└─────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 本番 URL での D&D | 未確定（URL 不在） | `https://snap-share.pages.dev` でローカルと同じ UX | Cloudflare Pages の Git 連携 build により main 自動反映 |
| `POST /rooms` 本番レイテンシ | 未計測 | `wrangler tail` で平均 RTT が見える | dogfood 期間中の p95 を docs/observability.md に追記する余白を確保 |
| Cloudflare Web Analytics | beacon が飛ばない（token 空） | 本番アクセスで Page View / Top Referrer が可視化 | cookieless なので EU 規制下でも consent 不要 |
| GitHub Actions main push | lint / test / build / e2e で停止 | 同上 + `e2e` が `room-create / share / protected / mobile` を含む | （任意）`deploy.yml` を追加して auto-deploy する選択肢、確定は Decisions Log |
| `wrangler tail` 監視 | ログ structure はあるが「何を grep するか」未定義 | `docs/observability.md` のクエリ集を見れば即座に判定可能 | `[api] rate limit hit` / `turnstile verify failed` / `app error code=...` を主軸に |
| E2E flake 耐性 | smoke のみで flaky 発生せず | webServer 経由で API が立ち上がるため初回 cold start が長くなる | Playwright `expect.poll` と `webServer.timeout` チューニング |
| Phase 7 review LOW 処遇 | 「Phase 8 follow-up でも可」（宙吊り） | LOW-1/2 解消 / LOW-3/4 docs 化 | 宙吊り状態を解消し dogfood 中に判断責務が誰かに残らないように |

---

## Mandatory Reading

実装前に必ず読むファイル。Phase 7 の差分を踏まえているので、Phase 7 plan / report / review の三点セットを優先する。

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 257-289（Phase 7.5 詳細） | 本フェーズの scope 定義。A/B/C/D の 4 トラックの内訳と「dogfood 開始ゲート = A + B」を確認 |
| P0 | `.claude/PRPs/reviews/phase-7-public-launch-review.md` | 全 | LOW-1〜4 の処遇判断の根拠（KV placeholder fail-open / VITE token JS escape / Turnstile poll / WS token query） |
| P0 | `apps/api/wrangler.toml` | 1-72 | placeholder と binding 名 / namespace_id の現状把握。R2 / KV / RL / DO migration / `[vars]` の構造 |
| P0 | `apps/web/playwright.config.ts` | 全 | `webServer` の `command: 'pnpm dev'` を multi-process 化する際の起点。`projects: [chromium]` のみという現状 |
| P0 | `apps/web/e2e/landing.spec.ts` | 全 | 既存 spec の書きぶり（`page.getByRole('toolbar', { name: '編集ツール' })` 等のロケーター）に合わせて新 spec を書く |
| P1 | `README.md` | 174-215（Production deploy 章） | 実機検証時に「README に書いてあるとおりに踏むと詰まらないか」を確認するためのベース |
| P1 | `apps/api/.dev.vars.example` | 全 | secret 一覧（`ROOM_TOKEN_SECRET` / `TURNSTILE_SECRET_KEY` / `BYPASS_TURNSTILE`）と production note |
| P1 | `apps/web/.env.example` | 全 | production で埋める 5 変数の定義（`VITE_API_URL` / `VITE_API_WS_URL` / `VITE_TURNSTILE_SITE_KEY` / `VITE_CF_ANALYTICS_TOKEN` / `VITE_PUBLIC_URL`） |
| P1 | `apps/api/src/middleware/rate-limit.ts` | 全 | RL binding が production で何を期待するか（`limit({ key })` の戻り `{ success }`）と fail-open の意図 |
| P1 | `apps/api/src/services/turnstile-service.ts` | 全 | dev 用 `BYPASS_TURNSTILE=true` と production の `siteverify` 呼び分け。E2E でどちらの経路を踏ませるか判断する材料 |
| P1 | `apps/api/src/services/image-blocklist-service.ts` | 全 | KV namespace バインドが「無いに等しい」状態（LOW-1）の挙動。Plan A1 で解消する根拠 |
| P1 | `apps/api/src/lib/logger.ts` | 全 | `wrangler tail` で grep する prefix `[api]` と meta 構造。`docs/observability.md` のクエリ集の元データ |
| P1 | `apps/api/src/lib/error.ts` | 全 | `error.code` / `sanitizePath` のログ structure。観測クエリのキー名 |
| P1 | `apps/web/src/hooks/useImageSource.ts` | 全 | `loadFromFile(file, turnstileToken, password?)` の呼び方。E2E で File 注入とトークン経路を組む際に使う |
| P1 | `apps/web/src/pages/LocalEditor.tsx` | 1-110 | パスワード保護 checkbox と Turnstile 状態機械。`room-protected.spec.ts` で踏む UI 経路 |
| P1 | `apps/web/src/components/room-gate/RoomGate.tsx` | 全 | `room-protected.spec.ts` で正答 / 誤答ケースに使うロケーター（`getByLabelText('パスワード')` / `getByRole('button', { name: '入室' })`） |
| P1 | `apps/web/src/lib/api-client.ts` | 1-130 | `createRoom` / `authenticateRoom` の reason union。E2E でどの status を期待するか確認 |
| P1 | `apps/web/index.html` | 30-44 | LOW-2 の修正対象（`VITE_CF_ANALYTICS_TOKEN` を `JSON.stringify` 化） |
| P1 | `.github/workflows/ci.yml` | 全 | E2E job の構造、Playwright install の流儀、artifact upload。本フェーズで auto-deploy を増やすか判断する基準 |
| P2 | `.claude/PRPs/plans/completed/phase-7-public-launch.plan.md` | 全 | 同種の「実装 + ドキュメント + 本番設定」マルチトラック plan の参考構造 |
| P2 | `.claude/PRPs/reports/phase-7-public-launch-report.md` | 全 | Phase 7 で実機検証を「コード上は完成、wrangler deploy は未実行」で止めた理由と Phase 7.5 への申し送り |
| P2 | `apps/api/src/lib/bindings.ts` | 全 | binding 型と「production で何が必要」の網羅 |
| P2 | `apps/api/src/__tests__/helpers/build-env.ts` | 全 | dev 用 default secret / site key の定数。E2E で同じ Turnstile dev test key を使う |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Cloudflare Workers Rate Limiting | [developers.cloudflare.com/workers/runtime-apis/rate-limit](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) | `period` は 10 / 60 のみ。`namespace_id` は account 内ユニーク。`limit({ key })` は `{ success: boolean }` を返す。本番 binding は wrangler.toml の `[[ratelimits]]` を deploy 時に自動作成（事前作成不要） |
| Cloudflare R2 production | [developers.cloudflare.com/r2/buckets/create-buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/) | `wrangler r2 bucket create snap-share-images` で作成。同名 bucket が他アカウントに無くても作成可能（R2 は account scoped） |
| Cloudflare KV namespace | [developers.cloudflare.com/kv/concepts/kv-namespaces](https://developers.cloudflare.com/kv/concepts/kv-namespaces/) | `wrangler kv namespace create IMAGE_BLOCKLIST` で 32 文字 hex の ID が返る。これを wrangler.toml の `[[kv_namespaces]] id = "..."` に貼る。preview ID は dev 用、production ID と分ける |
| Durable Object migration v2 | [developers.cloudflare.com/durable-objects/reference/durable-objects-migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/) | `[[migrations]] tag = "v2" renamed_classes = ...` は deploy 時に automatically applied。本番 DO がまだ v1 で動いていれば（過去 deploy 済の場合のみ）v2 が遡及適用される。今回は初回 deploy なので v1 → v2 が atomic |
| Cloudflare Turnstile widget management | [developers.cloudflare.com/turnstile/get-started](https://developers.cloudflare.com/turnstile/get-started/) | ダッシュボードで widget 作成。`Allowed hostnames` に `snap-share.pages.dev`（カスタムドメインなら両方）を登録しないと siteverify が通らない。site key は public、secret は wrangler secret put |
| Cloudflare Web Analytics | [developers.cloudflare.com/analytics/web-analytics](https://developers.cloudflare.com/analytics/web-analytics/) | beacon は `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"..."}'>`。Pages サイトを「Add a site」で登録すると token が払い出される |
| Cloudflare Pages Git 連携 | [developers.cloudflare.com/pages/configuration/git-integration](https://developers.cloudflare.com/pages/configuration/git-integration/) | Build command / Build output / Root directory の 3 設定。今回は monorepo なので Root を `apps/web` にすると `pnpm install` が web only になる罠があるため Root は `(空)` で `pnpm install --frozen-lockfile && pnpm -F @snap-share/web build` を build command に入れる |
| Playwright `webServer` | [playwright.dev/docs/test-webserver](https://playwright.dev/docs/test-webserver) | `webServer` は配列を取れる。複数プロセスを起動できるので `[ web (5173), api (8787) ]` の 2 サーバーを並行起動できる。`reuseExistingServer` を CI false にし、`url` で readiness を判定 |
| Playwright `devices` mobile | [playwright.dev/docs/emulation](https://playwright.dev/docs/emulation) | `devices['iPhone 12']` 等のプリセットで viewport / userAgent / hasTouch を一括設定。`Pixel 5` も使えるが iPhone 12 (390×844) が最も普及 |
| Cloudflare `wrangler tail` | [developers.cloudflare.com/workers/observability/logs/wrangler-tail](https://developers.cloudflare.com/workers/observability/logs/wrangler-tail/) | `wrangler tail snap-share-api --format=pretty` で stdout / stderr が逐次流れる。`--search "error.code"` でテキストフィルタ可能。WS upgrade のクエリ文字列もここに出るので LOW-4 の確認に使う |

> ECC の `cloudflare` skill にも Workers / Pages / R2 / KV のベストプラクティスがまとまっている。実機オペで詰まったら参照。

---

## Patterns to Mirror

Phase 7 までで確立した patterns に揃える。新規パターンは「Playwright multi-process webServer」と「観測ドキュメント章立て」の 2 つのみ。

### NAMING_CONVENTION（既存と同じ、E2E spec のみ追加）
```ts
// SOURCE: apps/web/e2e/landing.spec.ts:1-7
import { expect, test } from '@playwright/test';

test('landing page renders heading on desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('snap-share');
});
```
新 spec は `kebab-case-feature.spec.ts`（例: `room-create.spec.ts`）で `apps/web/e2e/` 直下に置く。`test('日本語の振る舞い説明', ...)` 形式の日本語タイトルを許容（既存と同じ流儀。CLAUDE.md の「日本語ファースト」原則に沿う）。

### LOCATOR_PATTERN（既存と同じ）
```ts
// SOURCE: apps/web/e2e/landing.spec.ts:14-19
await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeVisible();
for (const label of ['選択', '矩形', '矢印', 'テキスト', 'ハイライト']) {
  await expect(page.getByRole('button', { name: label })).toBeVisible();
}
```
**ロケーターは role + accessible name 主体**。CSS セレクタ / `data-testid` は最後の手段。新 spec の `room-protected.spec.ts` で `getByLabel('パスワード')` / `getByRole('button', { name: '入室' })` を使う根拠。

### ENVIRONMENT_FLAGS（既存と同じ、E2E でも踏襲）
```ts
// SOURCE: apps/api/src/__tests__/helpers/build-env.ts:10-11
export const DEFAULT_TURNSTILE_DEV_SECRET = '1x0000000000000000000000000000000AA';
export const DEFAULT_TURNSTILE_DEV_SITE_KEY = '1x00000000000000000000AA';
```
E2E でも同じ dev test key を使う。`.env.test` にすでに設定済（`VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA`）。`apps/api` 側は `BYPASS_TURNSTILE=true` を `.dev.vars` 経由で渡し、E2E 中の `wrangler dev` 起動コマンドで明示的に環境変数を立てる。

### LOGGING_PATTERN（既存、観測 docs の元データ）
```ts
// SOURCE: apps/api/src/middleware/rate-limit.ts:38-43
logger.warn('rate limit hit', {
  route: opts.routeId,
  ip: redactIp(ip),
});
```
prefix が `[api]`、structured meta が `{ route, ip, code, ... }` 形式。`docs/observability.md` の `wrangler tail` クエリ集はこの structure をそのまま grep する。新規ログは追加しない（本フェーズの方針）。

### DOC_STRUCTURE（既存 ADR / spike report に揃える）
```md
# Title

> 1-line summary

## Context
## Decision / Definition
## Consequences
## Follow-up
```
`docs/observability.md` も同様の章立てで書く（Background / KPIs / SLO / Operational Queries / Follow-up）。`docs/adr/ADR-0002-...` と同じトーン。新規ファイルだが**新規 ADR ではない**ため `docs/adr/` には置かない。

### PLAYWRIGHT_WEBSERVER_MULTI_PROCESS（**新規パターン**）
```ts
// PROPOSED for apps/web/playwright.config.ts
webServer: [
  {
    // API（wrangler dev）。E2E 用に BYPASS_TURNSTILE と Turnstile dev key を強制。
    command: 'pnpm -F @snap-share/api dev',
    url: 'http://localhost:8787/openapi.json',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      BYPASS_TURNSTILE: 'true',
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      ROOM_TOKEN_SECRET: 'e2e-test-token-secret-min-32-bytes-long',
    },
  },
  {
    command: 'pnpm -F @snap-share/web dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
],
```
- `webServer` は配列で複数プロセスを並行起動できる（Playwright 公式機能）。
- API 側は `/openapi.json`（Phase 2.5 で `@hono/zod-openapi` 化したエンドポイント）を readiness probe に使う。`/` だと 404 になる。実際のパスは `apps/api/src/index.ts` の `app.doc31` 設定を実装前に確認すること。`/api/docs` は Scalar UI で HTML を返すので probe 用には重い。`openapi.json` か、無ければ既存の `/rooms/non-existent` で 404 が返ることを probe にしてもよい（Playwright は 200-299 を要求するわけではなく「接続できれば OK」）。
- `env` で wrangler dev に渡す変数は `apps/api/.dev.vars` の代替。CI では `.dev.vars` が無いので `webServer.env` 経由が唯一の経路。

### E2E_TEST_DATA_FILE（**新規パターン**）
```ts
// PROPOSED for apps/web/e2e/fixtures/sample.png（バイナリ）
// 1×1 px の有効な PNG をリポジトリにコミット（< 100 bytes）
```
Playwright で `<input type="file">` に画像を流し込む際、Phase 1〜7 では smoke のため画像不要だった。本フェーズで初めて必要になるので fixture をリポジトリに置く。**生成方法**: `node -e "require('fs').writeFileSync('apps/web/e2e/fixtures/sample.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=', 'base64'))"` で 1×1 透過 PNG（67 bytes）が出力される。

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/api/wrangler.toml` | UPDATE | Track A1 — `id = "REPLACE_WITH_PRODUCTION_KV_ID"` を本番 KV namespace の確定 ID に差し替え。`[env.production.vars]` セクションを追加し `TURNSTILE_SITE_KEY` を本番 widget の site key に上書き、`BYPASS_TURNSTILE = "false"` を念のため明記 |
| `apps/web/.env.production` | CREATE / UPDATE | Track A1 / A4 — `VITE_API_URL` / `VITE_API_WS_URL` / `VITE_TURNSTILE_SITE_KEY` / `VITE_CF_ANALYTICS_TOKEN` / `VITE_PUBLIC_URL` の 5 変数を確定値で記入。**現在 0 行のため新規作成扱い**。Pages の build env からも入るが、ローカルで `pnpm -F @snap-share/web build` した時の挙動を一致させるため commit 候補。token を含むのでコミット可否は Decisions Log で判断（後述） |
| `apps/web/index.html` | UPDATE | Track D（LOW-2）— `const t = "%VITE_CF_ANALYTICS_TOKEN%";` を `JSON.stringify` 化。具体的には `htmlEnvPlugin` の置換後文字列を `JSON.stringify` でエスケープするか、index.html 側で `const t = ${...} as JSON literal` の形にする。最小差分は `const tRaw = "%VITE_CF_ANALYTICS_TOKEN%"; const t = tRaw.replace(/[^A-Za-z0-9-_]/g, '');` の sanitize 化が現実的（Cloudflare の token は base62 系のみなので副作用無し） |
| `apps/web/playwright.config.ts` | UPDATE | Track C — `webServer` を配列化して API + Web の 2 プロセス起動。`projects` に `mobile-chrome` を追加（`devices['iPhone 12']`）。Firefox / WebKit は plan で「dogfood 後フェーズ判断」と明記し本フェーズでは追加しない |
| `apps/web/e2e/fixtures/sample.png` | CREATE | Track C — E2E で `setInputFiles` に渡す 1×1 透過 PNG（base64 で 67 bytes）。新規 spec が共通で参照 |
| `apps/web/e2e/room-create.spec.ts` | CREATE | Track C — 画像 D&D → `POST /rooms` 201 → URL が `/r/:id` 形式に遷移 → PNG export ボタン enabled / clickable |
| `apps/web/e2e/room-share.spec.ts` | CREATE | Track C — `browser.newContext()` × 2 で同一ルーム URL を開き、片方の矩形追加が他方に Yjs 経由で 200ms 以内に反映されることを assert |
| `apps/web/e2e/room-protected.spec.ts` | CREATE | Track C — パスワード保護チェック → 画像 → `/r/:id` → 別 context で開いて RoomGate 表示 → 誤答で `getByText('パスワードが違います')` → 正答で入室 |
| `apps/web/e2e/room-mobile.spec.ts` | CREATE | Track C — `iPhone 12` viewport で landing が overflow しないこと、ツールバーが reachable なこと、screenshot 回帰 |
| `docs/observability.md` | CREATE | Track B — KPI / SLO / `wrangler tail` クエリ / CF Web Analytics ダッシュボード設定 / Phase 7 review LOW-3/4 follow-up リスト |
| `README.md` | UPDATE | Track A — Production deploy 章を実機検証ベースで書き換え。確定した本番 URL / Pages build settings / GitHub Actions secret 名を反映。`docs/observability.md` へのリンク追加 |
| `CONTRIBUTING.md` | UPDATE | Track A — デプロイ運用フロー（手動 `wrangler deploy` か main auto-deploy か Decisions Log の結果）を記述 |
| `apps/api/.dev.vars.example` | UPDATE | Track A — production 切替手順（`BYPASS_TURNSTILE=false` への切替注意 / secret put コマンド再掲）を comment で補強 |
| `.github/workflows/ci.yml` | UPDATE（任意） | Track A — main push の auto-deploy を採用する場合 `deploy` job を追加。Decisions Log 次第。**MUST スコープには含めない** |
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Phase 7.5 の status を `pending → in-progress` に更新、PRP plan 列に本ファイル `[phase-7.5-production-provisioning.plan.md]` を貼る |

## NOT Building

本フェーズが Phase 8 dogfood の前段である以上、明示的に**やらない**ことを多めに書いておく。これがないと「dogfood で見るべき問題を Phase 7.5 で潰してしまう」スコープ膨張が起きる。

- **dogfood で発生した小修正の事前対応**: Phase 7.5 はあくまで「dogfood 開始の前提を整える」。バグや UX 課題が想定されても、計測手段だけ用意して Phase 8 で受ける。
- **README の英語化**: 公開規模が固まってから判断（PRD の Phase 7.5 非スコープ明記）。
- **Privacy ページ / 利用規約**: 同上。
- **Phase 7 review LOW-3（Turnstile poll 上限）のコード対応**: dogfood 中の実機計測待ち。本フェーズでは `docs/observability.md` の follow-up に積むのみ。
- **Phase 7 review LOW-4（WS token を `Sec-WebSocket-Protocol` 経由に切替）**: 同上。実機の `wrangler tail` で「実際に token が出るか」を観察してから判断。
- **Firefox / WebKit の Playwright project 追加**: PRD で「Phase 6 後に拡張」と書いた宿題だが、**本フェーズでは chromium + mobile-chrome のみに絞る**。理由は (1) flaky の最小化（webServer multi-process 化と新 spec 4 件追加のリスクを同時に取らない）、(2) WebKit は Cloudflare Turnstile の challenge UI で時々詰まる既知問題（dogfood 後に判断）。
- **Yjs 同期 RTT の自動計測**: PRD に「200ms 以内に反映」とあるが、E2E は「200ms 以内に他方の DOM に反映される」という挙動 assert に留め、RTT 数値の自動収集は dogfood で `wrangler tail` から手動で見る。
- **新しいログ項目の追加**: 既存 `logger.warn/error` の structured meta だけで `docs/observability.md` のクエリは書ける。新規 `logger.info('analytics-event', ...)` は追加しない。
- **`SnapShareYDO` のメトリクス出力**: Durable Object 単位の WS 接続数 / hibernate 頻度は CF dashboard 側で見える。アプリ側で `state.storage.put` を増やす実装は本フェーズでは行わない。
- **Sentry 等の外部 APM 導入**: cookieless / 月額 $0 を維持するために CF Web Analytics + `wrangler tail` の組み合わせのみ。
- **画像ブラックリストの最小データ投入**: 本フェーズでは KV namespace を作るところまで。「最初のブロック対象 SHA」は dogfood で発生したら追加する。

---

## Step-by-Step Tasks

タスクは**トラック単位（A / B / C / D）**で並べる。同一トラック内は番号順、トラック間は依存が明示されていない限り並行可（A1 → A4 → A6 だけは順序固定。B / C / D は A の途中から並行できる）。

### Track A — Cloudflare 本番設定（実機オペ）

#### Task A1: R2 / KV / Durable Object / Rate Limit binding を本番に作成

- **ACTION**: ローカルから `wrangler` CLI で本番リソースを provision する。
- **IMPLEMENT**:
  - `wrangler r2 bucket create snap-share-images`
  - `wrangler kv namespace create IMAGE_BLOCKLIST` → 出力された 32 文字 hex の `id` を控える
  - `wrangler kv namespace create IMAGE_BLOCKLIST --preview` → preview ID を控える（dev 用、Phase 8 follow-up）
  - `wrangler deploy --dry-run --outdir dist` を `apps/api` で走らせ、wrangler.toml の syntactic な誤りが無いことを確認
  - DO migration v2 は `wrangler deploy` 実行時に自動適用されるため事前操作不要
  - RL binding ×3（`RL_CREATE_ROOM` / `RL_AUTH` / `RL_SYNC`）は wrangler.toml `[[ratelimits]]` ベースなので deploy 時に自動作成、事前 CLI 不要
- **MIRROR**: Phase 7 plan の Task 13/15 の wrangler binding 確定パターンと同じ流儀（README.md:179-184 の手順を実機で踏む）
- **IMPORTS**: なし（CLI 操作）
- **GOTCHA**:
  - `wrangler kv namespace create` は account scope。同名 namespace を別アカウントで作っても干渉しない
  - bucket / namespace 名は CF アカウント内ユニーク。失敗したら名前 collision を疑う
  - `--preview` を忘れると dev 用 ID が払い出されないが本フェーズの MUST ではない
- **VALIDATE**: `wrangler kv namespace list` / `wrangler r2 bucket list` で対象が並ぶことを確認

#### Task A2: `apps/api/wrangler.toml` の placeholder を確定値に差し替え

- **ACTION**: A1 で控えた KV ID を反映。Turnstile site key / `BYPASS_TURNSTILE` を `[env.production.vars]` で本番モードに上書き。
- **IMPLEMENT**:
  ```toml
  [[kv_namespaces]]
  binding = "IMAGE_BLOCKLIST"
  id = "<A1 で控えた 32 文字 hex>"
  preview_id = "<A1 で控えた preview ID（任意）>"

  # Turnstile widget は dev (1x000...) と production (本番 site key) を分ける
  [env.production.vars]
  TURNSTILE_SITE_KEY = "<本番 widget site key>"
  BYPASS_TURNSTILE = "false"
  ROOM_TTL_MS = "604800000"
  ```
- **MIRROR**: Phase 7 plan で wrangler.toml に `[[kv_namespaces]]` を新規追加した時の差分構造
- **IMPORTS**: なし
- **GOTCHA**:
  - `[env.production.vars]` を追加すると、`wrangler deploy --env production` で deploy する形になる。今までは無印 deploy だったので、`apps/api/package.json` の build script を `wrangler deploy --dry-run --outdir dist --env production` に揃えるか、無印に統一するか **Decisions Log で確定**する
  - 統一の最簡単パスは「`[env.production]` を使わず、`[vars]` 直下の `TURNSTILE_SITE_KEY` を本番値に上書きし、dev は `.dev.vars` の `BYPASS_TURNSTILE=true` で吸収する」。これだと wrangler deploy は無印のまま動く。**この plan ではこちらを推奨** とする
  - 推奨パスを採る場合、wrangler.toml `[vars] TURNSTILE_SITE_KEY` を **本番値に直接書き換える**（dev は `.env.test` の Vite 側 `VITE_TURNSTILE_SITE_KEY` で test key に切り替える設計を継続）
- **VALIDATE**: `grep "REPLACE_WITH_PRODUCTION" apps/api/wrangler.toml` が 0 行を返す。`pnpm -F @snap-share/api build`（`wrangler deploy --dry-run`）が緑

#### Task A3: Turnstile widget を作成し secret を投入

- **ACTION**: Cloudflare ダッシュボードで Turnstile widget を作成し、site key / secret を取得。
- **IMPLEMENT**:
  - dashboard.cloudflare.com → Turnstile → "Add a site"
  - Domain: `snap-share.pages.dev`（カスタムドメインを使う場合は両方）
  - Widget mode: **Invisible**
  - Site key と secret を控える
  - `wrangler secret put TURNSTILE_SECRET_KEY`（プロンプトで secret を貼る、`apps/api/` で実行）
  - `wrangler secret put ROOM_TOKEN_SECRET`（32 byte 以上のランダム値、`openssl rand -base64 48` で生成）
  - 控えた site key を A2 で wrangler.toml `[vars] TURNSTILE_SITE_KEY` に反映済み（手順順序上は A2 と A3 が逆になることがあるが、wrangler.toml 編集は両方の情報が揃ってから一括で OK）
- **MIRROR**: Phase 7 plan Task 16 の `wrangler secret put` パターン
- **IMPORTS**: なし
- **GOTCHA**:
  - Turnstile widget の Allowed hostnames に Pages 本番 URL を入れ忘れると siteverify が `error-codes: ['invalid-input-secret']` で常に失敗
  - `wrangler secret put` は production 環境にのみ書き込む。dev には影響しない
  - `wrangler secret list` で確認できるが値は表示されない（書き込み済みかどうかだけ）
- **VALIDATE**: `wrangler secret list` が `ROOM_TOKEN_SECRET` と `TURNSTILE_SECRET_KEY` を含む

#### Task A4: Cloudflare Web Analytics token 取得 → `apps/web/.env.production` を確定

- **ACTION**: CF Web Analytics の token を発行し、Pages build env 用と `.env.production` 用の両方に投入。
- **IMPLEMENT**:
  - dashboard.cloudflare.com → Analytics → Web Analytics → "Add a site"
  - Hostname: 本番 URL（`snap-share.pages.dev` or カスタム）
  - 発行された token（`d3cf...` 形式）を控える
  - `apps/web/.env.production` を新規作成し以下を記入:
    ```env
    VITE_API_URL=https://snap-share-api.<account>.workers.dev
    VITE_API_WS_URL=wss://snap-share-api.<account>.workers.dev
    VITE_TURNSTILE_SITE_KEY=<A3 で控えた site key>
    VITE_CF_ANALYTICS_TOKEN=<上記 token>
    VITE_PUBLIC_URL=https://snap-share.pages.dev
    ```
  - **`.env.production` を commit するかは Decisions Log で確定**。token と site key は public 扱いだが、URL を晒すリスクと「Pages build env でも書ける」冗長性を比較する。本 plan の推奨は **commit せず Pages build env のみで管理**（`.env.production` は `.gitignore` 追加 / 既存の Vite ignore に従う）
- **MIRROR**: `apps/web/.env.example` のコメント（Phase 7 で書いた production 想定の説明）と同じ key 順
- **IMPORTS**: なし
- **GOTCHA**:
  - `VITE_CF_ANALYTICS_TOKEN` は public bundle に焼き込まれる（cookieless beacon の token は private secret ではない）
  - Pages build env を使う場合は dashboard → Pages → Settings → Environment variables（Production / Preview を分ける）
  - `apps/web/vite.config.ts:11-19` の `loadEnv(mode, ...)` は mode が `production` の時 `.env.production` も読む。Pages の build がこれを直接読むかは build command 次第（`pnpm -F @snap-share/web build` は `vite build` を呼び mode=production になる）
- **VALIDATE**: `pnpm -F @snap-share/web build` をローカル（一時的に `.env.production` を作って試す）で実行し、`apps/web/dist/index.html` の `<meta property="og:url">` と analytics token がプレースホルダ `%VITE_...%` のままになっていないことを確認

#### Task A5: Cloudflare Pages プロジェクト作成 + Git 連携

- **ACTION**: dashboard.cloudflare.com → Pages → "Create a project" → "Connect to GitHub" → リポジトリ選択。
- **IMPLEMENT**:
  - Production branch: `main`
  - Build command: `pnpm install --frozen-lockfile && pnpm -F @snap-share/web build`
  - Build output: `apps/web/dist`
  - Root: `(空)` （monorepo 全体を見る必要があるため）
  - Environment variables（Production）: `VITE_API_URL` / `VITE_API_WS_URL` / `VITE_TURNSTILE_SITE_KEY` / `VITE_CF_ANALYTICS_TOKEN` / `VITE_PUBLIC_URL`
  - Node version: 22（`.node-version` か Pages settings で固定）
  - PNPM_VERSION: `10`（Pages はデフォで `8`、合わない場合 `corepack enable && pnpm install` の preinstall hack が必要）
- **MIRROR**: Phase 7 plan Task 17 の Pages 接続手順
- **IMPORTS**: なし
- **GOTCHA**:
  - Pages の monorepo build はデフォの Node 18 / pnpm 8 だと catalog: 記法が読めない。`PNPM_VERSION=10` と `NODE_VERSION=22` の env を Pages の build settings に追加する
  - Build command の `pnpm install --frozen-lockfile` は workspace 全体を install する。`pnpm -F @snap-share/web install` だと workspace 解決で `@snap-share/api` が見つからず `import type` で死ぬ
  - Root を `apps/web` にすると `pnpm install` が web-only になり同じ罠を踏む
  - `_headers` は `apps/web/public/_headers` から `apps/web/dist/_headers` に Vite が自動コピーする（`public/` の挙動）。Pages はこれを認識する
- **VALIDATE**:
  - 1 回目の build が成功し、Pages preview URL（`https://<commit-hash>.snap-share.pages.dev`）で landing が描画される
  - DevTools の Network タブで `_headers` 由来の `Content-Security-Policy` / HSTS が response header に乗っていることを確認
  - DevTools Console で `static.cloudflareinsights.com/beacon.min.js` が読み込まれエラーが出ていないことを確認

#### Task A6: API を `wrangler deploy` で本番にデプロイ

- **ACTION**: `cd apps/api && pnpm wrangler deploy`
- **IMPLEMENT**: 単一コマンド。完了後 `wrangler tail snap-share-api --format=pretty` を別ターミナルで起動しておく。
- **MIRROR**: Phase 7 plan Task 18 と同じ
- **IMPORTS**: なし
- **GOTCHA**:
  - 初回デプロイで DO migration v1 (`new_classes = ["YDurableObjects"]`) と v2 (`renamed_classes`) が atomic に適用される。`SnapShareYDO` という名前で DO が作成される
  - RL binding ×3 は deploy 時に CF が自動 provision、既存の `namespace_id = "1001"` 等を尊重
  - workers.dev URL は deploy 後に表示される（`https://snap-share-api.<account>.workers.dev`）。これを A4 の `VITE_API_URL` / `VITE_API_WS_URL` に反映
- **VALIDATE**:
  - `curl https://snap-share-api.<account>.workers.dev/rooms/non-existent` が 404 + envelope `{ ok: false, error: { code: 'NOT_FOUND', ... } }`
  - Pages 本番 URL から「画像 D&D → URL 取得 → 別ブラウザで開く」が手動で動く
  - `wrangler tail` に `[api] room created` 等のログが流れる

#### Task A7: 自動デプロイ vs 手動デプロイの Decisions Log 確定

- **ACTION**: 「main マージで自動デプロイ」か「手動 `wrangler deploy` 運用 + Pages の Git 連携のみ」を確定する。
- **IMPLEMENT**:
  - 推奨: **手動 `wrangler deploy` 運用 + Pages の Git 連携のみ**。理由:
    - 個人開発で main = production の関係が緊密。dogfood 中に「ロジックエラーを押し戻したい」場面で手動が早い
    - GitHub Actions に `CLOUDFLARE_API_TOKEN` を投入する追加リスクを避ける
    - Pages は Git 連携で main 自動 build なので web 側は自動、API 側のみ手動という非対称運用にする
  - 仮に自動デプロイを採るなら `.github/workflows/deploy.yml` を新規作成し以下:
    ```yaml
    name: Deploy API
    on:
      push:
        branches: [main]
      workflow_dispatch:
    jobs:
      deploy:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: pnpm/action-setup@v4
          - uses: actions/setup-node@v4
            with: { node-version: 22, cache: pnpm }
          - run: pnpm install --frozen-lockfile
          - run: pnpm -F @snap-share/api build
          - uses: cloudflare/wrangler-action@v3
            with:
              apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
              workingDirectory: apps/api
    ```
  - 確定したら `README.md` の Production deploy 章と `CONTRIBUTING.md` の運用フロー章に書く
  - PRD の Decisions Log（`.claude/PRPs/prds/snap-share.prd.md` 末尾）にも 1 行追加
- **MIRROR**: PRD の既存 Decisions Log の format
- **IMPORTS**: なし
- **GOTCHA**: 自動デプロイを採る場合、CI の e2e job 失敗時に deploy をブロックする `needs: e2e` を必ず設定（さもなくば壊れた API が main マージ即 prod に出る）
- **VALIDATE**: README / CONTRIBUTING / PRD で運用フローが一貫している（grep して矛盾がない）

---

### Track B — 観測 / KPI 設計（ドキュメント）

#### Task B1: `docs/observability.md` 新規作成 — KPI 表

- **ACTION**: dogfood で見る KPI を 7 項目で定義し、各々に「測定方法」「目標値」「悪化時の対応」を書く。
- **IMPLEMENT**: 章立ては `## KPIs` で以下表（7 行）:
  | KPI | 測定方法 | 目標 | 悪化時 |
  |---|---|---|---|
  | rooms 作成成功率 | `wrangler tail` で `[api] room created` / (`[api] app error code=INVALID_REQUEST` + `code=PAYLOAD_TOO_LARGE` + `code=UNSUPPORTED_MEDIA_TYPE` + `code=UNPROCESSABLE_ENTITY` + `code=RATE_LIMITED` + `code=INTERNAL`) の比 | ≥ 99% | バリデーション過剰 / 画像形式想定外 / RL 過剰絞りを疑う |
  | 画像アップロード成功率 | 上の `INTERNAL` のみ抽出。R2 put が原因の比率 | ≥ 99.9% | R2 reachability / `r2-image-storage` の `putImage failed` ログ確認 |
  | p95 WebSocket RTT | E2E の `room-share.spec.ts` で peer 間反映時間を timestamp で計測（dogfood は手動） | ≤ 200ms（同一リージョン）/ ≤ 500ms（global） | DO Hibernation 復帰のコスト / Yjs payload 肥大を疑う |
  | Rate Limit ヒット率 | `wrangler tail \| grep '[api] rate limit hit'` を 24h | < 1%（オーガニック） / 想定値（攻撃時） | 想定 RL 上限が低すぎる / 攻撃検知 |
  | Turnstile fail 率 | `wrangler tail \| grep 'turnstile verify failed'` を 24h | < 5% | widget Allowed hostnames 設定 / dev key 混入 |
  | 画像 SHA-256 重複率 | KV `IMAGE_BLOCKLIST` ヒットログ `[api] app error code=UNPROCESSABLE_ENTITY` の比率 | 0%（dogfood）→ ブロック対象が増えれば閾値再評価 | 共有素材 / 同一 PR スクショ の運用設計 |
  | 24h 後の room 残存率 | DO の Alarm が発火していること（`wrangler tail \| grep 'alarm fired'`） | ≥ 95%（誤発火を疑う） / 7 日 TTL の設定値 | DO Alarm 動作 / TTL 計算ロジック |
- **MIRROR**: PRD `Success Metrics` 表と `docs/adr/ADR-0002-...` の表 formatting
- **IMPORTS**: なし
- **GOTCHA**: `wrangler tail` は **24h リアルタイム** で過去ログ遡れない。dogfood 期間中に手動で叩くか、CF Workers Logpush に積むか（後者は有料、本フェーズは前者）
- **VALIDATE**: 表を友人 1 名に見せて「数字を出すまでに必要な操作が逆引きできるか」を確認

#### Task B2: SLO / エラーバジェット / 撤退ライン

- **ACTION**: B1 の KPI に対し SLO（達成すべき水準）と Error Budget（許容劣化）と撤退ライン（その値を割ったら snap-share の継続を再評価する閾値）を書く。
- **IMPLEMENT**: 章立て `## SLO and Error Budget`:
  - **SLO（30 日 rolling）**:
    - rooms 作成成功率 ≥ 99% — エラーバジェット 1%（30 日で約 7.2h 連続失敗 = 1% 強）
    - p95 WS RTT ≤ 500ms（global）
    - 月額 Cloudflare コスト ≤ $30
  - **撤退ライン（dogfood 終了時の Go/No-Go）**:
    - rooms 作成成功率 < 95%（明らかにバグ）
    - p95 WS RTT > 1000ms（DO Hibernation コストが想定外）
    - オーナー自身の自発利用回数 < 1 回 / 月（PRD の本来の Success Metric を逸脱、3 ヶ月時点）
- **MIRROR**: PRD の Success Metrics の数値感
- **IMPORTS**: なし
- **GOTCHA**: 「SLO は achievable target、撤退ラインは別の概念」を明示。SLO 違反 = 改修着手 ≠ 撤退
- **VALIDATE**: PRD の Success Metrics と数値が矛盾しないこと（grep で双方確認）

#### Task B3: `wrangler tail` クエリ集

- **ACTION**: dogfood 中に「何が起きているか」を 30 秒で判断するためのコマンド逆引き表を書く。
- **IMPLEMENT**: 章立て `## Operational Queries`:
  - 全エラー: `wrangler tail snap-share-api --format=pretty --search "[api]"`（prefix 共通なので大体これでいい）
  - rate limit: `wrangler tail --search "rate limit hit"`
  - Turnstile fail: `wrangler tail --search "turnstile verify"`
  - 認証失敗: `wrangler tail --search "auth failed"`
  - DO alarm: `wrangler tail --search "alarm fired"`
  - 画像 R2 fail: `wrangler tail --search "R2 putImage failed"`
- **MIRROR**: `apps/api/src/lib/logger.ts` の prefix と `apps/api/src/middleware/rate-limit.ts:38-43`、`apps/api/src/services/turnstile-service.ts:66-72` 等のログ structure
- **IMPORTS**: なし
- **GOTCHA**: `wrangler tail` の `--search` は plain text grep で正規表現は不可。`--format=json` でパイプして `jq` する案も併記
- **VALIDATE**: dogfood 開始前に上記コマンドを 1 回ずつ実機で叩き、想定通りログが流れることを確認（A6 完了後）

#### Task B4: Cloudflare Web Analytics ダッシュボード設計

- **ACTION**: 標準ダッシュボードで何を見るか、カスタムイベントを追加するか決める。
- **IMPLEMENT**: 章立て `## Web Analytics Dashboard`:
  - 標準で見える項目（Page Views / Unique Visitors / Top Pages / Top Referrers / Country / Browser / Device）のうち dogfood で意味のある 4 つに絞る:
    - **Page Views per day**（PRD Success Metric: 月間 UU 100）
    - **Top Referrer**（誰が共有 URL を踏んでいるか）
    - **Device split** （PRD: tablet 閲覧の Should 要件検証）
    - **Country**（日本以外からのアクセス比率 = スパムの一次インジケータ）
  - カスタムイベント（`/r/:id` 遷移時など）は本フェーズで追加しない。CF Web Analytics の SPA 対応は 2025 で改善されたが、本フェーズの方針は「最小限を最小限に」
- **MIRROR**: PRD `Success Metrics` 表の「How Measured」列
- **IMPORTS**: なし
- **GOTCHA**: cookieless beacon は IP ベースなので「同一人物の 2 デバイス」が別 UU として数えられる。dogfood で UU 100 を測る時の誤差として認識
- **VALIDATE**: A5 完了後、本番 URL を 2-3 回叩いて翌日に CF dashboard で Page View が +1 されていることを確認

#### Task B5: Phase 7 review LOW-3 / LOW-4 を follow-up リストに記録

- **ACTION**: docs/observability.md 末尾に `## Follow-ups` 章を追加。
- **IMPLEMENT**:
  - **LOW-3（Turnstile poll 上限）**: 「dogfood 期間中に `[api] turnstile verify network error` のログ頻度を観測。週次で 5 件以上発生していれば `apps/web/src/components/turnstile/TurnstileWidget.tsx:52` の `attempts > 50`（5s）を 100（10s）に拡張する」
  - **LOW-4（WS token query string がログに残る）**: 「dogfood 開始時に `wrangler tail` を 1 セッション流し、`/sync/:id?token=...` のクエリ文字列が tail に出るかを目視確認。出る場合は Phase 8 follow-up で `Sec-WebSocket-Protocol` 経由に切替（`apps/api/src/yjs.ts:90` と `apps/web/src/hooks/useYjsAnnotationsStore.ts` の WS URL 構築箇所）」
- **MIRROR**: ADR の Consequences / Follow-up section の format
- **IMPORTS**: なし
- **GOTCHA**: follow-up を docs に書いただけだと忘れる。GitHub Issue にも `phase-8-followup` ラベルで起票する選択肢を comment に記載
- **VALIDATE**: docs を読み返して「dogfood 中にここを見る」が判断可能なレベルになっていること

---

### Track C — E2E 拡充

#### Task C1: `apps/web/playwright.config.ts` を multi-process webServer + mobile project 化

- **ACTION**: `webServer` を配列にし `apps/api` (`pnpm -F @snap-share/api dev`) と `apps/web` (`pnpm -F @snap-share/web dev`) を並列起動。`projects` に `mobile-chrome` を追加。
- **IMPLEMENT**:
  ```ts
  // apps/web/playwright.config.ts
  import { defineConfig, devices } from '@playwright/test';

  const WEB_PORT = 5173;
  const API_PORT = 8787;

  export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
      baseURL: `http://localhost:${WEB_PORT}`,
      trace: 'on-first-retry',
    },
    projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    ],
    webServer: [
      {
        command: 'pnpm -F @snap-share/api dev',
        url: `http://localhost:${API_PORT}/rooms/__health__`,
        reuseExistingServer: !process.env.CI,
        timeout: 90_000,
        env: {
          BYPASS_TURNSTILE: 'true',
          TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
          ROOM_TOKEN_SECRET: 'e2e-test-token-secret-min-32-bytes-long-enough',
        },
      },
      {
        command: 'pnpm -F @snap-share/web dev',
        url: `http://localhost:${WEB_PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
    ],
  });
  ```
- **MIRROR**: 既存 `playwright.config.ts` の defineConfig 構造をそのまま拡張
- **IMPORTS**: `devices` は既に import 済
- **GOTCHA**:
  - **API readiness probe**: Phase 2 の `/rooms/non-existent` ルートは 404 を返す（`apps/api/src/lib/error.ts:onAppNotFound`）。Playwright の `webServer.url` は「200-299 を期待」する仕様 → 404 だと永遠に待つ。回避策: `apps/api/src/index.ts` に **超軽量な `/healthz` エンドポイント** を追加（`app.get('/healthz', (c) => c.text('ok'))` 1 行）。本フェーズで追加する小コードはこれのみ
  - もし `/healthz` を追加せず済ませたい場合、`webServer.url` を `http://localhost:8787/api/docs` にする手もある（Scalar UI が 200 を返す）。ただし dev only なので prod 影響なし
  - **`BYPASS_TURNSTILE=true`** を Playwright `env` で渡すのは `apps/api/.dev.vars` の代替。CI では `.dev.vars` が無いのでこの経路が必須
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e` がローカルで実行でき、両方の dev サーバーが立ち上がってから既存 6 spec が緑

#### Task C2: `apps/api/src/index.ts` に `/healthz` を追加（C1 の readiness probe 用）

- **ACTION**: 1 行追加。
- **IMPLEMENT**:
  ```ts
  // apps/api/src/index.ts（既存 createOpenAPI app の直後）
  app.openapi(
    createRoute({
      method: 'get',
      path: '/healthz',
      summary: 'Liveness probe',
      tags: ['system'],
      responses: { 200: { description: 'OK', content: { 'text/plain': { schema: z.string() } } } },
    }),
    (c) => c.text('ok'),
  );
  ```
  あるいは Scalar 経由で OpenAPI に乗せたくないなら `app.get('/healthz', (c) => c.text('ok'))` の plain hono ルートで十分。後者は OpenAPIHono でも plain `app.get` が動く
- **MIRROR**: `apps/api/src/routes/rooms.ts` の `app.openapi(...)` パターン or plain hono `app.get`
- **IMPORTS**: 既存
- **GOTCHA**: 既存テストへの影響なし（他のルートと衝突しない）。OpenAPI スキーマに乗せた場合は `apps/api/src/__tests__/` の OpenAPI snapshot テストが無いことを確認（grep `app.doc31` で利用箇所を確認）
- **VALIDATE**: `curl http://localhost:8787/healthz` → `ok` 200

#### Task C3: `apps/web/e2e/fixtures/sample.png` を作成

- **ACTION**: 1×1 透過 PNG を base64 でリポジトリにコミット。
- **IMPLEMENT**:
  ```sh
  node -e "require('fs').writeFileSync('apps/web/e2e/fixtures/sample.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=', 'base64'))"
  ```
- **MIRROR**: なし（リポジトリ初）
- **IMPORTS**: なし
- **GOTCHA**:
  - PNG が 67 bytes で `apps/api/src/lib/imageValidation`（あれば）/ `validateImageFile` を通る最小サイズ。`packages/shared` の `MIME_TYPES` / `MAX_BYTES` を確認して通過することを保証
  - `.gitignore` で `*.png` を除外していないか確認（commit できるか）
- **VALIDATE**: `file apps/web/e2e/fixtures/sample.png` が `PNG image data, 1 x 1` を返す

#### Task C4: `apps/web/e2e/room-create.spec.ts` 新規

- **ACTION**: 画像 D&D → `POST /rooms` 200 → URL 遷移 → PNG export ボタン enabled。
- **IMPLEMENT**:
  ```ts
  import { expect, test } from '@playwright/test';
  import path from 'node:path';

  const SAMPLE_IMAGE = path.resolve(__dirname, 'fixtures/sample.png');

  test('画像アップロードからルーム遷移、PNG エクスポート可能まで', async ({ page }) => {
    await page.goto('/');
    // <input type="file" /> はドロップゾーン内に存在（hidden）。setInputFiles は visibility 不問で動く
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(SAMPLE_IMAGE);

    // POST /rooms が走り URL が /r/:nanoid に遷移する。21 文字の nanoid を待つ
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });

    // ツールバーのツールが enabled に切り替わる
    await expect(page.getByRole('button', { name: '矩形' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'PNG 保存' })).toBeEnabled();
  });
  ```
- **MIRROR**: `apps/web/e2e/landing.spec.ts:1-11` の `expect(page.locator(...)).toBeVisible` パターン
- **IMPORTS**: `path`, `@playwright/test`
- **GOTCHA**:
  - ドロップゾーン UI がカスタム実装でも `<input type="file" />` は必ず存在する（`useImageSource` の File 受付経路）。`apps/web/src/components/empty-state/` を grep して input ロケーターが「1 つしか無い」ことを確認
  - URL は `setRoomIdInUrl` が `history.pushState('/r/:id')` する設計（`apps/web/src/lib/url-room.ts`）。`page.url()` に反映されるまで微小 lag あり、`toHaveURL` の `timeout: 10_000` で吸収
  - PNG export は実際にダウンロード trigger するとファイル保存 dialog が出てしまう → `enabled` 状態の assert に留める
- **VALIDATE**: spec 単独実行で緑（`pnpm -F @snap-share/web test:e2e -- -g "画像アップロードから"`）

#### Task C5: `apps/web/e2e/room-share.spec.ts` 新規（2 context 同期）

- **ACTION**: 1 つ目のコンテキストでルーム作成 → 2 つ目のコンテキストで同じ URL を開く → 1 つ目で矩形追加 → 2 つ目に反映される。
- **IMPLEMENT**:
  ```ts
  import { expect, test } from '@playwright/test';
  import path from 'node:path';

  const SAMPLE_IMAGE = path.resolve(__dirname, 'fixtures/sample.png');

  test('2 ブラウザコンテキスト間で注釈が同期される', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto('/');
    await page1.locator('input[type="file"]').setInputFiles(SAMPLE_IMAGE);
    await expect(page1).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/);
    const sharedUrl = page1.url();

    await page2.goto(sharedUrl);
    // 2 つ目で画像（KonvaImage）の DOM mount を待つ — canvas に描画されるので
    // ツールバーの「矩形」ボタンが enabled になることで間接 assert
    await expect(page2.getByRole('button', { name: '矩形' })).toBeEnabled({ timeout: 10_000 });

    // page1 で矩形ツール選択 → 矩形を 1 つ作成（座標 100,100 → 200,200）
    await page1.getByRole('button', { name: '矩形' }).click();
    const stage1 = page1.locator('.konvajs-content canvas').first();
    await stage1.dispatchEvent('mousedown', { clientX: 100, clientY: 100, button: 0 });
    await stage1.dispatchEvent('mousemove', { clientX: 200, clientY: 200, button: 0 });
    await stage1.dispatchEvent('mouseup', { clientX: 200, clientY: 200, button: 0 });

    // page2 にも矩形が反映されるまで待つ — Yjs awareness と annotation merge
    // 直接 assert する DOM は無いので、page2 の Konva stage 内の Rect ノード数で判定。
    // Konva は canvas なので DOM 数は数えにくく、page.evaluate で window.__YJS_DOC__ から見る案も。
    // → 実装は Yjs store のデバッグフックを露出する必要があるかもしれない。後述 GOTCHA
    // 暫定 assert: page2 のツールバー全ボタン enabled を 1s 以内に観測
    await page2.waitForTimeout(500); // 同期待機（200ms 仕様 + 余裕）
    // ここで page2 から Yjs ドキュメントの annotations 数を取れる経路を実装で用意する
    const count = await page2.evaluate(() => (window as any).__SNAP_SHARE_ANNOTATIONS__?.length ?? 0);
    expect(count).toBeGreaterThanOrEqual(1);
  });
  ```
- **MIRROR**: 既存 spec の `expect(...).toBeVisible` パターン + Playwright Multi-context の標準パターン
- **IMPORTS**: `@playwright/test`, `path`
- **GOTCHA**:
  - **Konva の canvas は DOM ノードを持たない**ので、矩形が描画されたかを DOM 数で assert できない
  - 解決策 (a): `apps/web/src/hooks/useYjsAnnotationsStore.ts` で `window.__SNAP_SHARE_ANNOTATIONS__ = annotations.toArray();` を **dev/test 限定で露出**（`if (import.meta.env.DEV || import.meta.env.MODE === 'test')`）。E2E では `evaluate` で取得
  - 解決策 (b): page2 のツールバーで Undo ボタンが enabled になったことで「他クライアントから注釈が来た」と判定する（Undo は historyReducer に乗らないので難しい）
  - 解決策 (c): page2 で「全削除」ボタンが押せる状態（`confirmClearAllDialog` の trigger）を assert
  - **本 plan は (a) を採用**：`useAnnotationsStore` か `useYjsAnnotationsStore` で `useEffect(() => { (window as any).__SNAP_SHARE_ANNOTATIONS__ = annotations; }, [annotations]);` を 1 つ追加。本番 build には乗らないように mode 判定
  - 矩形作成の `dispatchEvent` は Konva の `Stage` の上で発火する必要があり、`canvas` 要素を直接叩く形になる。`apps/web/src/components/canvas/CanvasStage.tsx` の handler が `e.target === stage` を見ている関係で `pointer` events を要求するか確認。`mousedown` で済む可能性も
- **VALIDATE**: `count >= 1` で 1 矩形以上が他端に到達した = 同期は動いている

#### Task C6: `apps/web/e2e/room-protected.spec.ts` 新規（パスワードゲート）

- **ACTION**: 「パスワード保護」チェック → password 入力 → 画像アップロード → 別 context で gate 表示 → 誤答 → 正答で入室。
- **IMPLEMENT**:
  ```ts
  import { expect, test } from '@playwright/test';
  import path from 'node:path';

  const SAMPLE_IMAGE = path.resolve(__dirname, 'fixtures/sample.png');
  const PASSWORD = 'e2e-test-password-XYZ';

  test('パスワード保護ルーム — 誤答 / 正答パス', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.goto('/');

    // パスワード保護 checkbox を on
    await page1.getByRole('checkbox', { name: /パスワードで保護する/ }).check();
    // password 入力 (Input[type=password])
    await page1.locator('input[type="password"]').fill(PASSWORD);
    await page1.locator('input[type="file"]').setInputFiles(SAMPLE_IMAGE);
    await expect(page1).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/);
    const sharedUrl = page1.url();

    // 別コンテキストで開く
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(sharedUrl);

    // RoomGate 表示
    await expect(page2.getByRole('heading', { name: /パスワードで保護されています/ })).toBeVisible();

    // 誤答
    await page2.getByLabel('パスワード').fill('wrong');
    await page2.getByRole('button', { name: '入室' }).click();
    await expect(page2.getByText('パスワードが違います')).toBeVisible();

    // 正答
    await page2.getByLabel('パスワード').fill(PASSWORD);
    await page2.getByRole('button', { name: '入室' }).click();
    // ゲート画面が消え、ツールバーが現れる
    await expect(page2.getByRole('toolbar', { name: '編集ツール' })).toBeVisible({ timeout: 10_000 });
  });
  ```
- **MIRROR**: 既存 `apps/web/src/components/room-gate/__tests__/RoomGate.test.tsx` の振る舞い assert を E2E に持ち上げる
- **IMPORTS**: `@playwright/test`, `path`
- **GOTCHA**:
  - `getByLabel('パスワード')` が LocalEditor の checkbox 配下にもあると ambiguous になる。LocalEditor 側は checkbox + "パスワードで保護する" のラベルなので role 区別で分離される
  - RoomGate の `Label` は `'パスワード'` で `Input[type=password]` に紐付く（`apps/web/src/components/room-gate/RoomGate.tsx:64-65`）
- **VALIDATE**: 単独実行緑

#### Task C7: `apps/web/e2e/room-mobile.spec.ts` 新規（モバイル viewport screenshot 回帰）

- **ACTION**: `mobile-chrome` project（`Pixel 5` viewport 393×851）で landing が崩れないこと、ツールバーが overflow しないことを screenshot 回帰でチェック。
- **IMPLEMENT**:
  ```ts
  import { expect, test } from '@playwright/test';

  test('モバイル viewport (Pixel 5) でランディングがレイアウト崩れしない', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('toolbar', { name: '編集ツール' })).toBeVisible();
    // 初回実行時は --update-snapshots で生成
    await expect(page).toHaveScreenshot('landing-mobile.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02, // 2% 以下の差は許容（フォントレンダ揺れ）
    });
  });
  ```
- **MIRROR**: `apps/web/e2e/landing.spec.ts:38-50` の viewport 切替パターン（ただし Pixel 5 emulation は `projects` で適用済み）
- **IMPORTS**: `@playwright/test`
- **GOTCHA**:
  - **screenshot snapshot の生成**: 初回は `pnpm -F @snap-share/web test:e2e --update-snapshots` で生成。生成された PNG (`apps/web/e2e/room-mobile.spec.ts-snapshots/landing-mobile-mobile-chrome-darwin.png`) を commit
  - CI（Linux） とローカル（macOS / Windows）で snapshot が分岐する。`maxDiffPixelRatio: 0.02` で吸収するが、CI 用の `-linux.png` を別途生成する必要がある場合あり。Playwright は OS suffix を自動付与
  - フォントが OS 依存。CI で Pages preview を screenshot 取るのが理想だが、ここではローカル dev でいい
- **VALIDATE**: 1 回目で snapshot 生成 → 2 回目以降緑

#### Task C8: `useAnnotationsStore` か `useYjsAnnotationsStore` に E2E 用 window debug expose を追加

- **ACTION**: room-share.spec.ts の page.evaluate 経路を成立させるため、annotations 配列を window に露出（dev/test mode のみ）。
- **IMPLEMENT**:
  ```ts
  // apps/web/src/hooks/useYjsAnnotationsStore.ts（最も外側 hook の最後付近）
  // E2E 専用: production build には含めない
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    useEffect(() => {
      (window as unknown as { __SNAP_SHARE_ANNOTATIONS__?: Annotation[] }).__SNAP_SHARE_ANNOTATIONS__ =
        store.annotations;
    }, [store.annotations]);
  }
  ```
- **MIRROR**: なし（新規パターン、本フェーズの最小コード変更の中で唯一の「観測フック」）
- **IMPORTS**: 既存（`useEffect`, `Annotation` 型）
- **GOTCHA**:
  - import.meta.env.DEV は Vite 標準。production build では false なので tree-shaken される
  - `store.annotations` の参照を直接渡すので、Yjs の `Y.Array` の場合は `.toArray()` 必要
  - **より小さいパッチ**: `useAnnotationsStore` のローカル版にも同じ expose を入れて E2E 経路を統一する
- **VALIDATE**: `pnpm -F @snap-share/web build` の bundle に `__SNAP_SHARE_ANNOTATIONS__` 文字列が含まれないこと（grep `apps/web/dist/assets/*.js` で確認）

#### Task C9: CI で E2E が緑になることを確認

- **ACTION**: GitHub Actions の `e2e` job が両 webServer 起動 + 5 spec × 2 project = 10 ケース（既存 6 + 新規 4 で = 10、screenshot は最初は `--update-snapshots` を別途）を回す。
- **IMPLEMENT**:
  - `.github/workflows/ci.yml:48-50` の `pnpm turbo run test:e2e` はそのまま動くはず（playwright.config.ts に依存）
  - Playwright install は `--with-deps chromium` で chromium のみ install しているので、mobile-chrome（実体は chromium emulation）も同じ chromium で動く
- **MIRROR**: 既存 ci.yml 構造
- **IMPORTS**: なし
- **GOTCHA**:
  - **wrangler dev の cold start**: CI では `pnpm install` 後に初めて `pnpm -F @snap-share/api dev` が走る。catalog 経由のビルド + miniflare 起動で 30〜60s かかる可能性。`webServer.timeout: 90_000` で吸収
  - `BYPASS_TURNSTILE=true` を Playwright `webServer.env` で渡しているので CI でも Turnstile siteverify を呼ばずに済む
  - screenshot snapshot が CI で初回失敗する可能性 → 初回は `--update-snapshots` で local 生成 → commit → CI で照合の流れにする
- **VALIDATE**: CI green。失敗時は artifact `playwright-report/` から HTML レポートを開く

---

### Track D — Phase 7 review LOW の刈り取り

#### Task D1: LOW-2 — `VITE_CF_ANALYTICS_TOKEN` の JS 文字列脱出を sanitize

- **ACTION**: `apps/web/index.html:33-44` の token 注入を、不正文字を削るパスに変更。
- **IMPLEMENT**:
  ```html
  <script>
    (() => {
      // VITE_CF_ANALYTICS_TOKEN は CF が払い出す英数字 + ハイフン/アンダースコア。
      // フォーク時に誤って引用符等が混入しても JS 文字列脱出が起きないよう sanitize。
      const tRaw = "%VITE_CF_ANALYTICS_TOKEN%";
      const t = tRaw.replace(/[^A-Za-z0-9_\-]/g, "");
      if (!t || tRaw.startsWith("%")) return;
      const s = document.createElement("script");
      s.defer = true;
      s.src = "https://static.cloudflareinsights.com/beacon.min.js";
      s.setAttribute("data-cf-beacon", JSON.stringify({ token: t }));
      document.body.appendChild(s);
    })();
  </script>
  ```
- **MIRROR**: 既存 `apps/web/index.html:30-44` の小さな inline script
- **IMPORTS**: なし
- **GOTCHA**:
  - Cloudflare Web Analytics token は base62 + `_` `-` のみ（実観測）。replace で空文字になることは無い
  - `tRaw.startsWith("%")` は dev で env が空のときの「`%VITE_CF_ANALYTICS_TOKEN%`」プレースホルダ残置を検出する既存ロジック。これは保持
- **VALIDATE**: `pnpm -F @snap-share/web build` で `apps/web/dist/index.html` に sanitize 後の token が `JSON.stringify` 経由で埋まっていることを確認

#### Task D2: LOW-3 / LOW-4 を `docs/observability.md` に follow-up として記録

- **ACTION**: B5 で実施済み（タスク内包）
- **IMPLEMENT**: B5 と同じ
- **MIRROR**: ADR follow-up format
- **IMPORTS**: なし
- **GOTCHA**: B5 で記述したことと矛盾しないように
- **VALIDATE**: docs/observability.md の `## Follow-ups` 章で 2 項目（LOW-3 / LOW-4）が確認できる

---

### Track E — PRD / README / CONTRIBUTING の追従

#### Task E1: PRD のフェーズ表を `pending → in-progress` に更新

- **ACTION**: `.claude/PRPs/prds/snap-share.prd.md:196` の Phase 7.5 行を更新
- **IMPLEMENT**:
  ```md
  | 7.5 | 本番プロビジョニング + 観測 + E2E 拡充 | Cloudflare 本番リソース確定 + KPI/ダッシュボード設計 + クリティカルパス E2E | in-progress | - | 7 | [phase-7.5-production-provisioning.plan.md](../plans/phase-7.5-production-provisioning.plan.md) |
  ```
- **MIRROR**: PRD 内の他フェーズ行の format
- **IMPORTS**: なし
- **GOTCHA**: テーブル整列はそのまま
- **VALIDATE**: `grep "Phase 7.5" .claude/PRPs/prds/snap-share.prd.md` がリンクを含む

#### Task E2: README.md / CONTRIBUTING.md にデプロイ運用フローを反映

- **ACTION**: A7 で確定した運用方針（推奨: 手動 `wrangler deploy` + Pages Git 連携）を README / CONTRIBUTING に反映、`docs/observability.md` へのリンクを README に追加
- **IMPLEMENT**:
  - `README.md` Production deploy 章末尾に `> 運用フローと観測 KPI は [docs/observability.md](./docs/observability.md) を参照。`
  - `CONTRIBUTING.md` に「本番デプロイ」セクションを追加（オーナーのみが触る、PR 作者は `wrangler deploy` を呼ばない、等）
- **MIRROR**: 既存 README / CONTRIBUTING の章立て
- **IMPORTS**: なし
- **GOTCHA**: 既存の `# → 出力された ID を apps/api/wrangler.toml の `[[kv_namespaces]] id = "..."` に貼る` コメントは A2 で確定値が入る前提なので、README からは「初回セットアップ手順」として残しつつ「現在の本番値」は別の場所（運用ノート / 個人 password manager）にしまう
- **VALIDATE**: `pnpm lint` / `markdownlint` 緑（リポジトリで使っていなければ目視）

#### Task E3: PRD 末尾の Decisions Log に「自動デプロイ vs 手動デプロイ」「`.env.production` commit 可否」を追加

- **ACTION**: A7 / A4 の判断結果を 1 行ずつ追記
- **IMPLEMENT**:
  ```md
  | 本番デプロイ運用 | **手動 `wrangler deploy` (API) + Pages Git 連携 (Web)** | main auto-deploy via GitHub Actions | 個人開発で push 直後の prod 反映が早すぎるリスクを避け、API 側のみ手動。Web は静的なので Pages Git 連携で安全 |
  | `.env.production` の commit | **commit せず Pages build env のみで管理** | リポジトリにコミットして履歴で追跡 | site key / analytics token は public bundle に焼かれるので秘匿性は低いが、URL を晒す副作用を避けるため Pages settings で管理。`.env.example` にエントリは残す |
  ```
- **MIRROR**: PRD 既存 Decisions Log の format
- **IMPORTS**: なし
- **GOTCHA**: 既存テーブルの列幅と揃える
- **VALIDATE**: PRD で grep して整合

---

## Testing Strategy

### Unit / Integration（**追加なし**）

本フェーズはコード変更を最小化する方針なので vitest スイートに新テストは増えない。`/healthz` 追加（C2）も「smoke だけ通っていればよい」ため、既存 OpenAPI snapshot test が無いことを前提にテストは省略。仮に追加するなら 1 件のみ:

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `GET /healthz` | `app.request('/healthz')` | 200 / `text/plain: 'ok'` | No |

### E2E（C で追加）

| Spec | Project | Critical Path |
|---|---|---|
| `landing.spec.ts`（既存） | chromium + mobile-chrome | UI smoke |
| `room-create.spec.ts` | chromium | 画像 → `/r/:id` → PNG export ボタン enabled |
| `room-share.spec.ts` | chromium | 2 context 同期、矩形が peer に伝播 |
| `room-protected.spec.ts` | chromium | 誤答 / 正答 / RoomGate |
| `room-mobile.spec.ts` | mobile-chrome | screenshot 回帰 |

### Manual / Operational（A / B でカバー）

- 本番 URL での D&D / 共有 / PNG export を手動で 1 周
- `wrangler tail` で `[api] room created` / `rate limit hit` / `turnstile verify failed` を実機観測
- Cloudflare Web Analytics ダッシュボードで 24h 後に Page View が増えていることを確認

### Edge Cases Checklist

- [x] 空入力（password 空 → unprotected として扱う、既存 normalizePassword）
- [x] 最大サイズ（10 MiB の境界 → Phase 2 で実装済、E2E 範囲外）
- [x] Turnstile token 無し（dev は BYPASS=true で素通し、prod は 401）
- [x] Rate limit ヒット（dogfood 中の手動観測でカバー）
- [x] パスワード誤答 / 正答（C6 でカバー）
- [x] WebSocket 再接続（既存実装で対応、E2E は 200ms 反映までを assert）
- [ ] DO Hibernation 復帰（dogfood で実観測、E2E で flake 化するため除外）
- [ ] R2 障害（fail-open 経路は手動 `wrangler tail` で確認）

---

## Validation Commands

### Static Analysis

```sh
pnpm typecheck
```
EXPECT: 全 4 workspace 0 error

```sh
pnpm lint
```
EXPECT: biome ci 緑

### Unit / Integration Tests

```sh
pnpm test
```
EXPECT: 既存件数 ± 数件（C2 で `/healthz` テスト追加した場合のみ +1）

### E2E

```sh
# ローカル（screenshot 初回生成）
pnpm -F @snap-share/web test:e2e -- --update-snapshots

# 通常実行
pnpm -F @snap-share/web test:e2e
```
EXPECT: 5 spec × 2 project の組み合わせで該当する分が緑（landing は両 project / room-mobile は mobile-chrome のみ / 残り 3 は chromium のみ → 合計 8 ケース）

### Build

```sh
pnpm build
```
EXPECT: vite build 成功 + wrangler --dry-run 緑、`apps/web/dist/index.html` に sanitize 済み analytics token、`apps/api/dist/` に worker bundle

### Production Deploy（実機検証）

```sh
# A1: provision
wrangler r2 bucket create snap-share-images
wrangler kv namespace create IMAGE_BLOCKLIST   # 出力 ID を A2 で wrangler.toml へ
wrangler secret put ROOM_TOKEN_SECRET
wrangler secret put TURNSTILE_SECRET_KEY

# A6: API deploy
cd apps/api && pnpm wrangler deploy

# A6: smoke
curl -i https://snap-share-api.<account>.workers.dev/healthz   # → 200 ok
curl -i https://snap-share-api.<account>.workers.dev/rooms/non-existent   # → 404 envelope

# A6: production E2E（手動）
# https://snap-share.pages.dev で D&D → /r/:id → 別ブラウザで開く → 注釈追加 → PNG 保存

# B3: tail
wrangler tail snap-share-api --format=pretty
```
EXPECT:
- `wrangler kv namespace list` に `IMAGE_BLOCKLIST` が並ぶ
- `wrangler secret list` に 2 secret（`ROOM_TOKEN_SECRET`, `TURNSTILE_SECRET_KEY`）
- 本番 URL で D&D → URL 取得 → 別タブ参加 → PNG export がすべて手動で動く
- `wrangler tail` に `[api] ` 付きログが流れる

### Manual Validation Checklist

- [ ] A1〜A6 完了で本番リソースが alive
- [ ] `apps/api/wrangler.toml` から `REPLACE_WITH_PRODUCTION_*` が消えている
- [ ] `apps/web/.env.production` 5 変数が揃う（または Pages build env で揃う）
- [ ] `pnpm test:e2e` ローカルで緑
- [ ] CI の `e2e` job が main 緑
- [ ] `docs/observability.md` が PR-merge 可能（章立て / KPI 表 / SLO / クエリ集 / follow-up）
- [ ] PRD のフェーズ表が `in-progress`、Decisions Log に 2 行追加
- [ ] LOW-2 の `JSON.stringify` 化が `apps/web/index.html` に反映
- [ ] LOW-3 / LOW-4 が docs/observability.md follow-up に記載
- [ ] 本番 URL で D&D → 共有 → 別ブラウザ参加 → PNG export が手動で 1 周

---

## Acceptance Criteria

- [ ] Track A 全 7 タスク完了（A1 R2/KV/RL provision、A2 wrangler.toml 確定、A3 Turnstile + secrets、A4 .env.production、A5 Pages、A6 API deploy、A7 運用フロー確定）
- [ ] Track B 全 5 タスク完了（B1 KPI、B2 SLO、B3 tail クエリ、B4 CF Web Analytics 設定、B5 follow-up 記録）
- [ ] Track C 全 9 タスク完了（C1 multi-process webServer、C2 /healthz、C3 fixture、C4-C7 4 spec、C8 window expose、C9 CI 緑）
- [ ] Track D 全 2 タスク完了（D1 sanitize、D2 follow-up 記録）
- [ ] Track E 全 3 タスク完了（E1 PRD status、E2 README/CONTRIBUTING、E3 Decisions Log）
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e` がすべて緑
- [ ] 本番 URL で手動チェックリスト全項目チェック

## Completion Checklist

- [ ] コード変更が最小（diff の主な比重は E2E spec とドキュメント）
- [ ] エラーハンドリングは既存パターン（`AppError` / `errorEnvelope`）を流用、新規例外型は導入しない
- [ ] ログ structure は既存（`logger.warn(msg, meta)`）を継続、新規 `logger.info` は **追加しない**
- [ ] Playwright spec は role + accessible name 主体（CSS / data-testid 不使用）
- [ ] `docs/observability.md` の章立てが既存 ADR / spike report と整合
- [ ] PRD / README / CONTRIBUTING のクロスリファレンスが切れていない（grep で確認）
- [ ] `apps/web/dist` の最終 bundle に `__SNAP_SHARE_ANNOTATIONS__` 文字列が含まれない（dev/test 限定 expose の確認）
- [ ] Phase 7 review LOW 全 4 件の処遇が「解消 / docs 化 / 実機 follow-up」のいずれかに整理されている
- [ ] dogfood 開始ゲート（A 完了 + B 完了）を満たす

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cloudflare Pages の monorepo build で pnpm catalog が読めない | M | H | `PNPM_VERSION=10` / `NODE_VERSION=22` を Pages env に明記。失敗ログから即発見可能 |
| Turnstile widget の Allowed hostnames 設定漏れで本番だけ siteverify fail | M | H | A3 の widget 作成時に `snap-share.pages.dev` を必ず登録。`wrangler tail \| grep "turnstile verify failed"` で即発見 |
| Playwright multi-process webServer の API cold start で flake | M | M | `webServer.timeout: 90_000`、CI `retries: 2`、`/healthz` を readiness probe に使う |
| screenshot snapshot が CI（Linux）とローカル（macOS）で乖離 | H | L | `maxDiffPixelRatio: 0.02` で吸収、CI 用 `-linux.png` を別途生成して commit |
| `apps/web/.env.production` を誤って commit / 漏洩 | L | M | `.gitignore` に追加、Pages build env で管理する方針を Decisions Log で確定 |
| `wrangler secret put` に貼り付けた値が誤入力 | L | H | `wrangler secret list` で名前は確認可能、値は不可。最終的には本番 URL で動作確認 |
| dogfood 中に LOW-3 / LOW-4 の対応が再必要化 | M | L | follow-up に記録済、トリガー条件（週次 5 件以上 / tail で token 漏出）も明記 |
| Yjs `window.__SNAP_SHARE_ANNOTATIONS__` の expose が production bundle に混入 | L | M | `import.meta.env.DEV` 判定 + `pnpm build` 後の bundle grep で確認 |
| Cloudflare Pages の build root 設定で workspace 解決失敗 | M | H | Root を `(空)` にする、build command で `pnpm -F @snap-share/web build` を明示。詳細は A5 の Gotcha |
| 自動デプロイを採った場合の壊れたコード即 prod 反映 | L | H | 推奨は手動運用。仮に auto を採るなら `needs: e2e` を必ず設定 |

## Notes

- **本フェーズの本質はコードよりオペレーション**: 純粋な行数で見ると plan の 70% が実機操作とドキュメント、コードは 30%。Plan レビュー時にこの比重に違和感を持たないでほしい。
- **`docs/observability.md` の位置付け**: 既存 ADR ではない（決定の記録ではなく運用記録）。場所は `docs/observability.md` でフラット。`docs/adr/` 配下には置かない。
- **Phase 8 dogfood 開始ゲート**: A 全完了 + B 全完了。C と D は dogfood 開始後に追従しても良い（C は CI 経由の回帰検知、D はコード差分とドキュメント）。
- **Confidence 6/10 の理由**: コード比重が低い分、不確実性は実機オペに集中する。Cloudflare ダッシュボードの UI 変更や DNS 反映待ちなど plan で予測できない時間が含まれる。Phase 7（confidence 7）より低い。
- **dogfood で見つかった問題は本フェーズで先回り対応しない**: NOT Building セクションに明記の通り。観測手段を整えるところまでが Phase 7.5 の責務。

