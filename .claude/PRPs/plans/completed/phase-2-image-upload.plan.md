# Plan: Phase 2 — 画像アップロード基盤 (Image Upload Foundation)

## Summary

Cloudflare R2 バインディングと Hono ルートを `apps/api` に実装し、`POST /rooms`（multipart 画像 → NanoID 21 文字のルーム ID 発行 + R2 アップロード）/ `GET /rooms/:id`（ルームメタ JSON）/ `GET /rooms/:id/image`（画像ストリーム配信）を提供する。`packages/shared` の `RoomSchema` を `image: RoomImageSchema` で拡張して SSOT を維持し、Phase 4（Yjs+DO）/ Phase 5（パスワード+TTL）/ Phase 6（PNG export）が乗る土台を作る。

## User Story

As a snap-share の Phase 3〜6 を実装する開発オーナー,
I want 画像を 1 リクエストで R2 に保存して安定した URL とルーム ID を返す HTTP API,
So that フロント側（Phase 3）の D&D / paste UI と Yjs DO（Phase 4）が「画像はもう R2 にある・ルーム ID は既に払い出されている」前提で実装に入れる.

## Problem → Solution

**Current**: `apps/api/src/index.ts` には `/health` のみ。`Bindings` 型は `Record<string, never>`。R2 バインディング未配線、`packages/shared/src/room.ts` の `RoomSchema` は `id` / `createdAt` / `ttlMs` だけで画像メタを持たない。画像を保存する経路もルームを発行する経路も存在しない。

**Desired**: `apps/api` が R2 バインディング `IMAGES` を持ち、`POST /rooms` に PNG/JPEG/WebP/SVG（≤10 MiB）をマルチパート送信すると `{ id, image: { key, contentType, size }, createdAt, ttlMs }` を返す。`GET /rooms/:id` で同 JSON が引け、`GET /rooms/:id/image` で R2 から画像が ETag/`Content-Type` 付きでストリーム配信される。`packages/shared` の `RoomSchema` は SSOT として `image` を持ち、Hono は `@hono/zod-validator` 経由で境界検証する。`pnpm turbo run lint typecheck test build` がすべて green、CI も green。

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/snap-share.prd.md`
- **PRD Phase**: Phase 2 — 画像アップロード基盤
- **Estimated Files**: 約 17 ファイル新規 + 6 ファイル更新
- **Estimated LOC**: 600〜800 行（テスト含む）

---

## UX Design

このフェーズはエンドユーザー UI を作らない。検証は curl / 自動テストで行う。`apps/web` のトップページは Phase 1 のプレースホルダのまま、Phase 3（Konva）で本物のアップロード UI に差し替える。

### Before

```
┌──────────────────────────────────────────────────────┐
│  apps/api → http://localhost:8787/health              │
│   { "ok": true, "service": "snap-share-api" }         │
│  R2: 未バインド                                       │
│  画像保存・ルーム発行: 不可                           │
└──────────────────────────────────────────────────────┘
```

### After

```
┌──────────────────────────────────────────────────────┐
│  $ curl -F "image=@cat.png" http://localhost:8787/rooms
│    → 201 { "id":"V1StGXR8_Z5jdHi6B-myT",             │
│            "image":{ "key":"rooms/V1.../image.png",  │
│                     "contentType":"image/png",        │
│                     "size":12345 },                   │
│            "createdAt":1714435200000,                 │
│            "ttlMs":604800000 }                        │
│                                                       │
│  $ curl http://localhost:8787/rooms/V1Stgxr.../        │
│    → 200 (上と同じ JSON)                              │
│                                                       │
│  $ curl http://localhost:8787/rooms/V1Stgxr.../image  │
│    → 200 image/png ストリーム + ETag                  │
└──────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 画像保存 | 経路なし | `POST /rooms` でマルチパート 1 リクエスト | 画像 + ルーム発行を 1 操作に |
| ルームメタ取得 | 経路なし | `GET /rooms/:id` で JSON | image, createdAt, ttlMs |
| 画像配信 | 経路なし | `GET /rooms/:id/image` で R2 プロキシ | エグレス無料を活かす |
| エラー応答 | なし | `{ ok: false, error: { code, message } }` 統一 envelope | Phase 5/7 でも同形式 |
| Bindings 型 | `Record<string, never>` | `{ IMAGES: R2Bucket; ROOM_TTL_MS: string }` | Phase 4 で `Y_ROOM` 追加予定 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 138-174, 212-216 | Phase 2 ゴール・スコープ・Success signal |
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 256-276 | Decisions Log: Zod v4 / SSOT / catalog |
| P0 | `.claude/PRPs/plans/completed/phase-1-monorepo-init.plan.md` | 230-330 | Patterns to Mirror（HONO_ROUTE / ZOD_SSOT / ERROR_HANDLING / LOGGING / TEST_STRUCTURE） |
| P0 | `apps/api/src/index.ts` | 全体 | Phase 1 で確立した Hono 最小エントリ。ここを拡張する |
| P0 | `apps/api/src/__tests__/health.test.ts` | 全体 | `app.request()` を使った Hono ユニットテストの形 |
| P0 | `packages/shared/src/room.ts` | 全体 | RoomSchema 既存定義、`MAX_IMAGE_BYTES`、`DEFAULT_ROOM_TTL_MS` |
| P0 | `packages/shared/src/__tests__/room.test.ts` | 全体 | Zod スキーマテストの AAA パターン |
| P0 | `apps/api/wrangler.toml` | 全体 | Phase 2 で R2 binding を追記する対象 |
| P0 | `apps/api/package.json` | 全体 | deps 追加対象（hono, @hono/zod-validator, nanoid） |
| P0 | `pnpm-workspace.yaml` | 全体 | catalog に `nanoid` / `@hono/zod-validator` を追加する対象 |
| P0 | `.claude/rules/typescript/coding-style.md` | 全体 | unknown narrowing / Zod 境界検証 / immutability |
| P0 | `.claude/rules/common/coding-style.md` | 全体 | KISS / 800 行上限 / 不変性 |
| P0 | `.claude/rules/common/security.md` | 全体 | 入力検証 / 秘密情報の扱い |
| P1 | `.claude/PRPs/prds/snap-share.prd.md` | 156-163 | Architecture Notes: 画像配信戦略・ルーム ID 仕様 |
| P1 | `apps/api/vitest.config.ts` | 全体 | `environment: 'node'` の Vitest 設定 |
| P1 | `apps/api/tsconfig.json` | 全体 | `@cloudflare/workers-types` を参照する tsconfig |
| P1 | `spikes/yjs-durable-object/server/index.ts` | 全体 | Hono + Bindings 型ジェネリクスの参考形 |
| P1 | `.github/workflows/ci.yml` | 全体 | CI が `pnpm turbo run lint typecheck test build` を回すこと |
| P1 | `.claude/rules/common/development-workflow.md` | 全体 | TDD ループ + GitHub code search 優先方針 |
| P2 | `spikes/yjs-durable-object/wrangler.toml` | 全体 | `compatibility_date` / `compatibility_flags` の参考 |
| P2 | `.claude/rules/common/testing.md` | 全体 | 80% カバレッジ目標 / AAA / 命名 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| R2 Workers binding | https://developers.cloudflare.com/r2/api/workers/workers-api-reference | `wrangler.toml` の `[[r2_buckets]]` で `binding = 'IMAGES'`、Worker 内では `env.IMAGES.put(key, body, { httpMetadata })` / `env.IMAGES.get(key)` |
| R2 アップロード上限 | https://developers.cloudflare.com/r2/api/workers/workers-api-reference | Worker 経由 PUT は 100 MiB（Free/Paid）/ 200 MiB（Business）/ 500 MiB（Enterprise）まで。本 PRD の 10 MiB 制限は十分内側 |
| R2 httpMetadata | https://developers.cloudflare.com/r2/api/workers/workers-api-usage | `{ contentType, cacheControl }` を渡すと `object.writeHttpMetadata(headers)` で配信時に復元できる |
| Hono c.req.parseBody | https://hono.dev/docs/api/request | `parseBody()` で `multipart/form-data` を `Record<string, string \| File>` に。File は `instanceof File` で判定可能 |
| Hono `app.request(path, init, env)` | https://hono.dev/docs/guides/testing | 第 3 引数で `c.env` を注入できる → R2 mock を渡してユニットテスト可能 |
| `@hono/zod-validator` | https://hono.dev/docs/guides/validation | `zValidator('json' \| 'form' \| 'query' \| 'param', schema)` で境界検証。失敗時はデフォルトで 400 を返すが、第3引数の hook で envelope 形式に整形できる |
| HTTPException + onError | https://hono.dev/docs/api/exception | `app.onError((err, c) => …)` で全例外を統一 envelope に整形 |
| nanoid 21 chars | https://github.com/ai/nanoid | `import { nanoid } from 'nanoid'` で既定 21 文字 URL-safe ID。Workers の Web Crypto を内部利用するため edge runtime 互換 |

> **GOTCHA — R2 のリージョン**: `wrangler.toml` の `[[r2_buckets]]` は本番では実バケット名と紐付く。Phase 2 では `bucket_name = "snap-share-images"` を仮配置し、バケット作成（`wrangler r2 bucket create snap-share-images`）と本番デプロイは Phase 7 で実施する。ローカル `wrangler dev` は `--local` がデフォルトで in-memory R2 を提供するため、開発に支障なし。

> **GOTCHA — Hono `parseBody` と Cloudflare Workers**: `c.req.parseBody()` は内部で `request.formData()` を 1 回呼ぶ。同じリクエストで `c.req.body` を別途読むと `Body has already been used` で死ぬ。テストでも本番でも、画像取得は `parseBody()` 経由（または `zValidator('form', ...)` 経由）に統一する。

> **GOTCHA — SVG の Content-Type**: ブラウザは `image/svg+xml` を送ってくる。`image/svg` ではない。`ALLOWED_IMAGE_MIME_TYPES` には正確に `image/svg+xml` を含める。

---

## Patterns to Mirror

Phase 1 で確立済みのパターンに加え、Phase 2 で追加するパターンも下記に集約する。

### NAMING_CONVENTION
// SOURCE: `.claude/rules/typescript/coding-style.md` + `apps/api/src/index.ts:1-8`
- 関数・変数: `camelCase`
- スキーマ: `XxxSchema`、対応型は `type Xxx = z.infer<typeof XxxSchema>`
- 定数: `UPPER_SNAKE_CASE`
- ファイル: `kebab-case.ts`（`room-service.ts` / `r2-image-storage.ts`）
- ログ prefix: `[api]`（service 名）

### ZOD_SSOT_PATTERN（Phase 1 確立 → Phase 2 で拡張）
// SOURCE: `packages/shared/src/room.ts:1-16`
```ts
import { z } from 'zod';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;

export const RoomImageSchema = z
  .object({
    key: z.string().min(1),
    contentType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
    size: z.number().int().positive().max(MAX_IMAGE_BYTES),
  })
  .readonly();

export const RoomSchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.number().int().nonnegative(),
    ttlMs: z.number().int().positive(),
    image: RoomImageSchema,
  })
  .readonly();

export type Room = z.infer<typeof RoomSchema>;
export type RoomImage = z.infer<typeof RoomImageSchema>;
```
**SSOT 規約（Phase 1 から継続）**:
- 型は `z.infer<typeof XxxSchema>` で導出。素の `type` で並行定義しない
- API 境界（Hono ハンドラ / Workers エントリ）では Zod スキーマで runtime 検証
- 失敗時は下記 ERROR_RESPONSE_PATTERN で envelope 化して返す

### HONO_ROUTE_PATTERN（Phase 1 確立 → Phase 2 で拡張）
// SOURCE: `apps/api/src/index.ts` + `spikes/yjs-durable-object/server/index.ts`
```ts
// apps/api/src/lib/bindings.ts
export type Bindings = {
  IMAGES: R2Bucket;
  ROOM_TTL_MS: string; // wrangler vars は string で渡る
  // Phase 4: Y_ROOM: DurableObjectNamespace;
  // Phase 5: ROOM_SECRETS: KVNamespace; など
};

// apps/api/src/index.ts
import { Hono } from 'hono';
import type { Bindings } from './lib/bindings';
import { roomsRoute } from './routes/rooms';
import { imagesRoute } from './routes/images';
import { onAppError, onAppNotFound } from './lib/error';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/health', (c) =>
  c.json({ ok: true, service: 'snap-share-api', ts: Date.now() }),
);

app.route('/rooms', roomsRoute);
app.route('/rooms', imagesRoute); // GET /rooms/:id/image

app.notFound(onAppNotFound);
app.onError(onAppError);

export default app;
```

### ZVALIDATOR_PATTERN（Phase 2 新規）
// SOURCE: https://hono.dev/docs/guides/validation + `.claude/rules/typescript/coding-style.md`
```ts
import { zValidator } from '@hono/zod-validator';
import * as z from 'zod';

const uploadFormSchema = z.object({
  image: z.instanceof(File),
});

roomsRoute.post(
  '/',
  zValidator('form', uploadFormSchema, (result, c) => {
    if (!result.success) {
      return c.json(errorEnvelope('INVALID_REQUEST', result.error.message), 400);
    }
  }),
  async (c) => {
    const { image } = c.req.valid('form');
    // ... business logic
  },
);
```
**規約**:
- `zValidator` の第 3 引数 hook で envelope 形式に整形（Phase 5 のパスワード入力検証もここに合わせる）
- `c.req.valid('form')` の戻り値型は Zod スキーマから自動導出される

### ERROR_RESPONSE_PATTERN（Phase 2 新規）
// SOURCE: `.claude/rules/typescript/patterns.md` の API Response Format + `.claude/rules/common/coding-style.md`
```ts
// apps/api/src/lib/error.ts
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'NOT_FOUND'
  | 'INTERNAL';

type ErrorEnvelope = {
  ok: false;
  error: { code: ErrorCode; message: string };
};

export const errorEnvelope = (code: ErrorCode, message: string): ErrorEnvelope => ({
  ok: false,
  error: { code, message },
});

export class AppError extends HTTPException {
  readonly code: ErrorCode;
  constructor(status: 400 | 404 | 413 | 415 | 500, code: ErrorCode, message: string) {
    super(status, { message });
    this.code = code;
  }
}

export const onAppNotFound = (c: Context) =>
  c.json(errorEnvelope('NOT_FOUND', `Route not found: ${c.req.path}`), 404);

export const onAppError = (err: unknown, c: Context) => {
  if (err instanceof AppError) {
    return c.json(errorEnvelope(err.code, err.message), err.status);
  }
  console.error('[api] unhandled', err);
  return c.json(errorEnvelope('INTERNAL', 'Internal Server Error'), 500);
};
```
**成功レスポンス**: 既存 `/health` と新設 `/rooms` 系は **裸の JSON** を返す（PRD で `{ id, image, createdAt, ttlMs }` が success signal として定義されているため、`{ ok: true, data }` の二重包装はしない）。失敗のみ envelope。

### ERROR_HANDLING（Phase 1 確立、再掲）
// SOURCE: `.claude/rules/typescript/coding-style.md`
```ts
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

try {
  await env.IMAGES.put(key, file.stream(), { httpMetadata });
} catch (err: unknown) {
  console.error('[api] R2 put failed', { key, err });
  throw new AppError(500, 'INTERNAL', getErrorMessage(err));
}
```

### LOGGING_PATTERN（Phase 1 確立、再掲）
// SOURCE: `.claude/PRPs/plans/completed/phase-1-monorepo-init.plan.md`
```ts
console.info('[api] room created', { id, contentType, size });
console.warn('[api] oversized upload rejected', { size, max: MAX_IMAGE_BYTES });
console.error('[api] R2 get failed', { id, err });
```
prefix は `[api]`。Phase 5+ で構造化ロガーへ統一する予定。

### REPOSITORY_PATTERN（Phase 2 新規・最小版）
// SOURCE: `.claude/rules/common/patterns.md` の Repository Pattern + `.claude/rules/typescript/patterns.md`
```ts
// apps/api/src/storage/r2-image-storage.ts
export type ImageStorage = {
  putImage(key: string, body: ReadableStream | ArrayBuffer | Blob, contentType: string): Promise<void>;
  getImage(key: string): Promise<R2ObjectBody | null>;
};

export const createR2ImageStorage = (bucket: R2Bucket): ImageStorage => ({
  async putImage(key, body, contentType) {
    await bucket.put(key, body, {
      httpMetadata: { contentType, cacheControl: 'public, max-age=3600' },
    });
  },
  async getImage(key) {
    return bucket.get(key);
  },
});
```
**規約**:
- ストレージ抽象を `ImageStorage` 型で表現 → テストで in-memory 実装に差し替え可能
- factory 関数 `createXxxStorage` 形式（class 不要、KISS）
- ルームメタの永続化は同 R2 バケット内 `rooms/{id}/meta.json` として実装し、`MetaStorage` を別 factory に分離

### TEST_STRUCTURE（Phase 1 確立 → Phase 2 で拡張）
// SOURCE: `apps/api/src/__tests__/health.test.ts` + `.claude/rules/common/testing.md`
```ts
// apps/api/src/__tests__/rooms.test.ts
import { describe, expect, it } from 'vitest';
import app from '../index';
import { buildEnv } from './helpers/build-env';

describe('POST /rooms', () => {
  it('creates a room and stores image when valid PNG is uploaded', async () => {
    // Arrange
    const env = buildEnv();
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'cat.png', { type: 'image/png' });
    const form = new FormData();
    form.set('image', file);

    // Act
    const res = await app.request('/rooms', { method: 'POST', body: form }, env);

    // Assert
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(body.image.contentType).toBe('image/png');
    expect(body.image.size).toBe(4);
  });
});
```

### IN_MEMORY_R2_PATTERN（Phase 2 新規・テストヘルパ）
// SOURCE: 自前最小実装（Miniflare を入れずに Phase 1 の最小化方針を踏襲）
```ts
// apps/api/src/__tests__/helpers/in-memory-r2.ts
type StoredObject = { body: Uint8Array; httpMetadata?: R2HTTPMetadata };

export const createInMemoryR2 = (): R2Bucket => {
  const store = new Map<string, StoredObject>();
  return {
    async put(key: string, body, options) {
      const buf = body instanceof ArrayBuffer
        ? new Uint8Array(body)
        : new Uint8Array(await new Response(body as BodyInit).arrayBuffer());
      store.set(key, { body: buf, httpMetadata: options?.httpMetadata });
      return { etag: `mock-${key}` } as R2Object;
    },
    async get(key: string) {
      const obj = store.get(key);
      if (!obj) return null;
      return {
        body: new Response(obj.body).body!,
        httpEtag: `"mock-${key}"`,
        writeHttpMetadata(headers: Headers) {
          if (obj.httpMetadata?.contentType) headers.set('content-type', obj.httpMetadata.contentType);
        },
        bodyUsed: false,
      } as unknown as R2ObjectBody;
    },
    async delete(key: string) { store.delete(key); },
    async list() { return { objects: [], truncated: false } as R2Objects; },
    async head() { return null; },
    async createMultipartUpload() { throw new Error('not implemented in mock'); },
    async resumeMultipartUpload() { throw new Error('not implemented in mock'); },
  } as unknown as R2Bucket;
};
```
**規約**:
- `R2Bucket` 全 API を実装する必要はない（put / get / delete のみ実装、それ以外は `throw`）
- 型は `as unknown as R2Bucket` で割り切る（テストヘルパ限定の妥協）
- Phase 4 で Miniflare 導入を再評価する

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `pnpm-workspace.yaml` | UPDATE | catalog に `nanoid: ^5.0` / `@hono/zod-validator: ^0.4` を追加 |
| `packages/shared/src/room.ts` | UPDATE | `ALLOWED_IMAGE_MIME_TYPES` 定数 / `RoomImageSchema` を追加、`RoomSchema` に `image` フィールドを追加 |
| `packages/shared/src/__tests__/room.test.ts` | UPDATE | `RoomImageSchema` のバリデーション、拡張版 `RoomSchema` のパステストを追加 |
| `apps/api/wrangler.toml` | UPDATE | `[[r2_buckets]]` バインディング `IMAGES` を追加、`[vars]` に `ROOM_TTL_MS` |
| `apps/api/package.json` | UPDATE | deps 追加: `@hono/zod-validator` / `nanoid`、catalog 経由 |
| `apps/api/tsconfig.json` | UPDATE | （変更不要見込み、`@cloudflare/workers-types` で R2Bucket 型は引ける）|
| `apps/api/src/index.ts` | UPDATE | `roomsRoute` / `imagesRoute` を組立、`onError` / `notFound` を配線 |
| `apps/api/src/lib/bindings.ts` | CREATE | `Bindings` 型を集約。Phase 4/5 で拡張する基点 |
| `apps/api/src/lib/error.ts` | CREATE | `AppError` / `errorEnvelope` / `onAppError` / `onAppNotFound` |
| `apps/api/src/lib/id.ts` | CREATE | `generateRoomId(): string`（nanoid ラッパ、Phase 5 で 衝突対策やプレフィックス追加に備えて関数化） |
| `apps/api/src/lib/logger.ts` | CREATE | `logger.info/warn/error` の薄いラッパ（Phase 5+ で構造化ロガーに差し替えやすくする） |
| `apps/api/src/storage/r2-image-storage.ts` | CREATE | R2 への画像 put/get の薄いラッパ |
| `apps/api/src/storage/r2-meta-storage.ts` | CREATE | R2 上の `rooms/{id}/meta.json` の put/get（ルームメタ永続化） |
| `apps/api/src/services/room-service.ts` | CREATE | `createRoom(file)` / `getRoom(id)` のドメインロジック（id 払い出し + 画像 put + メタ put） |
| `apps/api/src/routes/rooms.ts` | CREATE | `POST /` / `GET /:id` のハンドラと zValidator 配線 |
| `apps/api/src/routes/images.ts` | CREATE | `GET /:id/image` のハンドラ（R2 ストリーム配信、ETag/Content-Type） |
| `apps/api/src/__tests__/helpers/in-memory-r2.ts` | CREATE | テスト用 R2Bucket モック |
| `apps/api/src/__tests__/helpers/build-env.ts` | CREATE | `Bindings` を組み立てるテストヘルパ |
| `apps/api/src/__tests__/rooms.test.ts` | CREATE | `POST /rooms` / `GET /rooms/:id` のユニットテスト（happy + 失敗系） |
| `apps/api/src/__tests__/images.test.ts` | CREATE | `GET /rooms/:id/image` のユニットテスト |
| `apps/api/src/__tests__/services/room-service.test.ts` | CREATE | `room-service` のユニットテスト |
| `apps/api/src/__tests__/lib/id.test.ts` | CREATE | `generateRoomId` の長さ・文字種テスト |
| `apps/api/src/__tests__/lib/error.test.ts` | CREATE | `errorEnvelope` / `onAppError` のテスト |

## NOT Building

- **Web 側のアップロード UI（D&D / paste）** — Phase 3（Konva キャンバス）と統合して実装する。Phase 2 はサーバ API のみ
- **Yjs / Durable Object 連携** — Phase 4 で導入。Phase 2 は HTTP REST のみで完結
- **パスワード保護 / Argon2 ハッシュ** — Phase 5。`RoomSchema` に password 関連フィールドは追加しない
- **TTL 自動破棄（DO Alarms）** — Phase 5。Phase 2 は `ttlMs` フィールドを payload に含めるだけで、実際の削除ロジックは入れない
- **Cloudflare Turnstile / レート制限** — Phase 7。Phase 2 では `INVALID_REQUEST` envelope だけで防御
- **画像配信用カスタムドメイン / R2 public bucket 設定** — 本 Phase は Workers プロキシ（`GET /rooms/:id/image`）一本で配信
- **画像変換（リサイズ / WebP 変換）** — PRD `What We're NOT Building` に明記。MVP では原本そのまま保存
- **オーナー操作（削除 / TTL 変更 / リネーム）** — `Could` スコープ。Phase 8 dogfooding で必要性を判断
- **Miniflare による R2 統合テスト** — 自前 in-memory R2 で十分。Phase 4 の DO テストで導入を再評価
- **ルームの listing API（`GET /rooms`）** — id 既知の取得のみ。プライバシー観点で listing は公開しない
- **画像の overwrite / 同一ルーム内多重画像** — 1 ルーム 1 画像、上書き不可（`onlyIf` 不要、NanoID 衝突確率は無視可）

---

## Step-by-Step Tasks

### Task 1: catalog 拡張
- **ACTION**: `pnpm-workspace.yaml` の `catalog:` に `nanoid` / `@hono/zod-validator` を追記
- **IMPLEMENT**:
  ```yaml
  catalog:
    typescript: 5.6.3
    vitest: ^4.1
    zod: ^4.4
    nanoid: ^5.0
    '@hono/zod-validator': ^0.4
    '@types/node': ^22
    react: ^19.2
    react-dom: ^19.2
    '@types/react': ^19.2
    '@types/react-dom': ^19.2
  ```
- **MIRROR**: Phase 1 の `pnpm-workspace.yaml` 構造（Decisions Log で確立）
- **IMPORTS**: なし
- **GOTCHA**: `@hono/zod-validator` のキーはクォートで囲む（YAML の `@` 制限）。`nanoid` 5.x は ESM-only かつ Node 18+ 必須 → `apps/api` の Workers ランタイム/Node 22 とも互換
- **VALIDATE**: `pnpm install` 後、`pnpm why nanoid` で 5.x 解決を確認

### Task 2: `packages/shared` の RoomSchema 拡張（テストファースト）
- **ACTION**: `packages/shared/src/__tests__/room.test.ts` に追加テスト（`RoomImageSchema` の OK/NG ケース、拡張 `RoomSchema` のパス）→ RED → 実装で GREEN
- **IMPLEMENT**:
  - 追加テスト（最小例）:
    ```ts
    describe('RoomImageSchema', () => {
      it('parses a valid image meta', () => { /* ... */ });
      it('rejects unknown content type', () => { /* ... */ });
      it('rejects size exceeding MAX_IMAGE_BYTES', () => { /* ... */ });
      it('rejects non-positive size', () => { /* ... */ });
    });

    describe('RoomSchema (extended)', () => {
      it('parses a room with image', () => { /* ... */ });
      it('rejects a room missing image', () => { /* ... */ });
    });
    ```
  - 実装: 上記 ZOD_SSOT_PATTERN セクション通り
  - 既存 `room` 定数（既存テストで使用）の更新も必要 → `image` フィールドを追加
- **MIRROR**: ZOD_SSOT_PATTERN
- **IMPORTS**: `import { z } from 'zod'`
- **GOTCHA**:
  - Zod v4 では `.readonly()` の戻り値型が `Readonly<T>`。`type Room = z.infer<typeof RoomSchema>` で型導出すれば readonly が伝播
  - `z.enum([...] as const)` を使うときは `as const` の付け忘れに注意（Zod v4 は配列リテラルでも動くが明示推奨）
  - 既存 9 件のテストは `image` 抜きの Room を使っているため、`image` 必須化により失敗する → 既存テストの fixture も更新
- **VALIDATE**:
  - `pnpm --filter @snap-share/shared test` で全 GREEN
  - `pnpm --filter @snap-share/shared typecheck` で 0 errors

### Task 3: `apps/api/wrangler.toml` に R2 binding と vars を追加
- **ACTION**: `wrangler.toml` を以下のように更新
- **IMPLEMENT**:
  ```toml
  name = "snap-share-api"
  main = "src/index.ts"
  compatibility_date = "2026-04-07"
  compatibility_flags = ["nodejs_compat"]

  [[r2_buckets]]
  binding = "IMAGES"
  bucket_name = "snap-share-images"

  [vars]
  ROOM_TTL_MS = "604800000" # 7 日

  # Phase 4 で Durable Object、Phase 5 で SECRETS 拡張予定
  ```
- **MIRROR**: `spikes/yjs-durable-object/wrangler.toml`
- **IMPORTS**: なし
- **GOTCHA**:
  - `wrangler dev` はローカルで R2 を in-memory エミュレート（`--local` がデフォルト）。実バケット作成は Phase 7 で `wrangler r2 bucket create snap-share-images`
  - `[vars]` は Workers ランタイムでは **string** で渡る。`ROOM_TTL_MS` を取り出すときは `Number(c.env.ROOM_TTL_MS)` で変換
- **VALIDATE**: `pnpm --filter @snap-share/api build`（`wrangler deploy --dry-run`）が 0 errors

### Task 4: `apps/api/package.json` に依存追加
- **ACTION**: `dependencies` に `@hono/zod-validator: catalog:` と `nanoid: catalog:`、`zod: catalog:` を明示
- **IMPLEMENT**:
  ```json
  "dependencies": {
    "@snap-share/shared": "workspace:*",
    "@hono/zod-validator": "catalog:",
    "hono": "^4.12",
    "nanoid": "catalog:",
    "zod": "catalog:"
  }
  ```
  - `zod` は既に `packages/shared` 経由で resolve されるが、API でも直接 `import { z } from 'zod'` するため明示
- **MIRROR**: Phase 1 の catalog 採用（`packages/shared/package.json:14`）
- **IMPORTS**: なし
- **GOTCHA**: `zod` を直接 import するとき、`packages/shared` の peer 解決で衝突しないよう、catalog で 1 バージョンに固定されていることを `pnpm why zod` で必ず確認
- **VALIDATE**: `pnpm install` 後 `pnpm --filter @snap-share/api typecheck` で 0 errors

### Task 5: `apps/api/src/lib/bindings.ts` 作成
- **ACTION**: 共通 `Bindings` 型を切り出す
- **IMPLEMENT**:
  ```ts
  export type Bindings = {
    IMAGES: R2Bucket;
    ROOM_TTL_MS: string;
  };
  ```
- **MIRROR**: HONO_ROUTE_PATTERN
- **IMPORTS**: なし（`R2Bucket` は `@cloudflare/workers-types` のグローバル）
- **GOTCHA**: `R2Bucket` はグローバル型。`tsconfig.json` の `types: ["@cloudflare/workers-types"]` に依存（既存設定で OK）
- **VALIDATE**: `pnpm --filter @snap-share/api typecheck`

### Task 6: `apps/api/src/lib/error.ts` 作成（テストファースト）
- **ACTION**: テスト → 実装。`AppError` / `errorEnvelope` / `onAppError` / `onAppNotFound` を実装
- **IMPLEMENT**: ERROR_RESPONSE_PATTERN セクションのコードを移植。テストは `errorEnvelope` の出力形と `onAppError` が `AppError` を envelope 化することを確認
- **MIRROR**: ERROR_RESPONSE_PATTERN
- **IMPORTS**:
  ```ts
  import type { Context } from 'hono';
  import { HTTPException } from 'hono/http-exception';
  ```
- **GOTCHA**:
  - `HTTPException` の status は `ContentfulStatusCode` 型。`number` リテラル直接代入は通らない場合あり → `400 | 404 | 413 | 415 | 500` のリテラル union で受ける
  - `onAppError` / `onAppNotFound` の戻り値型は `Response | Promise<Response>`
- **VALIDATE**: `pnpm --filter @snap-share/api test` で error テスト GREEN

### Task 7: `apps/api/src/lib/id.ts` 作成（テストファースト）
- **ACTION**: `generateRoomId(): string` を実装
- **IMPLEMENT**:
  ```ts
  import { nanoid } from 'nanoid';
  export const ROOM_ID_LENGTH = 21;
  export const generateRoomId = (): string => nanoid(ROOM_ID_LENGTH);
  ```
- **MIRROR**: なし（最小ラッパ）
- **IMPORTS**: `nanoid`
- **GOTCHA**: `nanoid` 5.x は ESM-only。`apps/api/package.json` の `"type": "module"` で対応済み（Phase 1 で確立）
- **VALIDATE**: `apps/api/src/__tests__/lib/id.test.ts` で `generateRoomId().length === 21` と URL-safe 文字種（`/^[A-Za-z0-9_-]+$/`）の正規表現マッチを assert

### Task 8: `apps/api/src/lib/logger.ts` 作成
- **ACTION**: `console` の薄いラッパを作成（Phase 5+ で構造化ロガーへ差し替え可能に）
- **IMPLEMENT**:
  ```ts
  const PREFIX = '[api]';
  export const logger = {
    info: (msg: string, meta?: Record<string, unknown>) => console.info(PREFIX, msg, meta ?? {}),
    warn: (msg: string, meta?: Record<string, unknown>) => console.warn(PREFIX, msg, meta ?? {}),
    error: (msg: string, meta?: Record<string, unknown>) => console.error(PREFIX, msg, meta ?? {}),
  };
  ```
- **MIRROR**: LOGGING_PATTERN
- **IMPORTS**: なし
- **GOTCHA**: Biome の `noConsole: warn` ルールが効く可能性 → 本ファイル内のみ `// biome-ignore lint/suspicious/noConsole: logger wrapper` で抑制
- **VALIDATE**: `pnpm --filter @snap-share/api lint`

### Task 9: `apps/api/src/storage/r2-image-storage.ts` 作成
- **ACTION**: R2 画像 put/get の薄いラッパ（factory 関数）
- **IMPLEMENT**: REPOSITORY_PATTERN セクションのコード
- **MIRROR**: REPOSITORY_PATTERN
- **IMPORTS**: なし（`R2Bucket` / `R2ObjectBody` はグローバル）
- **GOTCHA**:
  - `bucket.put` の body は `ArrayBuffer | ReadableStream | Blob | string | null`。`File.stream()` は `ReadableStream`、`File.arrayBuffer()` は `ArrayBuffer` → どちらでも OK
  - `cacheControl: 'public, max-age=3600'` は MVP の仮値。Phase 7 で再検討
- **VALIDATE**: 後続 Task 13 のテストでカバー

### Task 10: `apps/api/src/storage/r2-meta-storage.ts` 作成
- **ACTION**: ルームメタ JSON を `rooms/{id}/meta.json` で保存・取得する factory
- **IMPLEMENT**:
  ```ts
  import { type Room, RoomSchema } from '@snap-share/shared';

  export type MetaStorage = {
    putMeta(room: Room): Promise<void>;
    getMeta(id: string): Promise<Room | null>;
  };

  export const metaKey = (id: string) => `rooms/${id}/meta.json`;

  export const createR2MetaStorage = (bucket: R2Bucket): MetaStorage => ({
    async putMeta(room) {
      await bucket.put(metaKey(room.id), JSON.stringify(room), {
        httpMetadata: { contentType: 'application/json' },
      });
    },
    async getMeta(id) {
      const obj = await bucket.get(metaKey(id));
      if (!obj) return null;
      const json = await obj.json();
      return RoomSchema.parse(json);
    },
  });
  ```
- **MIRROR**: REPOSITORY_PATTERN + ZOD_SSOT_PATTERN（読み込み時に再検証）
- **IMPORTS**: `@snap-share/shared`
- **GOTCHA**:
  - `obj.json()` は型 `unknown` → 必ず `RoomSchema.parse` を通す（壊れた JSON への防御）
  - 巨大な meta ではないため `bucket.put` で string 直渡しで十分
- **VALIDATE**: 後続 Task 13 のテストでカバー

### Task 11: `apps/api/src/services/room-service.ts` 作成
- **ACTION**: ルーム発行・取得のドメインロジックを集約
- **IMPLEMENT**:
  ```ts
  import {
    ALLOWED_IMAGE_MIME_TYPES,
    type AllowedImageMimeType,
    MAX_IMAGE_BYTES,
    type Room,
  } from '@snap-share/shared';
  import { AppError } from '../lib/error';
  import { generateRoomId } from '../lib/id';
  import { logger } from '../lib/logger';
  import type { ImageStorage } from '../storage/r2-image-storage';
  import type { MetaStorage } from '../storage/r2-meta-storage';

  export type CreateRoomDeps = {
    images: ImageStorage;
    meta: MetaStorage;
    now: () => number;
    ttlMs: number;
  };

  const extOf = (contentType: AllowedImageMimeType): string => {
    switch (contentType) {
      case 'image/png': return 'png';
      case 'image/jpeg': return 'jpg';
      case 'image/webp': return 'webp';
      case 'image/svg+xml': return 'svg';
    }
  };

  const assertAllowedMime = (type: string): AllowedImageMimeType => {
    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(type)) {
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', `Unsupported content type: ${type}`);
    }
    return type as AllowedImageMimeType;
  };

  export const createRoomService = (deps: CreateRoomDeps) => ({
    async create(file: File): Promise<Room> {
      if (file.size === 0) {
        throw new AppError(400, 'INVALID_REQUEST', 'Empty file');
      }
      if (file.size > MAX_IMAGE_BYTES) {
        throw new AppError(413, 'PAYLOAD_TOO_LARGE', `File exceeds ${MAX_IMAGE_BYTES} bytes`);
      }
      const contentType = assertAllowedMime(file.type);

      const id = generateRoomId();
      const key = `rooms/${id}/image.${extOf(contentType)}`;

      await deps.images.putImage(key, file.stream(), contentType);

      const room: Room = {
        id,
        createdAt: deps.now(),
        ttlMs: deps.ttlMs,
        image: { key, contentType, size: file.size },
      };
      await deps.meta.putMeta(room);
      logger.info('room created', { id, contentType, size: file.size });
      return room;
    },

    async get(id: string): Promise<Room> {
      const room = await deps.meta.getMeta(id);
      if (!room) throw new AppError(404, 'NOT_FOUND', `Room not found: ${id}`);
      return room;
    },
  });

  export type RoomService = ReturnType<typeof createRoomService>;
  ```
  - `AllowedImageMimeType` は `packages/shared/src/room.ts` で `export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number]` として export 済の前提（Task 2 で追加）
- **MIRROR**: ZOD_SSOT_PATTERN / ERROR_RESPONSE_PATTERN / LOGGING_PATTERN
- **IMPORTS**: `@snap-share/shared`, `../lib/*`, `../storage/*`
- **GOTCHA**:
  - `file.type` は **client から送られる Content-Type** で偽装可能。ヘッダ信頼でチェック → 真の防御は Phase 7 のシグネチャベース判定で再強化（MVP は割り切る）
  - `extOf` の `switch` exhaustive チェック: TypeScript の `noFallthroughCasesInSwitch` + リテラル union で switch caseが網羅されていることを担保
  - `assertAllowedMime` の `as readonly string[]` は型ナローイング用
- **VALIDATE**: 後続 Task 13 のサービス単体テストでカバー

### Task 12: `apps/api/src/__tests__/helpers/in-memory-r2.ts` + `build-env.ts` 作成
- **ACTION**: テスト用 R2 モックと env builder を作成
- **IMPLEMENT**: IN_MEMORY_R2_PATTERN セクションのコード + `build-env.ts`:
  ```ts
  import { createInMemoryR2 } from './in-memory-r2';
  import type { Bindings } from '../../lib/bindings';

  export const buildEnv = (overrides: Partial<Bindings> = {}): Bindings => ({
    IMAGES: createInMemoryR2(),
    ROOM_TTL_MS: String(7 * 24 * 60 * 60 * 1000),
    ...overrides,
  });
  ```
- **MIRROR**: IN_MEMORY_R2_PATTERN
- **IMPORTS**: 上記参照
- **GOTCHA**:
  - `R2Bucket` は実際には 20+ メソッドあり、全実装は不要。本 plan で使う put/get/delete のみ実装、それ以外は `throw` または最小スタブで型を満たす
  - `body: new Response(uint8).body!` の `!` を避けたい場合は `Readable.toWeb` 等を使うが、Workers/Vitest 環境では `new Response(uint8).body` で常に non-null
- **VALIDATE**: `pnpm --filter @snap-share/api typecheck` で型エラーなし

### Task 13: `apps/api/src/__tests__/services/room-service.test.ts` 作成（テストファースト）
- **ACTION**: `room-service` の単体テスト
- **IMPLEMENT**:
  ```ts
  describe('roomService.create', () => {
    it('stores image and meta with NanoID id', async () => { /* ... */ });
    it('rejects unsupported content type with AppError 415', async () => { /* ... */ });
    it('rejects oversized file with AppError 413', async () => { /* ... */ });
    it('rejects empty file with AppError 400', async () => { /* ... */ });
  });

  describe('roomService.get', () => {
    it('returns room when meta exists', async () => { /* ... */ });
    it('throws AppError 404 when meta missing', async () => { /* ... */ });
    it('throws ZodError when meta JSON is malformed', async () => { /* ... */ });
  });
  ```
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**: `vitest` / `../helpers/build-env` / `../../services/room-service` / `../../storage/*`
- **GOTCHA**:
  - `now: () => 1000` のように固定値を注入 → snapshot 安定化
  - 「壊れた meta JSON」ケースは in-memory R2 に直接 `'not json'` を put して再現
- **VALIDATE**: `pnpm --filter @snap-share/api test`

### Task 14: `apps/api/src/routes/rooms.ts` 作成（テストファースト）
- **ACTION**: `POST /` と `GET /:id` のハンドラを実装
- **IMPLEMENT**:
  ```ts
  import { zValidator } from '@hono/zod-validator';
  import { Hono } from 'hono';
  import * as z from 'zod';
  import type { Bindings } from '../lib/bindings';
  import { errorEnvelope } from '../lib/error';
  import { createR2ImageStorage } from '../storage/r2-image-storage';
  import { createR2MetaStorage } from '../storage/r2-meta-storage';
  import { createRoomService } from '../services/room-service';

  const uploadSchema = z.object({
    image: z.instanceof(File),
  });

  const idParamSchema = z.object({ id: z.string().min(1) });

  export const roomsRoute = new Hono<{ Bindings: Bindings }>();

  roomsRoute.post(
    '/',
    zValidator('form', uploadSchema, (result, c) => {
      if (!result.success) {
        return c.json(errorEnvelope('INVALID_REQUEST', 'image field is required'), 400);
      }
    }),
    async (c) => {
      const { image } = c.req.valid('form');
      const service = createRoomService({
        images: createR2ImageStorage(c.env.IMAGES),
        meta: createR2MetaStorage(c.env.IMAGES),
        now: () => Date.now(),
        ttlMs: Number(c.env.ROOM_TTL_MS),
      });
      const room = await service.create(image);
      return c.json(room, 201);
    },
  );

  roomsRoute.get(
    '/:id',
    zValidator('param', idParamSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const service = createRoomService({
        images: createR2ImageStorage(c.env.IMAGES),
        meta: createR2MetaStorage(c.env.IMAGES),
        now: () => Date.now(),
        ttlMs: Number(c.env.ROOM_TTL_MS),
      });
      const room = await service.get(id);
      return c.json(room);
    },
  );
  ```
- **MIRROR**: HONO_ROUTE_PATTERN / ZVALIDATOR_PATTERN
- **IMPORTS**: 上記参照
- **GOTCHA**:
  - `GET /:id` のフィールドは `image` だが、画像の URL は payload に含めない（呼び出し側は `/rooms/:id/image` を組み立てる）。Phase 6 で UI に絶対 URL が必要になったら `c.req.url` 由来でビルドする方針
  - `service` を毎回新規生成するのは Workers の per-request lifetime 前提。Singleton 化は不要
- **VALIDATE**: 後続 Task 15 のテストで GREEN

### Task 15: `apps/api/src/__tests__/rooms.test.ts` 作成
- **ACTION**: ハンドラ統合テスト（happy + 失敗系）
- **IMPLEMENT**:
  ```ts
  describe('POST /rooms', () => {
    it('returns 201 with room when valid PNG is uploaded', async () => { /* ... */ });
    it('returns 400 when image field missing', async () => { /* ... */ });
    it('returns 415 when content type is text/plain', async () => { /* ... */ });
    it('returns 413 when file exceeds 10 MiB', async () => { /* ... */ });
    it('returns 400 when file is empty', async () => { /* ... */ });
  });

  describe('GET /rooms/:id', () => {
    it('returns 200 with room JSON when room exists', async () => { /* ... */ });
    it('returns 404 with NOT_FOUND envelope when missing', async () => { /* ... */ });
  });
  ```
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**: `vitest`, `../index` (Hono app), `./helpers/build-env`
- **GOTCHA**:
  - `app.request('/rooms', { method: 'POST', body: form }, env)` の第3引数で env 注入
  - `FormData` には `Blob` ではなく `File` を入れる（`name` 属性がないと parseBody が File として扱わない場合あり）
  - 10 MiB 超過テストは `new Uint8Array(10 * 1024 * 1024 + 1)` でメモリ消費に注意 → Vitest の `--pool=threads` 既定なら問題なし
- **VALIDATE**: `pnpm --filter @snap-share/api test`

### Task 16: `apps/api/src/routes/images.ts` + テスト作成
- **ACTION**: `GET /:id/image` で R2 から画像をストリーム配信
- **IMPLEMENT**:
  ```ts
  import { Hono } from 'hono';
  import * as z from 'zod';
  import { zValidator } from '@hono/zod-validator';
  import type { Bindings } from '../lib/bindings';
  import { AppError } from '../lib/error';
  import { createR2ImageStorage } from '../storage/r2-image-storage';
  import { createR2MetaStorage } from '../storage/r2-meta-storage';

  export const imagesRoute = new Hono<{ Bindings: Bindings }>();

  imagesRoute.get(
    '/:id/image',
    zValidator('param', z.object({ id: z.string().min(1) })),
    async (c) => {
      const { id } = c.req.valid('param');
      const meta = await createR2MetaStorage(c.env.IMAGES).getMeta(id);
      if (!meta) throw new AppError(404, 'NOT_FOUND', `Room not found: ${id}`);

      const obj = await createR2ImageStorage(c.env.IMAGES).getImage(meta.image.key);
      if (!obj) throw new AppError(404, 'NOT_FOUND', `Image not found: ${meta.image.key}`);

      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('etag', obj.httpEtag);
      return new Response(obj.body, { status: 200, headers });
    },
  );
  ```
- **MIRROR**: HONO_ROUTE_PATTERN / ERROR_RESPONSE_PATTERN
- **IMPORTS**: 上記参照
- **GOTCHA**:
  - `obj.body` は `ReadableStream | null`。`get()` が non-null を返した時点で `body` は存在する（onlyIf 不指定のため 412 ケースなし）
  - テストでは in-memory R2 が `body: new Response(...).body!` を返すため `Response(obj.body, ...)` でストリームをそのまま再 wrap できる
  - `writeHttpMetadata` は in-memory R2 mock でも contentType を set するように実装済（IN_MEMORY_R2_PATTERN 参照）
- **VALIDATE**: `apps/api/src/__tests__/images.test.ts` で「200 + Content-Type: image/png + body 再現」を assert

### Task 17: `apps/api/src/index.ts` を更新して全ルートを組立
- **ACTION**: 既存 `index.ts` を ENTRY_POINT として整備
- **IMPLEMENT**: HONO_ROUTE_PATTERN セクション通り
  ```ts
  import { Hono } from 'hono';
  import type { Bindings } from './lib/bindings';
  import { onAppError, onAppNotFound } from './lib/error';
  import { imagesRoute } from './routes/images';
  import { roomsRoute } from './routes/rooms';

  const app = new Hono<{ Bindings: Bindings }>();

  app.get('/health', (c) => c.json({ ok: true, service: 'snap-share-api', ts: Date.now() }));
  app.route('/rooms', roomsRoute);
  app.route('/rooms', imagesRoute);
  app.notFound(onAppNotFound);
  app.onError(onAppError);

  export default app;
  ```
- **MIRROR**: HONO_ROUTE_PATTERN
- **IMPORTS**: 上記参照
- **GOTCHA**:
  - `app.route('/rooms', roomsRoute)` を 2 回 `app.route('/rooms', imagesRoute)` で並べる構成は Hono 4.x で公式サポート（複数ルーターを同一 mount 配下に重ね掛け）
  - 既存 health テストの payload は変えない
- **VALIDATE**:
  - `pnpm --filter @snap-share/api test` 全 GREEN
  - `pnpm --filter @snap-share/api typecheck` 0 errors
  - `pnpm --filter @snap-share/api dev` で起動 → `curl -F 'image=@cat.png' http://localhost:8787/rooms` で 201 + JSON

### Task 18: README とドキュメント追記
- **ACTION**: ルート README または `apps/api/README.md` に Phase 2 で追加された API の curl サンプルを追記
- **IMPLEMENT**:
  - `POST /rooms` / `GET /rooms/:id` / `GET /rooms/:id/image` の curl + 期待レスポンス
  - エラー envelope の例
  - 開発時のローカル R2 が in-memory である注意
- **MIRROR**: Phase 1 の README 更新方針
- **IMPORTS**: なし
- **GOTCHA**: README はユーザー向け。サンプルの `id` は `V1StGXR8_Z5jdHi6B-myT`（NanoID 公式 README の例）で固定して紛れがないように
- **VALIDATE**: 目視 + プレビュー

### Task 19: 最終検証 + PRD/plans 更新
- **ACTION**:
  1. `pnpm turbo run lint typecheck test build` をリポジトリルートで実行 → all green
  2. PRD の Implementation Phases 表で Phase 2 を `pending` → `in-progress` に更新、PRP Plan 列に `[phase-2-image-upload.plan.md](../plans/phase-2-image-upload.plan.md)` を記載
  3. plan 内の Acceptance Criteria を満たすか自己レビュー
- **MIRROR**: Phase 1 完了時の運用
- **IMPORTS**: なし
- **GOTCHA**:
  - PRD 表の `Status` を `in-progress` にするのは **plan 作成完了時点**（実装はまだ）。実装完了後に `complete` へ
  - PRD 改訂は 1 行のみ（PRP Plan 列とステータス列）。実装完了時に Decisions Log へ Phase 2 確定事項を追記
- **VALIDATE**: `git diff .claude/PRPs/prds/snap-share.prd.md` が表 1 行に収まる

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `RoomImageSchema parses valid` | `{ key, contentType: 'image/png', size: 1024 }` | OK | - |
| `RoomImageSchema rejects bad mime` | `contentType: 'text/plain'` | throw ZodError | YES |
| `RoomImageSchema rejects oversized size` | `size: MAX_IMAGE_BYTES + 1` | throw ZodError | YES |
| `RoomSchema requires image` | `{ id, createdAt, ttlMs }`（image 抜き）| throw ZodError | YES |
| `generateRoomId length` | - | length === 21、`/^[A-Za-z0-9_-]+$/` | - |
| `errorEnvelope shape` | `('NOT_FOUND', 'msg')` | `{ ok: false, error: { code, message } }` | - |
| `onAppError maps AppError` | `new AppError(404, 'NOT_FOUND', 'x')` | 404 + envelope | - |
| `onAppError fallback` | `new Error('boom')` | 500 + INTERNAL envelope | YES |
| `roomService.create happy` | valid PNG File | Room with image meta、in-memory R2 に key 保存 | - |
| `roomService.create empty` | size 0 File | AppError 400 INVALID_REQUEST | YES |
| `roomService.create oversize` | 10 MiB + 1 File | AppError 413 PAYLOAD_TOO_LARGE | YES |
| `roomService.create bad mime` | text/plain | AppError 415 UNSUPPORTED_MEDIA_TYPE | YES |
| `roomService.get happy` | 既存 id | Room | - |
| `roomService.get missing` | 不在 id | AppError 404 NOT_FOUND | YES |
| `roomService.get malformed meta` | R2 に `'not json'` 直挿入 | ZodError or onAppError → 500 | YES |
| `POST /rooms 201` | multipart with PNG | 201 JSON | - |
| `POST /rooms 400 missing field` | empty form | 400 envelope | YES |
| `POST /rooms 415` | text/plain file | 415 envelope | YES |
| `POST /rooms 413` | 10 MiB+ file | 413 envelope | YES |
| `POST /rooms 400 empty` | size 0 file | 400 envelope | YES |
| `GET /rooms/:id 200` | 既存 | 200 JSON | - |
| `GET /rooms/:id 404` | 不在 | 404 envelope | YES |
| `GET /rooms/:id/image 200` | 既存 | 200 + content-type + body bytes 一致 | - |
| `GET /rooms/:id/image 404 (no meta)` | 不在 id | 404 envelope | YES |

### Edge Cases Checklist
- [x] 空ファイル
- [x] 上限ぴったり（`MAX_IMAGE_BYTES`）/ 上限+1 byte
- [x] 不正 Content-Type（`text/plain`, `image/gif`）
- [x] 不在 id へのアクセス
- [x] R2 に壊れた JSON が入っている場合の `getMeta` 挙動
- [x] 既知の長文 path（NanoID 21 文字 URL safe）
- [ ] **対象外（Phase 5 で扱う）**: TTL 切れ判定、パスワード認証
- [ ] **対象外（Phase 7 で扱う）**: レート制限、Turnstile

---

## Validation Commands

### Static Analysis
```bash
pnpm turbo run typecheck
```
EXPECT: 全 workspace で 0 type errors（shared / api / web）

### Lint
```bash
pnpm lint
```
EXPECT: `biome ci .` が 0 errors

### Unit Tests
```bash
pnpm --filter @snap-share/shared test
pnpm --filter @snap-share/api test
```
EXPECT: shared 既存 9 + 拡張テスト数件、api 既存 1 + 新規 ~25 ケースが全 GREEN

### Full Pipeline
```bash
pnpm turbo run lint typecheck test build
```
EXPECT: 4 タスク × 3 workspace（shared/api/web）all green、`apps/api` の `wrangler deploy --dry-run` も成功

### E2E（Phase 1 から継続、Phase 2 では追加なし）
```bash
pnpm turbo run test:e2e
```
EXPECT: 既存 1 ケースが PASS（Phase 6 で本格 E2E 拡張）

### Manual Validation（ローカル wrangler dev）
```bash
pnpm --filter @snap-share/api dev
# 別ターミナル
curl -F "image=@/path/to/cat.png" http://localhost:8787/rooms
# → 201 + { id, image, createdAt, ttlMs }

curl http://localhost:8787/rooms/<id>
# → 200 + 同 JSON

curl -o out.png http://localhost:8787/rooms/<id>/image
# → 200 + 画像が再構成される

curl -F "image=@README.md" http://localhost:8787/rooms
# → 415 + { ok: false, error: { code: 'UNSUPPORTED_MEDIA_TYPE', ... } }
```

---

## Acceptance Criteria
- [ ] PRD Phase 2 の Success signal「画像を POST して R2 URL + roomId が返り、`/rooms/:id` で画像メタが取れる」を満たす
- [ ] `RoomSchema` は SSOT として `image: RoomImageSchema` を持つ（型は `z.infer` 派生）
- [ ] `pnpm turbo run lint typecheck test build` all green
- [ ] CI（GitHub Actions）も green
- [ ] エラーレスポンスは `{ ok: false, error: { code, message } }` 統一形
- [ ] R2 バインディング `IMAGES` が `wrangler.toml` に配線済（実バケット作成は Phase 7）
- [ ] テスト: `apps/api` 新規 ~25 ケースが GREEN、`packages/shared` 拡張テストも GREEN

## Completion Checklist
- [ ] Code follows discovered patterns（HONO_ROUTE / ZOD_SSOT / ERROR_RESPONSE / REPOSITORY / TEST_STRUCTURE）
- [ ] Error handling は `AppError` + `onAppError` 経由で統一
- [ ] Logging は `logger.info/warn/error` で `[api]` prefix 付き
- [ ] Tests は AAA 構造、`app.request(path, init, env)` 経由
- [ ] No hardcoded values（`MAX_IMAGE_BYTES` / `ROOM_TTL_MS` / `ALLOWED_IMAGE_MIME_TYPES` は shared 定数 / env vars 経由）
- [ ] `apps/api/src/__tests__/helpers/in-memory-r2.ts` は最小実装、未使用 R2 API は throw で OK
- [ ] PRD の Implementation Phases 表が更新済（`pending` → `in-progress` + plan link）
- [ ] No unnecessary scope additions（パスワード / TTL 自動破棄 / Yjs / Turnstile は触らない）
- [ ] Self-contained — 実装中に追加検索が不要

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `parseBody` の File ハンドリングが Workers ランタイムと Vitest で挙動差 | M | M | Vitest 4 + Hono 4.12 で `app.request` + FormData は Hono 公式テストガイドで動作確認済。差分が出たら Miniflare 導入検討 |
| in-memory R2 mock の型整合（R2Bucket 全 API カバー必須エラー） | M | L | `as unknown as R2Bucket` で割り切り、必要 API のみ実装（IN_MEMORY_R2_PATTERN）。型エラー出たら最小スタブ追加 |
| `nanoid` 5.x ESM-only と Workers/Vitest の interop | L | M | `apps/api/package.json` に `"type": "module"` 既設、Phase 1 で確立済 |
| R2 bucket 名 `snap-share-images` がまだ作成されていない | L | L | Phase 7 で実バケット作成。Phase 2 はローカル `wrangler dev` の in-memory R2 で動作確認可能 |
| `c.req.parseBody` の戻り値型推論が Hono 4.12 で `Record<string, string \| File>` のままで `File` ナローイングが弱い | M | L | `zValidator('form', z.object({ image: z.instanceof(File) }))` で File 型を強制 → ハンドラ内で `File` 型として安全に扱える |
| ルームメタが R2 上 JSON のため、トラフィック増で R2 read 数増（無料枠超過リスク） | L | M | MVP の規模（〜100 active users）では無料枠（class A 1M / class B 10M ops/月）の 1% 未満。Phase 5 で DO Storage に移行検討 |
| 大容量画像のメモリ消費（10 MiB を `arrayBuffer` で読むと spike） | L | M | `file.stream()` で R2 にストリーム転送 → Workers の 128 MB メモリ制限内で安定 |

## Notes

### Phase 4 / 5 / 6 への布石

- **Phase 4（Yjs+DO）**: `Bindings` 型に `Y_ROOM: DurableObjectNamespace` を追加するだけで配線可能。`apps/api/src/lib/bindings.ts` を 1 ファイルに集約しているため変更点が局所化される
- **Phase 5（パスワード+TTL）**: `RoomSchema` に optional `passwordHash?: string` を追加（Zod v4 の `.extend` または別スキーマ `RoomWithSecretsSchema` で対応）。TTL 切れ判定は既存 `isExpired(room, now)` を `roomService.get` に挿す
- **Phase 6（PNG export）**: API 側追加なし。`GET /rooms/:id/image` の Workers プロキシをそのまま使用 → フロントで Konva レンダー結果と合成してダウンロード

### Decisions Log への追加候補（実装完了時に PRD へ反映）

| Decision | Choice | Rationale |
|---|---|---|
| ルームメタ永続化 | **R2 上 `rooms/{id}/meta.json`** | DO Storage は Phase 4 で導入予定。Phase 2 段階で別バインディングを増やさず KISS |
| 画像配信戦略 | **Workers プロキシ `GET /rooms/:id/image`** | R2 public bucket 設定不要、Phase 5 のパスワード保護でアクセス制御を挟みやすい |
| Content-Type 判定 | **クライアント送信ヘッダ信頼（MVP）** | シグネチャベース判定は Phase 7 で導入 |
| ルームサービス DI | **Factory + deps オブジェクト**（class なし） | Workers per-request lifetime に整合、テストで mock 注入容易 |
| エラーレスポンス | **失敗のみ envelope `{ ok: false, error: { code, message } }`、成功は裸 JSON** | Success signal が PRD で「裸 JSON」と書かれているため二重包装を避ける |

### 実装順序の指針

Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 を順に進めて土台を作り、Task 9 → 10 を並行可、Task 11 → 13 のサービス層を TDD で固めてから Task 14 → 15 → 16 のルート層を実装する。Task 17 で配線を統合し、Task 18 → 19 で締める。

**実装開始時のコマンド**:
```bash
# テストファースト原則: 各 Task で test ファイルを先に作成 → RED → 実装 → GREEN を順守
pnpm install # Task 1 の catalog 反映
pnpm --filter @snap-share/shared test --watch=false
pnpm --filter @snap-share/api test --watch=false
```
