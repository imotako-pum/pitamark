# Implementation Report: Phase 2.5 — API モダン化

## Summary

`@hono/zod-openapi` への移行 (3 ルート) と `hc<AppType>` クライアント配線を完了。`/api/openapi.json` で OpenAPI 3.1 仕様自動生成、`/api/docs` で Scalar UI を配信。`apps/web` から `api.rooms[':id'].$get()` 形式で型推論が末端まで通るようになった。既存 API テスト 9 件は無改変で全緑、新規 6 件のテスト追加。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| Confidence | 7/10 | 達成 (障害 4 件、いずれも Plan の Risk セクションで予見されていた範囲) |
| Files Changed | 8〜12 | 14 (新規 6 + 編集 8) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | 依存追加 + catalog 更新 | Complete | `@hono/zod-openapi@1.3.0` / `@scalar/hono-api-reference@0.10.12` |
| 2 | OpenAPI doc 設定モジュール作成 | Complete | `as const` を `openapi: '3.1.0'` のみに局所化 (Issue #1 対応) |
| 3 | index.ts を OpenAPIHono に切替 | Complete | `routed` チェイン + `app.doc31` + Scalar mount |
| 4 | routes/rooms.ts を createRoute 形式へ移行 | Complete | チェイン export に最終リファクタ (Task 10 で発覚した型推論問題で対応) |
| 5 | routes/images.ts を createRoute 形式へ移行 | Complete | バイナリ Response は 200 の content 省略で raw `Response` を許容、SVG XSS 対策維持 |
| 6 | apps/web から API 型を参照可能にする | Complete | `apps/api/package.json` に `main`/`types`/`exports` 追加、`apps/web` に `@cloudflare/workers-types` を types 経由で導入 (Risk #3 mitigation) |
| 7 | apps/web/src/lib/api-client.ts 作成 | Complete | `import type` + `verbatimModuleSyntax` 強制で web bundle に runtime コード混入なし |
| 8 | web .env.example + api-client smoke test 作成 | Complete | `.env.test` も追加、テストを co-located 規約 (`src/lib/__tests__/`) に合わせて配置 |
| 9 | openapi.test.ts 作成 | Complete | `:id` → `{id}` path 規約 (`@hono/zod-openapi` 仕様) を発見し routes 修正、Scalar HTML 検証も追加 |
| 10 | 全 workspace typecheck/test/lint/build 緑確認 | Complete | チェイン export 化と biome organize-imports 自動修正で全緑到達 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | Pass | shared / api / web 全緑 |
| Unit Tests | Pass | 63 tests (shared 20 + api 37 + web 6) |
| Lint (Biome ci) | Pass | `biome check --write` で organize-imports 2 件自動修正 |
| Build | Pass | api: wrangler dry-run 成功 (712 KiB / gzip 116 KiB)、web: vite build 成功 (190 KiB / gzip 60 KiB) |
| Edge Cases | Pass | 既存 9 件 + 新規 OpenAPI/Scalar 検証 で網羅 |

## Files Changed

### CREATED (6)

| File | Lines |
|---|---|
| `apps/api/src/lib/openapi.ts` | +14 |
| `apps/api/src/__tests__/openapi.test.ts` | +30 |
| `apps/web/src/lib/api-client.ts` | +11 |
| `apps/web/src/lib/__tests__/api-client.test.ts` | +24 |
| `apps/web/.env.example` | +1 |
| `apps/web/.env.test` | +1 |

### UPDATED (8)

| File | 変更概要 |
|---|---|
| `pnpm-workspace.yaml` | catalog に `@hono/zod-openapi`, `@scalar/hono-api-reference` を追加 |
| `apps/api/package.json` | 上記 2 依存を catalog 経由で追加、`main`/`types`/`exports` フィールド追加 (web から型 import 用) |
| `apps/api/src/index.ts` | `Hono` → `OpenAPIHono`、`/api/openapi.json` + `/api/docs` mount、`AppType` export |
| `apps/api/src/routes/rooms.ts` | `Hono` → `OpenAPIHono`、`createRoute` ベース、チェイン export 化、path `{id}` 形式 |
| `apps/api/src/routes/images.ts` | 同上 (1 ルートのみ、200 binary は content 省略) |
| `apps/web/package.json` | `@snap-share/api`, `hono`, `@cloudflare/workers-types` を追加 |
| `apps/web/tsconfig.json` | `types` に `@cloudflare/workers-types` 追加 (apps/api 型解決のため) |
| `pnpm-lock.yaml` | 上記依存追加に伴う再生成 |

## Deviations from Plan

### 1. RoomSchema/ErrorResponseSchema を `.openapi('Room')` で名前付け component 化しない

- **WHAT**: プラン Task 4 IMPLEMENT は `RoomSchema.openapi('Room')` で OpenAPI components として登録する想定だったが、本実装ではルートファイル内で inline schema として参照 (component 化せず)
- **WHY**: `RoomSchema` は `packages/shared` 側で純正 Zod から定義されており、`.readonly()` と `@hono/zod-openapi` の `.openapi()` 拡張の相互作用で TypeScript 型解決が複雑化するリスクがあった。inline schema でも acceptance criteria (3 paths が含まれる、`hc` 型推論が通る) は完全に満たすため、複雑性を避ける選択
- **影響**: OpenAPI ドキュメントで `Room` schema が `components/schemas` に登録されず inline 化される。外部 API 利用者が schema を参照する際の DX が若干劣化するが、Phase 2.5 スコープ内では問題なし

### 2. apps/web に `@cloudflare/workers-types` を追加 (Risk #3 顕在化)

- **WHAT**: `apps/web/tsconfig.json` の `types` 配列に `@cloudflare/workers-types` を追加、devDep にも追加
- **WHY**: Plan の Risk #3 で予見された通り、`apps/web` が `apps/api` の `AppType` を type-only import すると、tsc が apps/api 配下のソースファイルを型解決のため走査し、`R2Bucket`/`R2ObjectBody` の global 型が見つからずエラー
- **代替案**: AppType を Bindings 抜きで切り出す案 (Plan §Risk #3 mitigation) は、Hono/OpenAPIHono の generic 引数を経由して Bindings が透過するため効果薄。`@cloudflare/workers-types` は v4 で DOM と coexist 設計のため web に追加しても DOM API との衝突なし
- **影響**: web bundle には影響なし (型情報のみ、ランタイム影響ゼロ)。verify で衝突なしを確認

### 3. routes のチェイン export パターン採用 (Task 10 で発覚)

- **WHAT**: `roomsRoute.openapi(...)` を文として呼ぶスタイル (Plan IMPLEMENT 例に近い形) ではなく、`new OpenAPIHono().openapi(...).openapi(...)` のチェイン形式で export
- **WHY**: `roomsRoute.openapi(...)` を文として呼ぶと `roomsRoute` の型は bare `OpenAPIHono` のままで、`hc<AppType>` から `api.rooms.$post` 等の型が解決できなかった (`api.health` のみが見えた)
- **解消**: Hono RPC 公式ガイド準拠のチェイン export パターンに移行 → web typecheck 緑
- **影響**: ルートファイルの可読性は若干変化するが、これが Hono RPC モノレポでの標準パターン

### 4. createRoute path に `{id}` 形式を採用

- **WHAT**: プラン IMPLEMENT 例は `path: '/:id'` だったが、本実装では `path: '/{id}'` に変更
- **WHY**: `@hono/zod-openapi` v1.3 の `app.route()` は親 mount path のみ `:` → `{}` 変換を行い、sub-route 自身の path 部分は変換しない。`/rooms/:id` という非標準 OpenAPI パスが出力されてテストが失敗したため、createRoute 側で予め `{id}` を使用するパターンに切替
- **影響**: ライブラリは `{id}` を内部で `:id` に逆変換して Hono routing に登録するため runtime 互換、OpenAPI 仕様も正しく `/rooms/{id}` で出力される

## Issues Encountered

### Issue 1: openapi.ts の `as const` で TS2345

- **症状**: `app.doc31(path, openApiDocConfig)` で `tags: readonly TagObject[]` が `mutable TagObject[]` と型整合せず
- **解消**: `as const` を全体ではなく `openapi: '3.1.0'` のみに局所適用、`tags` を mutable のまま扱う

### Issue 2: web tsc が R2Bucket/R2ObjectBody を解決できず TS2304

- **症状**: `apps/web` の tsc が `apps/api/src/lib/bindings.ts` 等を走査して global types 解決失敗
- **解消**: Deviation #2 を参照

### Issue 3: AppType に rooms ルートが含まれない (web typecheck 失敗)

- **症状**: `api.rooms` プロパティが見えず、`api.health` のみ存在
- **解消**: Deviation #3 を参照

### Issue 4: OpenAPI 仕様で path が `/rooms/:id` 形式 (非標準)

- **症状**: openapi.test.ts で `expect(doc.paths).toHaveProperty('/rooms/{id}')` が失敗、実際は `/rooms/:id` キー
- **解消**: Deviation #4 を参照

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/api/src/__tests__/openapi.test.ts` | 2 | OpenAPI doc paths + Scalar HTML レスポンス |
| `apps/web/src/lib/__tests__/api-client.test.ts` | 4 | hc<AppType> smoke (rooms.$post, rooms[":id"].$get, rooms[":id"].image.$get, health.$get) |

## Next Steps

- [ ] Code review via `/code-review` (本ブランチに積んだ全 commit を対象)
- [ ] Manual browser smoke: `pnpm -F @snap-share/api dev` 起動 → `http://localhost:8787/api/docs` で Scalar UI 描画を目視
- [ ] `apps/web/.env` 作成 (`.env.example` をコピー) — ローカル開発時に必要
- [ ] PR 作成 (Phase 2.5 完結 PR) via `/prp-pr` または手動 `gh pr create`
- [ ] PRD の Phase 2.5 status を `complete` に更新
