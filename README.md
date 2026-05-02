# snap-share

> 画像にハイライト・吹き出し・矢印・テキストをオーバーレイし、URL一発で共同編集できる、日本語ファーストの軽量Webアプリ。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-22%2B-339933)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10-orange)](https://pnpm.io/)

公開デモ: <!-- Phase 7 Task 28 で本番ドメイン確定後に差し込み: https://snap-share.pages.dev -->TBD

詳細な背景・ユーザー像・成功指標は [PRD](./.claude/PRPs/prds/snap-share.prd.md) を参照。

## 何ができるか

- 画像を D&D / クリップボード貼り付け → 即時に共有 URL を発行
- 矩形・矢印・テキスト・ハイライトの 4 種注釈をリアルタイム同期（Yjs / CRDT）
- 他参加者のカーソル可視化（Awareness）
- ⌘S で PNG エクスポート（注釈焼き込み済）
- 任意のパスワード保護ルーム（PBKDF2-SHA256 210k iter ハッシュ）
- 7 日 TTL で自動破棄（Durable Object Alarm）
- 日本語ファースト UI、cookieless アナリティクス
- スパム緩和: Cloudflare Turnstile + Workers Rate Limit + 画像 SHA-256 ブラックリスト

## Repository layout

| Path | What |
|---|---|
| `apps/web` | Vite + React 19 + Tailwind v4 + Konva フロントエンド |
| `apps/api` | Hono on Cloudflare Workers (REST + Durable Objects) |
| `packages/shared` | Zod-driven SSOT（型・検証） |
| `spikes/` | Phase 0 リファレンス実装（workspace 外） |
| `.claude/PRPs/` | PRP（PRD / plan / report / review）成果物 |
| `.claude/rules/` | コーディングルール |
| `docs/adr/` | アーキテクチャ意思決定記録 |
| `docs/spikes/REPORT.md` | Phase 0 spike 結果 |

## Local development

```sh
pnpm install
pnpm dev          # apps/web (5173) + apps/api (8787) を並行起動
pnpm test         # vitest 全 workspace
pnpm test:e2e     # Playwright (Chromium のみ)
pnpm typecheck    # tsc --noEmit
pnpm lint         # biome ci .
pnpm format       # biome format --write .
pnpm build        # vite build (web) + wrangler dry-run (api)
```

Node 22+ と pnpm 10 が必須（`packageManager` で固定）。

ローカル開発では Turnstile siteverify を `BYPASS_TURNSTILE=true` で素通しにします。
`apps/api/.dev.vars.example` を `apps/api/.dev.vars` にコピーして使ってください。

スコープ別タスク：

```sh
pnpm -F @snap-share/web dev
pnpm -F @snap-share/api test
pnpm -F @snap-share/shared test

# 単一テストファイル
pnpm -F @snap-share/web test -- src/hooks/__tests__/historyReducer.test.ts

# Playwright をタイトル指定で
pnpm -F @snap-share/web test:e2e -- -g "renders toolbar"
```

## Architecture

```
┌──────────────┐  HTTP(S)  ┌────────────────────────┐
│  apps/web    │──────────▶│  apps/api (Hono / CF)  │
│  Vite + React│           │  POST /rooms           │
│  + Konva     │           │   ├─ Turnstile verify  │
│  + Yjs client│           │   ├─ RL_CREATE_ROOM    │
└──────┬───────┘           │   ├─ SHA-256 blocklist │
       │ WS                │   └─ R2 put + DO alarm │
       │                   │  POST /rooms/:id/auth  │
       │                   │   └─ RL_AUTH + JWT     │
       ▼                   │  GET  /rooms/:id/image │
┌──────────────┐           │   └─ Bearer (protected)│
│ Durable Obj  │ Hibernate │  GET  /sync/:id (WS)   │
│ SnapShareYDO │◀──────────│   └─ RL_SYNC + token   │
│ + DO Alarm   │           └────────────┬───────────┘
│   (TTL 7d)   │                        │
└──────┬───────┘                        ▼
       │                  ┌─────────────┐  ┌──────────────────┐
       └─────────────────▶│  R2 IMAGES  │  │  KV blocklist    │
                          └─────────────┘  └──────────────────┘
```

設計の根拠は [docs/adr/](./docs/adr/) と PRD を参照。

## API (production reference)

> ローカル動作中に `wrangler dev` の `/api/docs` (Scalar UI) で同じ仕様を閲覧できます。

すべての失敗レスポンスは共通エンベロープ `{ ok: false, error: { code, message } }`。
コードは `INVALID_REQUEST` (400) / `UNAUTHORIZED` (401) / `NOT_FOUND` (404) /
`PAYLOAD_TOO_LARGE` (413) / `UNSUPPORTED_MEDIA_TYPE` (415) /
`UNPROCESSABLE_ENTITY` (422) / `RATE_LIMITED` (429) / `INTERNAL` (500)。

### `POST /rooms` (multipart/form-data)

新しいルームを作成。

| Field | Required | Description |
|---|---|---|
| `image` | yes | png/jpeg/webp/svg+xml、最大 10 MiB |
| `password` | no | 1〜256 文字。空文字は「保護無し」と同等 |
| `cf-turnstile-response` | yes | Turnstile widget が払い出すトークン。dev は dummy 値で OK（`BYPASS_TURNSTILE=true`） |

```sh
curl -F "image=@cat.png" \
     -F "cf-turnstile-response=dummy" \
     http://localhost:8787/rooms
# → 201 RoomPublic
# {
#   "id": "V1StGXR8_Z5jdHi6B-myT",
#   "createdAt": 1714435200000,
#   "ttlMs": 604800000,
#   "protected": false,
#   "image": {
#     "key": "rooms/V1StGXR8_Z5jdHi6B-myT/image.png",
#     "contentType": "image/png",
#     "size": 12345,
#     "sha256": "abc...64hex..."
#   }
# }
```

レート制限: 5 req / 60s / IP（`RL_CREATE_ROOM`）。
ブラックリストヒット時は 422、Turnstile 失敗時は 401。

### `GET /rooms/:id`

ルームメタデータを取得。`protected: true` のルームでは `image` フィールドが省かれます（R2 key の漏洩防止）。

### `POST /rooms/:id/auth` (application/json)

パスワードを HS256 JWT (24h) と交換。

```sh
curl -H "content-type: application/json" \
     -d '{"password":"letmein"}' \
     http://localhost:8787/rooms/V1StGXR8_Z5jdHi6B-myT/auth
# → 200 { "token": "eyJ..." }
```

レート制限: 10 req / 60s / `(roomId, IP)` ペア。

### `GET /rooms/:id/image`

未保護ルームは公開、保護ルームは `Authorization: Bearer <token>` 必須。
SVG は `Content-Disposition: attachment` で強制ダウンロード（XSS 緩和）。
保護ルーム配信は `Cache-Control: private, no-store`。

### `GET /sync/:id` (WebSocket upgrade)

Yjs 同期。保護ルームは `?token=<JWT>` 必須。未保護は `RL_SYNC` (30 req / 60s / IP)。

## Security & Privacy

- **パスワードハッシュ**: PBKDF2-SHA256 210,000 iterations + 16 byte salt（OWASP 推奨）。
- **TTL 自動破棄**: 7 日経過で Durable Object Alarm が R2 image + meta + DO storage を削除。
- **No tracking cookies**: Cloudflare Web Analytics は cookieless ビーコン。
- **画像 SHA-256 ブラックリスト**: 既知の悪用素材をハッシュベースで弾く。R2 にも書く前に検査。
- **Turnstile**: ルーム作成時の機械的トラフィックを invisible widget で抑制。
- **IP レート制限**: ルーム作成 / 認証 / 同期 WS upgrade に Workers Rate Limit binding。

詳細は `.claude/rules/web/security.md` を参照。

## Production deploy

前提: Cloudflare Workers Paid plan ($5/月) + R2 + KV + Pages（無料枠）。

```sh
# 1. R2 bucket
wrangler r2 bucket create snap-share-images

# 2. KV namespace for image blocklist
wrangler kv namespace create IMAGE_BLOCKLIST
# → 出力された ID を apps/api/wrangler.toml の `[[kv_namespaces]] id = "..."` に貼る

# 3. Secrets
wrangler secret put ROOM_TOKEN_SECRET    # 32+ byte random (例: openssl rand -base64 48)
wrangler secret put TURNSTILE_SECRET_KEY # CF dashboard → Turnstile → widget secret

# 4. Variables for production
#    apps/api/wrangler.toml の [vars]:
#    - TURNSTILE_SITE_KEY を本番 site key に
#    - BYPASS_TURNSTILE は "false" のまま

# 5. Deploy API (Workers)
cd apps/api && pnpm wrangler deploy

# 6. Deploy Web (Pages, Git 連携)
# Cloudflare ダッシュボード → Pages → New project → Connect to GitHub
#   Build command: pnpm install --frozen-lockfile && pnpm -F @snap-share/web build
#   Build output:  apps/web/dist
#   Root:          (空) または apps/web
#   Environment variables:
#     VITE_API_URL=https://snap-share-api.{account}.workers.dev
#     VITE_API_WS_URL=wss://snap-share-api.{account}.workers.dev
#     VITE_TURNSTILE_SITE_KEY=<本番 site key>
#     VITE_CF_ANALYTICS_TOKEN=<CF Web Analytics token>
#     VITE_PUBLIC_URL=https://snap-share.pages.dev
```

ブラックリストへの追加は KV を直接更新：

```sh
wrangler kv key put --binding=IMAGE_BLOCKLIST <sha256-hex> "phishing-2026q2"
```

## PRP Workflow

`.claude/PRPs/` 配下で PRD → Plan → Implement → Report → Review → PR の流れを回しています。

| Folder | Purpose |
|---|---|
| `prds/` | フェーズ別の製品要件 |
| `plans/` | 進行中の実装計画（完了で `plans/completed/` へ） |
| `reports/` | 実装報告 |
| `reviews/` | コードレビュー成果物 |

## Versioning

共有依存（typescript, vitest, zod, nanoid, react, @types/* など）は
[pnpm catalog](https://pnpm.io/catalogs) で `pnpm-workspace.yaml` の
`catalog:` セクションに集約しています。各 workspace は `"pkg": "catalog:"` で参照。

`spikes/` 配下は workspace から除外しています。動かす場合は
`cd spikes/<name> && pnpm install` で個別に。

## Contributing

PR / Issue / 提案、すべて歓迎します。詳しくは [CONTRIBUTING.md](./CONTRIBUTING.md) を参照。

## License

[MIT](./LICENSE) © 2026 imotako-pum
