# Plan: Phase 5 — パスワード保護 + DO Alarms による TTL

## Summary

ルーム作成時に **任意パスワード** を設定できるようにし、保護されたルームは入室時にパスワード入力 → サーバ署名済み短期トークン取得 → 以降の `GET /rooms/:id/image` と `GET /sync/:id` (WebSocket) でトークン検証、というフローで保護する。同時に、**Phase 4 の `YDurableObjects` を継承した `SnapShareYDO`** を導入して DO Alarm を仕込み、`createdAt + ttlMs` の時刻に R2 上の image / meta + DO storage を自動破棄する。**ハッシュは Argon2 ではなく Web Crypto の PBKDF2-SHA256 (210k iterations)** を採用し、署名トークンは **Hono 標準の HS256 JWT** で発行する（後述の Decisions Log 参照）。Phase 6 (UI 仕上げ) と並行可能。

## User Story

As a 機密性の高い画像（社内 UI スクショ・契約書のスクショ等）を snap-share で共有したいリモートワーカー,
I want ルーム発行時に任意パスワードを設定でき、URL が漏れても合言葉を知らない第三者は画像も同期セッションも開けない状態を作りたい。また、共有後に放置したルームが永遠に R2 と DO に残り続けないことも保証したい,
So that 「URL を Teams で雑に貼っても画像内容は守られる」「ルームが無期限に増えてコスト/責務が増えない」という二つの安心感が両立し、PRD の差別化要素「パスワード保護付きルーム」と Cost Metric (`$30/月以下`) を担保できる.

## Problem → Solution

**Current (Phase 4 完了時点)**:
- `RoomSchema` (`packages/shared/src/room.ts`) はパスワード関連フィールドを持たない（`{ id, createdAt, ttlMs, image }` のみ）。
- `POST /rooms` (`apps/api/src/routes/rooms.ts`) は multipart の `image` 1 フィールドのみ受け付ける。
- `GET /rooms/:id` / `GET /rooms/:id/image` / `GET /sync/:id` (`apps/api/src/yjs.ts`) は **誰でも roomId さえ知っていれば素通しで取得・接続可能**。
- 画像 R2 / メタ R2 / DO storage はいずれも `ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000` の値を Room に書き込むだけで、**実際の TTL 削除処理は未実装**。`createdAt + ttlMs` を超過しても `GET /rooms/:id` は 200 を返し続ける。
- `apps/web` には `RoomEditor` が `fetchRoom(roomId)` で 200 が返ったら即 Konva + Yjs 接続するパスしかない（パスワード入力画面が存在しない）。
- `wrangler.toml` 末尾コメントに `# Phase 5 で SECRETS を追加する` が残っており、`vars` セクションのみで `[secrets]` 相当が未設定。
- `apps/api/src/lib/bindings.ts` には `ROOM_TOKEN_SECRET` 等の auth 系 binding が存在しない。

**Desired (Phase 5 完了時点)**:
- `POST /rooms` がオプションで `password` (multipart text field) を受け付け、PBKDF2-SHA256 ハッシュ + 16 byte salt + iteration を `RoomSchema` の `auth?: { algo, salt, iterations, hash }` に格納して R2 メタに保存。**平文パスワードはサーバに残らない**。
- `GET /rooms/:id` はパスワード保護有無に関わらず 200 を返すが、保護されている場合のレスポンスは `image` フィールドを **含めない**（`protected: true` フラグのみ追加）。これにより未認証クライアントが画像 key を知る経路を塞ぐ。
- 新規 `POST /rooms/:id/auth` エンドポイントが平文パスワードを受け取り、PBKDF2 で再ハッシュ → 一致なら 24h 有効の HS256 JWT (`{ sub: roomId, exp }`) を返す。secret は `wrangler secret put ROOM_TOKEN_SECRET`。
- `GET /rooms/:id/image` (Phase 2 で実装済み) は、ルームが保護されている場合のみ `Authorization: Bearer <token>` 必須。トークンの `sub` が roomId と一致することを検証。未保護ルームは無認証で従来通り取得可能。
- `GET /sync/:id` (WebSocket) は、保護されている場合のみ query param `?token=...` 必須（WebSocket は `Authorization` ヘッダを送れないため）。`yRoute` upgrade 前の middleware で検証し、不一致なら 401。
- `apps/api/src/yjs.ts` の `YDurableObjects` を **import しつつ `SnapShareYDO extends YDurableObjects` でサブクラス化** し、`onStart` で `state.storage.setAlarm(createdAt + ttlMs)` を仕込む。alarm 発火時に R2 image + R2 meta + DO storage を破棄。`wrangler.toml` の `class_name = "YDurableObjects"` は `class_name = "SnapShareYDO"` に変更し、migration を `v2` で `renamed_classes`。
- `apps/web` 側に **`RoomGate` コンポーネント** を導入し、`fetchRoom` が `protected: true` を返したらパスワード入力画面を表示。送信成功で `sessionStorage` に token を保存し、`fetchProtectedImage(roomId, token)` と Yjs WebSocket URL `wss://.../sync/:id?token=...` を再構成。誤ったパスワードは「パスワードが違います」と日本語で表示し、リトライ可能。
- `RoomSchema` 拡張は `packages/shared` で `auth` をオプショナルに追加し、**stored shape (with auth) vs public shape (without auth, `protected: true` のみ)** を分離した二つの Zod スキーマを export する。
- 全 validation green: `pnpm turbo run lint typecheck test build` + 既存 5 件 (Phase 4) + 新規 35〜45 件のユニット / 統合テスト + Playwright smoke 1 件。

## Metadata

- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/snap-share.prd.md`
- **PRD Phase**: Phase 5 — パスワード保護 + TTL（pending → in-progress 化）
- **Depends on**: Phase 4（complete: `YDurableObjects` 統合 / `/sync/:id` middleware / `RoomEditor` の `fetchRoom` フロー / R2 image+meta storage / `useYjsAnnotationsStore` の `wsUrl` 注入経路）
- **Parallel with**: Phase 6（UI 仕上げ） — Phase 5 のバックエンド変更と Phase 6 のフロント PNG export / レスポンシブはコードパスが交差しない（ただし `RoomGate` 導入は Phase 6 の shadcn 適用と先に統合しておくと楽）
- **Estimated Files**: 約 11 ファイル新規 + 9 ファイル更新
- **Estimated LOC**: 約 1300〜1700 行（テスト含む）
- **Confidence**: **7/10** — 暗号化は Web Crypto + Hono JWT で枯れた API のみ、TTL も DO Alarm の標準パターン。残るリスクは (1) `YDurableObjects` サブクラス化が `y-durableobjects@1.0.5` の non-public field と干渉しないか、(2) `wrangler.toml` の `renamed_classes` migration が `wrangler dev` 環境で破綻しないか、(3) WS query token を URL ログに残さない運用配慮、の 3 点

---

## UX Design

### Before（Phase 4 完了時点）

```
┌─────────────────────────────────────────────────────────┐
│  http://localhost:5173/                                  │
│  ┌─────────────────────────────────────────────────────┐│
│  │ [画像 D&D] → ルーム発行 → /r/{id} に遷移 → 即編集  ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  http://localhost:5173/r/V1StGXR8_Z5jdHi6B-mYT          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ < 即時に画像 + 注釈 + 他ユーザーカーソル >          ││
│  │   URL を知っているだけで誰でも入れる                 ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  7 日経過後も R2 にデータが残り続け、`GET /rooms/:id`   │
│  は 200 を返し続ける                                      │
└─────────────────────────────────────────────────────────┘
```

### After

```
┌─────────────────────────────────────────────────────────┐
│  http://localhost:5173/  (ルーム作成)                     │
│  ┌─────────────────────────────────────────────────────┐│
│  │ [画像 D&D]                                          ││
│  │ □ パスワードで保護する (オプション)                   ││
│  │   └─ [────────────] (空のまま発行で未保護)           ││
│  │ → ルーム発行 → /r/{id} に遷移                        ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  http://localhost:5173/r/V1StGXR8_Z5jdHi6B-mYT          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 🔒 このルームはパスワードで保護されています           ││
│  │ パスワード [────────] [入室]                         ││
│  │  ↑ 誤入力時: 「パスワードが違います」                 ││
│  │  ↓ 正答時: 通常の編集画面に遷移                      ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  7 日経過後 (createdAt + ttlMs):                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ ルームが見つかりません                                ││
│  │ URL の有効期限が切れている可能性があります (TTL 7 日) ││
│  │ [トップに戻る]                                       ││
│  └─────────────────────────────────────────────────────┘│
│  ↑ DO Alarm が R2 image + meta + DO storage を破棄済    │
└─────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| トップページ アップロード | 画像 D&D のみ | 画像 D&D + パスワード入力欄（オプション） | 空のまま発行で未保護。`useImageSource` に password 引数を流す |
| `POST /rooms` レスポンス | `Room { image }` 必ず | 未保護: 従来通り / 保護: `Room { protected: true }` で `image` 抜き | `RoomPublicSchema` で stored / public を分離 |
| `/r/:id` 直アクセス（保護有） | 即編集画面 | 入室画面（`RoomGate`） → 認証成功で編集画面 | sessionStorage に `roomToken:{roomId}` キーで token 保存 |
| `/r/:id` 直アクセス（未保護） | 即編集画面 | 即編集画面（無変更） | `protected: false` のときは従来パス |
| `GET /rooms/:id/image` | 誰でも 200 | 保護有: `Authorization: Bearer ...` 必須、無効なら 401 / 未保護: 従来通り | クライアントは `fetch` の `headers` で Bearer 付与 |
| `/sync/:id` WebSocket | roomId 存在で接続可 | 保護有: `?token=...` 必須、無効なら 401 で WS 拒否 | `useYjsAnnotationsStore` に `wsUrlBuilder` を渡せるよう拡張 |
| 7 日経過後 | 200 が返り続ける | 404 NOT_FOUND（DO Alarm が破棄済） | UI は「ルームが見つかりません」（既存実装を流用） |
| 誤パスワード入力 | 概念なし | 「パスワードが違います」を日本語で表示、再入力可能 | 401 を 3 回連続で返したら 60s クールダウン（後述 Decisions Log） |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `apps/api/src/routes/rooms.ts` | 1-130 | `OpenAPIHono` の chained `.openapi(...)` パターン、multipart 受信、validation hook |
| P0 (critical) | `apps/api/src/services/room-service.ts` | 1-100 | `createRoomService` のロールバック付き put フロー（auth フィールド書込の合流点） |
| P0 (critical) | `apps/api/src/yjs.ts` | 1-50 | `YDurableObjects` の re-export、`syncRoute` middleware、`yRoute` の使い方 |
| P0 (critical) | `apps/api/src/lib/error.ts` | 1-90 | `AppError` / `errorEnvelope` / `onAppError` — 既存パターンを尊重 |
| P0 (critical) | `apps/api/wrangler.toml` | 全 | DO migration / vars / r2_bucket の追加場所、`renamed_classes` の構文 |
| P0 (critical) | `packages/shared/src/room.ts` | 全 | `RoomSchema` の現状と `auth` フィールド追加位置 |
| P1 (important) | `apps/api/src/storage/r2-meta-storage.ts` | 全 | meta JSON の put/get と Zod 検証パターン（`auth` 拡張時に同様の堅牢性を維持） |
| P1 (important) | `apps/web/src/pages/RoomEditor.tsx` | 全 | `imageState` 機械の現状、`RoomGate` 挿入ポイント |
| P1 (important) | `apps/web/src/lib/api-client.ts` | 全 | `fetchRoom` / `createRoom` / `buildImageUrl` の現状、token 挿入ポイント |
| P1 (important) | `apps/web/src/hooks/useYjsAnnotationsStore.ts` | 1-80 | `wsUrl` 構成箇所（query token を載せる場所） |
| P1 (important) | `apps/api/src/__tests__/helpers/build-env.ts` | 全 | `noopY_ROOM` の構造 — `ROOM_TOKEN_SECRET` 追加と alarm モック方針 |
| P1 (important) | `apps/api/src/__tests__/rooms.test.ts` | 1-130 | 既存 multipart 検証パターン |
| P1 (important) | `apps/api/src/__tests__/yjs.test.ts` | 全 | `/sync/:id` middleware テストパターン（query token テストはこの形を踏襲） |
| P2 (reference) | `.claude/PRPs/plans/completed/phase-4-realtime-sync.plan.md` | 全 | サブクラス化したくない誘惑への対処、import-vs-DI 判断材料 |
| P2 (reference) | `apps/web/src/lib/url-room.ts` | 全 | `parseRoomIdFromPath` を `RoomGate` がそのまま使える |
| P2 (reference) | `node_modules/.pnpm/y-durableobjects@1.0.5_hono@4.12.15/node_modules/y-durableobjects/dist/index.d.ts` | 全 | `YDurableObjects` の `protected onStart()` / `cleanup()` シグネチャ |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Cloudflare DO Alarms | [Workers Docs: Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/) | `state.storage.setAlarm(timestamp)` は最初の onStart 時に 1 回だけ呼ぶ。`alarm()` メソッド再エントリ可（idempotent 必須）。`wrangler dev` 上でも実時刻ベースで発火する |
| Cloudflare DO Migrations | [Workers Docs: DO Migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/) | `renamed_classes` は同一 binding name を保つために必須。`new_classes` から `renamed_classes` への移行は migration tag を `v2` 等にインクリメントするだけ |
| Web Crypto PBKDF2 | [MDN: SubtleCrypto.deriveBits](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits) | `crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)` で 32 byte ハッシュ。OWASP 2023 推奨は 600k 反復だが個人開発の Workers CPU 30s 制限を踏まえ **210k で開始** し dogfood で再評価 |
| Hono JWT helper | [Hono Docs: JWT](https://hono.dev/docs/helpers/jwt) | `import { sign, verify } from 'hono/jwt'` を使う。HS256 / payload に exp 必須 / verify は throw する（`JwtTokenExpired` 等で分岐） |
| `y-durableobjects` subclassing | [GitHub: napolab/y-durableobjects README](https://github.com/napolab/y-durableobjects) | `onStart` / `cleanup` は `protected` なので extend 可能。`fetch` の override は不要（hono app が WS upgrade を扱う） |

```
KEY_INSIGHT: Argon2 を Cloudflare Workers で動かすには WASM ライブラリ (argon2-browser 等) が必要だが、Workers の起動コスト + WASM init の trade-off が個人開発スコープには合わない。PBKDF2-SHA256 (210k iterations) は MDN/OWASP の現在も認められた選択肢で、Web Crypto がネイティブ非同期サポート、依存追加ゼロ。
APPLIES_TO: `apps/api/src/lib/password.ts` 設計、Decisions Log 記載、PRD の `Argon2` 記述からの逸脱
GOTCHA: PBKDF2 のセキュリティは反復回数に強く依存。salt は 16 byte 以上、`crypto.getRandomValues` で生成。`timingSafeEqual` 相当のために hex 比較ではなく同長 Uint8Array のビット集約比較を使う。
```

```
KEY_INSIGHT: WebSocket は `Authorization` ヘッダを送れないため、保護ルームの WS は query param token に依存する。だが query token は (a) ブラウザ履歴, (b) アクセスログ, (c) Referer header に記録され得る。緩和策: token は短寿命 (24h) + roomId binding (`sub` で検証) + 漏洩時の現実的影響は「TTL までそのルームに参加可能」のみ。Phase 5 はこのスコープで割り切る。
APPLIES_TO: `/sync/:id` の query token middleware、Decisions Log 記載
GOTCHA: `URLSearchParams` で append 後の URL を `logger.info` に流すと token が平文ログ化する。`/sync/:id` middleware では token を読み取った時点で c.set でフィールドに保持し、ログには `tokenPresent: true/false` のみ記録。
```

```
KEY_INSIGHT: `YDurableObjects` を import + `extends` する Approach A（サブクラス化）は library API surface に依存するが、Approach B（独立した Cleanup DO + Cron）は (a) `wrangler.toml` に Cron Trigger 追加, (b) DO 2 つ運用, (c) Hibernation 中の Cleanup DO は通常 wake しないため 7 日無アクセスのルームを掃除できない、という致命傷がある。Approach A 一択。
APPLIES_TO: `apps/api/src/yjs.ts` での `class SnapShareYDO extends YDurableObjects<{ Bindings: Bindings }>` 実装
GOTCHA: `y-durableobjects@1.0.5` の `onStart` は `protected async onStart(): Promise<void>` で、内部で `app` / `doc` / `storage` の初期化を行う。サブクラスは `super.onStart()` を必ず先に await すること。
```

---

## Patterns to Mirror

### NAMING_CONVENTION (新規 service / route / lib)

```ts
// SOURCE: apps/api/src/services/room-service.ts:18-30
export type RoomServiceDeps = { /* ... */ };
export type RoomService = { /* ... */ };
export const createRoomService = (deps: RoomServiceDeps): RoomService => ({ /* ... */ });
```

→ Phase 5 では `createPasswordService` (`apps/api/src/services/password-service.ts`) と `createTokenService` (`apps/api/src/services/token-service.ts`) を同形で作る。`createXxxService(deps): XxxService` パターン厳守。

### ERROR_HANDLING (AppError + envelope)

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

→ Phase 5 では `UNAUTHORIZED` を **新規エラーコードとして追加** (`apps/api/src/lib/error.ts` の `ErrorCode` union 拡張) し、auth 失敗時は `throw new AppError(401, 'UNAUTHORIZED', 'Invalid or missing token', { roomId })`。public message は固定文字列、ユーザー入力は logContext 側へ。

### LOGGING_PATTERN

```ts
// SOURCE: apps/api/src/services/room-service.ts:91
logger.info('room created', { id, contentType, size: file.size });
// SOURCE: apps/api/src/yjs.ts:39
logger.warn('sync ws denied: room not found', { id });
```

→ パスワード関連: `logger.info('room created', { id, protected: true })`, `logger.warn('auth failed', { id })`. **平文パスワード / token / hash / salt は絶対にログに含めない**。検証失敗時は `tokenPresent` boolean のみ。

### TYPE_DEFINITIONS (Zod SSOT, optional 拡張)

```ts
// SOURCE: packages/shared/src/room.ts:28-39
export const RoomSchema = z
  .object({
    id: z.string().regex(ROOM_ID_REGEX),
    createdAt: z.number().int().nonnegative(),
    ttlMs: z.number().int().positive(),
    image: RoomImageSchema,
  })
  .readonly();
```

→ Phase 5 では `RoomAuthSchema` を新設し、`RoomStoredSchema` (auth 含む / R2 メタ用) と `RoomPublicSchema` (auth 抜き + `protected` boolean / API レスポンス用) の二段構成に拡張。既存 `RoomSchema` は **`RoomStoredSchema` の alias** として `room.ts` で再 export し、後方互換維持（テストとサービスは段階的に移行）。

### REPOSITORY_PATTERN (R2 storage interface)

```ts
// SOURCE: apps/api/src/storage/r2-meta-storage.ts:1-12
export type MetaStorage = {
  putMeta(room: Room): Promise<void>;
  getMeta(id: string): Promise<Room | null>;
};
```

→ Phase 5 では `MetaStorage` の引数を `RoomStored` に差し替え、`auth` フィールドの透過保存。**インタフェースは増やさず**（ただし `deleteMeta` は alarm cleanup 用に追加）、Room 型の拡張で吸収。

### SERVICE_PATTERN (factory + Deps)

```ts
// SOURCE: apps/api/src/services/room-service.ts:60-100
export const createRoomService = (deps: RoomServiceDeps): RoomService => ({
  async create(file: File): Promise<Room> { /* ... */ },
  async get(id: string): Promise<Room> { /* ... */ },
});
```

→ 新規 `createPasswordService(deps)` は `{ hash(password): Promise<RoomAuth>, verify(password, auth): Promise<boolean> }` を、`createTokenService(deps)` は `{ issue(roomId): Promise<string>, verify(token, roomId): Promise<{ ok: true } | { ok: false, reason }> }` を返す。Deps は `{ secret: string, now: () => number, ttlMs: number }` 等の純粋値のみ（global crypto は import で参照）。

### TEST_STRUCTURE (vitest + buildEnv + AAA)

```ts
// SOURCE: apps/api/src/__tests__/rooms.test.ts:11-28
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

→ Phase 5 では `buildEnv()` を `buildEnv({ ROOM_TOKEN_SECRET: 'test-secret-min-32-bytes-padding-...' })` のオーバーライド可能形にして、auth 関連テストで使用。AAA + describe ブロックは既存通り。

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `packages/shared/src/room.ts` | UPDATE | `RoomAuthSchema` 追加、`RoomStoredSchema` / `RoomPublicSchema` 分離、`isExpired` 既存維持 |
| `packages/shared/src/__tests__/room.test.ts` | UPDATE | 新スキーマの parse / safeParse / `RoomStoredSchema → RoomPublicSchema` 変換ヘルパテスト |
| `apps/api/src/lib/bindings.ts` | UPDATE | `ROOM_TOKEN_SECRET: string` を追加 |
| `apps/api/src/lib/error.ts` | UPDATE | `ErrorCode` union に `'UNAUTHORIZED'` を追加、`AppErrorStatus` に `401` を追加 |
| `apps/api/src/lib/password.ts` | CREATE | PBKDF2 ハッシュ生成 / 検証 / salt 生成。Web Crypto のみ依存 |
| `apps/api/src/lib/__tests__/password.test.ts` | CREATE | round-trip / 異なる salt → 異なる hash / 誤パスワード reject / iteration 値固定 |
| `apps/api/src/lib/token.ts` | CREATE | Hono `hono/jwt` ラッパ。`issue(roomId)` / `verify(token, roomId)` |
| `apps/api/src/lib/__tests__/token.test.ts` | CREATE | issue/verify round-trip / wrong roomId reject / expired reject / 改ざん reject |
| `apps/api/src/services/password-service.ts` | CREATE | `createPasswordService(deps)` を export。lib 関数を service 形に整える |
| `apps/api/src/services/token-service.ts` | CREATE | `createTokenService(deps)` を export |
| `apps/api/src/services/room-service.ts` | UPDATE | `create(file, password?)` に拡張、auth 付き Room を保存 |
| `apps/api/src/services/__tests__/room-service.test.ts` | UPDATE | 既存テスト + パスワード付きルーム生成 / public shape 変換テスト |
| `apps/api/src/routes/rooms.ts` | UPDATE | `POST /rooms` に `password` field 追加、`GET /rooms/:id` を public shape で返却、`POST /rooms/:id/auth` 新設 |
| `apps/api/src/routes/images.ts` | UPDATE | 保護ルームは `Authorization: Bearer` 必須化（middleware で token verify） |
| `apps/api/src/yjs.ts` | UPDATE | `SnapShareYDO extends YDurableObjects` を新設して export、`/sync/:id` middleware に query token 検証を追加 |
| `apps/api/src/storage/r2-meta-storage.ts` | UPDATE | `deleteMeta(id)` を `MetaStorage` に追加（alarm cleanup 用） |
| `apps/api/src/__tests__/helpers/build-env.ts` | UPDATE | `ROOM_TOKEN_SECRET` を default 設定、`noopY_ROOM` を維持 |
| `apps/api/src/__tests__/rooms.test.ts` | UPDATE | password 付き作成 / 未保護維持 / public shape / 401 paths |
| `apps/api/src/__tests__/images.test.ts` | UPDATE | 保護ルーム image: 401 (no token) / 401 (wrong token) / 200 (valid token) |
| `apps/api/src/__tests__/yjs.test.ts` | UPDATE | `/sync/:id` で 401 (protected, no token) / 200 passthrough (valid token) を追加 |
| `apps/api/src/index.ts` | UPDATE | `export { YDurableObjects } from './yjs'` を `export { SnapShareYDO } from './yjs'` に変更 |
| `apps/api/wrangler.toml` | UPDATE | `class_name = "SnapShareYDO"` に変更、`migrations` に `v2` で `renamed_classes` 追加、`ROOM_TOKEN_SECRET` を **secret として `wrangler secret put`** する旨をコメント記載 |
| `apps/api/.dev.vars.example` | CREATE | `ROOM_TOKEN_SECRET` の見本値 (ダミー) |
| `apps/web/src/lib/api-client.ts` | UPDATE | `createRoom(file, password?)` / `fetchRoom` の戻り値が `RoomPublic` / `authenticateRoom(roomId, password): Promise<token | null>` / `fetchProtectedImage(room, token)` |
| `apps/web/src/lib/auth-storage.ts` | CREATE | `sessionStorage` に `roomToken:{id}` で token 永続、JSON safe parse |
| `apps/web/src/lib/__tests__/auth-storage.test.ts` | CREATE | get / set / clear / 破損 JSON 復元 |
| `apps/web/src/lib/yjs-config.ts` | UPDATE | `wsUrlFor(roomId, token?)` で query param に token を append |
| `apps/web/src/lib/__tests__/yjs-config.test.ts` | UPDATE | token 付与時の `wss://.../sync/:id?token=...` 形式テスト |
| `apps/web/src/components/room-gate/RoomGate.tsx` | CREATE | `protected: true` で表示するパスワード入力 UI |
| `apps/web/src/components/room-gate/__tests__/RoomGate.test.tsx` | CREATE | 入力 / 送信 / 401 でエラーメッセージ / 成功で onAuthenticated コール |
| `apps/web/src/pages/RoomEditor.tsx` | UPDATE | `protected` 判定 → `RoomGate` 挿入、token を `useYjsAnnotationsStore` と `fetchProtectedImage` に伝播 |
| `apps/web/src/pages/LocalEditor.tsx` | UPDATE | アップロード時の password 入力欄を導入（最小実装: チェックボックス + 任意 input） |
| `apps/web/src/hooks/useImageSource.ts` | UPDATE | `loadFromFile(file, password?)` を受け取り `createRoom(file, password)` に転送 |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | UPDATE | `wsUrl` 構成で `token` を query param に載せる経路を追加 |
| `.gitignore` (or `apps/api/.gitignore`) | UPDATE | `.dev.vars` を gitignore（既存確認、無ければ追加） |

## NOT Building

- **「全ルーム必須」のパスワード**: PRD MoSCoW 通り**オプション**。未保護ルームは Phase 4 と同等挙動を維持。
- **アカウント / ログイン / 招待ロール**: PRD Could スコープ。token は roomId-bound で「正しいパスワード持ち = 入室可」のみ。
- **オーナーのパスワード変更 UI**: 一度発行したルームのパスワードは TTL 期限まで固定。再発行が必要なら新ルームを作る。
- **複数同時パスワード / 別役割**: PRD スコープ外。
- **永続ルーム / 「TTL 延長」 UI**: PRD MoSCoW Could。Phase 5 では 7 日固定（`ROOM_TTL_MS` env）。
- **詳細 brute-force 対策**: 簡易 cooldown のみ（Decisions Log 参照）。本格的な Turnstile / IP rate limit は Phase 7 (公開準備) スコープ。
- **`hash` 移行マイグレーション**: 既存ルーム（`auth` 無し）はそのまま未保護扱い。Phase 5 リリース時点で生存している既存ルームに `auth` を後付けすることはしない。
- **24h / オーナー指定 TTL**: Open Questions のうち TTL 値判定は Phase 5 では行わず、`ROOM_TTL_MS` の値変更で済む構造のみ確保。
- **`Argon2` への切替**: Decisions Log 記載の通り PBKDF2 で確定。dogfood 後に必要なら別 ADR で再検討。

---

## Step-by-Step Tasks

### Task 1: `packages/shared` にパスワード/auth スキーマ追加

- **ACTION**: `packages/shared/src/room.ts` を編集
- **IMPLEMENT**:
  - `RoomAuthSchema = z.object({ algo: z.literal('PBKDF2-SHA256'), iterations: z.number().int().positive(), salt: z.string().min(1), hash: z.string().min(1) }).readonly()` (salt/hash は base64url エンコード文字列で保存)
  - `RoomStoredSchema = RoomSchema.extend({ auth: RoomAuthSchema.optional() })` (既存 RoomSchema を base に再利用)
  - `RoomPublicSchema = z.object({ id, createdAt, ttlMs, protected: boolean, image: RoomImageSchema.optional() }).readonly()`
  - `toPublicRoom(stored: RoomStored): RoomPublic` 関数: `auth` がある → `{ ...withoutImageAndAuth, protected: true }`、無い → `{ ...withoutAuth, protected: false, image }`
  - `RoomSchema` は `RoomStoredSchema` の alias として再 export（既存 import パスを壊さない）
  - 型: `export type RoomAuth = z.infer<...>; export type RoomStored = z.infer<...>; export type RoomPublic = z.infer<...>;`
- **MIRROR**: TYPE_DEFINITIONS（既存 readonly Zod object）
- **IMPORTS**: `import { z } from 'zod'`
- **GOTCHA**:
  - `RoomSchema` を直接 alias しないと既存 `apps/api/src/storage/r2-meta-storage.ts` のテストが壊れる。`export const RoomSchema = RoomStoredSchema` で**型と value 両方** alias する
  - `salt` は **base64url 文字列**として保存（JSON 経由のため bytes は不可）。実装側で `base64UrlEncode(getRandomValues(new Uint8Array(16)))` 必須
- **VALIDATE**:
  - `pnpm -F @snap-share/shared test` 全 pass
  - `RoomStoredSchema.parse({ id, createdAt, ttlMs, image })` (auth 抜き) も成功すること
  - `toPublicRoom({ ...stored, auth: { ... } })` で `image` キー自体が `Object.keys` から落ちること（`hasOwnProperty` テスト）

### Task 2: `packages/shared` の `__tests__/room.test.ts` 拡張

- **ACTION**: 既存テスト維持 + 5 件追加
- **IMPLEMENT**:
  - `RoomStoredSchema` parse: `auth` 有/無 両方
  - `RoomPublicSchema` parse: `protected: true` の場合 `image` 不要 / `protected: false` の場合 `image` 必須を validate
  - `toPublicRoom` 変換: auth 付き入力 → `{ protected: true }`, image なし
  - `toPublicRoom` 変換: auth 無し入力 → `{ protected: false, image }`
  - `RoomSchema` alias: 既存パターンが破綻しないこと（`RoomSchema.parse(stored)` 通る）
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**: `import { RoomStoredSchema, RoomPublicSchema, toPublicRoom, RoomSchema } from '../room'`
- **GOTCHA**: Zod の `safeParse` で `protected: false` かつ `image: undefined` を確実に reject すること（`refine` 経由が後方互換シンプル）
- **VALIDATE**: `pnpm -F @snap-share/shared test` で 9 件 + 5 件全て pass

### Task 3: `apps/api/src/lib/password.ts` 新規作成

- **ACTION**: PBKDF2 ハッシュユーティリティを実装
- **IMPLEMENT**:
  ```ts
  export const PBKDF2_ITERATIONS = 210_000;
  export const SALT_BYTES = 16;
  export const HASH_BITS = 256;

  export const generateSalt = (): Uint8Array =>
    crypto.getRandomValues(new Uint8Array(SALT_BYTES));

  export const derivePbkdf2 = async (password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> => {
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password),
      { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      keyMaterial, HASH_BITS
    );
    return new Uint8Array(bits);
  };

  export const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  };

  export const base64UrlEncode = (bytes: Uint8Array): string => /* ... */;
  export const base64UrlDecode = (str: string): Uint8Array => /* ... */;
  ```
- **MIRROR**: `apps/api/src/lib/id.ts` の lib モジュール構造（純粋関数のみ、service 層は別ファイル）
- **IMPORTS**: グローバル `crypto`（Workers / Node 22 ネイティブ）、`TextEncoder`
- **GOTCHA**:
  - `constantTimeEqual` は **必ず長さチェック後にビット XOR で集約**（早期 return は timing attack）
  - base64url は `+/=` を `-_` に置換して padding 削除。`atob`/`btoa` は使わず Uint8Array ↔ string で実装（Edge runtime 互換）
- **VALIDATE**: 単独で実行確認 — `pnpm -F @snap-share/api test -- src/lib/__tests__/password.test.ts`

### Task 4: `apps/api/src/lib/__tests__/password.test.ts` 新規作成

- **ACTION**: 7 件のユニットテスト
- **IMPLEMENT**:
  - 同 password + 同 salt → 同 hash (deterministic)
  - 同 password + 異なる salt → 異なる hash
  - 異なる password + 同 salt → 異なる hash
  - 空 password を deny（service 側 wrap 検証は task 5）
  - `constantTimeEqual`: 長さ違い false / 同一 true / 1 byte 違い false
  - `base64UrlEncode/Decode` round-trip（16 byte / 32 byte / 0 byte）
  - `PBKDF2_ITERATIONS` が 210_000 以上であることを assert（regression guard）
- **MIRROR**: TEST_STRUCTURE
- **GOTCHA**: 210k iterations は実行に数百 ms かかるため、`it` 内で password に短い `'a'` を使ってもテスト全体で 5〜10s 程度かかる。`vitest.config.ts` の `testTimeout` を確認（既存 5000ms 想定なら維持）
- **VALIDATE**: 全 7 件 pass

### Task 5: `apps/api/src/services/password-service.ts` 新規作成

- **ACTION**: lib を Service 形式に整える
- **IMPLEMENT**:
  ```ts
  export type PasswordService = {
    hash(password: string): Promise<RoomAuth>;
    verify(password: string, auth: RoomAuth): Promise<boolean>;
  };
  export const createPasswordService = (): PasswordService => ({
    async hash(password) {
      if (password.length === 0) throw new AppError(400, 'INVALID_REQUEST', 'Password is empty');
      if (password.length > 256) throw new AppError(400, 'INVALID_REQUEST', 'Password too long');
      const salt = generateSalt();
      const hash = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
      return { algo: 'PBKDF2-SHA256', iterations: PBKDF2_ITERATIONS, salt: base64UrlEncode(salt), hash: base64UrlEncode(hash) };
    },
    async verify(password, auth) {
      if (auth.algo !== 'PBKDF2-SHA256') return false;
      const salt = base64UrlDecode(auth.salt);
      const expected = base64UrlDecode(auth.hash);
      const actual = await derivePbkdf2(password, salt, auth.iterations);
      return constantTimeEqual(actual, expected);
    },
  });
  ```
- **MIRROR**: SERVICE_PATTERN (`createXxxService(deps)` factory)
- **IMPORTS**: `import { RoomAuth } from '@snap-share/shared'`、`AppError`、`./password` lib 関数群
- **GOTCHA**: Service 自身は外部依存ゼロのため `deps` 引数なし。テスト容易性は lib 関数経由で確保
- **VALIDATE**: テストは `services/__tests__/password-service.test.ts` で hash/verify の往復、誤 password で false、長さ制限で 400 throw

### Task 6: `apps/api/src/lib/error.ts` を `UNAUTHORIZED` 対応に拡張

- **ACTION**: `ErrorCode` union と `AppErrorStatus` 拡張
- **IMPLEMENT**:
  - `ErrorCode = 'INVALID_REQUEST' | 'UNSUPPORTED_MEDIA_TYPE' | 'PAYLOAD_TOO_LARGE' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'INTERNAL'`
  - `AppErrorStatus = 400 | 401 | 404 | 413 | 415 | 500`
  - `errorEnvelope` / `onAppError` のロジックは無変更（既に generic）
- **MIRROR**: ERROR_HANDLING（既存 AppError の構造そのまま）
- **IMPORTS**: 変更なし
- **GOTCHA**: `apps/api/src/routes/rooms.ts` の `ErrorResponseSchema` 内 `code: z.enum(...)` も同期更新が必要（4 ファイル grep で全箇所拾うこと）
- **VALIDATE**: `pnpm -F @snap-share/api typecheck` で型エラーなし、既存 41 件 緑

### Task 7: `apps/api/src/lib/token.ts` 新規作成

- **ACTION**: Hono JWT helper をラップ
- **IMPLEMENT**:
  ```ts
  import { sign, verify } from 'hono/jwt';
  import { JwtTokenExpired } from 'hono/utils/jwt/types';

  const TOKEN_TTL_SEC = 24 * 60 * 60;

  export type TokenPayload = { sub: string; exp: number; iat: number };

  export const issueRoomToken = async (roomId: string, secret: string, now: () => number = Date.now): Promise<string> => {
    const iat = Math.floor(now() / 1000);
    return sign({ sub: roomId, exp: iat + TOKEN_TTL_SEC, iat }, secret, 'HS256');
  };

  export const verifyRoomToken = async (token: string, expectedRoomId: string, secret: string): Promise<{ ok: true; payload: TokenPayload } | { ok: false; reason: 'expired' | 'invalid' | 'sub_mismatch' }> => {
    try {
      const payload = (await verify(token, secret, 'HS256')) as TokenPayload;
      if (payload.sub !== expectedRoomId) return { ok: false, reason: 'sub_mismatch' };
      return { ok: true, payload };
    } catch (e) {
      if (e instanceof JwtTokenExpired) return { ok: false, reason: 'expired' };
      return { ok: false, reason: 'invalid' };
    }
  };
  ```
- **MIRROR**: lib モジュール構造（純粋関数）。Service 化は Task 8
- **IMPORTS**: `hono/jwt`, `hono/utils/jwt/types`
- **GOTCHA**:
  - `hono/jwt` の `verify` は失敗時 throw。`JwtTokenExpired` の判定が他の `JwtTokenInvalid` 系と分岐できる
  - secret は **32 byte 以上**を契約として要求（`buildEnv` 既定値も 32 byte 確保）
- **VALIDATE**: token.test.ts でラウンドトリップ、wrong roomId reject、expired reject、改ざん reject

### Task 8: `apps/api/src/services/token-service.ts` + `apps/api/src/lib/__tests__/token.test.ts`

- **ACTION**: Service 化 + ユニットテスト
- **IMPLEMENT**:
  - `createTokenService({ secret, now })` で `issue(roomId)` / `verify(token, roomId)` を提供。サービスは secret を closure に閉じる
  - test:
    - issue → verify で ok: true、payload.sub 一致
    - issue → verify(token, otherRoomId) で `sub_mismatch`
    - 偽造 (secret 違い) で `invalid`
    - exp 過去 (mock now で iat を 25h 前に設定) で `expired`
    - 改ざん (Base64 部分書換) で `invalid`
- **MIRROR**: SERVICE_PATTERN, TEST_STRUCTURE
- **IMPORTS**: `hono/jwt`, `vi.useFakeTimers` 等
- **GOTCHA**: `vi.setSystemTime` で issue 時刻を制御。`now: () => number` を Service Deps 経由で注入することで mock が容易に
- **VALIDATE**: 全 5 件 pass

### Task 9: `apps/api/src/lib/bindings.ts` に `ROOM_TOKEN_SECRET` 追加

- **ACTION**: 型定義を 1 行追加
- **IMPLEMENT**:
  ```ts
  export type Bindings = {
    IMAGES: R2Bucket;
    ROOM_TTL_MS: string;
    Y_ROOM: DurableObjectNamespace;
    /** HS256 JWT signing secret. Set via `wrangler secret put ROOM_TOKEN_SECRET`. Min 32 bytes. */
    ROOM_TOKEN_SECRET: string;
  };
  ```
- **MIRROR**: 既存 `Bindings` の JSDoc コメント慣習
- **IMPORTS**: なし
- **GOTCHA**: secret は production では `wrangler secret put` で投入。ローカル dev は `.dev.vars` に書く（**`.gitignore` 確認**）
- **VALIDATE**: typecheck 緑

### Task 10: `apps/api/src/__tests__/helpers/build-env.ts` を更新

- **ACTION**: `ROOM_TOKEN_SECRET` の default 値を追加
- **IMPLEMENT**:
  ```ts
  export const DEFAULT_ROOM_TOKEN_SECRET = 'test-secret-32-bytes-min-padding-aaa';
  export const buildEnv = (overrides: Partial<Bindings> = {}): Bindings => ({
    IMAGES: createInMemoryR2(),
    ROOM_TTL_MS: String(DEFAULT_TTL_MS),
    Y_ROOM: noopY_ROOM,
    ROOM_TOKEN_SECRET: DEFAULT_ROOM_TOKEN_SECRET,
    ...overrides,
  });
  ```
- **MIRROR**: 既存 buildEnv パターン（既定値 + spread overrides）
- **IMPORTS**: 変更なし
- **GOTCHA**: 既定 secret が短すぎると HS256 が runtime で警告。32 byte 以上を確保
- **VALIDATE**: 既存テスト全 41 件が緑のまま

### Task 11: `apps/api/src/services/room-service.ts` を password 対応に拡張

- **ACTION**: `create(file, password?)` シグネチャ拡張、auth 含む RoomStored 保存
- **IMPLEMENT**:
  - `RoomServiceDeps` に `password: PasswordService` を追加
  - `create(file, password?)`:
    1. 既存の MIME / size / TTL 検証
    2. password が空文字 or undefined → auth フィールド無し
    3. password 有 → `await deps.password.hash(password)` で `RoomAuth` を作る
    4. `RoomStored = { id, createdAt, ttlMs, image, ...(auth ? { auth } : {}) }` で R2 メタに保存
    5. ロールバック処理は既存通り（auth フィールドの hash を含む RoomStored を渡してもメタ JSON 化は安全）
  - 戻り値型を `Promise<RoomStored>` に変更（呼び出し側が `toPublicRoom` で post-process）
- **MIRROR**: 既存 service の AppError + logger 使用法、ロールバックパターン
- **IMPORTS**: `RoomStored, RoomAuth, toPublicRoom`, `PasswordService`
- **GOTCHA**:
  - password の長さ検証は `PasswordService.hash` 内で実施するため service 側は素通し
  - `logger.info('room created', { id, contentType, size, protected: !!auth })` で protected フラグだけログ化（hash 自体は絶対ログに乗せない）
- **VALIDATE**: 既存 unit test + 新規「password 付き作成 → meta.json に auth.hash が含まれる」「password 付き作成 → public shape に auth が無い」

### Task 12: `apps/api/src/routes/rooms.ts` の `POST /rooms` に password field 追加

- **ACTION**: zod-openapi スキーマと handler を拡張
- **IMPLEMENT**:
  - `uploadFormSchema` に `password: z.string().optional()` を追加（multipart text field）
  - 201 response の schema を `RoomPublicSchema` に変更
  - handler 内で `room = await buildService(c.env).create(image, password)` → `c.json(toPublicRoom(room), 201)`
  - `buildService` の Deps に `createPasswordService()` を追加
- **MIRROR**: 既存 chained `.openapi(...)` パターン、validation hook
- **IMPORTS**: `RoomPublicSchema, toPublicRoom`, `createPasswordService`
- **GOTCHA**:
  - zod-openapi の `multipart/form-data` で text field と File field を混在 → OpenAPI 仕様としては `password: z.string().openapi({ type: 'string' })` で明示
  - 既存 `apps/web/src/lib/api-client.ts` の `createRoom` は `FormData.set('image', file)` のみ。Task 22 で password も渡す
- **VALIDATE**: `pnpm -F @snap-share/api test -- src/__tests__/rooms.test.ts` 既存緑 + 新規 4 件「password なし → public shape 通常」「password 有 → public shape protected: true / image 無し」「短い password (1 char) は受理」「長すぎ password (300 char) は 400」

### Task 13: `apps/api/src/routes/rooms.ts` に `POST /rooms/:id/auth` を追加

- **ACTION**: 認証エンドポイントを新規追加
- **IMPLEMENT**:
  - `authBodySchema = z.object({ password: z.string().min(1).max(256) })`
  - `authResponseSchema = z.object({ token: z.string() })`
  - handler:
    1. `roomId` validation
    2. `roomService.get(id)` で stored room 取得（404 ならそのまま envelope）
    3. `room.auth` が無ければ 400 INVALID_REQUEST 「This room does not require a password」
    4. `passwordService.verify(password, room.auth)` で false → 401 UNAUTHORIZED 「Invalid password」
    5. true → `tokenService.issue(roomId)` で 24h JWT 発行 → 200 `{ token }`
  - logger: `logger.warn('auth failed', { id })` (false 時) / `logger.info('auth success', { id })` (true 時)
- **MIRROR**: 既存 `getRoomRoute` の chained `.openapi(...)` パターン
- **IMPORTS**: `createTokenService`, `createPasswordService`
- **GOTCHA**:
  - **同一 IP からの連続失敗は Phase 7 で扱うが、Phase 5 では 401 後 `crypto.subtle.deriveBits` の 210k iter が事実上の rate limit になる**ので追加不要
  - レスポンス 401 と 404 は意図的に区別する（Phase 5 では 404 漏洩は許容、`GET /rooms/:id` が存在判定可なため致命傷ではない）
- **VALIDATE**: rooms.test.ts に 5 件追加「未保護ルームに POST /auth → 400」「正答 → 200 + token 形式」「誤答 → 401 envelope」「missing password → 400」「不存在 roomId → 404」

### Task 14: `apps/api/src/routes/images.ts` に Bearer token middleware

- **ACTION**: 保護ルームの `GET /rooms/:id/image` を 認証必須化
- **IMPLEMENT**:
  - 既存 image route 内で先頭に middleware 追加:
    1. `roomService.get(id)` で stored room 取得（404 で envelope）
    2. `room.auth` 無し → next()（無認証で 200）
    3. `room.auth` 有 →
       - `Authorization` ヘッダ抽出 (`c.req.header('authorization')`)
       - `Bearer xxx` パース失敗 → 401
       - `tokenService.verify(token, roomId)` で `ok: false` → 401
       - `ok: true` → next()
- **MIRROR**: 既存 `apps/api/src/yjs.ts:18-30` の middleware パターン（`use('/:id', async (c, next) => { ... })`）
- **IMPORTS**: `createTokenService`, `roomService`
- **GOTCHA**:
  - middleware で room を get すると `images.ts` の本体 handler でも get することになり R2 read が 2 回。既存 service は idempotent なので許容。最適化は Phase 6/7 で計測後判断
  - `c.req.header('authorization')` は lower-case（fetch 仕様）。case-insensitive
- **VALIDATE**: images.test.ts に 4 件「未保護 → 200」「保護 + token なし → 401」「保護 + 無効 token → 401」「保護 + 有効 token → 200」

### Task 15: `apps/api/src/yjs.ts` の middleware に query token 検証追加 + `SnapShareYDO` サブクラス化

- **ACTION**: 既存 `syncRoute` middleware を拡張、`YDurableObjects` を継承して alarm 対応 DO を export
- **IMPLEMENT**:
  ```ts
  import { YDurableObjects, yRoute } from 'y-durableobjects';
  import { createR2ImageStorage } from './storage/r2-image-storage';

  export class SnapShareYDO extends YDurableObjects<{ Bindings: Bindings }> {
    protected override async onStart(): Promise<void> {
      await super.onStart();
      const existing = await this.state.storage.getAlarm();
      if (existing == null) {
        const roomId = this.state.id.name;
        if (roomId) {
          const meta = createR2MetaStorage(this.env.IMAGES);
          const room = await meta.getMeta(roomId).catch(() => null);
          if (room) await this.state.storage.setAlarm(room.createdAt + room.ttlMs);
        }
      }
    }

    override async alarm(): Promise<void> {
      const roomId = this.state.id.name;
      logger.info('alarm fired, cleaning up', { id: roomId });
      const images = createR2ImageStorage(this.env.IMAGES);
      const meta = createR2MetaStorage(this.env.IMAGES);
      const room = await meta.getMeta(roomId).catch(() => null);
      if (room) await images.deleteImage(room.image.key);
      await meta.deleteMeta(roomId).catch(() => undefined);
      await this.state.storage.deleteAll();
    }
  }
  export { yRoute };
  ```
  - middleware (`syncRoute` 内 `use('/:id', ...)`):
    - 既存の roomId regex check
    - `roomService.get(id)` (NOT_FOUND envelope はそのまま)
    - `room.auth` 有り → `c.req.query('token')` を抽出。なければ 401 / `tokenService.verify(token, id)` で fail → 401
    - `room.auth` 無し → 既存通り通す
- **MIRROR**: 既存 `apps/api/src/yjs.ts:18-39` の middleware 構造、`YDurableObjects` の export 慣習
- **IMPORTS**: `import { YDurableObjects, yRoute } from 'y-durableobjects'`, `import { createR2MetaStorage }`
- **GOTCHA**:
  - **`y-durableobjects@1.0.5` の `onStart` は `protected`** だが TypeScript override は許容。`super.onStart()` を **必ず先頭で await**
  - `state.id.name` は `idFromName` で発行されたときのみ存在。yRoute は `idFromName(roomId)` を呼ぶため Phase 4 経路では常に存在
  - alarm は **idempotent**（複数回発火する可能性）。R2 delete は既に missing でも OK な実装になっている（Task 16 で同等の deleteMeta を実装）
  - `wrangler.toml` の `class_name` を `SnapShareYDO` に書き換え + migration v2 が必須（Task 17）
- **VALIDATE**: yjs.test.ts に 4 件追加「未保護 + token なし → passthrough」「保護 + token なし → 401」「保護 + 無効 token → 401」「保護 + 有効 token → passthrough」。alarm 自体は wrangler dev で手動 smoke

### Task 16: `apps/api/src/storage/r2-meta-storage.ts` に `deleteMeta` を追加

- **ACTION**: alarm cleanup 用に削除関数追加
- **IMPLEMENT**:
  ```ts
  export type MetaStorage = {
    putMeta(room: RoomStored): Promise<void>;
    getMeta(id: string): Promise<RoomStored | null>;
    deleteMeta(id: string): Promise<boolean>;
  };
  // createR2MetaStorage の object literal に deleteMeta を追加
  async deleteMeta(id) {
    try { await bucket.delete(metaKey(id)); return true; }
    catch (err) { logger.warn('R2 deleteMeta failed', { id, err: getErrorMessage(err) }); return false; }
  }
  ```
- **MIRROR**: `r2-image-storage.ts` の `deleteImage` パターン
- **IMPORTS**: 変更なし
- **GOTCHA**: R2 の `delete` は missing オブジェクトでも success。エラーは true/false で吸収（既存 deleteImage と同形）
- **VALIDATE**: storage の既存テスト + 新規 1 件 `deleteMeta` round-trip

### Task 17: `apps/api/wrangler.toml` を migration v2 + secret コメント

- **ACTION**: migration / class_name 更新、secret 投入手順をコメント
- **IMPLEMENT**:
  ```toml
  [[durable_objects.bindings]]
  name = "Y_ROOM"
  class_name = "SnapShareYDO" # was YDurableObjects (Phase 4)

  [[migrations]]
  tag = "v1"
  new_classes = ["YDurableObjects"]

  [[migrations]]
  tag = "v2"
  renamed_classes = [{ from = "YDurableObjects", to = "SnapShareYDO" }]

  [vars]
  ROOM_TTL_MS = "604800000"

  # ROOM_TOKEN_SECRET is a secret, set via:
  #   wrangler secret put ROOM_TOKEN_SECRET   (production)
  #   .dev.vars (local — NOT committed; see .gitignore)
  ```
  - `apps/api/src/index.ts` の `export { YDurableObjects } from './yjs'` を `export { SnapShareYDO } from './yjs'` に変更
- **MIRROR**: `apps/api/wrangler.toml` 既存 migration 構造
- **IMPORTS**: なし
- **GOTCHA**:
  - **`renamed_classes` は `migrations.v2` で初めて宣言**するため、production で v1 上にデプロイされている既存 DO がある場合のみ書換が走る。dev / 未デプロイは migration v1 + v2 どちらも走るがエラーにはならない
  - `.dev.vars` を `.gitignore` に追加していない場合は Task で追加（既存 `.gitignore` 確認）
- **VALIDATE**: `pnpm -F @snap-share/api build`（wrangler dry-run）で `env.Y_ROOM (SnapShareYDO)` がログに出ること

### Task 18: `apps/api/src/__tests__/yjs.test.ts` 拡張

- **ACTION**: 4 件追加 + 既存 3 件は無変更（`buildEnv` の secret 経由）
- **IMPLEMENT**:
  - 既存 3 件: 無変更（middleware 通過確認）
  - 新規:
    - 未保護ルーム + token なし → passthrough（middleware を通って yRoute / noop に到達 = 404 にならない）
    - 保護ルーム + token なし → 401 envelope
    - 保護ルーム + 無効 token → 401 envelope
    - 保護ルーム + 有効 token → passthrough
- **MIRROR**: yjs.test.ts の既存 expect not 404 パターン
- **IMPORTS**: `tokenService` を test 内で直接使って valid token を生成
- **GOTCHA**: `app.request('/sync/{id}?token=xxx')` で query を載せる。`URLSearchParams` か直接文字列連結
- **VALIDATE**: 既存 3 + 新規 4 = 7 件 pass

### Task 19: `apps/api/src/__tests__/rooms.test.ts` 拡張

- **ACTION**: password 関連 9 件を追加
- **IMPLEMENT**:
  - `POST /rooms`: password なし → public shape (image あり、protected:false)
  - `POST /rooms`: password='secret123' → public shape (image なし、protected:true)
  - `POST /rooms`: password='' → 既存パスにフォールバック（未保護扱い）
  - `POST /rooms`: 257 文字 password → 400 INVALID_REQUEST
  - `POST /rooms/:id/auth`: 未保護ルームに対し → 400 INVALID_REQUEST
  - `POST /rooms/:id/auth`: 正答 → 200 + JWT 形式の token
  - `POST /rooms/:id/auth`: 誤答 → 401 UNAUTHORIZED envelope
  - `POST /rooms/:id/auth`: missing password → 400
  - `POST /rooms/:id/auth`: 不存在 roomId → 404
  - `GET /rooms/:id`: 保護ルームの public shape を確認（auth フィールド漏洩していないこと）
- **MIRROR**: 既存 rooms.test.ts のパターン
- **IMPORTS**: `tokenService` 不要（rooms route 経由で取得）
- **VALIDATE**: 全 pass

### Task 20: `apps/api/src/__tests__/images.test.ts` 拡張

- **ACTION**: 保護ルーム image アクセスのテスト 4 件追加
- **IMPLEMENT**:
  - 未保護ルーム → 200 stream（既存維持）
  - 保護ルーム + Authorization なし → 401
  - 保護ルーム + 無効 Bearer → 401
  - 保護ルーム + 有効 Bearer → 200 stream
- **MIRROR**: 既存 images.test.ts
- **IMPORTS**: `issueRoomToken`
- **VALIDATE**: 全 pass

### Task 21: `apps/web/src/lib/api-client.ts` 拡張

- **ACTION**: token / public shape 対応
- **IMPLEMENT**:
  - `import type { RoomPublic } from '@snap-share/shared'`
  - `createRoom(file, password?: string): Promise<RoomPublic | null>` — FormData に `password` を append（空文字列はスキップ）
  - `fetchRoom(id): Promise<RoomPublic | null>` — レスポンス型を `RoomPublic` に変更
  - `authenticateRoom(id, password): Promise<string | null>` — `POST /rooms/:id/auth`、200 で `{ token }`、401/400 で null
  - `fetchProtectedImage(room: RoomPublic, token: string): Promise<Response | null>` — `Authorization: Bearer` 付きで fetch、200 OK のみ Response 返す
  - `buildImageUrl(room, base?)` 既存維持（保護ルームの場合は使用側で fetch 経由に切替え）
- **MIRROR**: 既存 try/catch + logger.warn パターン
- **IMPORTS**: `RoomPublic`, `logger`
- **GOTCHA**:
  - `fetch` で `Authorization` ヘッダ付き Response を `<img src>` に直接渡せない。Konva の `useImage` も無認証 GET 前提。**保護ルームでは `fetchProtectedImage` で Blob を取得し、`URL.createObjectURL(blob)` で local URL に変換**して `<img>` に渡す
  - 既存 `RoomEditor` の `imageState.kind === 'ready'; url` フローはこの ObjectURL を流せばそのまま動く
- **VALIDATE**: api-client 単体テストは無いため、Task 25 の `RoomEditor` 統合テストで網羅

### Task 22: `apps/web/src/lib/auth-storage.ts` + テスト

- **ACTION**: sessionStorage ラッパ
- **IMPLEMENT**:
  ```ts
  const KEY = (roomId: string) => `roomToken:${roomId}`;
  export const getRoomToken = (roomId: string): string | null => {
    try { return window.sessionStorage.getItem(KEY(roomId)); } catch { return null; }
  };
  export const setRoomToken = (roomId: string, token: string): void => {
    try { window.sessionStorage.setItem(KEY(roomId), token); } catch { /* full / disabled */ }
  };
  export const clearRoomToken = (roomId: string): void => {
    try { window.sessionStorage.removeItem(KEY(roomId)); } catch { /* noop */ }
  };
  ```
- **MIRROR**: `apps/web/src/lib/local-user.ts` の sessionStorage / localStorage ラッパ try/catch パターン
- **IMPORTS**: なし
- **GOTCHA**:
  - sessionStorage はタブ閉じで消える（PRD 想定の「URL 共有」用途と合致）
  - localStorage を選ぶと長期生存になり token 漏洩リスクが高まる。**sessionStorage 一択**
- **VALIDATE**: 4 件「set/get/clear/missing key」

### Task 23: `apps/web/src/lib/yjs-config.ts` 拡張

- **ACTION**: `wsUrlFor(roomId, token?)` で query token を載せる
- **IMPLEMENT**:
  - 既存の URL 構築関数（`buildSyncWsUrl(env, roomId)` 等）に `token?: string` 引数追加
  - token 有り → `?token=${encodeURIComponent(token)}` を末尾に append
- **MIRROR**: 既存の関数シグネチャ・URL 生成パターン
- **IMPORTS**: なし
- **GOTCHA**: encodeURIComponent 必須（base64url の `_-` は安全だが将来 base64 標準に変えても壊れないように）
- **VALIDATE**: yjs-config.test.ts に 2 件追加「token あり → URL に ?token=」「token なし → URL に ?token= 無し」

### Task 24: `apps/web/src/components/room-gate/RoomGate.tsx` + テスト

- **ACTION**: パスワード入力 UI
- **IMPLEMENT**:
  - props: `{ roomId: string, onAuthenticated: (token: string) => void }`
  - state: `password`, `submitting`, `error: string | null`
  - JSX:
    - 中央に縦積み: 鍵アイコン (lucide-react `Lock`) + 「このルームはパスワードで保護されています」+ password input + 「入室」ボタン
    - エラーは下部に赤系で「パスワードが違います」（401 のみ）/「ネットワークエラー」（fetch 失敗）
  - submit: `authenticateRoom(roomId, password)` → 戻り値 string → `setRoomToken(roomId, token); onAuthenticated(token)` / null → `setError('パスワードが違います')`
  - `<form onSubmit>`、Enter 送信、autoFocus
- **MIRROR**:
  - `apps/web/src/components/connection/ConnectionBadge.tsx` の Tailwind v4 + `--color-*` token 利用
- **IMPORTS**: `lucide-react` の `Lock` icon、`authenticateRoom`, `setRoomToken`
- **GOTCHA**:
  - `password` input は `type="password"` 必須
  - submit 中は button disabled + 「認証中…」表示
  - 認証成功時の transition は親 (`RoomEditor`) で sessionStorage 検査 → 通常パス、で十分
- **VALIDATE**: RoomGate.test.tsx に 5 件「初期描画」「正答 → onAuthenticated コール」「誤答 → エラー表示」「ネットワークエラー → 別エラー」「submit 中ボタン disabled」

### Task 25: `apps/web/src/pages/RoomEditor.tsx` を password 対応に拡張

- **ACTION**: `protected` 判定 + `RoomGate` 挿入 + token 伝播
- **IMPLEMENT**:
  - `imageState` を `{ kind: 'loading' } | { kind: 'protected'; token: string | null } | { kind: 'ready'; url: string } | { kind: 'not-found' }` に拡張
  - 初期化:
    1. `fetchRoom(roomId)` → `RoomPublic`
    2. `room.protected === false` → 既存パスのまま `kind: 'ready'` (`buildImageUrl` 直接)
    3. `room.protected === true` → sessionStorage の token 検査
       - token 有 → `fetchProtectedImage(room, token)` → 200 → blob → `URL.createObjectURL` → `kind: 'ready'`
       - token 有 + 401 → `clearRoomToken(roomId)` → `kind: 'protected', token: null`
       - token なし → `kind: 'protected', token: null`
  - `kind: 'protected', token: null` のとき `<RoomGate roomId={roomId} onAuthenticated={(t) => { setToken(t); /* re-fetch */ }} />` を表示
  - `useYjsAnnotationsStore(roomId, { token })` のように token を Store factory に渡す（Task 26）
  - `URL.createObjectURL` を作った場合はクリーンアップ で `URL.revokeObjectURL(url)` を return cleanup
- **MIRROR**: 既存 `imageState` 機械、`useEffect` cleanup パターン
- **IMPORTS**: `getRoomToken, setRoomToken, clearRoomToken`, `RoomGate`, `fetchProtectedImage`
- **GOTCHA**:
  - **`<KonvaImage>` の使う `useImage` は ObjectURL を直接受けても動く**（Phase 0/3 で確認済）
  - `useEffect` の dependency に token を入れると無限ループに注意。token は state、変わったら fetch やり直し
- **VALIDATE**: RoomEditor.test.tsx を新設（既存無し）。3 件「未保護 → 即 ready」「保護 + token なし → RoomGate」「保護 + 認証成功 → 画像 fetch + ready」

### Task 26: `apps/web/src/hooks/useYjsAnnotationsStore.ts` に token 注入経路

- **ACTION**: `wsUrl` 構築時に token を query に載せる
- **IMPLEMENT**:
  - hook signature `useYjsAnnotationsStore(roomId, options?: { token?: string | null })` に拡張
  - 内部で `wsUrlFor(roomId, options?.token ?? undefined)` を使用
  - token が変わったら provider を再構築（既存の roomId 変更時の再構築ロジックに乗せる: dependency 配列に token 追加）
- **MIRROR**: 既存 `useYjsAnnotationsStore` の dependency / cleanup
- **IMPORTS**: `wsUrlFor` 拡張版
- **GOTCHA**:
  - token なしで未保護ルームに繋ぐ既存パスは無変更（query なしの URL）
  - 認証成功で token が変わった瞬間、WebSocket は **dispose → 再接続**。Yjs 内部 state はサーバから sync されるので体感的なロスは無し
- **VALIDATE**: useYjsAnnotationsStore.test.ts に 2 件追加「token 渡したら wsUrl が ?token= 付き」「token undefined → 既存パスと同じ URL」

### Task 27: `apps/web/src/hooks/useImageSource.ts` を password 引数対応

- **ACTION**: `loadFromFile(file, password?)` に拡張、`createRoom(file, password)` に転送
- **IMPLEMENT**:
  - hook 戻り値の `loadFromFile` 関数 sig 変更
  - 内部で `createRoom(file, password)` を呼ぶ。password 省略時は `undefined`
- **MIRROR**: 既存の onRoomCreated コールバックパターン
- **IMPORTS**: 既存 `createRoom`（拡張版）
- **GOTCHA**: `LocalEditor` 側で password 入力 UI を作るが、空文字列を渡すと API 側が「パスワード設定」と誤解しないよう、空文字列は `undefined` に正規化
- **VALIDATE**: useImageSource.test.ts に 1 件追加「password 渡したら createRoom 引数に流れる」

### Task 28: `apps/web/src/pages/LocalEditor.tsx` に password チェックボックス + input

- **ACTION**: アップロード前にパスワード設定 UI
- **IMPLEMENT**:
  - 既存 EditorShell の上 or 下に小さな checkbox「□ パスワードで保護」を表示
  - チェック ON で password input が表示される（password 状態は LocalEditor の useState）
  - `handleLoadFile(file)` で `loadFromFile(file, isProtected ? password : undefined)`
  - 画像ロード前のみ表示（`source` が null のとき）
- **MIRROR**: 既存 EditorShell の `imageError` 表示エリア / 既存 toolbar 配色
- **IMPORTS**: 既存 useImageSource、`useState`
- **GOTCHA**:
  - **「最小限を最小限に」**（design-quality.md）に従い、デフォルト OFF + チェックで input が現れる遅延展開。ヘッダーのチェックボックスにアイコン (lock) を添えると親しみやすい
  - 空 password で送信させない validation（チェック ON かつ password 空 → ボタン disabled）
- **VALIDATE**: 既存 e2e smoke が通る + 新規 component test 1 件「checkbox ON → input 表示」「checkbox OFF → password 空でも作成可」

### Task 29: `.gitignore` に `.dev.vars` 確認 + `.dev.vars.example` + ドキュメント追記

- **ACTION**: secret の漏洩予防 + 開発者向け手順
- **IMPLEMENT**:
  - `.gitignore` に `.dev.vars` がなければ追加（`apps/api/.gitignore` または repo root）
  - `apps/api/.dev.vars.example` (commit OK) を新規作成: `ROOM_TOKEN_SECRET="change-me-32-bytes-or-more-random-string"`
  - README に「Local development」セクションで secret 設定手順を追記
- **MIRROR**: 既存 README の Phase 2 セクション
- **IMPORTS**: なし
- **GOTCHA**: 既に `.dev.vars` が gitignore されているか必ず `git check-ignore .dev.vars` で確認
- **VALIDATE**: `git status` で `.dev.vars` が untracked にも staged にもならないこと

### Task 30: 全 validation 走らせて green を確認

- **ACTION**: PR 直前最終確認
- **IMPLEMENT**:
  - `pnpm install` (新依存無し想定。`hono/jwt` は hono 同梱)
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test` (api 新規 ~25 件 / web 新規 ~10 件 / shared 新規 5 件 = 計 ~40 件追加で 200 件規模)
  - `pnpm build` (vite + wrangler dry-run、`SnapShareYDO` 検出ログ確認)
  - `pnpm test:e2e` (chromium、既存 5 件 + 新規 1 件 skipped または passing)
  - 手動 smoke:
    - `pnpm dev` → ブラウザで未保護ルーム作成 → 別タブで `/r/{id}` 開いて同期動作確認（Phase 4 の regression check）
    - 保護ルーム作成（password=`test1234`）→ 別タブで開く → RoomGate 表示 → 正答で入室 → Awareness 動作確認
    - 別タブで誤パスワード → 「パスワードが違います」表示
    - `wrangler dev` のログで `alarm fired, cleaning up` を見るには `ROOM_TTL_MS=10000`（10 秒）に一時変更して 10s 待ち、`GET /rooms/:id` が 404 化することを確認
- **VALIDATE**: 全 green、PRD Success Signal「パスワード付きルームに正答以外で入れない」「7 日経過後アクセスでルーム消滅確認」を満たす

### Task 31: PRD ステータス更新 + report 雛形

- **ACTION**: PRD の Phase 4 を `complete`、Phase 5 を `pending` → `in-progress` (実装完了時 `complete`)、report ファイルを作成
- **IMPLEMENT**:
  - `.claude/PRPs/prds/snap-share.prd.md` の Phase 5 行に PRP plan link を追加
  - Phase 4 のステータスを `in-progress` → `complete` に更新（report は既に存在）
  - `.claude/PRPs/reports/phase-5-password-protection-ttl-report.md` を Task 30 完了後に作成（テンプレートは Phase 4 report を踏襲）
- **MIRROR**: PRD の他 phase 行のフォーマット、Phase 4 report 構造
- **IMPORTS**: なし
- **VALIDATE**: PRD のテーブルが見栄えよく整っていること

---

## Testing Strategy

### Unit Tests (主要)

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `RoomStoredSchema.parse({ id, createdAt, ttlMs, image })` | auth 無し | success | y (auth 任意性) |
| `RoomStoredSchema.parse({ ..., auth: { algo, iterations, salt, hash } })` | auth 有り | success | n |
| `RoomPublicSchema.parse({ ..., protected: true })` | image 抜き | success | y (オーバーロード) |
| `RoomPublicSchema.parse({ ..., protected: false })` | image 抜き | failure | y (image 必須側) |
| `toPublicRoom(stored_with_auth)` | hash 付 stored | `{ ...stored_no_image_no_auth, protected: true }` | y |
| `toPublicRoom(stored_no_auth)` | hash 無 stored | `{ ...stored_no_auth, protected: false }` | y |
| `derivePbkdf2('a', salt, 1000)` | 既知 vector | 既知 hash (deterministic) | n |
| `constantTimeEqual(a, a)` | 同一 | true | y (timing) |
| `constantTimeEqual(a, b)` | 1 byte 違い | false | y (timing) |
| `passwordService.hash('mypw')` | str 1〜256 | RoomAuth shape | y (boundary) |
| `passwordService.hash('')` | 空 | throw 400 INVALID_REQUEST | y |
| `passwordService.verify('mypw', authOf('mypw'))` | 正答 | true | n |
| `passwordService.verify('xx', authOf('mypw'))` | 誤答 | false | n |
| `tokenService.issue('id')` → `verify(token, 'id')` | round-trip | `{ ok: true }` | n |
| `tokenService.verify(token, 'other')` | sub mismatch | `{ ok: false, reason: 'sub_mismatch' }` | y |
| `tokenService.verify(expiredToken, 'id')` | exp 過去 | `{ ok: false, reason: 'expired' }` | y |
| `tokenService.verify('garbage', 'id')` | 改ざん | `{ ok: false, reason: 'invalid' }` | y |
| `POST /rooms` (no password) | multipart image | 201 + RoomPublic { protected:false, image } | n |
| `POST /rooms` (with password) | multipart image+pw | 201 + RoomPublic { protected:true, image:undefined } | n |
| `POST /rooms` (pw='') | multipart image+empty pw | 201 + protected:false | y (空文字 = 未設定) |
| `POST /rooms/:id/auth` (correct pw) | json {password} | 200 + {token} | n |
| `POST /rooms/:id/auth` (wrong pw) | json {password} | 401 envelope UNAUTHORIZED | n |
| `POST /rooms/:id/auth` (room without auth) | json {password} | 400 INVALID_REQUEST | y |
| `POST /rooms/:id/auth` (missing password) | empty body | 400 INVALID_REQUEST | y |
| `POST /rooms/:id/auth` (404 room) | unknown id | 404 envelope | y |
| `GET /rooms/:id/image` (unprotected) | no header | 200 stream | n |
| `GET /rooms/:id/image` (protected, no token) | no header | 401 envelope | y |
| `GET /rooms/:id/image` (protected, valid token) | Bearer | 200 stream | n |
| `GET /rooms/:id/image` (protected, wrong token) | Bearer | 401 envelope | y |
| `GET /sync/:id` (unprotected, no token) | no query | passthrough (not 404, not 401) | n |
| `GET /sync/:id` (protected, no token) | no query | 401 envelope | y |
| `GET /sync/:id` (protected, valid token) | ?token= | passthrough | n |
| `GET /sync/:id` (protected, wrong token) | ?token= | 401 envelope | y |
| `auth-storage.set/get/clear` | sessionStorage | round-trip | y (full storage) |
| `wsUrlFor(roomId, token)` | token 有 | URL に `?token=` | n |
| `wsUrlFor(roomId)` | token なし | URL に `?token=` 無 | n |
| `RoomGate` Render | 初期 | 鍵アイコン + input + button | n |
| `RoomGate` submit (correct) | password='ok' | onAuthenticated(token) コール | n |
| `RoomGate` submit (wrong) | 401 | エラー「パスワードが違います」 | y |
| `RoomGate` submit (network err) | catch | エラー「ネットワークエラー」 | y |
| `RoomEditor` (unprotected) | mock fetchRoom unprotected | `<EditorShell>` 直接 | n |
| `RoomEditor` (protected, no token) | mock fetchRoom protected | `<RoomGate>` | y |
| `RoomEditor` (protected, valid token) | sessionStorage に token | fetchProtectedImage 経由で `<EditorShell>` | n |
| `LocalEditor` checkbox | チェック | password input 表示 | y |

### Edge Cases Checklist

- [x] 空 password （空文字 = 未設定）: 既存未保護パスへフォールバック
- [x] 256 文字超 password: 400 INVALID_REQUEST
- [x] 既存（Phase 4 時代）の auth 無しルーム: そのまま未保護として読み取れる
- [x] sessionStorage に古い (異なる secret 生成の) token が残っている: API 側 401 → クライアントが clear → RoomGate 再表示
- [x] WebSocket query token URL のログ: middleware で token 文字列はログに含めない (`tokenPresent` のみ)
- [x] DO Alarm が複数回発火 (idempotent): R2 image / meta は missing でも success、`storage.deleteAll` も冪等
- [x] alarm が `createdAt + ttlMs` 過去日付で setAlarm された場合: Cloudflare ランタイムが即座に発火するので問題なし
- [x] alarm 発火後に対応 R2 image が既に他ルートで消えている: `deleteImage` が non-fatal warn を出して continue
- [x] `wrangler dev` 環境で alarm 発火: ローカル時刻ベースで動く
- [x] 認証中の WS は token 失効でどうなるか: WS は確立後は token を再検証しない（既存接続維持）。次回再接続時に 401。Phase 5 はこのスコープで割り切り
- [x] 同じルームを別ブラウザで開く: それぞれ独立した sessionStorage、それぞれ認証必要

---

## Validation Commands

### Static Analysis

```bash
pnpm turbo run typecheck
```
EXPECT: 4 workspaces 全て 0 type errors。`SnapShareYDO`、`RoomStored`、`RoomPublic` の型整合確認

### Unit + Integration Tests

```bash
pnpm turbo run test
```
EXPECT: api ~70 件 (既存 41 + 新規 ~25) / web ~135 件 (既存 125 + 新規 ~10) / shared ~14 件 (既存 9 + 新規 5) 全 pass

### Lint

```bash
pnpm lint
```
EXPECT: biome 0 errors（既存 1 warning は許容範囲）

### Build (incl. wrangler dry-run)

```bash
pnpm build
```
EXPECT:
- `vite build`: web bundle 成功
- `wrangler deploy --dry-run` 相当: `env.Y_ROOM (SnapShareYDO)` がログに出る、migration v2 が advertise される

### Browser / Manual Validation

```bash
pnpm dev
```
EXPECT:
- 未保護ルーム作成 → Phase 4 と同等動作
- 保護ルーム作成（password=`test`）→ 別タブで `/r/{id}` 開く → RoomGate 表示 → 正答で入室 → 同期動作
- 誤パスワードで「パスワードが違います」表示
- `apps/api/.dev.vars` の `ROOM_TTL_MS=10000` (一時) → 11 秒後 `GET /rooms/:id` が 404 化（戻すこと忘れない）

### E2E (chromium)

```bash
pnpm test:e2e
```
EXPECT: 既存 5 件 pass。新規 1 件 (RoomGate happy path) は skipped マーク許容（CI 統合は Phase 7）

### Manual Validation Checklist

- [ ] `pnpm dev` で未保護ルーム作成 → 同期動作（Phase 4 regression）
- [ ] パスワード保護ルーム作成 → 別タブで RoomGate → 正答 → 同期動作
- [ ] 別タブで誤パスワード → 「パスワードが違います」表示、再入力可能
- [ ] sessionStorage に token があるタブを再ロードしても再認証要求されない
- [ ] sessionStorage を手動 clear → リロードで再 RoomGate
- [ ] `ROOM_TTL_MS=10000` 一時設定 → 10 秒待ち → ルーム 404 + R2 ストアから image / meta 消失
- [ ] `wrangler dev` ログに `alarm fired, cleaning up` が出る
- [ ] 通常時 (`ROOM_TTL_MS=604800000`) で 7 日 alarm が setAlarm されるログ

---

## Acceptance Criteria

- [ ] Task 1〜31 全て完了
- [ ] `pnpm turbo run lint typecheck test build` 全 green
- [ ] PRD Success Signal: 「パスワード付きルームに正答以外で入れない」を unit + 手動 smoke で確認
- [ ] PRD Success Signal: 「7 日経過後アクセスでルーム消滅確認」を `ROOM_TTL_MS=10000` smoke で確認
- [ ] 既存 Phase 4 機能（未保護ルームの同期 / Awareness / Undo/Redo）に regression 無し
- [ ] secret (`ROOM_TOKEN_SECRET`) が `.gitignore` 配下に置かれており commit に紛れ込んでいない
- [ ] PRD ステータス更新 + Phase 5 report 作成

## Completion Checklist

- [ ] パターン faithfulness: AppError / errorEnvelope / Service factory / SSOT Zod / R2 storage interface 全て既存形に準拠
- [ ] エラーハンドリング: AppError + log + 401/400/404/500 で統一
- [ ] ロギング: 平文パスワード / token / hash / salt 一切ログに含まれない
- [ ] テスト: AAA 構造、buildEnv 経由、新規 ~40 件
- [ ] ハードコード値なし（PBKDF2 iterations / SALT_BYTES / TOKEN_TTL_SEC は named const）
- [ ] CLAUDE.md item 追加候補:
  - 「password / token / hash / salt はログに出さない」
  - 「`SnapShareYDO` のサブクラス化と alarm の idempotency」
- [ ] `.dev.vars` を README に文書化、`.dev.vars.example` を commit
- [ ] 単独で実装可能（このプランだけで他検索不要）

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `y-durableobjects@1.0.5` の `onStart` を override すると internal field の初期化順序が壊れる | M | H (DO 起動失敗) | `super.onStart()` を必ず先頭で await。spike を `wrangler dev` で smoke 確認 |
| `wrangler.toml` の `renamed_classes` migration が production の既存 Y_ROOM に対して破壊的 | L | H (production 既存ルーム消失) | Phase 5 はまだ production デプロイ前。dev のみで migration テスト。Phase 7 公開時に再確認 |
| PBKDF2 210k iterations が Worker CPU 30s 制限を超える | L | M (auth エンドポイント timeout) | iterations 値を named const にして dogfood 中に調整可。worst case で 100k に下げる |
| WS query token のログ漏洩（プロキシ等） | M | L (token 短寿命のため影響限定) | `logger` で token 文字列を出さない、`tokenPresent: bool` のみ。Phase 7 で本格的な header-based WS auth (subprotocol / cookie) を検討 |
| `RoomEditor` の状態機械拡張（loading / protected / ready / not-found）が複雑化 | M | M (バグ温床) | discriminated union + 完全分岐 + テストで 4 種全カバー |
| sessionStorage が disabled / quota 超でも token 機能を維持したい | L | L (再認証で済む) | try/catch で吸収、再 RoomGate を許容 |
| Argon2 採用予定だった PRD と実装乖離 | L | L (decision として記録済) | Decisions Log に PBKDF2 採用理由を明記、本 plan を ADR-0003 として保存することも可（後続セッション判断） |

## Notes

### Decisions Log（plan 内意思決定）

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| パスワードハッシュ | **PBKDF2-SHA256 / 210k iterations / Web Crypto** | Argon2 (PRD原案) / scrypt (node:crypto) / bcrypt | Argon2 は WASM 依存で Workers 起動コスト増。scrypt は nodejs_compat だが Workers 上の安定性が PBKDF2 より弱い。PBKDF2 は Web Crypto ネイティブ・依存ゼロ・OWASP 2023 容認 |
| Token 形式 | **HS256 JWT (Hono `hono/jwt`)** | 自前 HMAC + base64url / Stateful session token in DO | hono 同梱・追加依存ゼロ・標準形式。stateful は DO storage にも書く必要があり TTL 管理が二重化する |
| Token 配送 (REST) | **`Authorization: Bearer`** | Cookie / 自前 header | 標準・テスタブル・CSRF 不要 |
| Token 配送 (WS) | **`?token=` query param** | Subprotocol / Cookie | WS は header 不可、subprotocol は browser API で扱いにくい。短寿命 + roomId binding でリスク許容 |
| Token TTL | **24h (固定)** | 1h / 7d | ルーム TTL 7 日と一致させない（漏洩時の影響範囲を限定）。24h なら 1 日 1 回再ログインで運用可能 |
| Brute-force 緩和 | **PBKDF2 自体の 210k iter で実質 rate limit** | IP-based rate limit / Turnstile | Phase 5 スコープでは追加実装せず、Phase 7 (公開準備) で本格対応。PBKDF2 の各 verify が ~200ms かかるので 1 IP / 秒程度に自然制限 |
| Public shape 構造 | **`protected: boolean` flag + 条件付き `image`** | 別エンドポイント (`/rooms/:id/public` vs `/rooms/:id/secure`) | 1 エンドポイントで完結する方が hc 型推論にやさしい。`image` を hide することで未認証クライアントは R2 key を知らない |
| TTL 削除戦略 | **`SnapShareYDO extends YDurableObjects` + `state.storage.setAlarm`** | 別 DO + Cron Trigger / Workers Scheduled Event | Hibernation 中に wake する手段が DO Alarm のみ。Approach A 一択 |
| `RoomSchema` 後方互換 | **`RoomSchema = RoomStoredSchema` で alias** | 既存名称破棄 + breaking | r2-meta-storage や既存テストの import を維持。stored / public の区別は新名で導入 |
| Storage の `deleteMeta` | **`MetaStorage` interface に追加** | DO storage に直書き | repository pattern との整合、テスト容易性 |

### Implementation Notes

- secret はローカル `.dev.vars` で管理（`.gitignore` 確認）。production は `wrangler secret put`
- `apps/api/src/index.ts` の `export { YDurableObjects } from './yjs'` を `SnapShareYDO` に変更する忘れ防止: Task 17 で wrangler.toml と一緒に書き換え
- Phase 6 が並行で進む場合、`RoomGate` のスタイリングは shadcn 適用後に再調整可能（現状は Tailwind v4 + CSS variables 直接で十分）
- Phase 7 の `Cloudflare Turnstile` は本 plan では NOT building。ただし `POST /rooms/:id/auth` の呼び出し回数を計測しておくと Phase 7 で閾値設計しやすい

### Future Work（Phase 5 後の検討項目）

- token を JWT から **Stateless HMAC** にシンプル化する余地（library 依存削除）
- RoomGate を shadcn `Card` + `Form` に置換（Phase 6）
- `auth.algo` の bump（Argon2id 切替時の dual-decode 期間）
- IP-based rate limit + Turnstile（Phase 7）
- TTL 値を Open Question 通り「24h / 7d / 指定」から選ばせる UX（Could スコープ）
