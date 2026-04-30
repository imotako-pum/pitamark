# Implementation Report: Phase 2 — 画像アップロード基盤 (Image Upload Foundation)

> Generated: 2026-04-30
> Branch: `feat/phase-2-image-upload`
> Plan: [.claude/PRPs/plans/phase-2-image-upload.plan.md](../plans/phase-2-image-upload.plan.md)
> PRD: [.claude/PRPs/prds/snap-share.prd.md](../prds/snap-share.prd.md) — Phase 2

## Summary

`apps/api` に Cloudflare R2 バインディング `IMAGES` を配線し、`POST /rooms`（multipart 画像 → NanoID 21 文字のルーム ID 払い出し + R2 アップロード + メタ JSON 永続化）/ `GET /rooms/:id`（ルームメタ JSON）/ `GET /rooms/:id/image`（R2 ストリーム配信）の 3 エンドポイントを実装。`packages/shared` の `RoomSchema` を `image: RoomImageSchema` で拡張して SSOT を維持。`pnpm turbo run lint typecheck test build` および E2E すべて green、計 **49 件のテストが GREEN**（shared 19 + api 28 + web 2）。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium（妥当） |
| Confidence | 8/10 | 9/10 |
| Estimated Files | 約 17 新規 + 6 更新 | 16 新規 + 9 更新 |
| Estimated LOC | 600〜800 | 約 600 行（diff +260 既存 + 約 340 新規 ≈ 600） |
| Tests Added | ~25 ケース | **27 ケース** （shared +10 / api +27） |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | catalog 拡張 (`nanoid` / `@hono/zod-validator`) | ✅ | `@hono/zod-validator` は Zod v4 対応のため `^0.4` → `^0.7` に修正（下記 Deviations 参照） |
| 2 | `RoomSchema` 拡張 + SSOT | ✅ | `ALLOWED_IMAGE_MIME_TYPES`, `RoomImageSchema`, `AllowedImageMimeType` を追加。テスト 19 件 GREEN |
| 3 | `wrangler.toml` に R2 binding 追加 | ✅ | `[[r2_buckets]] binding=IMAGES bucket_name=snap-share-images` + `[vars] ROOM_TTL_MS="604800000"` |
| 4 | `apps/api/package.json` deps 追加 | ✅ | `@hono/zod-validator: catalog:`, `nanoid: catalog:`, `zod: catalog:` |
| 5 | `lib/bindings.ts` | ✅ | `Bindings = { IMAGES: R2Bucket; ROOM_TTL_MS: string }` |
| 6 | `lib/error.ts` (テスト先行) | ✅ | `AppError` / `errorEnvelope` / `onAppError` / `onAppNotFound`、テスト 4 件 |
| 7 | `lib/id.ts` (テスト先行) | ✅ | `generateRoomId()` (NanoID 21 chars)、テスト 3 件 |
| 8 | `lib/logger.ts` | ✅ | `logger.info/warn/error` (`[api]` prefix)、`biome-ignore noConsole` |
| 9 | `storage/r2-image-storage.ts` | ✅ | `createR2ImageStorage(bucket): ImageStorage` factory |
| 10 | `storage/r2-meta-storage.ts` | ✅ | `createR2MetaStorage(bucket): MetaStorage` factory、`metaKey(id) = rooms/{id}/meta.json` |
| 11 | `services/room-service.ts` | ✅ | `createRoomService(deps)` factory、`create(file)` / `get(id)` |
| 12 | テストヘルパ (`in-memory-r2.ts` + `build-env.ts`) | ✅ | `R2Bucket` 全 API を最小実装、`createInMemoryR2WithControls()` で store にも直接アクセス可 |
| 13 | `room-service.test.ts` | ✅ | 10 ケース（create 6 / get 4） |
| 14 | `routes/rooms.ts` | ✅ | `POST /` + `GET /:id`、`zValidator('form', uploadSchema)` で File 強制 |
| 15 | `rooms.test.ts` | ✅ | 7 ケース（POST 5 / GET 2） |
| 16 | `routes/images.ts` + `images.test.ts` | ✅ | `GET /:id/image` で R2 ストリーム配信、テスト 2 件 |
| 17 | `index.ts` 配線 | ✅ | `app.route('/rooms', roomsRoute)` + `app.route('/rooms', imagesRoute)` + `onError`/`notFound` |
| 18 | README 追記 | ✅ | API セクション（curl サンプル + エラー envelope） |
| 19 | 最終検証 + PRD 更新 | ✅ | turbo all green、E2E PASS、PRD は plan 作成時点で in-progress 化済 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (`pnpm turbo run typecheck`) | ✅ Pass | shared / api / web 全 0 type errors |
| Lint (`biome ci .`) | ✅ Pass | 0 errors |
| Unit Tests (`pnpm turbo run test`) | ✅ Pass | 全 49 件 GREEN（shared 19 / api 28 / web 2） |
| Build (`wrangler deploy --dry-run`) | ✅ Pass | api: 626 KiB raw / 99.57 KiB gz、IMAGES R2 binding と ROOM_TTL_MS 環境変数を Wrangler が認識 |
| Integration (Playwright E2E) | ✅ Pass | 既存 1 件 PASS（Phase 6 で本格 E2E 拡張予定） |
| Edge Cases | ✅ Pass | 空ファイル / 上限ぴったり / 上限+1 / 不正 mime / 不在 id / 壊れた meta JSON / スキーマ違反 meta すべてカバー |

## Files Changed

### Created (16 ファイル)

| Path | Purpose |
|---|---|
| `apps/api/src/lib/bindings.ts` | `Bindings` 型集約 |
| `apps/api/src/lib/error.ts` | `AppError` + envelope + handlers |
| `apps/api/src/lib/id.ts` | `generateRoomId()` + `ROOM_ID_LENGTH` |
| `apps/api/src/lib/logger.ts` | `[api]` prefix 付き console wrapper |
| `apps/api/src/storage/r2-image-storage.ts` | R2 画像 put/get factory |
| `apps/api/src/storage/r2-meta-storage.ts` | R2 メタ JSON put/get factory |
| `apps/api/src/services/room-service.ts` | ルーム発行/取得ドメインロジック |
| `apps/api/src/routes/rooms.ts` | `POST /` + `GET /:id` ハンドラ |
| `apps/api/src/routes/images.ts` | `GET /:id/image` ストリーム配信 |
| `apps/api/src/__tests__/helpers/in-memory-r2.ts` | `R2Bucket` 全 API モック |
| `apps/api/src/__tests__/helpers/build-env.ts` | `Bindings` builder |
| `apps/api/src/__tests__/lib/error.test.ts` | error.ts テスト |
| `apps/api/src/__tests__/lib/id.test.ts` | id.ts テスト |
| `apps/api/src/__tests__/services/room-service.test.ts` | room-service テスト |
| `apps/api/src/__tests__/rooms.test.ts` | rooms ルート統合テスト |
| `apps/api/src/__tests__/images.test.ts` | images ルート統合テスト |

### Updated (9 ファイル)

| Path | Action | Diff |
|---|---|---|
| `pnpm-workspace.yaml` | UPDATE | catalog に nanoid + @hono/zod-validator 追加 (+2/-0) |
| `pnpm-lock.yaml` | UPDATE | 依存追加分のロック (+33/-0) |
| `packages/shared/src/room.ts` | UPDATE | RoomImageSchema / AllowedImageMimeType 追加、RoomSchema に image 必須化 (+20/-0) |
| `packages/shared/src/__tests__/room.test.ts` | UPDATE | 新規 10 ケース追加、既存 fixture を image 必須に更新 (+128/-45) |
| `apps/api/wrangler.toml` | UPDATE | r2_buckets + vars 追加 (+9/-2) |
| `apps/api/package.json` | UPDATE | dependencies 追加 (+5/-1) |
| `apps/api/src/index.ts` | UPDATE | rooms/images ルート + onError/notFound 配線 (+11/-3) |
| `README.md` | UPDATE | API セクション追記 (+68/-2) |
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Phase 2 → in-progress + plan link (+1/-1)（plan 作成時に既に実施済） |

## Deviations from Plan

### 1. `@hono/zod-validator` バージョン: `^0.4` → `^0.7`

**WHY**: plan で指定した `^0.4` は peer dependency `zod@^3.19.1` を要求しており、本プロジェクトの Zod v4 と peer 警告（`unmet peer zod@^3.19.1: found 4.4.1`）が出た。npm の latest 版 `0.7.6` は peer `zod: ^3.25.0 || ^4.0.0` で v4 対応のため、catalog エントリを `^0.7` に変更して再 install。動作は完全に同等で、テストも全 GREEN。

### 2. `error.ts` で console 直書き → `logger` 経由に変更

**WHY**: plan のテンプレートでは `error.ts` 内で `console.error('[api] unhandled', err)` 直書きだったが、`logger.ts` を一元化する規約に揃えて `import { logger } from './logger'` に変更。`logger` は `error` を import しないため循環は発生しない。

### 3. in-memory R2 mock が plan より大きい

**WHY**: plan の IN_MEMORY_R2_PATTERN は put/get 最小実装だったが、`R2Bucket` 型の satisfies チェックを通すため `head` / `delete` / `list` / `createMultipartUpload` / `resumeMultipartUpload` まで実装した（後者 2 つは `throw`）。テストの再利用性は向上（`createInMemoryR2WithControls()` で store 直接アクセスも可）。

## Issues Encountered

### 1. `httpMetadata` の union 型エラー

**問題**: `R2PutOptions['httpMetadata']` は `Headers | R2HTTPMetadata` の union（onlyIf 用と共有された型）。in-memory mock 内で `options?.httpMetadata?.contentType` にアクセスしたところ、Headers 側に `contentType` プロパティがないため type error。

**解決**: `const meta = options?.httpMetadata as R2HTTPMetadata | undefined;` でナローイング。本実装側は plain object を渡すので runtime 安全。

### 2. `pnpm install` 後の peer 警告

**問題**: 上記 Deviation #1 と同じ。`@hono/zod-validator@0.4.3` の peer が Zod v3 のみ対応。

**解決**: `npm view @hono/zod-validator@latest peerDependencies` で `^3.25.0 || ^4.0.0` を確認 → `^0.7` に更新。

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `packages/shared/src/__tests__/room.test.ts` | 19 (既存 9 → 19、+10) | RoomImageSchema 全エッジ + RoomSchema image 必須化 |
| `apps/api/src/__tests__/lib/error.test.ts` | 4 (新規) | errorEnvelope / AppError / onAppError / onAppNotFound 統合 |
| `apps/api/src/__tests__/lib/id.test.ts` | 3 (新規) | NanoID 21 chars + URL-safe + uniqueness |
| `apps/api/src/__tests__/services/room-service.test.ts` | 10 (新規) | create 6（happy + 4 つの失敗系 + 上限ぴったり）+ get 4 |
| `apps/api/src/__tests__/rooms.test.ts` | 7 (新規) | POST 5（happy + missing/wrong-type/oversize/empty）+ GET 2 |
| `apps/api/src/__tests__/images.test.ts` | 2 (新規) | 200 + bytes 一致 + 404 |
| `apps/api/src/__tests__/health.test.ts` | 1 (既存維持) | health endpoint |

**合計**: shared 19 + api 28 + web 2 = **49 件 GREEN**。

## Decisions Confirmed at Implementation Time

| Decision | Choice | Rationale |
|---|---|---|
| ルームメタ永続化 | R2 上 `rooms/{id}/meta.json` | DO 不要、KISS |
| 画像配信戦略 | Workers プロキシ `GET /rooms/:id/image` | R2 public 設定不要、Phase 5 で password 制御に拡張可 |
| ルームサービス DI | Factory + deps オブジェクト | per-request lifetime 整合、テストで mock 注入容易 |
| エラーレスポンス | 失敗のみ envelope、成功は裸 JSON | PRD success signal が裸 JSON 想定のため |
| `@hono/zod-validator` | **^0.7（実装時に確定）** | Zod v4 対応の最新安定版 |
| in-memory R2 mock スコープ | put/get/head/delete/list 実装、multipart は throw | `R2Bucket` 型 satisfies と必要 API のバランス |

## Phase 4 / 5 / 6 への布石（実装で固めた点）

- **`Bindings` 型は 1 ファイル集約** (`apps/api/src/lib/bindings.ts`) → Phase 4 で `Y_ROOM: DurableObjectNamespace`、Phase 5 で password 関連を 1 行ずつ追加するだけ
- **factory + deps 構造** → Phase 5 で `now: () => number` 注入が既にあるため、TTL 切れ判定の挿入が容易（`isExpired(room, deps.now())` を `get` に挿すだけ）
- **error envelope の統一形** → Phase 5/7 のレート制限・パスワード認証エラーも同形式で返せる
- **`createR2MetaStorage` の `RoomSchema.parse`** → Phase 5 で `RoomSchema` に optional `passwordHash` を追加しても、既存メタは前方互換（optional フィールドのため）

## Next Steps

- [ ] `/code-review` でローカル変更を一通りレビュー（CRITICAL / HIGH 優先）
- [ ] `/prp-commit` でブランチに commit
- [ ] `/prp-pr` で PR 作成、CI green 確認
- [ ] PRD の Implementation Phases 表 Phase 2 を `in-progress` → `complete` に更新（PR マージ後）
- [ ] Phase 3（キャンバス & 注釈ツール）の plan 作成へ
