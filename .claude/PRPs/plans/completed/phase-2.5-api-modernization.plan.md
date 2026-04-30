# Plan: Phase 2.5 — API モダン化 (`@hono/zod-openapi` + `hc` 配線)

## Summary

既存の Hono + `@hono/zod-validator` REST 3 ルートを破壊せずに、(1) クライアント型推論を `hc<AppType>` で確立し、(2) `@hono/zod-openapi` への移行で OpenAPI 3.1 仕様を自動生成、(3) `@scalar/hono-api-reference` で `/api/docs` を mount する。`apps/web` から `api.rooms[':id'].$get()` 形式で型安全に呼び出せる状態にする。

## User Story

As a developer building the snap-share Web client (Phase 3 以降),
I want type-safe API calls from client to server with auto-generated docs,
So that I can refactor backend changes with compiler guarantees and onboard external API consumers without hand-written specs.

## Problem → Solution

- **現状**: API は型安全だがサーバ側に閉じている。`apps/web` から呼ぶ手段がなく、クライアント実装で型を再定義する負債が発生する直前。
- **解決**: `hc<AppType>` で型を末端まで通し、`@hono/zod-openapi` で外部公開仕様も同時に得る。

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/snap-share.prd.md`
- **PRD Phase**: Phase 2.5 — API モダン化
- **ADR**: [ADR-0002](../../../docs/adr/ADR-0002-hono-zod-openapi-tanstack-stack.md)
- **Estimated Files**: 8〜12 (新規 4 + 編集 4〜8)

---

## UX Design

### Before

```
┌─────────────────────────────────────────┐
│  Developer (Phase 3 以降):               │
│   - apps/web から fetch を手書き         │
│   - レスポンス型を手で書き直す            │
│   - 仕様変更時にクライアント側で気づけない │
└─────────────────────────────────────────┘
```

### After

```
┌─────────────────────────────────────────┐
│  Developer:                              │
│   const room = await api.rooms[':id']    │
│     .$get({ param: { id }})             │
│   if (!room.ok) ...                      │
│   const data = await room.json()         │
│   //          ^? Room (型推論)           │
│                                          │
│  ブラウザで /api/docs:                   │
│   - Scalar UI で 3 ルート全仕様表示      │
│   - 直接エンドポイントを叩いて検証可能    │
└─────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| クライアントからの API 呼び出し | 未実装 (Phase 3 で `fetch` を手書き予定だった) | `hc<AppType>` 経由で型推論 | dev/prod 両方 |
| API 仕様の参照 | コードを読む | `/api/docs` で UI 表示 | Scalar UI |
| 仕様変更時の波及 | クライアント側で手動修正 | コンパイラが型エラーを出す | DX 向上 |

---

## Mandatory Reading

Files that MUST be read before implementing:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/api/src/index.ts` | 1-18 | エントリポイント — `AppType` を export する場所 |
| P0 | `apps/api/src/routes/rooms.ts` | all | `POST /rooms`, `GET /rooms/:id` — 移行対象 |
| P0 | `apps/api/src/routes/images.ts` | all | `GET /rooms/:id/image` — バイナリ Response、移行対象 |
| P0 | `packages/shared/src/room.ts` | all | Zod SSOT — OpenAPI のスキーマ源 |
| P0 | `apps/api/src/lib/error.ts` | all | `errorEnvelope` / `AppError` — エラーレスポンスの形 |
| P1 | `apps/api/src/__tests__/rooms.test.ts` | all | 移行後も無改変で緑である必要あり |
| P1 | `apps/api/src/__tests__/images.test.ts` | all | 同上 |
| P1 | `apps/api/src/__tests__/helpers/build-env.ts` | all | テスト環境ヘルパ |
| P1 | `apps/web/src/main.tsx` / `App.tsx` | all | `hc` クライアント注入ポイント |
| P1 | `apps/web/vite.config.ts` | all | dev サーバ port 5173 / proxy 設定有無 |
| P2 | `apps/api/package.json` | all | 既存依存 |
| P2 | `apps/web/package.json` | all | 既存依存 |
| P2 | `pnpm-workspace.yaml` | all | catalog 利用パターン |
| P2 | `apps/api/wrangler.toml` | all | バインディング設定 |
| P2 | `tsconfig.base.json` | all | strict / verbatimModuleSyntax 設定 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Hono RPC (`hc`) | https://hono.dev/docs/guides/rpc | `export type AppType = typeof route` (チェイン後の変数), `hc<AppType>(baseUrl)` |
| `hc` + multipart File | Hono docs (RPC guide) | `client.user.picture.$put({ form: { file: new File(...) } })` — `z.instanceof(File)` ルートと相性◎ |
| `$url()` ヘルパ | Hono docs (RPC guide) | `client.api.posts[':id'].$url({ param: { id } })` — 画像 GET の絶対 URL 生成に有用 |
| `@hono/zod-openapi` | https://hono.dev/examples/zod-openapi | `OpenAPIHono`, `createRoute({ method, path, request, responses })`, `app.openapi(route, handler)`, `app.doc31('/api/openapi.json', ...)` |
| Scalar mount | https://github.com/scalar/scalar/tree/main/packages/hono-api-reference | `app.get('/api/docs', Scalar({ url: '/api/openapi.json' }))` |

---

## Patterns to Mirror

### NAMING_CONVENTION
```ts
// SOURCE: apps/api/src/routes/rooms.ts:1-15
import { ROOM_ID_REGEX } from '@snap-share/shared';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';
import type { Bindings } from '../lib/bindings';
import { errorEnvelope } from '../lib/error';
import { logger } from '../lib/logger';
```
- `kebab-case` ファイル名 (`room-service.ts`)
- ルート Hono インスタンスは末尾 `Route`: `roomsRoute`, `imagesRoute`
- 型は PascalCase, 関数 camelCase
- ファイル単一 export 優先

### ERROR_HANDLING
```ts
// SOURCE: apps/api/src/lib/error.ts:32-56
export const errorEnvelope = (code: ErrorCode, message: string): ErrorEnvelope => ({
  ok: false,
  error: { code, message },
});

export class AppError extends HTTPException {
  readonly code: ErrorCode;
  readonly logContext?: Record<string, unknown>;
  // ...
}
```
- 全エラーは `errorEnvelope` 形式 `{ ok: false, error: { code, message } }`
- `AppError` は HTTPException 継承、`logContext` で構造化ログ補足
- 公開メッセージはユーザー入力をエコーしない (セキュリティ要件)

### LOGGING_PATTERN
```ts
// SOURCE: apps/api/src/lib/logger.ts:6-13
export const logger = {
  info: (msg: string, meta?: Meta) => /* ... */,
  warn: (msg: string, meta?: Meta) => /* ... */,
  error: (msg: string, meta?: Meta) => /* ... */,
};
```
- `console.*` の薄いラッパ、prefix `[api]`
- 第二引数で `Record<string, unknown>` の構造化メタ

### ROUTE_DEFINITION (現状の zValidator 形式)
```ts
// SOURCE: apps/api/src/routes/rooms.ts:25-46
roomsRoute.post(
  '/',
  zValidator('form', uploadSchema, (result, c) => {
    if (!result.success) {
      logger.warn('upload validation failed', {
        path: c.req.path,
        issues: result.error.issues.map((i) => ({ path: i.path, code: i.code })),
      });
      return c.json(errorEnvelope('INVALID_REQUEST', 'image field is required'), 400);
    }
    return undefined;
  }),
  async (c) => {
    const { image } = c.req.valid('form');
    const room = await buildService(c.env).create(image);
    return c.json(room, 201);
  },
);
```

### TEST_STRUCTURE
```ts
// SOURCE: apps/api/src/__tests__/rooms.test.ts:11-27
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
- HTTP リクエストレベル (`app.request`) でテスト
- `buildEnv()` で in-memory R2 + TTL を注入
- レスポンス JSON は `as Room` でキャスト (Phase 2.5 後は `hc` 経由なら型推論で済む)

### SHARED_SCHEMA_SSOT
```ts
// SOURCE: packages/shared/src/room.ts:18-37
export const RoomSchema = z.object({
  id: z.string().regex(ROOM_ID_REGEX),
  createdAt: z.number().int().nonnegative(),
  ttlMs: z.number().int().positive(),
  image: RoomImageSchema,
}).readonly();

export type Room = z.infer<typeof RoomSchema>;
```
- スキーマ → 型導出 (`z.infer`) の SSOT パターン
- `.readonly()` で immutable 強制

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/api/package.json` | UPDATE | `@hono/zod-openapi` / `@scalar/hono-api-reference` 追加 |
| `apps/web/package.json` | UPDATE | `@snap-share/api` を type-only 依存として追加 |
| `pnpm-workspace.yaml` | UPDATE | catalog に `@hono/zod-openapi` / `@scalar/hono-api-reference` を追加 |
| `apps/api/src/index.ts` | UPDATE | `OpenAPIHono` へ差し替え、`AppType` export、Scalar mount |
| `apps/api/src/routes/rooms.ts` | UPDATE | `createRoute` ベースへ書き換え |
| `apps/api/src/routes/images.ts` | UPDATE | `createRoute` ベースへ書き換え、binary は `c.body()` |
| `packages/shared/src/room.ts` | UPDATE (任意) | `.openapi('Room')` メタ付与 (zod-openapi 拡張)。SSOT 維持 |
| `apps/api/src/lib/openapi.ts` | CREATE | OpenAPI ドキュメント設定 (`info`, `servers`, `tags`) を 1 箇所に集約 |
| `apps/web/src/lib/api-client.ts` | CREATE | `hc<AppType>` インスタンス + 環境変数からの baseUrl 解決 |
| `apps/web/.env.example` | CREATE | `VITE_API_URL=http://localhost:8787` |
| `apps/web/src/__tests__/api-client.test.ts` | CREATE | `hc` 型推論が壊れていないことの最小スモークテスト |
| `apps/api/src/__tests__/openapi.test.ts` | CREATE | `/api/openapi.json` が 3 ルートを含むことの検証 |
| `apps/api/src/__tests__/rooms.test.ts` | NO-CHANGE | 既存テストは移行後も無改変で通る前提 (acceptance criteria) |
| `apps/api/src/__tests__/images.test.ts` | NO-CHANGE | 同上 |

## NOT Building

- **TanStack Router / Query の導入**: Phase 3 のキャンバス画面実装で必要になったタイミングで別 PR
- **`POST /rooms` の form 形式変更**: 引き続き `multipart/form-data` のまま
- **OpenAPI 仕様のリポジトリへのコミット (`docs/api/openapi.json`)**: ADR-0002 §Implementation Plan 7 番に記載したが本 Phase では実施しない (Phase 3 着手時に再検討)
- **本番環境での `/api/docs` 公開ガード**: 公開ツール想定なので現時点ではガード不要、必要になったら別 PR
- **エラーレスポンスのスキーマ統一**: 既存 `errorEnvelope` を OpenAPI に書き出すのみ。形は変えない
- **既存テストの書き換え**: HTTP リクエストレベルなので無改変で通るのが品質保証ライン

---

## Step-by-Step Tasks

### Task 1: 依存追加 + catalog 更新

- **ACTION**: `pnpm-workspace.yaml` の `catalog:` に `@hono/zod-openapi` / `@scalar/hono-api-reference` を追加し、`apps/api/package.json` で `catalog:` 参照
- **IMPLEMENT**:
  - `pnpm-workspace.yaml` catalog セクション末尾に追記
  - `apps/api/package.json` の `dependencies` に `"@hono/zod-openapi": "catalog:"` `"@scalar/hono-api-reference": "catalog:"` を追加
  - `pnpm install` 実行
- **MIRROR**: `pnpm-workspace.yaml` 既存の catalog 形式
- **IMPORTS**: なし
- **GOTCHA**: `@hono/zod-openapi` は Zod v4 対応版を選ぶこと (古いメジャーは v3 のみ)。`pnpm` がエラー出したらバージョン指定の見直し
- **VALIDATE**: `pnpm install` が緑、`pnpm -F @snap-share/api typecheck` が緑

### Task 2: OpenAPI ドキュメント設定モジュールを作成

- **ACTION**: `apps/api/src/lib/openapi.ts` を新規作成、`info` / `servers` / `tags` を 1 箇所に集約
- **IMPLEMENT**:
  ```ts
  // apps/api/src/lib/openapi.ts
  export const openApiDocConfig = {
    openapi: '3.1.0',
    info: {
      title: 'snap-share API',
      version: '0.0.0',
      description: 'Image annotation rooms (PRD-driven)',
    },
    tags: [
      { name: 'rooms', description: 'Room CRUD' },
      { name: 'images', description: 'Image binary delivery' },
    ],
  } as const;
  ```
- **MIRROR**: `apps/api/src/lib/bindings.ts` の単一責務モジュール
- **IMPORTS**: なし (型定義のみ)
- **GOTCHA**: なし
- **VALIDATE**: `pnpm -F @snap-share/api typecheck` 緑

### Task 3: `apps/api/src/index.ts` を `OpenAPIHono` に切り替え + Scalar mount + AppType export

- **ACTION**: `Hono` を `OpenAPIHono` に差し替え、`/api/openapi.json` と `/api/docs` を mount、`AppType` を export
- **IMPLEMENT**:
  ```ts
  import { OpenAPIHono } from '@hono/zod-openapi';
  import { Scalar } from '@scalar/hono-api-reference';
  import type { Bindings } from './lib/bindings';
  import { onAppError, onAppNotFound } from './lib/error';
  import { openApiDocConfig } from './lib/openapi';
  import { imagesRoute } from './routes/images';
  import { roomsRoute } from './routes/rooms';

  const app = new OpenAPIHono<{ Bindings: Bindings }>();

  app.get('/health', (c) =>
    c.json({ ok: true, service: 'snap-share-api', ts: Date.now() }),
  );

  const routed = app.route('/rooms', roomsRoute).route('/rooms', imagesRoute);

  app.doc31('/api/openapi.json', openApiDocConfig);
  app.get('/api/docs', Scalar({ url: '/api/openapi.json' }));

  app.notFound(onAppNotFound);
  app.onError(onAppError);

  export type AppType = typeof routed;
  export default app;
  ```
- **MIRROR**: 現状の `apps/api/src/index.ts:1-18` の構造をそのまま維持しつつ `OpenAPIHono` へ
- **IMPORTS**: `OpenAPIHono`, `Scalar`, 既存 imports
- **GOTCHA**:
  - `AppType` は `app` 直接でなく `app.route(...).route(...)` のチェイン結果 (`routed`) から取る (Hono RPC ガイド準拠)
  - `app.doc31` は OpenAPI 3.1 用、`app.doc` は 3.0
- **VALIDATE**:
  - `pnpm -F @snap-share/api typecheck` 緑
  - `pnpm -F @snap-share/api dev` 起動 → `curl http://localhost:8787/health` で `{ok:true,...}`
  - `curl http://localhost:8787/api/openapi.json` で OpenAPI 仕様 JSON

### Task 4: `routes/rooms.ts` を `createRoute` 形式へ移行

- **ACTION**: `roomsRoute` を `OpenAPIHono` 化、`POST /` と `GET /:id` を `createRoute` で再定義
- **IMPLEMENT**:
  ```ts
  import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
  import { ROOM_ID_REGEX, RoomSchema } from '@snap-share/shared';
  import type { Bindings } from '../lib/bindings';
  import { errorEnvelope } from '../lib/error';
  import { logger } from '../lib/logger';
  import { createRoomService } from '../services/room-service';
  import { createR2ImageStorage } from '../storage/r2-image-storage';
  import { createR2MetaStorage } from '../storage/r2-meta-storage';

  const RoomResponse = RoomSchema.openapi('Room');
  const ErrorResponse = z
    .object({
      ok: z.literal(false),
      error: z.object({
        code: z.enum([
          'INVALID_REQUEST',
          'UNSUPPORTED_MEDIA_TYPE',
          'PAYLOAD_TOO_LARGE',
          'NOT_FOUND',
          'INTERNAL',
        ]),
        message: z.string(),
      }),
    })
    .openapi('ErrorEnvelope');

  const idParamSchema = z.object({
    id: z.string().regex(ROOM_ID_REGEX).openapi({ param: { name: 'id', in: 'path' } }),
  });

  const uploadFormSchema = z.object({
    image: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
  });

  const buildService = (env: Bindings) =>
    createRoomService({
      images: createR2ImageStorage(env.IMAGES),
      meta: createR2MetaStorage(env.IMAGES),
      now: () => Date.now(),
      ttlMs: Number(env.ROOM_TTL_MS),
    });

  export const roomsRoute = new OpenAPIHono<{ Bindings: Bindings }>();

  const createRoomRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['rooms'],
    request: {
      body: { content: { 'multipart/form-data': { schema: uploadFormSchema } } },
    },
    responses: {
      201: { content: { 'application/json': { schema: RoomResponse } }, description: 'Created' },
      400: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Bad Request' },
      413: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Payload Too Large' },
      415: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Unsupported Media Type' },
    },
  });

  roomsRoute.openapi(createRoomRoute, async (c) => {
    const form = await c.req.parseBody();
    const image = form['image'];
    if (!(image instanceof File)) {
      logger.warn('upload validation failed', { path: c.req.path });
      return c.json(errorEnvelope('INVALID_REQUEST', 'image field is required'), 400);
    }
    const room = await buildService(c.env).create(image);
    return c.json(room, 201);
  });

  const getRoomRoute = createRoute({
    method: 'get',
    path: '/:id',
    tags: ['rooms'],
    request: { params: idParamSchema },
    responses: {
      200: { content: { 'application/json': { schema: RoomResponse } }, description: 'OK' },
      400: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Invalid ID' },
      404: { content: { 'application/json': { schema: ErrorResponse } }, description: 'Not Found' },
    },
  });

  roomsRoute.openapi(getRoomRoute, async (c) => {
    const { id } = c.req.valid('param');
    const room = await buildService(c.env).get(id);
    return c.json(room, 200);
  });
  ```
- **MIRROR**: 既存 rooms.ts のサービス層呼び出し / エラーハンドリングをそのまま維持
- **IMPORTS**: `OpenAPIHono`, `createRoute`, `z` (from `@hono/zod-openapi`)
- **GOTCHA**:
  - `multipart/form-data` の File を `z.instanceof(File)` で OpenAPI 化するときは `.openapi({ type: 'string', format: 'binary' })` で OpenAPI binary string へマップする
  - `@hono/zod-openapi` の `z` は `zod` 純正でなく拡張版。プロジェクト内の `import * as z from 'zod'` と混在させない
  - `RoomSchema.openapi('Room')` は `@hono/zod-openapi` を import すると Zod プロトタイプ拡張で利用可能になる (副作用 import)
- **VALIDATE**:
  - `pnpm -F @snap-share/api test` で `rooms.test.ts` 全テスト緑 (無改変で通ること = acceptance)
  - `curl -F image=@cat.png http://localhost:8787/rooms` で 201 + Room JSON

### Task 5: `routes/images.ts` を `createRoute` 形式へ移行

- **ACTION**: `imagesRoute` を `OpenAPIHono` 化、`GET /:id/image` を `createRoute` で再定義 (binary レスポンス)
- **IMPLEMENT**:
  - `createRoute` の `responses[200]` で `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` を content として宣言
  - handler は既存の `R2Object.body` ストリーム返却ロジックを維持、`Response` または `c.body()` で返す
  - schema 部分は `z.unknown()` または schema 省略 (`@hono/zod-openapi` は content schema 省略を許容)
- **MIRROR**: 既存 images.ts:14-43 の handler ロジックをそのまま維持
- **IMPORTS**: `OpenAPIHono`, `createRoute`, `z`
- **GOTCHA**:
  - binary レスポンスは OpenAPI で型表現が緩い。`schema: z.string().openapi({ format: 'binary' })` または schema を空にする
  - `c.body(stream, 200, headers)` で `Response` を直接返すパターンを使うと `hc` の型推論が `Response` を返すジェネリックになる — 画像 GET では妥当
  - 既存の `headers.set('content-disposition', ...)` ロジック (SVG 強制ダウンロード) を絶対に削らない (XSS 対策)
- **VALIDATE**:
  - `pnpm -F @snap-share/api test` で `images.test.ts` 4 テスト全緑
  - `curl http://localhost:8787/rooms/<id>/image` で画像バイナリ + 正しいヘッダ

### Task 6: `apps/web` から API 型を参照できるようにする

- **ACTION**: `apps/web/package.json` に `@snap-share/api` を依存として追加 (型のみ利用)
- **IMPLEMENT**:
  - `apps/web/package.json` `dependencies` に `"@snap-share/api": "workspace:*"` 追加
  - `pnpm install`
  - 注意: 実行時は import しない、型のみの import (`import type`)
- **MIRROR**: `apps/web/package.json` の `@snap-share/shared: workspace:*` 既存パターン
- **IMPORTS**: なし (package.json 編集のみ)
- **GOTCHA**:
  - `@snap-share/api` の `package.json` に `exports` フィールドが必要かもしれない (現状 `main` も無いため)。必要なら `apps/api/package.json` に `"exports": { ".": { "types": "./src/index.ts" } }` を追加
  - tsconfig の `moduleResolution: "Bundler"` であれば `.ts` を直接参照できる
- **VALIDATE**: `pnpm -F @snap-share/web typecheck` 緑

### Task 7: `apps/web/src/lib/api-client.ts` を作成

- **ACTION**: `hc<AppType>` インスタンスを 1 箇所で生成
- **IMPLEMENT**:
  ```ts
  import type { AppType } from '@snap-share/api';
  import { hc } from 'hono/client';

  const baseUrl = import.meta.env.VITE_API_URL;
  if (!baseUrl) {
    throw new Error('VITE_API_URL is not configured');
  }
  export const api = hc<AppType>(baseUrl);
  ```
- **MIRROR**: `apps/api/src/lib/` の単一責務モジュール構成
- **IMPORTS**: `import type { AppType }` (型のみ), `hc from 'hono/client'`
- **GOTCHA**:
  - `import type` を必ず付ける (Workers ランタイムコードを web バンドルに混入させない)
  - `verbatimModuleSyntax: true` (tsconfig.base.json) のため type-only import は明示必須
  - `VITE_API_URL` は `apps/web/.env` (gitignore) と `.env.example` (commit) で管理
- **VALIDATE**:
  - `pnpm -F @snap-share/web typecheck` 緑
  - `apps/web/src/__tests__/api-client.test.ts` の型推論スモークテスト緑

### Task 8: `apps/web/.env.example` 作成 + `apps/web/src/__tests__/api-client.test.ts` 作成

- **ACTION**: 環境変数テンプレートと型推論スモークテスト
- **IMPLEMENT**:
  ```
  # apps/web/.env.example
  VITE_API_URL=http://localhost:8787
  ```
  ```ts
  // apps/web/src/__tests__/api-client.test.ts
  import { describe, expect, it } from 'vitest';
  import { api } from '../lib/api-client';

  // Smoke test: ensure hc compile-time type inference is wired.
  // We do NOT make a real network call here.
  describe('api client (smoke)', () => {
    it('exposes rooms.$post / rooms[":id"].$get / rooms[":id"].image.$get', () => {
      expect(typeof api.rooms.$post).toBe('function');
      expect(typeof api.rooms[':id'].$get).toBe('function');
      expect(typeof api.rooms[':id'].image.$get).toBe('function');
    });
  });
  ```
- **MIRROR**: 既存テストの describe/it スタイル
- **IMPORTS**: vitest
- **GOTCHA**: テスト中で `import.meta.env.VITE_API_URL` が undefined になるため、`vitest.config.ts` の `test.env` か `setupFiles` で `VITE_API_URL` を注入するか、`apps/web/.env.test` を作る
- **VALIDATE**: `pnpm -F @snap-share/web test` 緑

### Task 9: `apps/api/src/__tests__/openapi.test.ts` 作成

- **ACTION**: `/api/openapi.json` が 3 ルートを含むことを検証
- **IMPLEMENT**:
  ```ts
  import { describe, expect, it } from 'vitest';
  import app from '../index';
  import { buildEnv } from './helpers/build-env';

  describe('GET /api/openapi.json', () => {
    it('exposes the 3 phase-2 routes in the OpenAPI document', async () => {
      const res = await app.request('/api/openapi.json', undefined, buildEnv());
      expect(res.status).toBe(200);
      const doc = (await res.json()) as { paths: Record<string, unknown> };
      expect(doc.paths).toHaveProperty('/rooms');
      expect(doc.paths).toHaveProperty('/rooms/{id}');
      expect(doc.paths).toHaveProperty('/rooms/{id}/image');
    });
  });
  ```
- **MIRROR**: `rooms.test.ts` のテスト構造
- **IMPORTS**: 既存テストヘルパ
- **GOTCHA**: `@hono/zod-openapi` のパスは `:id` を `{id}` に変換する (OpenAPI 仕様準拠)
- **VALIDATE**: `pnpm -F @snap-share/api test` 緑

### Task 10: 既存テスト全件緑確認 + lint/format 通過

- **ACTION**: 移行後にも既存挙動が壊れていないことを確認
- **IMPLEMENT**: 検証コマンド一括実行
- **VALIDATE**:
  - `pnpm -r typecheck` 全 workspace 緑
  - `pnpm -r test` 全 workspace 緑
  - `pnpm -F @snap-share/api dev` で `/api/docs` を Chrome で開き Scalar UI が描画されることを目視確認
  - `pnpm biome check .` 緑

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| 既存 rooms.test.ts (5 件) | (無改変) | 全緑 | NO (回帰検知) |
| 既存 images.test.ts (4 件) | (無改変) | 全緑 | NO (回帰検知) |
| openapi.test.ts | `GET /api/openapi.json` | 200 + 3 paths 存在 | NO |
| api-client.test.ts (web) | `api.rooms.$post` 等の型 | 関数として存在 | NO (smoke) |

### Edge Cases Checklist

- [x] `multipart/form-data` の `File` が `@hono/zod-openapi` 経由でも届く (Task 4 のテストで検証)
- [x] バイナリ Response の `content-disposition` ヘッダが SVG で維持される (既存 images.test.ts で検証)
- [x] エラーレスポンス形式 (`errorEnvelope`) が変わっていない (既存テストで検証)
- [x] 不正 NanoID で 400 (path traversal 攻撃) (既存テストで検証)
- [x] 巨大ファイルで 413 (既存テストで検証)
- [x] OpenAPI 仕様の path が `{id}` 形式 (openapi.test.ts で検証)
- [ ] dev 環境での Scalar UI 描画 (Task 10 で目視)

---

## Validation Commands

### Static Analysis

```bash
pnpm -r typecheck
```
EXPECT: Zero type errors across all workspaces

### Unit Tests (per package)

```bash
pnpm -F @snap-share/api test
pnpm -F @snap-share/web test
```
EXPECT: All tests pass, including the 9 existing API tests + 2 new ones

### Full Test Suite

```bash
pnpm -r test
```
EXPECT: No regressions

### Lint / Format

```bash
pnpm biome check .
```
EXPECT: No errors

### Browser Validation (dev only)

```bash
pnpm -F @snap-share/api dev   # http://localhost:8787
# 別ターミナル
open http://localhost:8787/api/docs
```
EXPECT: Scalar UI が描画され `POST /rooms`, `GET /rooms/{id}`, `GET /rooms/{id}/image` が表示される、Try-it-out で実呼び出しが成功

### Manual Validation

- [ ] `apps/web` の `App.tsx` 内で `import { api } from './lib/api-client'` を追加し、`api.rooms[':id'].$get({param:{id:'V1StGXR8_Z5jdHi6B-mYT'}})` の型推論で IDE が `Promise<Response<Room | ErrorEnvelope>>` を表示することを確認 (確認後この import は削除)
- [ ] `/api/openapi.json` をブラウザで開き、Zod スキーマが正しく OpenAPI 3.1 仕様に変換されている

---

## Acceptance Criteria

- [ ] 既存テスト 9 件 (rooms 5 + images 4) が無改変で全緑
- [ ] 新規テスト 2 件 (openapi.test.ts, api-client.test.ts) 緑
- [ ] `/api/docs` で Scalar UI が描画される
- [ ] `/api/openapi.json` が OpenAPI 3.1 仕様として valid (3 paths 含む)
- [ ] `apps/web` から `api.rooms[':id'].$get()` 形式で型推論が末端まで通る
- [ ] `pnpm -r typecheck` 緑
- [ ] `pnpm biome check .` 緑

## Completion Checklist

- [ ] Code follows discovered patterns (kebab-case, errorEnvelope, logger.warn 構造化)
- [ ] Error handling matches codebase style (`AppError` + `errorEnvelope` で完結)
- [ ] Logging follows codebase conventions (`logger.warn` + meta オブジェクト)
- [ ] Tests follow test patterns (`app.request` + `buildEnv`)
- [ ] No hardcoded values (環境変数 + ROOM_TTL_MS の string キャスト維持)
- [ ] Documentation updated: PRD Phase 2.5 status → in-progress (本プラン作成時に自動更新) / 完了時 → complete
- [ ] No unnecessary scope additions (TanStack Router/Query は本 Phase 対象外)
- [ ] Self-contained — 実装中に追加検索が不要

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `@hono/zod-openapi` と Zod v4 の互換問題 | 中 | 中 | Task 1 で最新版確認、互換版が無い場合は ADR-0002 §Validation の fallback (純 hc + OpenAPI なし) に倒す |
| `multipart/form-data` の File を OpenAPI でうまく表現できない | 中 | 低 | `.openapi({ type: 'string', format: 'binary' })` で対応、ダメなら content schema を空にしてランタイム挙動だけ維持 |
| `apps/web` から `apps/api` の型を import するときに Workers 専用 API (R2Bucket 等) が web の TS チェックに混入 | 中 | 中 | `import type` のみ、`Bindings` 型を AppType の generic に閉じ込める。最悪 `apps/api/src/index.ts` から `AppType` を `apps/api/src/types.ts` などに切り出して web 側に純粋型のみ露出 |
| Scalar UI が Workers ランタイムで動かない | 低 | 低 | `@scalar/hono-api-reference` は HTML を返すだけのミドルウェア、Workers で動作実績あり |
| 既存テストが移行後に壊れる | 低 | 高 | acceptance criteria の最重要項目。1 ルート移行ごとに `pnpm -F @snap-share/api test` を回す |

## Notes

- ADR-0002 は accepted 済み (`docs/adr/ADR-0002-hono-zod-openapi-tanstack-stack.md`)
- 本プランは Phase 3 と並行可能だが、ADR-0002 §Implementation Plan / PRD Parallelism Notes により **Phase 3 着手前の先行を強推奨**
- `hc` は OpenAPI 移行とは独立に動作する。万が一 `@hono/zod-openapi` でブロックしたら、Task 6-8 のみ先行コミットして OpenAPI 移行を Phase 2.5b として分離可能
- ECC 学習観点: 「ADR-0002 で意思決定 → PRD で Phase 化 → plan で実装ブループリント → implement で TDD ループ」という ECC PRP ワークフロー一周を体験する Phase
