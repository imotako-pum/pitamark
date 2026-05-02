# Plan: Phase 7 — 公開準備（スパム対策 + Cloudflare Analytics + ドキュメント整備 + Pages デプロイ）

## Summary

snap-share を「個人開発者として恥ずかしくない状態」で公開できるように仕上げる。具体的には (1) 公開 URL に対する 4 系統のスパム/悪用緩和（Cloudflare Workers Rate Limiting binding でルーム作成と認証エンドポイントの IP レート制限、Cloudflare Turnstile invisible widget でルーム作成時の機械的トラフィック弾き、画像 SHA-256 ハッシュベースのブラックリスト、`extractClientIp` を骨抜きにしないログ集約）、(2) Cloudflare Web Analytics の cookieless スニペット注入（GDPR/PIPC ノンブロッキング）、(3) `README.md` の本番モード対応、`CONTRIBUTING.md` / `LICENSE`（MIT）/ Issue Template / PR Template の追加、(4) `apps/web` の Cloudflare Pages デプロイと `apps/api` の `wrangler deploy`（カスタムドメイン or `*.workers.dev`）まで。Phase 6 で `og:url` / `og:image` を本番ドメイン確定後に差す TODO が残っているのもこの phase で吸収する。

## User Story

As a snap-share の オーナー兼初期ユーザー兼サポーター,
I want 自分が業務で 24/7 使える本番環境を Cloudflare 上に持ち、URL がスパマーに弾を込められても (a) ルーム量産で R2 を埋められない、(b) 一度悪用された画像 (例: 既知のフィッシング素材) を再アップロードでブロックできる、(c) どの程度のトラフィックが来ているか cookieless で計測できる、状態にしたい。同時に、OSS として GitHub に公開しても README 1 枚で誰でも `pnpm install && pnpm dev` から始められる、ライセンス/コントリビュート方針/PR テンプレが揃った最低限の体裁を整えたい,
So that PRD の Success Metrics 「月額インフラコスト ≤ $30」「ルーム作成→共有→2人目アクセス到達率 30%」「初期 LCP ≤ 2s」を本番計測フェーズ (Phase 8 dogfood) に持ち込めて、かつ snap-share という名前で他人に URL を渡しても恥ずかしくない.

## Problem → Solution

### Current（Phase 6 完了時点）

- **本番デプロイ手段なし**: `apps/api/package.json` の `build` は `wrangler deploy --dry-run --outdir dist` のみ、`wrangler deploy` は手元から走らせていない。Cloudflare Pages 側にも `apps/web` のプロジェクトが存在しない。R2 バインディング `IMAGES` は `bucket_name = "snap-share-images"` を指すが本番バケット未作成。
- **公開 URL のスパム対策ゼロ**: `POST /rooms`（multipart 画像アップロード、認証不要）と `POST /rooms/:id/auth`（パスワード総当り対象）が両方とも IP / トークンレス。`y-durableobjects` の WS upgrade も同様に無防備。Phase 5 の Decisions Log で「PBKDF2 210k iter が事実上の rate limit」と書いたが、これは `auth` だけで、`POST /rooms` の bulk room creation には何も効かない。
- **画像ブラックリスト無し**: `r2-image-storage.putImage` は MIME / size のみ検証。同一画像（フィッシング素材、児童保護違反等）が再アップロードされても検出経路がない。
- **アナリティクス未設定**: `apps/web/index.html` に Cloudflare Web Analytics スニペットが無い。Phase 5/6 の機能の実トラフィックを観測する手段がない。
- **README 古い**: `README.md` (99 行) は Phase 2 までの API 仕様しか書いていない。`/rooms/:id/auth`、`/sync/:id`、PNG エクスポート、TTL、shadcn UI に言及なし。本番デプロイ手順 (`wrangler deploy`、Pages link、secret 投入、R2 bucket create) もない。
- **OSS 体裁不在**: `LICENSE` / `CONTRIBUTING.md` / `.github/ISSUE_TEMPLATE/` / `.github/PULL_REQUEST_TEMPLATE.md` がいずれも未作成。Decisions Log の「ライセンス未決（OSS方針）」が Phase 7 で決定すべき宿題として残っている。
- **OG/メタ TODO 残置**: `apps/web/index.html` の `<!-- Phase 7 で og:url / og:image を本番ドメイン確定後に追加。 -->` が文字通り残っている。
- **CI が production deploy をしない**: `.github/workflows/ci.yml` は `lint / typecheck / test / build / e2e` で止まり、`main` push の自動デプロイ無し。

### Desired（Phase 7 完了時点）

- **本番疎通**: Cloudflare ダッシュボードで `snap-share-api`（Workers）と `snap-share-web`（Pages）の 2 リソースが alive、production URL（例: `https://snap-share.pages.dev` と `https://api.snap-share.{domain}` or `https://snap-share-api.{account}.workers.dev`）で D&D → ルーム作成 → 別タブ参加 → PNG 保存 → 7 日後 TTL 削除確認、までエンドツーエンドで通る。R2 バケット `snap-share-images` も Cloudflare 上に実在し、`wrangler r2 bucket create` 済。
- **スパム多層防御**:
  - `POST /rooms`: Workers Rate Limit binding `RL_CREATE_ROOM`（5 req / 60s per CF-Connecting-IP）+ Turnstile invisible widget 必須。Turnstile token がなければ 401（dev では `BYPASS_TURNSTILE=true` で素通し）。
  - `POST /rooms/:id/auth`: Workers Rate Limit binding `RL_AUTH`（10 req / 60s per `${roomId}:${ip}` key）。PBKDF2 自体の 210k iter と組み合わせて bot 総当りを実用上不可能に。
  - 画像 SHA-256: `room-service.create` 内で `crypto.subtle.digest('SHA-256', bytes)` でハッシュ化、KV ベースのブラックリスト `IMAGE_BLOCKLIST` (key: hex digest, value: ブロック理由) に存在すれば 422 UNPROCESSABLE_ENTITY「この画像は使用できません」を返す（新規エラーコード追加）。`RoomStored.image` に `sha256` フィールドを追加して既存ルームの後追い掃除を可能に。
  - WebSocket `/sync/:id`: 既存 token 検証に加え、保護ルームでない場合は `RL_SYNC`（30 connect / 60s per IP）をかける。token 有り = 既に PBKDF2 を通過済なので追加 RL 不要。
- **Analytics**:
  - `apps/web/index.html` 末尾に Cloudflare Web Analytics の cookieless ビーコン (`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"..."}'>`) を `VITE_CF_ANALYTICS_TOKEN` 環境変数経由で注入。`vite-plugin-html` を入れるほどでもないので、`index.html` 内の小さな `<script type="module">` で `import.meta.env` を読む形にする。
- **OSS 体裁**:
  - `LICENSE` (MIT、author = imotako-pun, year = 2026)。Decisions Log で「OSS方針」を MIT に確定。
  - `CONTRIBUTING.md`（日本語、PR/Issue ガイドライン、PRP ワークフロー、`pnpm install && pnpm dev` の最短セットアップ、Conventional Commits）。
  - `.github/ISSUE_TEMPLATE/bug_report.md` / `feature_request.md`（日本語）。
  - `.github/PULL_REQUEST_TEMPLATE.md`（日本語、Test plan / 対応 PRD phase / スクリーンショット欄）。
- **README 全面改訂**:
  - 冒頭にデモ GIF プレースホルダ（Phase 8 で差し込み）と `https://snap-share.pages.dev` リンク。
  - Phase 2/2.5/3/4/5/6 すべての API 仕様を反映（`/rooms/:id/auth`、`/sync/:id`、PNG export、TTL）。
  - 本番デプロイ手順章（`wrangler r2 bucket create` → `wrangler secret put` × 2 (`ROOM_TOKEN_SECRET`, `TURNSTILE_SECRET_KEY`) → `wrangler kv namespace create IMAGE_BLOCKLIST` → `wrangler deploy` → Pages 接続 → `VITE_API_URL` / `VITE_API_WS_URL` / `VITE_TURNSTILE_SITE_KEY` / `VITE_CF_ANALYTICS_TOKEN` 設定）。
- **OG/メタ確定**: `index.html` の placeholder TODO を消し、`og:url = https://snap-share.pages.dev`（or 確定した production URL）、`og:image = https://snap-share.pages.dev/og-image.png` に。Phase 6 で作成した `apps/web/public/og-image.png` を流用。
- **CI 拡張（オプショナル）**: `.github/workflows/deploy.yml` を追加し、`main` push で Pages preview comment & Workers deploy。本番 secret は GitHub Actions secrets に格納。**Phase 7 の MUST スコープには「ローカルから手動 `wrangler deploy` できる」ことのみを含め**、auto-deploy は Should 扱いとし、時間が許せば実装する。

### 受け入れ条件（Acceptance）

- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e` / `pnpm build` がすべて緑（Phase 6 比で +30〜45 件のテスト）。
- `wrangler deploy` (apps/api) と Cloudflare Pages（apps/web）両方がデプロイ済で、本番 URL で D&D → 共有 → 2 人目参加 → PNG export → 7 日 TTL の一連が動く。
- `POST /rooms` を 6 連打すると 6 発目で 429 が返る（手動 curl で確認）。
- 既知ハッシュをブラックリスト KV に PUT した画像をアップロードすると 422 が返る（手動 curl で確認）。
- Cloudflare Web Analytics ダッシュボードに本番アクセスが現れる（ビーコン有効）。
- README 1 枚で他者が `pnpm install && pnpm dev` できる（友人 1 人に試してもらう手動チェック）。

## Metadata

- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/snap-share.prd.md`
- **PRD Phase**: Phase 7 — 公開準備（pending → in-progress 化）
- **Depends on**: Phase 5（complete: パスワード保護 + DO Alarm TTL）、Phase 6（complete: PNG export + shadcn UI）
- **Parallel with**: なし（Phase 8 dogfood は本 phase 完了後）
- **Estimated Files**: 約 18 ファイル新規 + 14 ファイル更新
- **Estimated LOC**: 約 1100〜1500 行（`README.md` の大幅追記とドキュメント類で 600 行程度、コードは 500〜900 行）
- **Confidence**: **7/10** — Cloudflare 各機能はドキュメント化された API のみ、本番 R2/KV 命名と Pages の build root 指定の摩擦が想定される。Turnstile dev/prod のキー切替と `BYPASS_TURNSTILE` フラグの test カバレッジが Phase 7 で初挑戦の領域。

---

## UX Design

### Before（Phase 6 完了時点）

```
┌─────────────────────────────────────────────────────────┐
│  http://localhost:5173/                                  │
│  ├─ 画像 D&D → /r/{id} 即遷移                              │
│  ├─ パスワード保護 + PNG export まで OK（Phase 5/6）       │
│  └─ Turnstile / RL / SHA blocklist ZERO                  │
│                                                          │
│  本番デプロイ: 不可（README に手順なし、bucket 未作成）       │
│  Analytics: 計測手段なし                                   │
│  ライセンス: 未決                                           │
└─────────────────────────────────────────────────────────┘
```

### After

```
┌─────────────────────────────────────────────────────────┐
│  https://snap-share.pages.dev/                           │
│  ├─ 画像 D&D → Turnstile invisible verify                │
│  │   └─ token 込みで POST /rooms → 201                  │
│  │       (RL: 5 req/60s/IP, SHA blocklist チェック)      │
│  ├─ /r/{id} 通常編集（既存）                                │
│  ├─ Cloudflare Web Analytics 計測                        │
│  └─ <head> に og:url / og:image 確定                     │
│                                                          │
│  GitHub:                                                 │
│  ├─ README に本番デプロイ手順 + API 仕様完全版              │
│  ├─ LICENSE (MIT) / CONTRIBUTING.md / Issue Template     │
│  └─ /.github/PULL_REQUEST_TEMPLATE.md                    │
│                                                          │
│  攻撃者目線:                                                │
│  ├─ POST /rooms 1万連打 → 6 発目以降 429 (60s rolling)     │
│  ├─ パスワード総当り → 11 発目以降 429                      │
│  ├─ 既知フィッシング画像再up → 422 UNPROCESSABLE_ENTITY    │
│  └─ サンドボックス WS 大量接続 → 31 発目以降 429            │
└─────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| トップページ アップロード（無人検証） | フォーム送信のみ | Turnstile invisible widget が裏で score 取得 → 失敗時はチャレンジ表示 → token を `cf-turnstile-response` フィールドに同梱 | UI 上は既存の D&D / paste 体験を変えない。失敗時のみチャレンジモーダル |
| `POST /rooms` レスポンス | 201 / 400 / 413 / 415 | 上記 + 401 (Turnstile 無効) / 422 (画像ブロックリスト) / 429 (レート超) | クライアントは `dispatch /rooms` 失敗時に reason をユーザーに提示 |
| `POST /rooms/:id/auth` レスポンス | 200 / 400 / 401 / 404 | 上記 + 429 | 既存 RoomGate に「しばらく経ってから試してください」表示パスを追加 |
| `/sync/:id` WebSocket（未保護ルーム） | 200 upgrade / 404 / 401(token) | 上記 + 429（per IP burst） | 既存 reconnect ロジックは exponential backoff なので CWI と相性良 |
| 本番ドメイン | なし | `https://snap-share.pages.dev` (or カスタム) | OG / Twitter Card preview がリンクから出る |
| README | Phase 2 までの API のみ | 全 phase API + Setup（Local/Prod）+ デプロイ + ライセンス | 個人開発者が 1 read で全体把握できる |
| オフライン体裁 | LICENSE/CONTRIBUTING なし | MIT + 日本語 CONTRIBUTING + Issue/PR Template | OSS 公開最低限の体裁 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `apps/api/wrangler.toml` | all | `[[ratelimits]]` / `[[kv_namespaces]]` / `[vars]` / migration の追加位置、既存 v1+v2 migration を壊さない範囲 |
| P0 (critical) | `apps/api/src/lib/bindings.ts` | all | Bindings 型に RL / KV / Turnstile secret を追加。既存 `Bindings` JSDoc コメント慣習 |
| P0 (critical) | `apps/api/src/routes/rooms.ts` | all | `POST /rooms` / `POST /rooms/:id/auth` の chained `.openapi(...)` パターン、validation hook、middleware 挿入ポイント |
| P0 (critical) | `apps/api/src/services/room-service.ts` | all | `create(file, password?)` のロールバック付き put フロー、SHA-256 計算とブラックリスト検査の合流点 |
| P0 (critical) | `apps/api/src/lib/error.ts` | all | `ErrorCode` union、`AppError` クラス、`AppErrorStatus` の status union（`422` / `429` 追加） |
| P0 (critical) | `apps/api/src/yjs.ts` | all | `syncRoute.use('/:id', ...)` middleware に未保護時の RL 追加位置 |
| P0 (critical) | `packages/shared/src/room.ts` | all | `RoomImageSchema` に `sha256?: string` 追加。後方互換: 既存 R2 メタを読むときは optional |
| P0 (critical) | `apps/web/src/lib/api-client.ts` | all | `createRoom` に `turnstileToken` を渡す経路、429 / 422 / 401 のハンドリング分岐 |
| P0 (critical) | `apps/web/index.html` | all | OG TODO 解消、Cloudflare Analytics ビーコン挿入、Turnstile script 追加 |
| P0 (critical) | `README.md` | all | 全面改訂対象。既存 Phase 2 API 仕様だけ残して Phase 5/6 を追記 |
| P1 (important) | `apps/api/src/__tests__/helpers/build-env.ts` | all | RL / KV / Turnstile bypass のテスト用デフォルトを追加する場所 |
| P1 (important) | `apps/api/src/__tests__/rooms.test.ts` | all | 既存 multipart テストパターン。429 / 422 / Turnstile 無効パス追加 |
| P1 (important) | `apps/api/src/storage/r2-image-storage.ts` | all | `putImage` の前後に SHA 計算と blocklist 検査を入れる位置の判断材料 |
| P1 (important) | `apps/api/src/services/__tests__/room-service.test.ts` | all | service レベルのテスト追加用 |
| P1 (important) | `apps/web/src/pages/EditorPage.tsx` | all | Turnstile widget の mount 位置、ボタン disabled の条件 |
| P1 (important) | `.github/workflows/ci.yml` | all | 自動デプロイ追加（Should）の参考 |
| P1 (important) | `.claude/PRPs/plans/completed/phase-5-password-protection-ttl.plan.md` | 1100-1135 | Phase 7 に「Turnstile / IP rate limit」「Phase 7 で再確認」と記された決定の継承 |
| P2 (reference) | `.claude/rules/web/security.md` | all | CSP / SRI / HSTS / Permissions-Policy のチェックリスト |
| P2 (reference) | `.claude/rules/common/security.md` | all | secret 管理、入力検証、CSRF の前提 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Cloudflare Workers Rate Limiting binding | https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ | `wrangler.toml` で `[[ratelimits]] name = "RL_X" namespace_id = "1001"` + `[ratelimits.simple] limit = N period = 10/60`。runtime は `await env.RL_X.limit({ key })` で `{ success: boolean }`。**period は 10 or 60 のみ**、key には IP 単独ではなく `${ip}:${path}` のような複合キーを推奨 |
| Cloudflare Turnstile siteverify | https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ | `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` に `{secret, response, remoteip?, idempotency_key?}`（form-urlencoded or JSON）。レスポンス `{success, error-codes}`。client は invisible widget でフォーム自動 token 注入、フィールド名 `cf-turnstile-response` |
| Turnstile dev test keys | https://developers.cloudflare.com/turnstile/troubleshooting/testing/ | site key `1x00000000000000000000AA` (always passes) / secret `1x0000000000000000000000000000000AA` (always passes)。dev/CI で使用、production は本番キーに切替 |
| Cloudflare Pages SPA | https://developers.cloudflare.com/pages/configuration/redirects/ + community 検索結果 | `_redirects` の `/* /index.html 200` は最近 "infinite loop" 検出で無視されることがある。**Pages は 404.html が無ければ自動で SPA fallback** するので、`apps/web/dist/` に `404.html` を作らないだけで動く。明示するなら `_redirects` に `/* /index.html 200` を置きつつ、build 時に `404.html` を削除しない（自動判定優先） |
| Cloudflare Workers KV (blocklist) | https://developers.cloudflare.com/kv/api/read-key-value-pairs/ | `await env.IMAGE_BLOCKLIST.get(hex)` で `string | null`。読み取りは eventual consistent (~60s 伝播) だが、blocklist 用途では十分。`wrangler kv namespace create IMAGE_BLOCKLIST` で作成、`wrangler.toml` に `[[kv_namespaces]] binding = "IMAGE_BLOCKLIST" id = "..."` |
| Cloudflare Web Analytics (cookieless) | https://developers.cloudflare.com/analytics/web-analytics/getting-started/ | `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"abc"}'></script>` を最後尾に挿入。token は dashboard で取得、site URL に紐付く。GA と違って GDPR/PIPC 上は cookie 同意不要 |
| Cloudflare Pages monorepo build | https://developers.cloudflare.com/pages/configuration/build-configuration/ | "Root directory" を `apps/web`、Build command を `pnpm install --frozen-lockfile && pnpm -F @snap-share/web build`、Output directory を `dist`。pnpm support は組み込み |
| `wrangler deploy` for Workers | https://developers.cloudflare.com/workers/wrangler/commands/#deploy | `wrangler deploy` を `apps/api` cwd で実行。secret は `wrangler secret put NAME` でインタラクティブ入力。R2 bucket は `wrangler r2 bucket create snap-share-images`、KV は `wrangler kv namespace create IMAGE_BLOCKLIST` |

```
KEY_INSIGHT: Workers Rate Limiting は CF-Connecting-IP を直接 key にすると同一 NAT 配下の正当ユーザーが共倒れする。`${cfIp}:${path}` のような route 単位キーにしておくと「rooms 作成は制限するが auth はカウント別」の二重制限が同一 IP でも独立に効く。
APPLIES_TO: Task 4（rooms RL）と Task 5（auth RL）と Task 12（sync RL）の key 設計
GOTCHA: `c.req.header('cf-connecting-ip')` は Cloudflare 経由のときのみセット。`wrangler dev` ローカルでは undefined になることがあるので fallback として `c.req.header('x-forwarded-for')` の最初のトークン → `'127.0.0.1'` の順に縮退する。
```

```
KEY_INSIGHT: Turnstile invisible widget はクライアントが意識せず token を `<input name="cf-turnstile-response">` として form に流し込む。FormData で `multipart/form-data` を使う既存の `createRoom` に追加フィールドとして同梱できるので、API 側の Zod スキーマに `'cf-turnstile-response': z.string()` を加えるだけで配線できる（ただしフィールド名にハイフンが入るため zod-openapi の `.openapi({ type: 'string' })` で明示）。
APPLIES_TO: Task 4 / Task 9 / Task 14（client widget）/ Task 16（API スキーマ追加）
GOTCHA: Turnstile token は **single-use** で 5 分で expire。`createRoom` がリトライする場合は新しい token を再取得（`turnstile.reset()` API）。E2E テストでは dev test keys (`1x00...AA`) を使い常に success させる。
```

```
KEY_INSIGHT: 画像 SHA-256 ブラックリストは「アップロード時に計算して照合」だけでなく、**`RoomStored.image.sha256` に保存しておく**ことで、後から「このハッシュをブラックリストに追加」したときに既存ルームの掃除（DO storage delete + R2 image delete）を CLI で一括実行できる。
APPLIES_TO: Task 6（room-service.create に SHA 計算追加）+ Task 7（RoomImageSchema 拡張）+ Task 8（IMAGE_BLOCKLIST KV 検査）
GOTCHA: SHA 計算は `crypto.subtle.digest` で stream 全体を ArrayBuffer に load する必要がある（subtle.digest は streaming 非対応）。`MAX_IMAGE_BYTES = 10 MiB` なので Workers 128MB メモリ制限内で十分。`file.arrayBuffer()` を 1 回呼び、その後 `R2.put(key, buffer, ...)` で put するように `room-service` の signature を `file.stream()` から `file.arrayBuffer()` 経由に変更（ArrayBuffer 渡しは R2 が公式サポート）。
```

```
KEY_INSIGHT: Cloudflare Pages の SPA fallback は「dist/ 内に 404.html が**無い**ことで自動有効化」。Vite の `vite build` は標準では 404.html を作らないので、何もしないだけで OK。`_redirects` の `/* /index.html 200` を明示する場合、infinite loop 警告が出るがビルドは通る（無視される）。**明示派 vs 暗黙派の選択が必要**だが、本 plan は「暗黙（404.html を置かない）」を選び、`apps/web/public/_redirects` を作成しない。
APPLIES_TO: Task 19（Pages デプロイ設定）
GOTCHA: もし将来 `apps/web/public/404.html` を置く必要が出たら、`apps/web/public/_redirects` を `/* /index.html 200` で明示する切替に変更する。本 plan ではコメントで残置。
```

```
KEY_INSIGHT: `wrangler.toml` 内で `[vars]` セクションに dev 値を直接書くと、`wrangler deploy` 時にも production に同じ値が漏れる。`TURNSTILE_SITE_KEY` は public（client にも露出する）なので vars OK だが、`TURNSTILE_SECRET_KEY` は **必ず `wrangler secret put`** で投入。dev 環境は `apps/api/.dev.vars` (gitignored) に書く。
APPLIES_TO: Task 1（wrangler.toml + .dev.vars + Bindings 拡張）
GOTCHA: `.dev.vars` は `.gitignore` に既に含まれているが、CI（GitHub Actions）で test 走らせるときも `.dev.vars` が無いと `BYPASS_TURNSTILE=true` が読めない。テストの `buildEnv` で直接デフォルトを与える + CI では env を全く読まないテストにする（=テスト用 ServerSide 検証スタブを Service DI 経由で差し替え）。
```

---

## Patterns to Mirror

### NAMING_CONVENTION（新規 service / lib）

```ts
// SOURCE: apps/api/src/services/room-service.ts:18-30
export type RoomServiceDeps = {
  images: ImageStorage;
  meta: MetaStorage;
  now: () => number;
  ttlMs: number;
  password: PasswordService;
};
export type RoomService = {
  create(file: File, password?: string): Promise<Room>;
  get(id: string): Promise<Room>;
};
export const createRoomService = (deps: RoomServiceDeps): RoomService => ({ /* ... */ });
```

→ Phase 7 では `createTurnstileService` (`apps/api/src/services/turnstile-service.ts`) と `createImageBlocklistService` (`apps/api/src/services/image-blocklist-service.ts`) を同形で作る。`createXxxService(deps): XxxService` パターン厳守。

### ERROR_HANDLING（AppError + envelope）

```ts
// SOURCE: apps/api/src/services/room-service.ts:52-58
const assertAllowedMime = (type: string): AllowedImageMimeType => {
  if (!isAllowedMime(type)) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type', {
      receivedType: type,
    });
  }
  return type;
};
```

→ Phase 7 では `UNPROCESSABLE_ENTITY`（422、画像ブロックリスト hit）と `RATE_LIMITED`（429、RL hit）を新規 ErrorCode として追加（`apps/api/src/lib/error.ts` の `ERROR_CODES` タプルに append、`AppErrorStatus` union に `422 | 429` 追加）。public message は固定文字列、ユーザー入力は logContext。

### LOGGING_PATTERN

```ts
// SOURCE: apps/api/src/services/room-service.ts:114
logger.info('room created', { id, contentType, size: file.size, protected: !!auth });
// SOURCE: apps/api/src/yjs.ts:91
logger.warn('sync ws denied: missing token', { id, tokenPresent: false });
```

→ Phase 7 では `logger.warn('rate limit hit', { route, ip: redactIp(ip), key })` と `logger.warn('image blocked by hash', { sha256Prefix: hash.slice(0, 8) })`。**IP は full でログに残さない**（個人情報配慮）— 末尾 1 オクテットを `xxx` でマスクする `redactIp` を `apps/api/src/lib/ip.ts` に作る。

### REDACT_IP（新規パターン）

```ts
// 新規: apps/api/src/lib/ip.ts
export const redactIp = (ip: string | null | undefined): string => {
  if (!ip) return 'unknown';
  // IPv4: 1.2.3.4 -> 1.2.3.xxx
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/, '.xxx');
  // IPv6: 2001:db8::1 -> 2001:db8::xxx (last group masked)
  return ip.replace(/[^:]+$/, 'xxx');
};
export const extractClientIp = (req: Request): string => {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  );
};
```

→ 全 RL 経路で `extractClientIp(c.req.raw)` を使い、`logger` には必ず `redactIp(ip)` 経由で出す。

### SERVICE_DI_TEST_PATTERN

```ts
// SOURCE: apps/api/src/__tests__/services/room-service.test.ts (既存パターン)
const password = createPasswordService();
const images = createInMemoryR2();
const meta = createR2MetaStorage(images);
const service = createRoomService({ images: createR2ImageStorage(images), meta, now: () => 0, ttlMs: 1000, password });
```

→ Phase 7 では `TurnstileService` と `ImageBlocklistService` も DI 注入し、テストでは `createStubTurnstile({ alwaysSuccess: true })` / `createStubBlocklist({ blockedHashes: new Set(['abc...']) })` を渡す。

### ZOD_OPENAPI_FORM_FIELD

```ts
// SOURCE: apps/api/src/routes/rooms.ts:18-21
const uploadFormSchema = z.object({
  image: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
  password: z.string().max(256).optional().openapi({ type: 'string' }),
});
```

→ Phase 7 では `'cf-turnstile-response': z.string().min(1).max(2048).openapi({ type: 'string' })` を追加（フィールド名にハイフンが入るため string literal key）。

### TEST_STRUCTURE

```ts
// SOURCE: apps/api/src/__tests__/rooms.test.ts:11-27 (Arrange-Act-Assert)
describe('POST /rooms', () => {
  it('returns 201 with Room JSON when valid PNG is uploaded', async () => {
    const env = buildEnv();
    const form = new FormData();
    form.set('image', pngFile(4));

    const res = await app.request('/rooms', { method: 'POST', body: form }, env);

    expect(res.status).toBe(201);
    const body = (await res.json()) as Room;
    expect(body.id).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });
});
```

→ describe / it / expect、Arrange-Act-Assert、`buildEnv()` で env stub。Phase 7 では `buildEnv({ BYPASS_TURNSTILE: 'true' })` の上書きパターンを追加。

### LOGGER_CONSOLE_GUARD

```ts
// SOURCE: apps/api/src/lib/logger.ts:1
// biome-ignore-all lint/suspicious/noConsole: this module is the single console wrapper for the api
```

→ 新規 `lib/ip.ts` には console を入れず logger 経由で。

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/api/src/lib/ip.ts` | CREATE | `redactIp` + `extractClientIp`（全 RL 経路の共通基盤） |
| `apps/api/src/lib/__tests__/ip.test.ts` | CREATE | redact / extract の純関数テスト |
| `apps/api/src/services/turnstile-service.ts` | CREATE | siteverify 呼び出しを DI 化、`BYPASS_TURNSTILE` 対応 |
| `apps/api/src/services/__tests__/turnstile-service.test.ts` | CREATE | success / error-codes / network failure のテスト |
| `apps/api/src/services/image-blocklist-service.ts` | CREATE | KV 読み取りラッパ、`isBlocked(sha256): Promise<boolean>` |
| `apps/api/src/services/__tests__/image-blocklist-service.test.ts` | CREATE | KV miss / hit / null KV namespace（in-memory stub）テスト |
| `apps/api/src/lib/sha256.ts` | CREATE | `bytesToHex(ArrayBuffer): string` + `sha256Hex(ArrayBuffer): Promise<string>` 純関数 |
| `apps/api/src/lib/__tests__/sha256.test.ts` | CREATE | 既知 fixture（"hello" → e4d909c290d0fb1ca068ffaddf22cbd0...）でラウンドトリップ |
| `apps/api/src/middleware/rate-limit.ts` | CREATE | `withRateLimit({ binding, keyFn, errorContext })` Hono middleware ファクトリ |
| `apps/api/src/middleware/__tests__/rate-limit.test.ts` | CREATE | success path / 429 path / no-binding-passthrough |
| `apps/api/src/routes/rooms.ts` | UPDATE | uploadFormSchema に `'cf-turnstile-response'` 追加、`POST /rooms` ハンドラ前に Turnstile verify と RL middleware を挿入、`POST /rooms/:id/auth` ハンドラ前に RL middleware を挿入 |
| `apps/api/src/services/room-service.ts` | UPDATE | `create(file, password?, turnstileVerifier?, blocklist?, sha?)` ではなく **DI を Deps に追加**: `turnstile: TurnstileService`、`blocklist: ImageBlocklistService`、`sha256: (buf) => Promise<string>`。create 内で `arrayBuffer` 取得 → SHA 計算 → blocklist 検査 → MIME/size 検証 → R2 put（buffer 渡し） |
| `apps/api/src/yjs.ts` | UPDATE | `syncRoute.use('/:id', ...)` 内に未保護ルーム時の RL チェックを追加（保護ルームは token 検証のみで OK） |
| `apps/api/src/lib/error.ts` | UPDATE | `ERROR_CODES` に `'UNPROCESSABLE_ENTITY'` と `'RATE_LIMITED'` 追加、`AppErrorStatus` に `422 \| 429` を union に追加 |
| `apps/api/src/lib/bindings.ts` | UPDATE | `RL_CREATE_ROOM` / `RL_AUTH` / `RL_SYNC` / `IMAGE_BLOCKLIST` / `TURNSTILE_SECRET_KEY` / `BYPASS_TURNSTILE` を追加 |
| `apps/api/src/__tests__/helpers/build-env.ts` | UPDATE | 上記 binding のデフォルト stub を追加（in-memory KV、always-pass RL、bypass Turnstile） |
| `apps/api/src/__tests__/helpers/in-memory-rl.ts` | CREATE | `RateLimit` インターフェイスを満たす in-memory 実装（counter map + period reset） |
| `apps/api/src/__tests__/helpers/in-memory-kv.ts` | CREATE | `KVNamespace` の get/put/delete のサブセット in-memory 実装 |
| `apps/api/src/__tests__/rooms.test.ts` | UPDATE | 既存 24 件保持 + 429 / 422 / Turnstile invalid の 9 件追加 |
| `apps/api/src/__tests__/yjs.test.ts` | UPDATE | 既存 7 件保持 + sync RL の 3 件追加 |
| `apps/api/src/__tests__/images.test.ts` | UPDATE | 既存テストはそのまま、新規 binding が破壊しないことを確認 |
| `apps/api/src/services/__tests__/room-service.test.ts` | UPDATE | SHA 計算ステップ + blocklist 検査 + Turnstile 検査が rollback 正しいことを確認する 4〜5 件追加 |
| `apps/api/wrangler.toml` | UPDATE | `[[ratelimits]]` × 3 / `[[kv_namespaces]]` × 1 / `[vars]` に `TURNSTILE_SITE_KEY` / secret コメントの拡張 |
| `apps/api/.dev.vars.example` | CREATE | `ROOM_TOKEN_SECRET=...` / `TURNSTILE_SECRET_KEY=1x0000...AA` / `BYPASS_TURNSTILE=false` のテンプレ（gitignored ではなく commit 対象、`.dev.vars` 自体は ignore 維持） |
| `packages/shared/src/room.ts` | UPDATE | `RoomImageSchema` に `sha256: z.string().regex(/^[a-f0-9]{64}$/).optional()` を追加（既存メタの後方互換のため optional） |
| `packages/shared/src/__tests__/room.test.ts` | UPDATE | `sha256` 付き / 無し両方のラウンドトリップテスト追加 |
| `apps/web/src/lib/api-client.ts` | UPDATE | `createRoom(file, password, turnstileToken)` に turnstileToken を追加。429 / 422 の reason を返す `CreateRoomResult` discriminated union 化 |
| `apps/web/src/lib/__tests__/api-client.test.ts` | CREATE or UPDATE | 既存があれば 429/422/turnstile-required の reason ハンドリングを追加。なければ新規 |
| `apps/web/src/components/turnstile/TurnstileWidget.tsx` | CREATE | invisible widget の薄いラッパ。`onSuccess(token)` callback、ref 経由で `reset()` 呼び出し可能 |
| `apps/web/src/hooks/useTurnstileToken.ts` | CREATE | site key の有無で no-op / actual widget を切替 + token state 管理 |
| `apps/web/src/pages/EditorPage.tsx` | UPDATE | TurnstileWidget を mount、token を `createRoom` に渡す。token 取得失敗時は upload ボタン disabled |
| `apps/web/src/pages/LocalEditor.tsx` | UPDATE | upload ボタン disabled 条件に turnstile token 未取得を追加 |
| `apps/web/src/components/room-gate/RoomGate.tsx` | UPDATE | 429 reason を「しばらく経ってから試してください」と表示するパスを追加 |
| `apps/web/index.html` | UPDATE | OG TODO 解消（og:url / og:image 確定）、Cloudflare Web Analytics ビーコン追加、Turnstile script `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer>` 追加 |
| `apps/web/.env.example` | CREATE | `VITE_API_URL` / `VITE_API_WS_URL` / `VITE_TURNSTILE_SITE_KEY` / `VITE_CF_ANALYTICS_TOKEN` のテンプレ |
| `apps/web/e2e/landing.spec.ts` | UPDATE | Turnstile dev key で常時 success 状態 → 既存 D&D テストが緑のまま動くことを確認 |
| `apps/web/e2e/export.spec.ts` | UPDATE | 同上 |
| `README.md` | UPDATE | 全面改訂（後述 Task 23） |
| `CONTRIBUTING.md` | CREATE | 日本語、PR/Issue ガイド、PRP ワークフロー、Setup |
| `LICENSE` | CREATE | MIT、author = imotako-pun、year = 2026 |
| `.github/PULL_REQUEST_TEMPLATE.md` | CREATE | 日本語、Test plan / 対応 PRD phase / スクショ |
| `.github/ISSUE_TEMPLATE/bug_report.md` | CREATE | 日本語、再現手順 / 期待結果 / 環境 |
| `.github/ISSUE_TEMPLATE/feature_request.md` | CREATE | 日本語、Problem / Proposal / Alternatives |
| `.github/ISSUE_TEMPLATE/config.yml` | CREATE | blank issues 無効化 + Discussions リンクのみ |
| `.github/workflows/deploy.yml` | CREATE (Should) | `main` push で wrangler deploy + Pages preview。MUST スコープではないが時間が許せば |
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Phase 7 status を pending → in-progress、PRP Plan 列を本 plan ファイルに紐付け、Decisions Log に「ライセンス: MIT 確定」を追記 |
| `docs/adr/ADR-0003-public-launch-defenses.md` | CREATE (Should) | スパム対策の三層構造（RL + Turnstile + 画像ハッシュブロックリスト）の意思決定記録。MUST ではないが Phase 4 の ADR-0002 に倣う |

## NOT Building

- **画像 OCR / 機械的コンテンツモデレーション**（NSFW 判定、PII 自動マスク）: Phase 7 は SHA-256 ベースの「既知の悪い画像」のみ。コンテンツ判定は Phase 8 以降の Could 領域。
- **ユーザー通報機能（report this room）**: PRD `Technical Risks` に「通報機能」とあるが、認証無しの状態で通報フォームを置くとそれ自体がスパム経路になる。better-auth 導入後（Could）に再評価。
- **Cloudflare Workers Logs / Logpush**: 個人開発スコープで月額 +$5/$10 を許容しない。`logger.{info,warn,error}` のままで `wrangler tail` でデバッグ。
- **Privacy Policy / Terms of Service の正式ページ**: README に「No data persistence beyond TTL」「No tracking cookies」の 1 段落だけ書き、専用 LP は Phase 8 dogfood 後の判断。
- **多言語切替 UI**: Phase 6 NOT Building と同じく日本語のみ。`<html lang="ja">` 維持。
- **CSP nonce 配布のための Workers エッジレンダリング**: `apps/web/index.html` は完全 static SPA。CSP は `<meta http-equiv>` で最小限（`script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com`）に留め、nonce ベースは Phase 8 以降。
- **Sentry / Bug tracking SaaS の導入**: ログは Cloudflare ダッシュボードの Workers logs で十分。
- **完全自動デプロイ（GitHub Actions → Pages/Workers prod）**: Should スコープ。MUST はローカルから手動 `wrangler deploy` 1 回が成功すること。
- **WebKit / Firefox の E2E**: Playwright config は Chromium のみのまま（Phase 6 で先送り）。Phase 8 dogfood で実機テストに置換。
- **画像 SHA ブラックリストの管理 UI**: KV PUT は `wrangler kv key put` で運用。Web UI は不要。
- **R2 容量計測のアラート**: PRD の `$30/月` は十分余裕。Phase 8 で実トラフィックを見て判断。
- **Sticky session / cookie ベースの token 配送**: 既存の sessionStorage + WS query token を維持（Phase 5 の決定）。

---

## Step-by-Step Tasks

### Task 1: `apps/api/src/lib/bindings.ts` の Bindings 型拡張

- **ACTION**: Phase 7 で追加する 6 個の binding を `Bindings` 型に追加し、JSDoc で取得手順をコメント。
- **IMPLEMENT**:
  ```ts
  export type Bindings = {
    IMAGES: R2Bucket;
    ROOM_TTL_MS: string;
    Y_ROOM: DurableObjectNamespace;
    ROOM_TOKEN_SECRET: string;

    /** Workers Rate Limiting binding for `POST /rooms`. wrangler.toml: ratelimits.RL_CREATE_ROOM (5 req / 60s). */
    RL_CREATE_ROOM: RateLimit;
    /** Workers Rate Limiting binding for `POST /rooms/:id/auth`. wrangler.toml: ratelimits.RL_AUTH (10 req / 60s). */
    RL_AUTH: RateLimit;
    /** Workers Rate Limiting binding for `/sync/:id` WS upgrades on UNPROTECTED rooms. (30 req / 60s). */
    RL_SYNC: RateLimit;

    /** KV namespace storing SHA-256 hex of blocked images. `wrangler kv namespace create IMAGE_BLOCKLIST`. */
    IMAGE_BLOCKLIST: KVNamespace;

    /** Public site key for Turnstile widget. Safe to commit. */
    TURNSTILE_SITE_KEY: string;
    /** Secret for Turnstile siteverify. `wrangler secret put TURNSTILE_SECRET_KEY`. */
    TURNSTILE_SECRET_KEY: string;
    /** "true" => skip Turnstile verification (dev/CI only). Defaults to "false" in prod. */
    BYPASS_TURNSTILE: string;
  };
  ```
- **MIRROR**: 既存の Bindings JSDoc 慣習（取得手順を `wrangler ...` 形式でコメント）
- **IMPORTS**: `RateLimit` / `KVNamespace` は `@cloudflare/workers-types`（既に devDep）。
- **GOTCHA**: `RateLimit` 型は `@cloudflare/workers-types@^4.20260430` にネイティブ型として export されている。古いバージョンだと無いので package.json 確認。
- **VALIDATE**: `pnpm -F @snap-share/api typecheck` で 0 error。

### Task 2: `apps/api/src/lib/error.ts` に新エラーコード追加

- **ACTION**: `ERROR_CODES` に `'UNPROCESSABLE_ENTITY'` と `'RATE_LIMITED'` を追加、`AppErrorStatus` に 422 と 429 を追加。
- **IMPLEMENT**:
  ```ts
  export const ERROR_CODES = [
    'INVALID_REQUEST',
    'UNSUPPORTED_MEDIA_TYPE',
    'PAYLOAD_TOO_LARGE',
    'NOT_FOUND',
    'UNAUTHORIZED',
    'UNPROCESSABLE_ENTITY', // 画像ブロックリスト等
    'RATE_LIMITED',         // RL hit
    'INTERNAL',
  ] as const;
  type AppErrorStatus = 400 | 401 | 404 | 413 | 415 | 422 | 429 | 500;
  ```
- **MIRROR**: 既存のタプル + status union パターン
- **IMPORTS**: 変更なし
- **GOTCHA**: status 429 は仕様上 `Retry-After` ヘッダを返すのが望ましいが、`HTTPException` のシグネチャに `headers` を渡すパスがない。`onAppError` で AppError → JSON envelope を返す経路のままにする（ヘッダ追加は Phase 8 で）。
- **VALIDATE**: `pnpm -F @snap-share/api typecheck` 緑、`apps/api/src/__tests__/lib/error.test.ts` 既存 + 新規 2 件「`UNPROCESSABLE_ENTITY` / `RATE_LIMITED` envelope」を追加して緑。

### Task 3: `packages/shared/src/room.ts` の `RoomImageSchema` に `sha256` 追加

- **ACTION**: 既存メタの後方互換維持のため optional で追加。
- **IMPLEMENT**:
  ```ts
  export const RoomImageSchema = z
    .object({
      key: z.string().min(1),
      contentType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
      size: z.number().int().positive().max(MAX_IMAGE_BYTES),
      /** SHA-256 hex of the original bytes. Optional for backward-compat with rooms created before Phase 7. */
      sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    })
    .readonly();
  ```
- **MIRROR**: 既存 RoomImageSchema スタイル
- **IMPORTS**: 変更なし
- **GOTCHA**: 既存の R2 メタには `sha256` フィールドが無い → optional で読み込み時に undefined。書き込み時は Phase 7 以降は必ず付与。
- **VALIDATE**: `pnpm -F @snap-share/shared test` で既存テスト + 新規 2 件「sha256 付き parse 成功」「不正な hex で parse 失敗」が緑。

### Task 4: `apps/api/src/lib/sha256.ts` + `lib/ip.ts` 新規

- **ACTION**: 純関数の SHA-256 hex 化と IP ユーティリティを切り出す。
- **IMPLEMENT**:
  ```ts
  // sha256.ts
  export const bytesToHex = (buf: ArrayBuffer): string => {
    const view = new Uint8Array(buf);
    let out = '';
    for (let i = 0; i < view.length; i++) {
      out += view[i]!.toString(16).padStart(2, '0');
    }
    return out;
  };
  export const sha256Hex = async (buf: ArrayBuffer): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return bytesToHex(digest);
  };
  ```
  ```ts
  // ip.ts (前述の Patterns to Mirror 通り)
  export const redactIp = (ip: string | null | undefined): string => { /* ... */ };
  export const extractClientIp = (req: Request): string => { /* ... */ };
  ```
- **MIRROR**: NAMING_CONVENTION（純関数のキャメルケース、explicit return 型）
- **IMPORTS**: なし（standard Web Crypto / Request）
- **GOTCHA**: `crypto.subtle.digest` は Workers では同期取得できず Promise 必須。`bytesToHex` を別出しにすることで unit test に Workers ランタイム不要。
- **VALIDATE**: `__tests__/lib/sha256.test.ts` 3 件（"hello" の既知 hash、空 buffer、長文）+ `__tests__/lib/ip.test.ts` 6 件（IPv4/IPv6 redact、各種 header 経路）すべて緑。

### Task 5: `apps/api/src/services/turnstile-service.ts` 新規

- **ACTION**: siteverify 呼び出しを DI 化し、`BYPASS_TURNSTILE='true'` で常時 success を返す stub に切替可能にする。
- **IMPLEMENT**:
  ```ts
  import { logger } from '../lib/logger';

  export type TurnstileVerifyInput = Readonly<{ token: string; remoteIp?: string }>;
  export type TurnstileResult =
    | { ok: true }
    | { ok: false; reason: 'invalid' | 'network' | 'misconfigured' };

  export type TurnstileService = {
    verify(input: TurnstileVerifyInput): Promise<TurnstileResult>;
  };

  export type TurnstileDeps = Readonly<{
    secret: string;
    bypass: boolean;
    fetch?: typeof globalThis.fetch; // injectable for tests
  }>;

  const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  export const createTurnstileService = (deps: TurnstileDeps): TurnstileService => ({
    async verify({ token, remoteIp }) {
      if (deps.bypass) return { ok: true };
      if (!deps.secret) {
        logger.error('turnstile misconfigured: empty secret');
        return { ok: false, reason: 'misconfigured' };
      }
      const fetchImpl = deps.fetch ?? globalThis.fetch;
      try {
        const body = new URLSearchParams({ secret: deps.secret, response: token });
        if (remoteIp) body.set('remoteip', remoteIp);
        const res = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body });
        const json = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
        if (json.success) return { ok: true };
        logger.warn('turnstile verify failed', { codes: json['error-codes'] });
        return { ok: false, reason: 'invalid' };
      } catch (err: unknown) {
        logger.warn('turnstile verify network error', {
          err: err instanceof Error ? err.message : String(err),
        });
        return { ok: false, reason: 'network' };
      }
    },
  });
  ```
- **MIRROR**: SERVICE_DI_TEST_PATTERN（`createXxxService` ファクトリ + Deps 型）
- **IMPORTS**: `logger`
- **GOTCHA**:
  - `deps.bypass` が true のときは secret が空でも success を返す（dev 環境用）。
  - test では `fetch` を Vitest の `vi.fn()` で注入する。実 endpoint には叩かない。
  - `network` failure は client が 5xx ではなく「もう一度お試しください」を出すための区別用。Phase 7 では handler 側で `network` も `invalid` 同様 401 にする（公開時の判断）。
- **VALIDATE**: `__tests__/services/turnstile-service.test.ts` 6 件「bypass=true で常時 ok」「success=true で ok」「success=false で invalid」「network throw で network」「empty secret + bypass=false で misconfigured」「remoteip 渡しで body に含まれる」すべて緑。

### Task 6: `apps/api/src/services/image-blocklist-service.ts` 新規

- **ACTION**: KV 読み取りラッパ。Phase 7 では read-only で十分（書き込みは `wrangler kv key put` で運用）。
- **IMPLEMENT**:
  ```ts
  import { logger } from '../lib/logger';

  export type BlocklistDeps = Readonly<{ kv: KVNamespace }>;

  export type ImageBlocklistService = {
    isBlocked(sha256Hex: string): Promise<boolean>;
  };

  export const createImageBlocklistService = (deps: BlocklistDeps): ImageBlocklistService => ({
    async isBlocked(sha256Hex) {
      try {
        const v = await deps.kv.get(sha256Hex);
        return v !== null;
      } catch (err: unknown) {
        // Fail open (do NOT block legitimate users on KV errors). Log loudly.
        logger.error('blocklist KV read failed', {
          err: err instanceof Error ? err.message : String(err),
        });
        return false;
      }
    },
  });
  ```
- **MIRROR**: SERVICE_DI_TEST_PATTERN
- **IMPORTS**: `logger`
- **GOTCHA**:
  - **fail open** は意図的判断。"重要画像が誤って block されない" を優先。Phase 8 でメトリクス見て fail closed に切替検討。
  - KV read は eventual consistent（最大 60s 伝播遅延）。新規 block 適用が即時反映されないが、blocklist 用途では実用上問題なし。
- **VALIDATE**: `__tests__/services/image-blocklist-service.test.ts` 4 件「KV miss → false」「KV hit (any value) → true」「KV throw → false (fail open) + error log」「empty hex → KV.get 呼ばれる」すべて緑。

### Task 7: `apps/api/src/middleware/rate-limit.ts` 新規

- **ACTION**: Hono middleware ファクトリ。binding と key 生成関数を受け取り、429 envelope を返す。
- **IMPLEMENT**:
  ```ts
  import type { MiddlewareHandler } from 'hono';
  import type { Bindings } from '../lib/bindings';
  import { AppError } from '../lib/error';
  import { extractClientIp, redactIp } from '../lib/ip';
  import { logger } from '../lib/logger';

  export type RateLimitOptions = Readonly<{
    /** Resolves the binding from env (e.g. `(env) => env.RL_CREATE_ROOM`). */
    binding: (env: Bindings) => RateLimit | undefined;
    /** Builds the limiter key. Receives Hono context. */
    keyFn: (c: { req: { raw: Request; param(k: string): string } }) => string;
    /** Identifier for logs (e.g. 'rooms-create'). */
    routeId: string;
  }>;

  export const withRateLimit = (opts: RateLimitOptions): MiddlewareHandler<{ Bindings: Bindings }> =>
    async (c, next) => {
      const binding = opts.binding(c.env);
      if (!binding) {
        // Tests / dev without RL — passthrough.
        return next();
      }
      const key = opts.keyFn(c);
      const ip = extractClientIp(c.req.raw);
      try {
        const { success } = await binding.limit({ key });
        if (!success) {
          logger.warn('rate limit hit', { route: opts.routeId, ip: redactIp(ip), key });
          throw new AppError(429, 'RATE_LIMITED', 'Too many requests');
        }
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        // Fail open on RL binding errors (do not break the API).
        logger.error('rate limit binding error', {
          route: opts.routeId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
      return next();
    };
  ```
- **MIRROR**: 既存 `apps/api/src/yjs.ts:73` の `use('/:id', async (c, next) => { ... })` middleware パターン
- **IMPORTS**: `AppError` / `logger` / `extractClientIp` / `redactIp`
- **GOTCHA**:
  - `binding === undefined` のときは passthrough。`buildEnv` で stub 作成しないテストでも壊れないようにする保険。
  - **fail open on binding error**: RL 自体の障害で全リクエストを止めると DoS 化する。Phase 7 は fail open、Phase 8 で再評価。
- **VALIDATE**: `__tests__/middleware/rate-limit.test.ts` 4 件「binding undefined → passthrough」「success → next()」「success=false → 429 envelope」「binding throw → passthrough + error log」緑。

### Task 8: `apps/api/__tests__/helpers/in-memory-rl.ts` + `in-memory-kv.ts` 新規

- **ACTION**: テストで使う stub 実装。
- **IMPLEMENT**:
  ```ts
  // in-memory-rl.ts
  export type StubRateLimitOptions = Readonly<{ alwaysBlock?: boolean; limit?: number; period?: number }>;
  export const createStubRateLimit = (opts: StubRateLimitOptions = {}): RateLimit => {
    const counters = new Map<string, { count: number; resetAt: number }>();
    return {
      async limit({ key }) {
        if (opts.alwaysBlock) return { success: false };
        const limit = opts.limit ?? 1000;
        const period = (opts.period ?? 60) * 1000;
        const now = Date.now();
        const entry = counters.get(key);
        if (!entry || entry.resetAt < now) {
          counters.set(key, { count: 1, resetAt: now + period });
          return { success: true };
        }
        if (entry.count >= limit) return { success: false };
        entry.count++;
        return { success: true };
      },
    };
  };
  ```
  ```ts
  // in-memory-kv.ts
  export const createInMemoryKv = (initial: Record<string, string> = {}): KVNamespace => {
    const store = new Map<string, string>(Object.entries(initial));
    return {
      async get(key) { return store.get(key) ?? null; },
      async put(key, value) { store.set(key, String(value)); },
      async delete(key) { store.delete(key); },
      // Other methods stubbed minimally; tests touch only get/put/delete.
    } as unknown as KVNamespace;
  };
  ```
- **MIRROR**: 既存 `apps/api/src/__tests__/helpers/in-memory-r2.ts` の関数スタイル
- **IMPORTS**: なし（型は ambient）
- **GOTCHA**: `KVNamespace` は他にも `list` や `getWithMetadata` を持つが Phase 7 では使わない。`as unknown as KVNamespace` で十分。`RateLimit` は `limit` のみ。
- **VALIDATE**: 単体テストはなし（helpers）。Task 5/6/7 のテストで間接的にカバー。

### Task 9: `apps/api/src/__tests__/helpers/build-env.ts` 拡張

- **ACTION**: 新 binding のデフォルト stub を追加。
- **IMPLEMENT**:
  ```ts
  import { createInMemoryKv } from './in-memory-kv';
  import { createStubRateLimit } from './in-memory-rl';

  export const buildEnv = (overrides: Partial<Bindings> = {}): Bindings => ({
    IMAGES: createInMemoryR2(),
    ROOM_TTL_MS: String(DEFAULT_TTL_MS),
    Y_ROOM: noopY_ROOM,
    ROOM_TOKEN_SECRET: DEFAULT_ROOM_TOKEN_SECRET,
    RL_CREATE_ROOM: createStubRateLimit(),
    RL_AUTH: createStubRateLimit(),
    RL_SYNC: createStubRateLimit(),
    IMAGE_BLOCKLIST: createInMemoryKv(),
    TURNSTILE_SITE_KEY: '1x00000000000000000000AA', // dev test key
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA', // dev test secret
    BYPASS_TURNSTILE: 'true', // tests bypass by default; flip per-test for negative cases
    ...overrides,
  });
  ```
- **MIRROR**: 既存 `buildEnv` パターン
- **IMPORTS**: 上記 stub
- **GOTCHA**: `BYPASS_TURNSTILE: 'true'` で既存 24 件のテストが Turnstile を意識せず緑のまま動く。Turnstile を効かせるテストは `buildEnv({ BYPASS_TURNSTILE: 'false' })` で上書き。
- **VALIDATE**: 既存テスト全件（Phase 6 終了時点 ~280 件）が `pnpm test` で緑のまま。

### Task 10: `apps/api/src/services/room-service.ts` の create 拡張

- **ACTION**: SHA 計算 + blocklist 検査 + Turnstile 検査を組み込み、`create` シグネチャを拡張。R2 put は `arrayBuffer` ベースに切替。
- **IMPLEMENT**:
  - `RoomServiceDeps` に `turnstile: TurnstileService`、`blocklist: ImageBlocklistService`、`sha256: (buf: ArrayBuffer) => Promise<string>` を追加（後者はテストで mock 容易にするため DI）。
  - `RoomService.create` シグネチャ:
    ```ts
    create(file: File, opts: { password?: string; turnstileToken: string; remoteIp?: string }): Promise<Room>;
    ```
  - 処理順:
    1. file.size 検証（既存）
    2. MIME 検証（既存）
    3. **Turnstile verify** — 失敗で `AppError(401, 'UNAUTHORIZED', 'Turnstile verification failed', { reason })`
    4. arrayBuffer 取得（`await file.arrayBuffer()`）
    5. **SHA-256 計算** → blocklist 照会
    6. blocklist hit で `AppError(422, 'UNPROCESSABLE_ENTITY', 'This image cannot be uploaded', { sha256Prefix: hex.slice(0, 8) })`
    7. password ハッシュ化（既存）
    8. R2 put（`buffer` 渡し）+ meta put（`image.sha256: hex` を含む）
    9. ロールバックは既存通り
- **MIRROR**: 既存 create のロールバックパターン、`logger.info('room created', { ... })` の構造
- **IMPORTS**: `sha256Hex from '../lib/sha256'`、`TurnstileService` / `ImageBlocklistService`
- **GOTCHA**:
  - **Turnstile verify は MIME/size 検証の後に置く**。理由: 不正な MIME/巨大ファイルでも Turnstile 検証 (CF サーバへの 1 req) を消費するのは無駄。
  - **逆に SHA 計算 + blocklist は password hash の前**。理由: blocklist hit なら password hash の 210k iter を回さずに弾く。
  - `file.arrayBuffer()` は MAX_IMAGE_BYTES (10 MiB) なので Workers 128MB 余裕。
  - **R2 put を `arrayBuffer` 渡しに変える** ことで stream 二重消費の罠を避ける（stream は 1 回 only）。`bucket.put(key, body, ...)` は `body: ReadableStream | ArrayBuffer | Blob` を受け取るので互換。
- **VALIDATE**: `__tests__/services/room-service.test.ts` 既存 + 新規 6 件「Turnstile fail → 401」「Turnstile bypass=true → 通常パス」「blocklist hit → 422」「blocklist miss → 通常パス」「sha256 が meta に保存される」「Turnstile fail で R2 に書き込まれない」緑。

### Task 11: `apps/api/src/routes/rooms.ts` の `POST /rooms` 拡張

- **ACTION**: middleware 順 = (1) RL_CREATE_ROOM → (2) ハンドラ内で Turnstile + blocklist。Form schema に `cf-turnstile-response` 追加。
- **IMPLEMENT**:
  - `uploadFormSchema`:
    ```ts
    const uploadFormSchema = z.object({
      image: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
      password: z.string().max(256).optional().openapi({ type: 'string' }),
      'cf-turnstile-response': z.string().min(1).max(2048).openapi({ type: 'string' }),
    });
    ```
  - `createRoomRoute` の `responses` に 401, 422, 429 を追加。
  - `roomsRoute` に `.use(createRoomRoute.method as any === 'post' ? ... : ...)` ではなく、route-level の `.use('/', withRateLimit({ ... }))` を最初の openapi 呼び出しの前に挟む。**chained `.openapi(...)` の途中に `.use` を入れると型推論が崩れる** ため、middleware は別経路で挟む（`new OpenAPIHono<...>().use('/', withRateLimit(...)).openapi(createRoomRoute, handler).openapi(...).openapi(...)`）。
  - **PoC で型推論確認必須**: `.use('/', mw)` を chained 先頭に置いても `hc<AppType>` の型が壊れないことを `apps/web/src/lib/api-client.ts` で確認。壊れたら **path 単位に分けて `.use('/', mw)` を route 別に置く** ようリファクタ。
  - handler 内で:
    ```ts
    const turnstile = createTurnstileService({
      secret: c.env.TURNSTILE_SECRET_KEY,
      bypass: c.env.BYPASS_TURNSTILE === 'true',
    });
    const blocklist = createImageBlocklistService({ kv: c.env.IMAGE_BLOCKLIST });
    const room = await buildRoomService(c.env, turnstile, blocklist).create(image, {
      password,
      turnstileToken: c.req.valid('form')['cf-turnstile-response'],
      remoteIp: extractClientIp(c.req.raw),
    });
    ```
- **MIRROR**: 既存 chained `.openapi(...)` パターン、validation hook
- **IMPORTS**: `withRateLimit`, `createTurnstileService`, `createImageBlocklistService`, `extractClientIp`
- **GOTCHA**:
  - `cf-turnstile-response` 必須化で **全クライアントが Turnstile token を送る前提**。dev でテスト用に `1x00...AA` site key を `apps/web/.env.example` に書き、`BYPASS_TURNSTILE=true` で API 側を素通しに。
  - `.use('/', mw)` を OpenAPIHono の先頭に置いても `hc` 型推論が壊れないか **Task 24 で実機検証**。壊れる場合は middleware を per-route に切り替え。
- **VALIDATE**: `__tests__/rooms.test.ts` 既存 24 件 + 新規 7 件「Turnstile token なし → 400 (Zod)」「Turnstile fail (BYPASS=false + 不正 token) → 401」「Turnstile bypass → 既存パス」「blocklist hit → 422」「RL hit (alwaysBlock stub) → 429」「sha256 が response の image に含まれる」「sha256 hex が 64 文字」緑。

### Task 12: `apps/api/src/routes/rooms.ts` の `POST /rooms/:id/auth` に RL 追加

- **ACTION**: middleware として `withRateLimit({ binding: env => env.RL_AUTH, keyFn: c => `${c.req.param('id')}:${extractClientIp(c.req.raw)}`, routeId: 'rooms-auth' })` を auth route に挟む。
- **IMPLEMENT**:
  - `roomsRoute` の chain で auth route だけに middleware を効かせる方法:
    ```ts
    .use('/:id/auth', withRateLimit({
      binding: (env) => env.RL_AUTH,
      keyFn: (c) => `${c.req.param('id')}:${extractClientIp(c.req.raw)}`,
      routeId: 'rooms-auth',
    }))
    .openapi(authRoute, async (c) => { /* 既存 */ })
    ```
  - Hono の middleware は path matching ベースなので `/:id/auth` で auth route のみカバー、`/:id` 単独の `GET` には影響しない。
- **MIRROR**: Task 11 と同じパターン
- **IMPORTS**: 同上
- **GOTCHA**:
  - **key を `${roomId}:${ip}` にする** 理由: 同一 IP から複数ルームに対する個別 auth は許可、同一ルーム + 同一 IP の総当りは弾く。Phase 7 の dogfood でメトリクス見て調整。
  - 401 (wrong password) と 429 (RL hit) はクライアント目線で違う体験なので RoomGate で明確に分岐表示。
- **VALIDATE**: `__tests__/rooms.test.ts` 既存 + 新規 3 件「11 連打目で 429（stub に limit=10 を渡す）」「2 つの roomId に対する auth は独立してカウント」「IP 違いは独立カウント」緑。

### Task 13: `apps/api/src/yjs.ts` の sync route に RL 追加（未保護のみ）

- **ACTION**: 既存 middleware の中で、`room.auth` 無しのときだけ RL チェック。保護ルームは token 検証 (= PBKDF2 経由) を通過しているので追加 RL 不要。
- **IMPLEMENT**:
  ```ts
  .use('/:id', async (c, next) => {
    // 既存 ROOM_ID_REGEX チェック
    // 既存 service.get
    if (!room.auth) {
      // ここで RL_SYNC をチェック
      const rl = c.env.RL_SYNC;
      if (rl) {
        const ip = extractClientIp(c.req.raw);
        const { success } = await rl.limit({ key: `sync:${ip}` });
        if (!success) {
          logger.warn('sync ws denied: rate limit', { id, ip: redactIp(ip) });
          return c.json(errorEnvelope('RATE_LIMITED', 'Too many requests'), 429);
        }
      }
    }
    // 既存 token 検証 (room.auth ありの場合)
    return next();
  })
  ```
- **MIRROR**: 既存 syncRoute middleware の構造
- **IMPORTS**: `extractClientIp`, `redactIp`
- **GOTCHA**: WebSocket upgrade 経由は通常の Hono middleware で 429 を返せる（upgrade はまだ確立していない）。**ResponseEmitting 後の Close ではない**。
- **VALIDATE**: `__tests__/yjs.test.ts` 既存 7 件 + 新規 3 件「未保護 + RL hit → 429」「保護ルームは token 検証のみで RL 通過」「RL undefined（test stub なし）→ passthrough」緑。

### Task 14: `apps/api/wrangler.toml` 更新

- **ACTION**: `[[ratelimits]]` × 3、`[[kv_namespaces]]` × 1、`[vars]` に `TURNSTILE_SITE_KEY`、secret コメント拡張。
- **IMPLEMENT**:
  ```toml
  name = "snap-share-api"
  main = "src/index.ts"
  compatibility_date = "2026-04-07"
  compatibility_flags = ["nodejs_compat"]

  [[r2_buckets]]
  binding = "IMAGES"
  bucket_name = "snap-share-images"

  [[durable_objects.bindings]]
  name = "Y_ROOM"
  class_name = "SnapShareYDO"

  [[migrations]]
  tag = "v1"
  new_classes = ["YDurableObjects"]
  [[migrations]]
  tag = "v2"
  renamed_classes = [{ from = "YDurableObjects", to = "SnapShareYDO" }]

  [[ratelimits]]
  name = "RL_CREATE_ROOM"
  namespace_id = "1001"
  [ratelimits.simple]
  limit = 5
  period = 60

  [[ratelimits]]
  name = "RL_AUTH"
  namespace_id = "1002"
  [ratelimits.simple]
  limit = 10
  period = 60

  [[ratelimits]]
  name = "RL_SYNC"
  namespace_id = "1003"
  [ratelimits.simple]
  limit = 30
  period = 60

  [[kv_namespaces]]
  binding = "IMAGE_BLOCKLIST"
  # `wrangler kv namespace create IMAGE_BLOCKLIST` の出力 ID をここに貼る。
  # CI / dev は in-memory stub なので空でも OK だが production deploy 前に必須。
  id = "REPLACE_WITH_PRODUCTION_KV_ID"

  [vars]
  ROOM_TTL_MS = "604800000"
  TURNSTILE_SITE_KEY = "1x00000000000000000000AA" # dev test key; production override via env
  BYPASS_TURNSTILE = "false"

  # Secrets — set via `wrangler secret put NAME`:
  #   ROOM_TOKEN_SECRET    (HS256 JWT signing, ≥ 32 bytes)
  #   TURNSTILE_SECRET_KEY (Cloudflare Turnstile siteverify)
  # Local dev: `apps/api/.dev.vars` (gitignored).
  ```
- **MIRROR**: 既存 wrangler.toml 構造
- **IMPORTS**: なし
- **GOTCHA**:
  - `period = 60` のみ許容（10 と 60）。
  - `id = "REPLACE_..."` のままでは `wrangler dev` 起動時に warning。CI のテストは `buildEnv` で in-memory KV を使うので影響なし。
  - production deploy 前にこの ID を実 KV namespace ID に置換する手順は README に明記。
- **VALIDATE**: `pnpm -F @snap-share/api build`（wrangler dry-run）が緑、`env.RL_CREATE_ROOM` / `env.IMAGE_BLOCKLIST` がログに出る。

### Task 15: `apps/api/.dev.vars.example` 作成

- **ACTION**: dev 環境用 secret テンプレ（コミット対象、`.dev.vars` 自体は gitignore のまま）。
- **IMPLEMENT**:
  ```sh
  # Copy to apps/api/.dev.vars (gitignored) and fill values for local development.

  # 32+ bytes random string for HS256 JWT signing (rooms password tokens).
  ROOM_TOKEN_SECRET=replace-me-with-32-byte-random-string-aaaaaaaaaaaaaaaaaaa

  # Cloudflare Turnstile dev test secret (always passes verification).
  # Production: get a real secret from Cloudflare dashboard and set via:
  #   wrangler secret put TURNSTILE_SECRET_KEY
  TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

  # Set to "true" to skip Turnstile siteverify entirely (dev/CI only).
  BYPASS_TURNSTILE=true
  ```
- **MIRROR**: 一般的な `.env.example` 慣習
- **IMPORTS**: なし
- **GOTCHA**: ファイル名は `.dev.vars.example`、`.dev.vars` ではない。`.gitignore` で `.dev.vars` のみマッチ済（`.example` は別ファイル名扱い）。
- **VALIDATE**: `git status` で `.dev.vars.example` が track されることを確認。

### Task 16: `apps/web/.env.example` 作成

- **ACTION**: web の env テンプレ。
- **IMPLEMENT**:
  ```sh
  # Copy to apps/web/.env.local (gitignored) for local development.

  # API origin. Empty = use Vite proxy (http://localhost:8787 via vite.config.ts).
  # VITE_API_URL=

  # WebSocket origin (NOT proxied by Vite; see vite.config.ts comment).
  # Default: ws://localhost:8787 (set in apps/web/.env.development).
  # VITE_API_WS_URL=

  # Turnstile site key (PUBLIC; safe to commit/build into bundle).
  # Dev test key (always passes): 1x00000000000000000000AA
  VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA

  # Cloudflare Web Analytics token. Empty = no tracking (default for dev).
  # Production: paste the token from CF dashboard → Analytics → Web Analytics.
  VITE_CF_ANALYTICS_TOKEN=
  ```
- **MIRROR**: 一般的な `.env.example` 慣習
- **GOTCHA**: `VITE_*` プレフィックスはバンドルに埋め込まれる。secret は VITE_* に**入れない**。
- **VALIDATE**: コミット対象として `git add` できる、`.env.local` は `.gitignore` に既に含まれる。

### Task 17: `apps/web/src/components/turnstile/TurnstileWidget.tsx` 新規

- **ACTION**: invisible Turnstile widget の薄いラッパ。`useTurnstileToken` フックと組み合わせる。
- **IMPLEMENT**:
  ```tsx
  // TurnstileWidget.tsx — minimal wrapper around the global window.turnstile
  // injected by the script tag in index.html.
  import { useEffect, useRef } from 'react';

  declare global {
    interface Window {
      turnstile?: {
        render(container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'error-callback'?: () => void; size?: 'invisible' | 'normal' }): string;
        reset(widgetId?: string): void;
        remove(widgetId?: string): void;
      };
    }
  }

  export type TurnstileWidgetProps = Readonly<{
    siteKey: string;
    onSuccess: (token: string) => void;
    onError?: () => void;
  }>;

  export const TurnstileWidget = ({ siteKey, onSuccess, onError }: TurnstileWidgetProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useEffect(() => {
      if (!containerRef.current || !window.turnstile) return;
      const id = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        size: 'invisible',
        callback: onSuccess,
        'error-callback': onError,
      });
      widgetIdRef.current = id;
      return () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
        }
      };
    }, [siteKey, onSuccess, onError]);

    return <div ref={containerRef} aria-hidden="true" />;
  };
  ```
- **MIRROR**: NAMING_CONVENTION（PascalCase named export、Readonly props）
- **IMPORTS**: `useEffect` / `useRef` のみ
- **GOTCHA**:
  - **`window.turnstile` は `index.html` の `<script>` でロードされる前に React が render される可能性**: そのため `useEffect` 内で undefined 早期 return。次回 render（マウント後）で再試行。さらに堅牢にするには `<script onload>` or `MutationObserver` だが、Phase 7 では「最初の上下移動 (~50ms) で常に script ロード完了」前提でシンプルに保つ。
  - **size: 'invisible'** 指定で UI 上に何も出ない。チャレンジが必要な場合のみモーダルが自動表示される。
- **VALIDATE**: 単体テストは window.turnstile の mock が複雑なので skip。E2E でテスト keys を使った Phase 6 既存の D&D シナリオが緑のまま動くことを Task 26 で検証。

### Task 18: `apps/web/src/hooks/useTurnstileToken.ts` 新規

- **ACTION**: site key 有り/無しで分岐、token state 管理、reset 経路を提供。
- **IMPLEMENT**:
  ```ts
  import { useCallback, useState } from 'react';

  export type TurnstileTokenState =
    | { status: 'disabled' } // VITE_TURNSTILE_SITE_KEY が空
    | { status: 'pending' }
    | { status: 'ready'; token: string }
    | { status: 'error' };

  export type UseTurnstileTokenResult = Readonly<{
    state: TurnstileTokenState;
    setToken: (token: string) => void;
    setError: () => void;
    reset: () => void;
    /** Returns the current usable token (or empty string if disabled). */
    consumeToken: () => string;
  }>;

  export const useTurnstileToken = (siteKey: string | undefined): UseTurnstileTokenResult => {
    const [state, setState] = useState<TurnstileTokenState>(() =>
      siteKey ? { status: 'pending' } : { status: 'disabled' },
    );
    const setToken = useCallback((token: string) => setState({ status: 'ready', token }), []);
    const setError = useCallback(() => setState({ status: 'error' }), []);
    const reset = useCallback(
      () => setState(siteKey ? { status: 'pending' } : { status: 'disabled' }),
      [siteKey],
    );
    const consumeToken = useCallback(() => {
      if (state.status === 'disabled') return '';
      if (state.status === 'ready') return state.token;
      return '';
    }, [state]);
    return { state, setToken, setError, reset, consumeToken };
  };
  ```
- **MIRROR**: 既存の hooks の `Readonly<{ ... }>` 戻り値、`useCallback` での安定参照
- **IMPORTS**: `useCallback` / `useState`
- **GOTCHA**:
  - `disabled` ブランチで `consumeToken()` が空文字列を返す → サーバ側は `BYPASS_TURNSTILE=true` で空 token を許容するパスが必要。**ただし Zod スキーマは `min(1)` を要求**。整合: `BYPASS_TURNSTILE=true` の API では Zod 通過後の handler 内で bypass 判定し、token 値は無視。Zod スキーマは緩めずに（公開後に `BYPASS_TURNSTILE=false` に戻すと自動的に厳格化）。
  - dev で site key が空の場合、`disabled` で常に空 token 送信 → API 側 `BYPASS_TURNSTILE=true` で素通し。**production では絶対に site key を空にしない** 運用ルールを README に明記。
- **VALIDATE**: `__tests__/hooks/useTurnstileToken.test.ts` 5 件「siteKey undefined → disabled」「siteKey 有 → pending」「setToken → ready」「reset → pending に戻る」「setError → error」緑。

### Task 19: `apps/web/src/lib/api-client.ts` の `createRoom` 拡張

- **ACTION**: turnstileToken 必須化、戻り値を discriminated union 化。
- **IMPLEMENT**:
  ```ts
  export type CreateRoomFailure =
    | { reason: 'rate-limited' }
    | { reason: 'image-blocked' }
    | { reason: 'turnstile' }
    | { reason: 'invalid' }
    | { reason: 'network' };

  export type CreateRoomResult =
    | { ok: true; room: RoomPublic }
    | { ok: false } & CreateRoomFailure;

  export const createRoom = async (
    file: File,
    password: string | undefined,
    turnstileToken: string,
  ): Promise<CreateRoomResult> => {
    try {
      const form = new FormData();
      form.set('image', file);
      const pw = normalizePassword(password);
      if (pw !== undefined) form.set('password', pw);
      form.set('cf-turnstile-response', turnstileToken);
      const res = await fetch(`${baseUrl}/rooms`, { method: 'POST', body: form });
      if (res.status === 201) return { ok: true, room: (await res.json()) as RoomPublic };
      if (res.status === 429) return { ok: false, reason: 'rate-limited' };
      if (res.status === 422) return { ok: false, reason: 'image-blocked' };
      if (res.status === 401) return { ok: false, reason: 'turnstile' };
      if (res.status === 400 || res.status === 413 || res.status === 415) {
        return { ok: false, reason: 'invalid' };
      }
      logger.warn('createRoom: unexpected status', { status: res.status });
      return { ok: false, reason: 'network' };
    } catch (e: unknown) {
      logger.warn('createRoom: network error', { error: e instanceof Error ? e.message : String(e) });
      return { ok: false, reason: 'network' };
    }
  };
  ```
- **MIRROR**: `authenticateRoom` の AuthResult パターン
- **IMPORTS**: 既存
- **GOTCHA**: 既存 `createRoom: Promise<RoomPublic | null>` の callsite を全て discriminated union 受け取りに書き換える必要がある（`apps/web/src/pages/EditorPage.tsx` 周辺）。
- **VALIDATE**: `pnpm -F @snap-share/web typecheck` 緑、callsite が全て更新されていることを `tsc --noEmit` で確認。

### Task 20: `apps/web/src/pages/EditorPage.tsx` / `LocalEditor.tsx` の Turnstile 統合

- **ACTION**: TurnstileWidget を mount、token を `createRoom` に渡し、結果別にユーザー文言出し分け。
- **IMPLEMENT**:
  - `EditorPage` の冒頭 hooks に `const turnstile = useTurnstileToken(import.meta.env.VITE_TURNSTILE_SITE_KEY);`
  - JSX 末尾（floatingExtras 付近）に `<TurnstileWidget siteKey={...} onSuccess={turnstile.setToken} onError={turnstile.setError} />`（site key 有のときのみ）。
  - `handleFile = async (file) => { const result = await createRoom(file, password, turnstile.consumeToken()); /* result.ok 別 toast */ }`。
  - `LocalEditor` の upload ボタン disabled 条件に `turnstile.state.status !== 'ready' && turnstile.state.status !== 'disabled'` を追加。
  - 失敗 reason 別 toast:
    - `rate-limited` → `'しばらく経ってからお試しください'`
    - `image-blocked` → `'この画像はアップロードできません'`
    - `turnstile` → `'認証に失敗しました。再度お試しください'`（+ `turnstile.reset()`）
    - `invalid` → 既存 imageValidation の文言
    - `network` → `'通信に失敗しました'`
- **MIRROR**: Phase 6 の Sonner toast パターン、imageValidation エラー文言
- **IMPORTS**: `useTurnstileToken`, `TurnstileWidget`, `toast`
- **GOTCHA**:
  - **invisible Turnstile** はユーザー操作不要で token を取得するが、初回マウント後 ~100-300ms 遅延がある。「画像 D&D した瞬間に upload」が pending 状態だとボタン disabled で UX 違和感。→ disabled 表示は最小限にし、submit 時に再 await する形でもよい。本 plan は disabled 派（明示性優先）。
  - dev で site key 空 = `disabled` 状態 → `consumeToken()` が空文字列 → API は `BYPASS_TURNSTILE=true` で素通し。
- **VALIDATE**: 既存 E2E `landing.spec.ts` / `export.spec.ts` が緑のまま（Turnstile 無効状態 = disabled で素通し）。手動: dev で D&D 成功、dev で `BYPASS_TURNSTILE=false` + 不正 token で 401 toast 出ること。

### Task 21: `apps/web/src/components/room-gate/RoomGate.tsx` の 429 対応

- **ACTION**: `authenticateRoom` の戻り値の `reason` 拡張（429 を追加）に追従、UI 文言を出し分け。
- **IMPLEMENT**:
  - `apps/web/src/lib/api-client.ts` の `authenticateRoom` に 429 reason を追加（小さな更新、Task 19 と一緒に）。
  - `RoomGate` で `reason === 'rate-limited'` のとき disabled + 「しばらく経ってからお試しください（10 回/分の制限）」を表示。
- **MIRROR**: 既存 RoomGate state machine
- **IMPORTS**: 既存
- **GOTCHA**: cooldown タイマーは Phase 7 では実装しない（60s の wall-clock 待ち = ユーザーが画面リロードで十分）。`reset` ボタンを「再入力」として残す。
- **VALIDATE**: `__tests__/RoomGate.test.tsx` 既存 5 件 + 新規 2 件「rate-limited reason 表示」「reason 切替」緑。

### Task 22: `apps/web/index.html` の OG 確定 + Cloudflare Analytics + Turnstile script

- **ACTION**: TODO コメント解消、ビーコン追加、Turnstile script 追加。
- **IMPLEMENT**:
  ```html
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta name="theme-color" content="#5b6dff" />
    <title>snap-share — 画像URL一発で共同注釈</title>
    <meta name="description" content="..." />
    <meta property="og:title" content="snap-share — 画像URL一発で共同注釈" />
    <meta property="og:description" content="..." />
    <meta property="og:url" content="%VITE_PUBLIC_URL%" />
    <meta property="og:image" content="%VITE_PUBLIC_URL%/og-image.png" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <!-- Cloudflare Turnstile (siteKey passed at build time via VITE_TURNSTILE_SITE_KEY). -->
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
    <!-- Cloudflare Web Analytics. Token from VITE_CF_ANALYTICS_TOKEN; build-time injection. -->
    <script type="module">
      const t = "%VITE_CF_ANALYTICS_TOKEN%";
      if (t && !t.startsWith("%")) {
        const s = document.createElement("script");
        s.defer = true;
        s.src = "https://static.cloudflareinsights.com/beacon.min.js";
        s.setAttribute("data-cf-beacon", JSON.stringify({ token: t }));
        document.body.appendChild(s);
      }
    </script>
  </body>
  ```
  - Vite の HTML transform plugin (`vite-plugin-html` でなく) は標準で `%VITE_FOO%` を `import.meta.env.VITE_FOO` に置換しない。**`vite.config.ts` に小さな html plugin を足す**（既存の `tailwindcss()` の後）:
    ```ts
    import type { Plugin } from 'vite';
    const htmlEnvPlugin = (): Plugin => ({
      name: 'html-env-replace',
      transformIndexHtml: {
        order: 'pre',
        handler: (html, ctx) => html.replace(/%VITE_([A-Z0-9_]+)%/g, (_, k) => ctx.server?.config.env[`VITE_${k}`] ?? import.meta.env[`VITE_${k}`] ?? ''),
      },
    });
    ```
  - もしくは Vite の `define` ベースで build 時のみ注入し、dev は空にする選択肢もあり。シンプルに行きたければ後者。
- **MIRROR**: index.html 既存スタイル
- **IMPORTS**: vite.config.ts のみ
- **GOTCHA**:
  - **build-time vs runtime**: Cloudflare Pages は static SPA なので runtime 注入不可。build 時に `%VITE_CF_ANALYTICS_TOKEN%` を実値に置換する必要がある。Vite 標準の HTML transform は `%VITE_*%` を自動展開しない（`%VITE_*%` は ENV プラグイン非標準）→ 自前 plugin か `vite-plugin-html` 等の追加。本 plan は **自前 8 行 plugin** で済ませる。
  - production ビルドで `VITE_CF_ANALYTICS_TOKEN` が空なら beacon script を出さない（`!t.startsWith("%")` チェックで未置換のときも素通し）。
  - **CSP**: `<meta http-equiv="Content-Security-Policy" content="script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com 'unsafe-inline';">`。'unsafe-inline' は Phase 7 では許容（nonce 配布は static SPA では不可、Phase 8 で Workers に移行検討）。
- **VALIDATE**: `pnpm -F @snap-share/web build` で `dist/index.html` に置換済 token が入る（dev 環境では空でも OK）、手動で local 起動して `<script defer src="https://challenges.cloudflare.com/...api.js">` がロードされること、`window.turnstile` が定義されること。

### Task 23: `README.md` 全面改訂

- **ACTION**: 既存 99 行を 250〜350 行に拡張。Phase 5/6 の機能反映 + 本番デプロイ手順 + ライセンス + 貢献方針リンク。
- **IMPLEMENT**: 構成案
  1. **冒頭ヒーロー**: タイトル + 1 文サマリ + デモリンク（`https://snap-share.pages.dev`）+ デモ GIF プレースホルダ（`docs/demo.gif` を Phase 8 で差し込み）+ ライセンスバッジ（`![MIT](https://img.shields.io/badge/license-MIT-blue.svg)`）。
  2. **Features**: D&D upload / リアルタイム CRDT / 4 種注釈 / カーソル共有 / PNG export / パスワード保護 / 7 日 TTL / 日本語 UI / cookieless analytics / モバイル閲覧 / OSS。
  3. **Quick Start (Local)**: `pnpm install && pnpm dev` のみ。Node 22+ / pnpm 10。
  4. **Architecture diagram**（ASCII / mermaid）: client (Vite + React + Konva + Yjs) ↔ Workers (Hono + zod-openapi) ↔ R2 + Durable Objects (SnapShareYDO) + KV (IMAGE_BLOCKLIST) + Turnstile siteverify。
  5. **API**: Phase 2 endpoints（既存）+ `POST /rooms/:id/auth`（Phase 5）+ `GET /sync/:id` WS upgrade（Phase 4）+ エラーコード一覧（`UNPROCESSABLE_ENTITY` / `RATE_LIMITED` / `UNAUTHORIZED` を追記）。
  6. **Security & Privacy**: パスワード保護メカニズム（PBKDF2 210k iter）、TTL 7 日（DO Alarms）、no cookies、no tracking、SHA-256 image blocklist、Turnstile bot 緩和、IP rate limiting。
  7. **Production Deploy**:
     - 前提: Cloudflare Workers Paid plan ($5/月) + R2 (10GB 無料枠内) + KV (10GB 無料枠) + Pages (無料)
     - 手順:
       ```sh
       # 1. R2 bucket
       wrangler r2 bucket create snap-share-images

       # 2. KV namespace for image blocklist
       wrangler kv namespace create IMAGE_BLOCKLIST
       # → 出力された ID を apps/api/wrangler.toml の kv_namespaces.id に貼る

       # 3. Secrets
       wrangler secret put ROOM_TOKEN_SECRET    # 32+ byte random
       wrangler secret put TURNSTILE_SECRET_KEY # CF dashboard の Turnstile widget secret

       # 4. Deploy API (Workers)
       cd apps/api && pnpm wrangler deploy

       # 5. Deploy Web (Pages, Git 連携)
       # Cloudflare ダッシュボードで Pages → New project → Connect to GitHub
       # Build command: pnpm install --frozen-lockfile && pnpm -F @snap-share/web build
       # Build output directory: apps/web/dist
       # Root directory: (空 or apps/web)
       # Environment variables:
       #   VITE_API_URL=https://snap-share-api.{account}.workers.dev
       #   VITE_API_WS_URL=wss://snap-share-api.{account}.workers.dev
       #   VITE_TURNSTILE_SITE_KEY={your widget public key}
       #   VITE_CF_ANALYTICS_TOKEN={your CF Analytics token}
       #   VITE_PUBLIC_URL=https://snap-share.pages.dev
       ```
     - blocklist へ画像追加: `wrangler kv key put --binding=IMAGE_BLOCKLIST {sha256-hex} "{reason}"`
  8. **PRP Workflow**: `.claude/PRPs/` の構造説明、`/everything-claude-code:prp-prd` などコマンドへのリンク。
  9. **Contributing**: `CONTRIBUTING.md` 参照。
  10. **License**: MIT。
- **MIRROR**: Phase 0 の README、PRD `Solution Detail` の言語スタイル
- **IMPORTS**: なし
- **GOTCHA**: README の「動くコマンド例」は実際にコピペで動くこと。CI で markdown lint or shellcheck まで掛けるかは Phase 8 で判断。本 plan では人手レビュー。
- **VALIDATE**: 友人 1 人（または同僚）に README だけ渡して `pnpm install && pnpm dev` まで成功するかの dogfood テスト。Phase 8 への引き継ぎ事項としても OK。

### Task 24: `LICENSE`、`CONTRIBUTING.md`、`.github/` テンプレ作成

- **ACTION**: 標準ファイル一式を新規作成。
- **IMPLEMENT**:
  - `LICENSE`: SPDX 標準 MIT、`Copyright (c) 2026 imotako-pun`
  - `CONTRIBUTING.md`（日本語）: 構成
    1. はじめに（個人 OSS、PR 大歓迎、日本語 OK）
    2. ローカル開発セットアップ（README へのリンク）
    3. PRP ワークフロー（`/everything-claude-code:prp-prd` → `prp-plan` → `prp-implement` → `code-review` → `prp-pr`）
    4. ブランチ命名（`feat/`, `fix/`, `refactor/` など）
    5. Conventional Commits（[git-workflow.md](.claude/rules/common/git-workflow.md) 参照）
    6. PR チェックリスト（`pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm build` 緑）
    7. Code of Conduct（軽量、Contributor Covenant 参照だけ）
  - `.github/PULL_REQUEST_TEMPLATE.md`（日本語）:
    ```md
    ## 概要

    <!-- このPRが何を変えるか、なぜ必要か、3〜5行で。-->

    ## 対応する PRD Phase / Plan

    <!-- .claude/PRPs/plans/ の plan ファイルへのリンク -->

    ## Test plan

    - [ ] `pnpm typecheck` 緑
    - [ ] `pnpm lint` 緑
    - [ ] `pnpm test` 緑
    - [ ] `pnpm -F @snap-share/web test:e2e` 緑（影響範囲のみ）
    - [ ] `pnpm build` 緑

    ## スクリーンショット (UI 変更時)

    <!-- before / after を貼る -->

    ## Notes

    <!-- レビュアー向けの補足、トレードオフ、後続タスクなど -->
    ```
  - `.github/ISSUE_TEMPLATE/bug_report.md`（日本語）:
    ```md
    ---
    name: バグ報告
    about: 不具合の報告に使ってください
    ---

    ## 再現手順
    1.
    2.

    ## 期待した挙動

    ## 実際の挙動

    ## 環境
    - OS:
    - Browser:
    - Node:
    - snap-share commit hash:

    ## スクリーンショット / コンソールログ
    ```
  - `.github/ISSUE_TEMPLATE/feature_request.md`（日本語）: Problem / Proposal / Alternatives
  - `.github/ISSUE_TEMPLATE/config.yml`:
    ```yaml
    blank_issues_enabled: false
    contact_links:
      - name: 質問・ディスカッション
        url: https://github.com/imotako-pun/snap-share/discussions
        about: バグや機能要望ではない雑談・質問はこちらへ。
    ```
- **MIRROR**: 一般的な OSS テンプレ
- **IMPORTS**: なし
- **GOTCHA**: `imotako-pun` は git config の name から確認 (`git config user.name`)。誤記注意。
- **VALIDATE**: GitHub UI で「New Issue」「New PR」を開いた時にテンプレが表示されること（手動）。

### Task 25: `apps/api/__tests__/rooms.test.ts` / `yjs.test.ts` / `services/room-service.test.ts` の新規テスト追加

- **ACTION**: 上記 Task 4-13 で言及した新規テストを実際に追加。
- **IMPLEMENT**: 各 task の `VALIDATE` セクションで宣言した件数を厳守。
  - rooms.test.ts: +9 件 (Turnstile fail/bypass, blocklist hit, sha256 in response, RL hit, auth RL hit ×3)
  - yjs.test.ts: +3 件 (sync RL hit / passthrough / undefined binding)
  - room-service.test.ts: +6 件 (Turnstile order, blocklist order, sha256 persistence, rollback on Turnstile fail, rollback on blocklist hit, fail-open on KV error)
  - lib/sha256.test.ts: 3 件 (新規ファイル)
  - lib/ip.test.ts: 6 件 (新規ファイル)
  - lib/error.test.ts: +2 件 (UNPROCESSABLE_ENTITY / RATE_LIMITED envelope)
  - middleware/rate-limit.test.ts: 4 件 (新規ファイル)
  - services/turnstile-service.test.ts: 6 件 (新規ファイル)
  - services/image-blocklist-service.test.ts: 4 件 (新規ファイル)
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**: 各 service / helper
- **VALIDATE**: `pnpm -F @snap-share/api test` 全件緑（既存 ~80 件 + 新規 ~43 件）。

### Task 26: `apps/web/e2e/` 既存 E2E が緑のまま動くことを確認

- **ACTION**: Turnstile dev test key を `apps/web/.env.test` に書く（CI 環境変数として）。E2E 既存シナリオに変更なし。
- **IMPLEMENT**:
  - `apps/web/playwright.config.ts` の `webServer` に env 注入:
    ```ts
    webServer: {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      env: {
        VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      },
    },
    ```
  - もしくは `.env.test` ファイルで Vite が自動読込（mode='test'）。
  - `landing.spec.ts` / `export.spec.ts` は内容変更不要。Turnstile dev key で常に `success` → 既存テストがそのまま緑。
- **MIRROR**: 既存 playwright config
- **IMPORTS**: なし
- **GOTCHA**:
  - CI（GitHub Actions）でも `VITE_TURNSTILE_SITE_KEY=1x00...AA` を export し、API 側は `BYPASS_TURNSTILE=true`。
  - `apps/web/.env.test` を gitignore しない（テスト用公開キーは commit 対象）。
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e` 既存全件緑。

### Task 27: `apps/web/src/lib/__tests__/api-client.test.ts` 拡張

- **ACTION**: discriminated union 化した戻り値の network mock テスト追加。
- **IMPLEMENT**:
  - 既存テストがあれば status 別 reason をカバーする 6 件追加（201/400/401/422/429/network）。
  - `MSW` か `vi.fn` で `fetch` を mock。
- **MIRROR**: 既存 api-client テストパターン
- **IMPORTS**: vi, fetch mock
- **VALIDATE**: 全件緑。

### Task 28: 本番デプロイ手動実行（オーナー作業）

- **ACTION**: README の本番デプロイ手順を実機で 1 回完走する。
- **IMPLEMENT**: README 通りに `wrangler r2 bucket create` → `wrangler kv namespace create` → `wrangler secret put` × 2 → `wrangler deploy` → Cloudflare Pages 接続。Turnstile widget は CF dashboard で実 site key/secret 取得。Cloudflare Web Analytics は CF dashboard で site 登録 → token 取得。`apps/api/wrangler.toml` の `kv_namespaces.id` を実 ID に書換 → コミット。
- **MIRROR**: なし（手動）
- **IMPORTS**: なし
- **GOTCHA**:
  - `wrangler.toml` の `kv_namespaces.id` を実 ID に書き換えてコミットするのが production への必須ステップ。コミットメッセージ例: `chore(phase-7): bind production IMAGE_BLOCKLIST KV namespace`。
  - `BYPASS_TURNSTILE` は production では `wrangler.toml` の `[vars]` に `"false"` のまま（コードの default）。
  - DO migration v1+v2 が production に既存 `YDurableObjects` がある場合のみ走る。Phase 5 では production deploy 未実施だったので Phase 7 が初 deploy。**v1 と v2 が同時に走る** が、Cloudflare はこれを正しく処理する（v1 で new、v2 で rename）。
- **VALIDATE**:
  - `https://snap-share-api.{account}.workers.dev/health` が `{ "ok": true, ... }` を返す。
  - `https://snap-share.pages.dev/` がトップ画面を表示、画像 D&D で room 作成できる。
  - 別タブで同じ URL を開き、注釈追加が同期する。
  - 7 日待ち → ルームが消えていることを確認（Phase 8 範囲、本 phase の VALIDATE は「DO Alarm が登録された」をログで確認）。

### Task 29: PRD ステータス更新 + Decisions Log 拡張

- **ACTION**: `.claude/PRPs/prds/snap-share.prd.md` を更新。
- **IMPLEMENT**:
  - Phase 7 行: `pending` → `in-progress`、PRP 列を `[phase-7-public-launch.plan.md](../plans/phase-7-public-launch.plan.md)` に。
  - Decisions Log に 3 行追加:
    | スパム対策階層 | **Workers RL + Turnstile + 画像 SHA blocklist の三層** | IP-only RL / WAF / 認証必須化 | 個人 OSS スコープで運用負荷最小、各層が独立に fail / disable 可能 |
    | ライセンス | **MIT 確定** | Apache-2.0 / BUSL | デフォルト想定通り、依存ライブラリ群と互換 |
    | アナリティクス | **Cloudflare Web Analytics（cookieless）** | Plausible / GA4 / Umami | CF スタック整合 + cookie 同意不要 + 無料 |
- **MIRROR**: 既存 PRD 構造
- **IMPORTS**: なし
- **VALIDATE**: PRD 表が GitHub 上で正しくレンダリングされる（手動）。

### Task 30 (Should): `docs/adr/ADR-0003-public-launch-defenses.md` 作成

- **ACTION**: スパム対策の意思決定記録を ADR として残す。
- **IMPLEMENT**: ADR-0002 のフォーマットを踏襲。Status / Context / Decision / Consequences。
- **MIRROR**: `docs/adr/ADR-0002-hono-zod-openapi-tanstack-stack.md`
- **IMPORTS**: なし
- **VALIDATE**: PR レビュー時にリンクが効いていること。

### Task 31 (Should): `.github/workflows/deploy.yml` 自動デプロイ

- **ACTION**: `main` push で wrangler deploy + Pages auto-deploy。
- **IMPLEMENT**:
  ```yaml
  name: Deploy
  on:
    push:
      branches: [main]
  jobs:
    deploy-api:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v4
        - uses: actions/setup-node@v4
          with: { node-version: 22, cache: pnpm }
        - run: pnpm install --frozen-lockfile
        - name: Deploy API
          run: pnpm -F @snap-share/api wrangler deploy
          env:
            CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
            CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  ```
  - Pages は GitHub 連携で自動。
- **MIRROR**: `.github/workflows/ci.yml` の構造
- **IMPORTS**: なし
- **GOTCHA**:
  - **MUST スコープ外**: 時間が押したら省略可。手動 `wrangler deploy` で代用。
  - GitHub secrets に `CLOUDFLARE_API_TOKEN`（`Edit Cloudflare Workers` 権限）と `CLOUDFLARE_ACCOUNT_ID` を入れる。
- **VALIDATE**: PR を main にマージ → workflow run 緑、production が更新される。

---

## Testing Strategy

### Unit Tests (新規 ~37 件)

| Test | File | Input | Expected Output |
|---|---|---|---|
| `bytesToHex` 既知値 | `lib/__tests__/sha256.test.ts` | `Uint8Array([0xab, 0xcd])` | `'abcd'` |
| `sha256Hex("hello")` | 同上 | `new TextEncoder().encode('hello').buffer` | `'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'` |
| `sha256Hex` 空 buffer | 同上 | `new ArrayBuffer(0)` | `'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'` |
| `redactIp` IPv4 | `lib/__tests__/ip.test.ts` | `'1.2.3.4'` | `'1.2.3.xxx'` |
| `redactIp` IPv6 | 同上 | `'2001:db8::1'` | `'2001:db8::xxx'` |
| `redactIp` null | 同上 | `null` | `'unknown'` |
| `extractClientIp` cf-connecting-ip 優先 | 同上 | Request with both headers | cf 値 |
| `extractClientIp` x-forwarded-for fallback | 同上 | Request with only XFF | XFF 先頭 |
| `extractClientIp` neither → 127.0.0.1 | 同上 | Request without IP headers | `'127.0.0.1'` |
| `createTurnstileService` bypass=true | `services/__tests__/turnstile-service.test.ts` | bypass: true | `{ ok: true }` |
| `verify` success=true | 同上 | mock fetch returning success | `{ ok: true }` |
| `verify` success=false | 同上 | mock fetch returning failure | `{ ok: false, reason: 'invalid' }` |
| `verify` network throw | 同上 | mock fetch throwing | `{ ok: false, reason: 'network' }` |
| `verify` empty secret | 同上 | secret: '', bypass: false | `{ ok: false, reason: 'misconfigured' }` |
| `verify` remoteip in body | 同上 | input remoteIp | mock fetch called with `remoteip` |
| `isBlocked` KV miss | `services/__tests__/image-blocklist-service.test.ts` | kv with no entry | `false` |
| `isBlocked` KV hit | 同上 | kv with entry | `true` |
| `isBlocked` KV throws | 同上 | kv.get throws | `false` (fail open) |
| `isBlocked` empty hex | 同上 | `''` | KV.get called with `''` |
| `withRateLimit` no binding | `middleware/__tests__/rate-limit.test.ts` | binding undefined | passthrough |
| `withRateLimit` success | 同上 | binding.limit success | next() called |
| `withRateLimit` fail | 同上 | binding.limit fail | 429 envelope |
| `withRateLimit` binding throws | 同上 | binding.limit throws | passthrough + error log |
| RoomImage parse with sha256 | `packages/shared/__tests__/room.test.ts` | valid 64-char hex | parse success |
| RoomImage parse without sha256 | 同上 | image without sha256 | parse success (optional) |
| RoomImage parse invalid sha256 | 同上 | 63-char or non-hex | parse failure |
| AppError UNPROCESSABLE_ENTITY | `lib/__tests__/error.test.ts` | new AppError(422, 'UNPROCESSABLE_ENTITY', ...) | envelope correct |
| AppError RATE_LIMITED | 同上 | new AppError(429, 'RATE_LIMITED', ...) | envelope correct |
| useTurnstileToken disabled | `hooks/__tests__/useTurnstileToken.test.ts` | siteKey undefined | state: disabled |
| useTurnstileToken pending | 同上 | siteKey: 'x' | state: pending |
| useTurnstileToken setToken | 同上 | setToken('abc') | state: ready, token: 'abc' |
| useTurnstileToken reset | 同上 | reset() after ready | state: pending |
| useTurnstileToken error | 同上 | setError() | state: error |
| RoomGate rate-limited | `components/room-gate/__tests__/RoomGate.test.tsx` | reason: rate-limited | 「しばらく経ってから」表示 |
| RoomGate reason transition | 同上 | wrong-password → rate-limited | 文言切替 |
| createRoom 201 | `lib/__tests__/api-client.test.ts` | mock 201 | `{ ok: true, room }` |
| createRoom 429 | 同上 | mock 429 | `{ ok: false, reason: 'rate-limited' }` |
| createRoom 422 | 同上 | mock 422 | `{ ok: false, reason: 'image-blocked' }` |
| createRoom 401 | 同上 | mock 401 | `{ ok: false, reason: 'turnstile' }` |
| createRoom 400/413/415 | 同上 | mock 400 | `{ ok: false, reason: 'invalid' }` |
| createRoom network | 同上 | fetch throw | `{ ok: false, reason: 'network' }` |

### Integration Tests (新規 ~16 件 over rooms/yjs/room-service)

各 task の VALIDATE 通り。

### E2E (変更なし、Turnstile dev key で素通し)

- `landing.spec.ts` / `export.spec.ts` 既存全件緑のまま。

### Edge Cases Checklist

- [x] 同一 IP からの 6 連 POST /rooms で 6 発目が 429
- [x] 同一 IP × 同一 roomId への 11 連 auth で 11 発目が 429
- [x] 同一 IP × 異 roomId の auth は独立カウント
- [x] Turnstile bypass=true で空 token 許容
- [x] Turnstile bypass=false で空 token は Zod 400
- [x] 画像 SHA-256 が既知 hash と一致 → 422
- [x] KV 障害 → fail open (画像通る)
- [x] RL 障害 → fail open (リクエスト通る)
- [x] CF Web Analytics token 空 → beacon script を出さない
- [x] dev で site key 空 → Turnstile widget 不在 + API bypass
- [x] R2 put 失敗時のロールバック (既存) は SHA 計算後でも正しく動く
- [x] DO Alarm が createdAt + ttlMs に正しく登録 (Phase 5 既存)

---

## Validation Commands

### Static Analysis

```sh
pnpm typecheck
```
EXPECT: 0 errors across all 4 workspaces

### Unit Tests

```sh
pnpm -F @snap-share/api test
pnpm -F @snap-share/web test
pnpm -F @snap-share/shared test
```
EXPECT: Phase 6 終了時点 ~280 件 + 新規 ~50 件 = 330 件前後すべて緑

### Lint

```sh
pnpm lint
```
EXPECT: biome ci 0 error。新規 .ts ファイルが既存ルール（single quotes / trailing commas / semicolons / `noConsole: warn` 例外は logger.ts のみ）と整合。

### Build

```sh
pnpm build
```
EXPECT:
- vite build (apps/web) 緑、`dist/index.html` に Turnstile script + Cloudflare Analytics ビーコン（VITE_CF_ANALYTICS_TOKEN セット時）
- wrangler dry-run (apps/api) 緑、`env.RL_*` / `env.IMAGE_BLOCKLIST` がログに出る
- gzip サイズ < 280 KB（Phase 6 終了時 ~240 KB + Turnstile widget script は CDN なのでバンドルに含まれない）

### Browser Validation

```sh
pnpm dev   # web: 5173, api: 8787 (BYPASS_TURNSTILE=true 前提)
```
EXPECT:
- ローカル D&D → ルーム作成 (Turnstile bypass) → 注釈 → ⌘S export まで通常動作
- DevTools console に `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js">` ロード成功
- `window.turnstile` が定義
- 同じ IP から 6 連 D&D → 6 発目が 429 toast (RL stub では timer 制御が効かないため、curl で確認)

```sh
# 6 連で 6 発目が 429 を curl で確認
for i in 1 2 3 4 5 6; do
  curl -F "image=@cat.png" -F "cf-turnstile-response=test" \
    -H "cf-connecting-ip: 1.2.3.4" \
    http://localhost:8787/rooms -w "\n%{http_code}\n";
done
```
EXPECT: 1〜5 は 201、6 は 429（dev で `wrangler dev` の RL binding が実際にカウントするか要確認、ローカル stub 動作の場合は in-memory RL なので問題なし）。

### E2E

```sh
pnpm -F @snap-share/web test:e2e
```
EXPECT: Phase 6 既存 6 件 + Phase 7 で追加なし = 6 件すべて緑。

### Manual Validation

- [ ] `wrangler r2 bucket create snap-share-images` 成功（Cloudflare ダッシュボードに表示）
- [ ] `wrangler kv namespace create IMAGE_BLOCKLIST` 成功
- [ ] `wrangler secret put ROOM_TOKEN_SECRET` 成功
- [ ] `wrangler secret put TURNSTILE_SECRET_KEY` 成功
- [ ] `wrangler deploy` (apps/api) 成功、`https://snap-share-api.{account}.workers.dev/health` 200
- [ ] Cloudflare Pages で snap-share-web プロジェクト作成、main push で auto-deploy 緑
- [ ] `https://snap-share.pages.dev/` で D&D → 別タブで参加 → 注釈同期 → PNG export
- [ ] DevTools の Network タブで Cloudflare Analytics ビーコンが POST されている
- [ ] DevTools で Turnstile widget が invisible で動作（チャレンジが出ないこと）
- [ ] Lighthouse (production URL) Performance / Accessibility / Best Practices / SEO すべて 90+
- [ ] OG カードが Slack で正しく表示（image, title, description）
- [ ] README を別の人（同僚 1 名）が読んで `pnpm install && pnpm dev` まで成功（dogfood Phase 8 へ引き継ぎ）

---

## Acceptance Criteria

- [ ] `POST /rooms` が `cf-turnstile-response` 必須（dev は bypass で素通し）
- [ ] `POST /rooms` の RL が 5 req/60s/IP で動作
- [ ] `POST /rooms/:id/auth` の RL が 10 req/60s/(roomId,IP) で動作
- [ ] `/sync/:id` 未保護ルームの RL が 30 req/60s/IP で動作
- [ ] 画像 SHA-256 が `RoomImageSchema.sha256` に保存される
- [ ] `IMAGE_BLOCKLIST` KV にハッシュを登録するとアップロードが 422 で弾かれる
- [ ] `apps/web/index.html` に Turnstile API script + Cloudflare Web Analytics ビーコン（条件付き）が注入される
- [ ] OG `og:url` / `og:image` の placeholder TODO が消え、build-time 注入が動く
- [ ] `LICENSE` (MIT) / `CONTRIBUTING.md` (日本語) / `.github/PULL_REQUEST_TEMPLATE.md` (日本語) / `.github/ISSUE_TEMPLATE/{bug_report,feature_request,config}` がすべて存在
- [ ] `README.md` に Phase 5/6 機能の API 仕様 + 本番デプロイ手順 + ライセンスバッジ
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e` / `pnpm build` がすべて緑
- [ ] 本番 Workers + Pages がデプロイ済（または手順が完全にドキュメント化されており、Task 28 のみ別途実行）
- [ ] PRD Phase 7 status が `in-progress`、本 plan が PRP 列に紐付く

## Completion Checklist

- [ ] Discovered patterns（`Readonly<{}>` props / `cn()` / `logger.warn` / `bg-(--color-*)`) を踏襲
- [ ] エラーは `unknown` で受けて `instanceof Error` で narrow
- [ ] `console.*` の直書きが増えていない（`logger.ts` 経由のみ）
- [ ] Turnstile token / IP / SHA full hex は **絶対にログに残さない**（IP は redact、SHA は prefix 8 文字のみ）
- [ ] テストが AAA 構造で日本語の `it` 説明（既存スタイル踏襲）
- [ ] バンドルサイズ予算内（gzip < 280 KB、Turnstile widget は CDN 配信）
- [ ] PRD 表更新済、Decisions Log 3 行追加済
- [ ] `wrangler.toml` の `kv_namespaces.id` が production の実 ID（または明示的に `REPLACE_*` プレースホルダ + コメント）
- [ ] `.dev.vars` が gitignore されている（既存）、`.dev.vars.example` がコミット対象

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `OpenAPIHono.use('/', mw)` を chained 先頭に置くと `hc<AppType>` 型推論が壊れる | M | M | Task 11 の dev 検証で確認。壊れたら per-route middleware（path 指定）に切替 |
| Workers Rate Limit binding が `wrangler dev` ローカルで実カウントしない（CF 実機のみカウント） | M | L | テストは in-memory stub で検証、production は CF 実機で curl 連打して確認 |
| Cloudflare Web Analytics の `data-cf-beacon` token を build 時に置換しないと runtime で undefined | M | M | Vite の自前 html plugin で `%VITE_*%` 置換、token 空の場合は beacon script 自体を出さないガード |
| Turnstile widget が CSP `script-src` 制限で blocked | M | H | `<meta http-equiv="Content-Security-Policy">` に `https://challenges.cloudflare.com` 追加。本番ドメイン確定後に `_headers` ファイル化 |
| `wrangler kv namespace create IMAGE_BLOCKLIST` の ID 漏れで production で KV bind 失敗 | M | M | README の手順に強調文 + `wrangler.toml` の `REPLACE_WITH_PRODUCTION_KV_ID` がデプロイ前検証で fail する |
| SHA-256 hash 化で 10MiB 画像をメモリ load するため Workers 128MB 制限に近づく | L | M | 単発リクエスト約 12MB（FormData parser overhead 込）で余裕。DO 経由ではなく fetch handler 内なのでメモリ独立 |
| 画像 SHA blocklist KV の eventual consistency で「block 直後に再 upload 通る」 | L | L | Phase 7 では許容、Phase 8 で実利用見て判断（該当画像は post-block で R2/DO 削除する CLI を別途用意） |
| Production deploy で DO migration v1+v2 が初回同時実行 → 何らかの不整合 | L | H | wrangler は migration を順序実行する設計。万一壊れたら `wrangler rollback` で前状態に戻し v1 のみで再 deploy |
| Cloudflare Pages monorepo 設定で `apps/web` root + 全ワークスペース install の build time が長すぎ (>10min) | L | L | Pages は 20分の build 上限、現状 ~3 min (Phase 0 spike 実測) で余裕 |
| README 全面改訂で前任 Phase 2 仕様への参照が消えて他開発者が混乱 | L | L | git log で履歴は辿れる。PR の commit メッセージで「Phase 2 API description was preserved as-is, augmented with Phase 5/6」と明記 |
| Turnstile dev test key が CI / E2E で何らかの理由で `success=false` 返す | L | L | 公式が "always passes" と保証。Cloudflare 障害時は Turnstile 全体が落ちて invalid を返す可能性、その場合は Phase 7 の E2E が flaky になり retry 1 で吸収 |

## Notes

- Phase 6 で 247 (web) + ~80 (api) + shared = 約 280 件のテスト緑、`vite build` ~240 KB gzip。Phase 7 で +50 件、+~10 KB（Turnstile widget は CDN なのでバンドルに含まれない、Cloudflare Analytics beacon も外部 script なので bundle 外）。
- **Phase 8 dogfood への引継ぎ**: (a) 1 週間運用後の RL 閾値再評価（5/10/30 req/60s が厳しすぎ・緩すぎ）、(b) blocklist KV を実運用で使うか、(c) Cloudflare Web Analytics で実際の LCP / CLS / INP が PRD 目標を満たすか、(d) DO Storage / R2 サイズ集計、(e) GitHub Discussions に Discord/Slack-equivalent な気軽な雑談チャネルを足すか。
- **Phase 5 で Argon2 ではなく PBKDF2 を採択** した経緯と同じく、Phase 7 は "Cloudflare 一次" で固める（Turnstile / RL binding / KV / Pages / Web Analytics すべて Cloudflare）。**1 ベンダーロックイン** だが個人 OSS スコープでは運用コスト最小化が優先。
- 「英語フォールバック UI」（Should）は依然 Phase 7 でも実装しない。dogfood 後に判断。
- **og:image** は Phase 6 で `apps/web/public/og-image.png` を 1200×630 で用意済（Phase 6 Task 13）。Phase 7 では `og:url` の placeholder を本番 URL に置換するのみ。
- 本 plan の確信度 7/10 の主因: **Cloudflare Pages monorepo + Vite + pnpm の build 設定** と **`OpenAPIHono.use()` の型推論影響** の 2 点が実機検証必要。実装中に問題があれば Task 11 / Task 19 の中で path-level middleware への切替 or Pages root path 調整で吸収。
