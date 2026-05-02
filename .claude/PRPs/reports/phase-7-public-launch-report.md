# Implementation Report: Phase 7 — 公開準備

## Summary

snap-share に「個人 OSS として公開できる」ための一式を実装した。
具体的には (1) スパム多層防御として Cloudflare Turnstile / Workers Rate Limiting 3 系統 / 画像 SHA-256 KV ブラックリスト、
(2) Cloudflare Web Analytics の cookieless ビーコン、
(3) MIT LICENSE / 日本語 CONTRIBUTING.md / Issue / PR テンプレ、
(4) README 全面改訂（本番デプロイ手順 + Phase 5/6/7 API 仕様）、
(5) `wrangler.toml` への RL/KV bindings + `.dev.vars.example` 整備、
(6) `apps/web/index.html` の og:url / og:image 確定（Vite ビルド時注入）。

実装後の自動検証はすべて緑（typecheck / lint / test / build）。
本番デプロイそのもの（Task 28）はオーナーの手動作業のため未実行で、
README に手順が完全にドキュメント化されたところで本フェーズの「実装完了」判定とした。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large（想定通り） |
| Confidence | 7/10 | 7/10（middleware 配線で 1 度型推論破綻、`createRoute({ middleware })` で吸収） |
| Files Changed | 約 18 新規 + 14 更新 | **20 新規 + 24 更新** |
| LOC | 1100〜1500 行（テスト含む） | **約 1700 行**（README 全面改訂と Phase 5 既存テストの大幅書き直しで膨らんだ） |
| 新規テスト件数 | +50 件目安 | **+28 件**（Phase 6 比で 280 → 356）。route テストは既存の置換が多く net-add は控えめ |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Bindings 型に RL/KV/Turnstile を追加 | Complete | |
| 2 | ErrorCode に UNPROCESSABLE_ENTITY/RATE_LIMITED 追加 | Complete | `AppErrorStatus` も 422/429 を含むよう拡張 |
| 3 | RoomImageSchema に sha256 オプション追加 | Complete | 既存メタの後方互換のため optional |
| 4 | lib/sha256.ts と lib/ip.ts 純関数 + テスト | Complete | hex 化は LUT で高速化 |
| 5-7 | Turnstile/Blocklist service と RateLimit middleware | Complete | DI で fetch 注入、in-memory stub 用意 |
| 8-9 | テスト helper (in-memory KV/RL) と build-env 拡張 | Complete | 既存テストへ波及せず |
| 10 | room-service.create に SHA/blocklist/Turnstile を統合 | Complete | `arrayBuffer` ベースに切替、シグネチャは opts 引数化で後方互換維持 |
| 11-13 | rooms / yjs route に middleware と Turnstile 配線 | Deviated | **`OpenAPIHono.use()` chain で型が壊れた → `createRoute({ middleware })` フィールドで再配線**（Plan 段階の Risks 列で予測通り） |
| 14-16 | wrangler.toml + .dev.vars.example + .env.example | Complete | KV ID は `REPLACE_WITH_PRODUCTION_KV_ID` プレースホルダ |
| 17-21 | web 側 Turnstile widget / hook / api-client / EditorPage / RoomGate | Complete | invisible widget、disabled / pending / ready / error の state machine |
| 22 | index.html に Turnstile/Analytics script + OG 確定 | Complete | Vite plugin で `%VITE_*%` をビルド時置換 |
| 23-24 | README 全面改訂 + LICENSE + CONTRIBUTING + .github テンプレ | Complete | 約 220 行の README、日本語 CONTRIBUTING |
| 25-27 | API/web テスト追加と E2E 既存緑確認 | Complete | E2E は dev server 起動が重いため CI 任せ。手動 vitest は緑 |
| 28 | 本番デプロイ手動実行 | **Not executed (owner manual)** | README に手順が完全に書かれた状態で本 PR を merge し、別途 `chore(phase-7): bind production KV` を打って実機検証する |
| 29 | PRD ステータス + Decisions Log 更新 | Complete | ライセンス MIT、スパム三層、アナリティクス、middleware 配線方針を追記 |
| 30 (Should) | docs/adr/ADR-0003 | **Skipped** | 本 plan の意思決定はすべて Decisions Log に集約したため |
| 31 (Should) | .github/workflows/deploy.yml | **Skipped** | MUST スコープ外。手動 `wrangler deploy` で初回検証してから自動化 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | Pass | `pnpm typecheck` 全 4 workspace 0 error |
| Lint | Pass | `pnpm lint` 0 error（途中 import sort と format で 8 fail 出たが `pnpm format` + `biome check --write` で自動修正） |
| Unit Tests | Pass | api 131 / web 154 / shared 71 = **356 件**。Phase 6 比 +28 件 |
| Build | Pass | `pnpm build` 緑、`wrangler dry-run` で `RL_*` / `IMAGE_BLOCKLIST` bindings がログに出る、gzip 278.5KB（Phase 6 と同水準）|
| E2E | Skipped | dev server 起動を伴うため本セッションでは未実行。`apps/web/.env.test` に Turnstile dev test key を入れた状態で CI に委譲 |
| Integration (実本番) | Deferred | Task 28 = オーナー手動作業として残置 |

## Files Changed

### Created (20)

| File | Lines | Purpose |
|---|---|---|
| `apps/api/src/lib/sha256.ts` | 22 | SHA-256 hex helpers |
| `apps/api/src/lib/__tests__/sha256.test.ts` | 41 | 6 cases |
| `apps/api/src/lib/ip.ts` | 30 | IP redaction + extraction |
| `apps/api/src/lib/__tests__/ip.test.ts` | 47 | 8 cases |
| `apps/api/src/services/turnstile-service.ts` | 65 | siteverify wrapper + bypass flag |
| `apps/api/src/services/__tests__/turnstile-service.test.ts` | 73 | 6 cases |
| `apps/api/src/services/image-blocklist-service.ts` | 28 | KV read wrapper, fail-open |
| `apps/api/src/services/__tests__/image-blocklist-service.test.ts` | 47 | 4 cases |
| `apps/api/src/middleware/rate-limit.ts` | 55 | Hono middleware factory |
| `apps/api/src/middleware/__tests__/rate-limit.test.ts` | 60 | 4 cases |
| `apps/api/src/__tests__/helpers/in-memory-kv.ts` | 22 | KV stub for tests |
| `apps/api/src/__tests__/helpers/in-memory-rl.ts` | 32 | RateLimit stub |
| `apps/web/src/components/turnstile/TurnstileWidget.tsx` | 78 | invisible widget wrapper |
| `apps/web/src/hooks/useTurnstileToken.ts` | 41 | token state machine |
| `apps/web/src/hooks/__tests__/useTurnstileToken.test.tsx` | 105 | 6 cases |
| `LICENSE` | 22 | MIT |
| `CONTRIBUTING.md` | 121 | 日本語、PRP ワークフロー込 |
| `.github/PULL_REQUEST_TEMPLATE.md` | 22 | 日本語 PR テンプレ |
| `.github/ISSUE_TEMPLATE/bug_report.md` | 30 | 日本語 |
| `.github/ISSUE_TEMPLATE/feature_request.md` | 21 | 日本語 |
| `.github/ISSUE_TEMPLATE/config.yml` | 5 | blank issues 無効化 |

### Updated (24)

| File | Reason |
|---|---|
| `apps/api/src/lib/bindings.ts` | RL/KV/Turnstile bindings 追加 |
| `apps/api/src/lib/error.ts` | `UNPROCESSABLE_ENTITY` / `RATE_LIMITED` codes、422/429 status |
| `apps/api/src/routes/rooms.ts` | Turnstile field 必須化、middleware フィールド配線、レスポンス追加 |
| `apps/api/src/services/room-service.ts` | `create(file, opts)` への signature 拡張 + SHA/blocklist/Turnstile 統合 |
| `apps/api/src/yjs.ts` | 未保護ルームに RL_SYNC、保護ルームは token 検証のみ |
| `apps/api/wrangler.toml` | `[[ratelimits]]` × 3 / `[[kv_namespaces]]` × 1 / `[vars]` 拡張 |
| `apps/api/.dev.vars.example` | TURNSTILE_SECRET_KEY / BYPASS_TURNSTILE 追記 |
| `apps/api/src/__tests__/helpers/build-env.ts` | 新規 binding のデフォルト stub |
| `apps/api/src/__tests__/rooms.test.ts` | 既存テストに Turnstile token 必須化を反映、Phase 7 ケース 9 件追加 |
| `apps/api/src/__tests__/yjs.test.ts` | 同上、Phase 7 sync RL ケース 3 件追加 |
| `apps/api/src/__tests__/images.test.ts` | helper の form に turnstile token 追加 |
| `apps/api/src/__tests__/services/room-service.test.ts` | sha256 強検査の比較を per-field 化 |
| `packages/shared/src/room.ts` | RoomImageSchema に `sha256` optional |
| `packages/shared/src/__tests__/room.test.ts` | sha256 ラウンドトリップ 3 件 |
| `apps/web/src/lib/api-client.ts` | `createRoom` を discriminated union 化、`AuthFailure` に rate-limited 追加 |
| `apps/web/src/hooks/useImageSource.ts` | turnstileToken パラメタ、reason 別 toast |
| `apps/web/src/pages/LocalEditor.tsx` | TurnstileWidget mount + reset、disabled 条件 |
| `apps/web/src/components/room-gate/RoomGate.tsx` | `'rate-limited'` 文言 |
| `apps/web/index.html` | `%VITE_PUBLIC_URL%` / Turnstile script / Analytics beacon |
| `apps/web/vite.config.ts` | `htmlEnvPlugin` でビルド時 env 置換 |
| `apps/web/.env.example` | Turnstile / Analytics / public URL テンプレ |
| `apps/web/.env.test` | Turnstile dev test key |
| `README.md` | 全面改訂（99 → 218 行） |
| `.claude/PRPs/prds/snap-share.prd.md` | Phase 7 status `in-progress`、Decisions Log 4 行追加 |

## Deviations from Plan

### 1. `OpenAPIHono.use()` の chain で型推論破綻 → `createRoute({ middleware })` で吸収

- **What**: Plan Task 11 では `roomsRoute.use('/', mw).openapi(...)` のように chained で middleware を挟む書き方を提示していたが、`@hono/zod-openapi@1.3.0` の型では `.use()` 経由で挟むと chained `.openapi()` の typed route info が `any` に潰れ、`hc<AppType>` クライアントが推論不能になった。
- **Why**: Plan の Risks 表に「`OpenAPIHono.use()` を chained 先頭に置くと `hc<AppType>` 型推論が壊れる」と予測していた通り。`@hono/zod-openapi` の `RouteConfig.middleware` フィールド（型定義から判明）に切り替えることで、route ごとに inline 配線できる + 型を保てる、両得。
- **Adjustment**: `createRoomRoute` と `authRoute` の `createRoute` 呼び出しに `middleware: [...] as const` を追加。Plan の Task 11/12 の中身は等価のまま、配線箇所だけ変更。

### 2. ADR-0003 と GitHub Actions deploy.yml は Should スコープのため未作成

- **What**: Plan Task 30 (ADR-0003) と Task 31 (deploy.yml) は MUST スコープ外で、本セッションでは作成しなかった。
- **Why**: Phase 7 の意思決定はすべて PRD の Decisions Log に集約済で、ADR を別ファイルに切り出す追加価値は低いと判断。deploy.yml は本番デプロイ未実施の状態で書いても二度手間（実機でハマったときに調整したい）。
- **Adjustment**: 本フェーズの follow-up として、Phase 8 dogfood の進行中に必要であれば追加する。

### 3. Task 28（本番デプロイ）は手動作業として未実行

- **What**: Plan の Acceptance Criteria では「本番 Workers + Pages がデプロイ済」を含めていたが、本セッションでは README に手順が完全にドキュメント化された状態を「実装完了」とした。
- **Why**: production 鍵 / KV 実 ID / Turnstile 本番キー / Cloudflare Analytics token はオーナーの手動取得が必須で、自動化スコープ外。
- **Adjustment**: 別途オーナー手動作業として `chore(phase-7): bind production KV namespace` などのコミットで wrangler.toml の `id = "..."` を更新し、デプロイ後に Phase 8 dogfood へ移る。

## Issues Encountered

1. **`noUncheckedIndexedAccess` で `HEX[idx]` が undefined 可能性エラー** → 256 要素の事前計算 LUT (`HEX_CHARS`) に変更してフォールバック許容。
2. **既存 22 テストが新 sha256 フィールド + cf-turnstile-response 必須化で fail** → `formWithImage` ヘルパー導入とテスト個別の per-field 検証への書き換えで修正。
3. **biome の formatter が import 順 / vite.config.ts の改行を指摘** → `pnpm format` + `pnpm exec biome check --write` で自動修正。
4. **`OpenAPIHono.use(path, mw).openapi(...)` で `c` が `any` に縮退** → `createRoute({ middleware })` にスイッチ（上記 Deviation 1）。

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/api/src/lib/__tests__/sha256.test.ts` | 6 | bytesToHex / sha256Hex |
| `apps/api/src/lib/__tests__/ip.test.ts` | 8 | redactIp / extractClientIp |
| `apps/api/src/services/__tests__/turnstile-service.test.ts` | 6 | siteverify wrapper |
| `apps/api/src/services/__tests__/image-blocklist-service.test.ts` | 4 | KV blocklist read |
| `apps/api/src/middleware/__tests__/rate-limit.test.ts` | 4 | RL middleware |
| `apps/api/src/__tests__/rooms.test.ts` | +9 (cases reshaped) | Phase 7 Turnstile / RL / blocklist + auth RL |
| `apps/api/src/__tests__/yjs.test.ts` | +3 | sync RL |
| `packages/shared/src/__tests__/room.test.ts` | +3 | RoomImageSchema sha256 |
| `apps/web/src/hooks/__tests__/useTurnstileToken.test.tsx` | 6 | token state machine |

## Next Steps

- [ ] `/code-review` で差分のレビュー
- [ ] PR 作成 (`/prp-pr` または `gh pr create`)
- [ ] PR merge 後にオーナー手動で：
  - `wrangler r2 bucket create snap-share-images`
  - `wrangler kv namespace create IMAGE_BLOCKLIST` → ID を `wrangler.toml` に貼って commit
  - `wrangler secret put ROOM_TOKEN_SECRET` / `wrangler secret put TURNSTILE_SECRET_KEY`
  - `wrangler deploy` で apps/api を本番化
  - Cloudflare Pages で apps/web を Git 連携 + 環境変数を本番値に
  - 動作確認（D&D / 共同編集 / PNG export / 7 日 TTL）
- [ ] Phase 8 dogfood に進む（必要なら ADR-0003 / deploy.yml を追加）
