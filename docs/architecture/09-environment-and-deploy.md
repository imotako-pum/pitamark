# 09. Environment & Deploy

> [← INDEX](./INDEX.md) | 前: [08-glossary-and-pitfalls](./08-glossary-and-pitfalls.md)

ローカル / preview / 本番の三環境で snap-share を動かすための環境変数 / bindings / deploy 経路をまとめる。

## API 側 bindings (Cloudflare Workers)

[apps/api/wrangler.toml](../../apps/api/wrangler.toml) で定義。

### Bindings 一覧

| Binding 名 | 種別 | 用途 | dev での扱い |
|---|---|---|---|
| `IMAGES` | R2 bucket | 画像バイナリ + `rooms/{id}/meta.json` 保存 | `wrangler dev` で in-memory mock |
| `Y_ROOM` | Durable Object | ルーム単位の Yjs document (class: `SnapShareYDO`) | wrangler dev で local DO 実行 |
| `RL_CREATE_ROOM` | RateLimit | `POST /rooms` (5 req / 60s) | wrangler dev で auto-mock |
| `RL_AUTH` | RateLimit | `POST /auth` + `POST /ws-ticket` (10 req / 60s) | wrangler dev で auto-mock |
| `RL_SYNC` | RateLimit | WS `/sync` public room (30 req / 60s) | wrangler dev で auto-mock |
| `IMAGE_BLOCKLIST` | KV | SHA-256 hex ブロックリスト | wrangler dev で in-memory |
| `WS_TICKETS` | KV | 60 秒 WS チケット (burn-on-consume) | wrangler dev で in-memory |

### Vars (公開できる設定値)

| 名前 | デフォルト | 役割 |
|---|---|---|
| `ROOM_TTL_MS` | `86400000` (24h) | ルームのデフォルト TTL。クライアントが `MAX_ROOM_TTL_MS` (7d) まで上書き可。 |
| `TURNSTILE_SITE_KEY` | テストキー | Turnstile widget 公開鍵 (常に pass のテスト鍵がデフォルト) |
| `BYPASS_TURNSTILE` | `"false"` | dev/CI で Turnstile 検証を skip するフラグ。**本番は必ず `"false"`** |
| `BYPASS_RATE_LIMIT` | `"false"` | dev/CI で RL を skip するフラグ。**本番は必ず `"false"`** |
| `CORS_ALLOWED_ORIGINS` | `https://snap-share.pages.dev,*.snap-share.pages.dev` | API を叩いてよい browser origin の allowlist (カンマ区切り) |

### Secrets (機密値; `wrangler secret put` で投入)

| 名前 | 用途 |
|---|---|
| `ROOM_TOKEN_SECRET` | HS256 JWT 署名鍵 (≥32 bytes) |
| `TURNSTILE_SECRET_KEY` | Turnstile siteverify 用 |

### KV / R2 を初めて provision するとき

```sh
cd apps/api
wrangler kv namespace create IMAGE_BLOCKLIST
wrangler kv namespace create IMAGE_BLOCKLIST --preview   # 任意 (dev 用)
wrangler kv namespace create WS_TICKETS
wrangler kv namespace create WS_TICKETS --preview        # 任意 (dev 用)
wrangler r2 bucket create snap-share-images              # 本番
```

返ってきた KV namespace ID を `wrangler.toml` の各 `[[kv_namespaces]]` の `id` に貼る。これを忘れると `image-blocklist-service` は **fail-open** (= ブロックリスト無効化) になり全画像が通る。詳細は [docs/observability.md](../observability.md)。

## ローカル dev: `apps/api/.dev.vars`

`apps/api/.dev.vars.example` をコピーして使う。重要なのは:

```
BYPASS_TURNSTILE=true
BYPASS_RATE_LIMIT=true
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
ROOM_TOKEN_SECRET=<32+ bytes でランダム生成>
TURNSTILE_SECRET_KEY=<dev は dummy で OK>
```

注意: `.dev.vars` は `wrangler.toml` の `[vars]` を **完全置換** する (マージではない)。`CORS_ALLOWED_ORIGINS` を localhost で上書きしたいなら本番 origin も含めて全列挙が必要。

## Web 側: VITE_* 環境変数

ビルド時に `apps/web/vite.config.ts` の `htmlEnvPlugin` 経由で `index.html` の `%VITE_FOO%` プレースホルダを置換する。`apps/web/.env.development` / `.env.production` などで定義。

| 名前 | 役割 |
|---|---|
| `VITE_API_URL` | REST API origin (dev: `http://localhost:8787`、本番: API Worker のドメイン) |
| `VITE_API_WS_URL` | WS API origin (dev: `ws://localhost:8787`、本番: `wss://...`)。Vite WS proxy は y-websocket のバイナリフレームを壊すので **直結が必須**。 |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile widget の公開鍵 |
| `VITE_CF_ANALYTICS_TOKEN` | Cloudflare Web Analytics トークン (dev は空) |
| `VITE_PUBLIC_URL` | OGP / canonical URL の base (例: `https://pitamark.app`) |
| `VITE_ADSENSE_CLIENT_ID` | AdSense 広告枠の client ID (Phase 10.H) |

## Dev サーバ起動

```sh
pnpm install
pnpm dev   # turbo run dev → web (5173) + api (8787) parallel
```

Vite は `/rooms` REST 通信を `localhost:8787` の wrangler dev へ proxy する (`apps/web/vite.config.ts`)。**WS は proxy しない** (バイナリフレーム破壊回避) ので、ブラウザは `VITE_API_WS_URL` を見て直接 wrangler dev に繋ぐ。

## CI (GitHub Actions)

[.github/workflows/ci.yml](../../.github/workflows/ci.yml) のジョブ構成:

| ジョブ | 内容 |
|---|---|
| `check` | `pnpm install --frozen-lockfile` → `pnpm lint` (biome ci) → `pnpm turbo run typecheck test build` |
| `e2e` | `check` 完了後、Playwright (chromium) を install → `apps/api/.dev.vars` を BYPASS フラグ付きで生成 → `pnpm turbo run test:e2e` → `playwright-report/` を artifact upload |

PR ごとに両ジョブが走る。lint or build or test が落ちると merge gate が閉じる。

## 本番 Deploy

### Web (Cloudflare Pages)

```sh
pnpm -F @pitamark/web build
# 出力: apps/web/dist/
```

Cloudflare Pages プロジェクト (`snap-share` または `pitamark`) に `dist` を upload。`_headers` の CSP がそのまま効く。リネーム後は OGP / favicon / apple-touch-icon が `pitamark` 系に切り替わっていることを実機で確認 ([ADR-0005](../adr/ADR-0005-app-naming-and-domain.md))。

### API (Cloudflare Workers)

```sh
cd apps/api
pnpm build       # tsc 型チェック
wrangler deploy  # 本番に push
```

初回 deploy 前に必須:
1. R2 bucket (`snap-share-images`) を本番アカウントで作成
2. KV namespace (`IMAGE_BLOCKLIST` / `WS_TICKETS`) を本番アカウントで作成 → `wrangler.toml` の `id` を更新
3. Secrets を投入: `wrangler secret put ROOM_TOKEN_SECRET` / `wrangler secret put TURNSTILE_SECRET_KEY`
4. Turnstile site を Cloudflare ダッシュボードで作成 → `TURNSTILE_SITE_KEY` を `[vars]` に貼る (公開鍵なので commit OK)
5. Migrations: `wrangler.toml` の `[[migrations]]` (`v1: new_classes / v2: renamed_classes`) は初回 deploy で自動適用される

詳細は [docs/observability.md](../observability.md) と Phase 7.5 の runbook (`docs/.tmp/cloudflare-runbook.md`)。

## リネーム移行 (snap-share → pitamark)

Phase 10.D で `pitamark.app` 確定 + リネーム実装が完了している。現状:

- workspace 名: `@snap-share/*` → `@pitamark/*` (済)
- 可視 UI 文言: pitamark に切替 (済)
- localStorage キー: 旧キーから新キーへ migration ロジック実装 (済)
- OGP / favicon / apple-touch-icon: pitamark 用に差替 (済)
- 法務文書 (privacy ja): pitamark 名で済 / 英訳: draft レビュー待ち
- 本番ドメイン (`pitamark.app`): **Phase 10.F** で取得 + DNS + Pages 本番設定 + v1.0.0 タグ

`wrangler.toml` の `name = "snap-share-api"` や R2 bucket 名 `snap-share-images` などサーバ側のリソース名は **Phase 10.F の本番 deploy 時に再作成** で切り替える。途中の preview デプロイでは旧名のまま運用。
