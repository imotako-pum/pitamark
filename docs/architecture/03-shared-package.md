# 03. Shared Package — Zod SSOT

> [← INDEX](./INDEX.md) | 前: [02-monorepo-and-tooling](./02-monorepo-and-tooling.md) | 次: [04-api-anatomy](./04-api-anatomy.md)

`packages/shared` は **web/api 両方が直接 import する Zod 中心の型定義パッケージ**。`workspace:*` で参照されるが build step は持たず、TypeScript が `src/index.ts` を直接読む構造。

## ファイル一覧

```
packages/shared/src/
├── index.ts        # re-export only (annotation / presence / room)
├── annotation.ts   # Annotation discriminated union (4 種) + 定数
├── room.ts         # Room schemas (Stored / Public / Created) + 認証 + TTL 定数
├── presence.ts     # UserPresence (cursor / selectedId / displayName / color)
└── __tests__/      # 各 schema の parse/refine テスト
```

`index.ts` は単純な barrel re-export のみ。

```typescript
export * from './annotation';
export * from './presence';
export * from './room';
```

## Annotation Discriminated Union

[packages/shared/src/annotation.ts](../../packages/shared/src/annotation.ts)。注釈の型は **`type` で判別する 4 種の discriminated union**。

```typescript
export const AnnotationSchema = z.discriminatedUnion('type', [
  RectangleAnnotationSchema,
  ArrowAnnotationSchema,
  TextAnnotationSchema,
  HighlightAnnotationSchema,
]);
export type Annotation = z.infer<typeof AnnotationSchema>;
```

| Schema | 専用フィールド | 共通フィールド |
|---|---|---|
| `RectangleAnnotationSchema` | `x` / `y` / `width` / `height` / `strokeWidth` | `id` / `createdAt` / `type` / `color` |
| `ArrowAnnotationSchema` | `from` / `to` (`PointSchema`) / `strokeWidth` | 同上 |
| `TextAnnotationSchema` | `x` / `y` / `text` / `fontSize` | 同上 |
| `HighlightAnnotationSchema` | `x` / `y` / `width` / `height` | 同上 |

すべての schema は `.readonly()` 付き。`color` は `#RRGGBB` 形式 (regex 検証)。

### 上限定数

```typescript
export const MAX_ANNOTATIONS_PER_ROOM = 200;
export const MAX_TEXT_LENGTH = 500;
export const MAX_FONT_SIZE = 200;
export const MAX_STROKE_WIDTH = 20;
```

これらは web/api 双方で参照される。例えば web 側の `historyReducer` が `MAX_ANNOTATIONS_PER_ROOM` を見て add 拒否、api 側の `room-service` が同じ値を見て 422 を返す。

### 新しい annotation 種類を追加するときの手順

1. `annotation.ts` に新 `*AnnotationSchema` を追加し `AnnotationSchema` の `discriminatedUnion` に並べる。
2. `ANNOTATION_TYPES` タプルに type 名を追加。
3. web 側 `domain/annotation/operations.ts` の switch に分岐を追加 (TS の網羅性チェックでビルドエラーが出るので機械的)。
4. web 側 `components/canvas/AnnotationLayer.tsx` の dispatch と `shapes/` に対応 React コンポーネントを追加。
5. web 側 `components/toolbar/Toolbar.tsx` の `TOOL_DEFS` に項目追加。
6. `domain/annotation/yjs-codec.ts` の Y.Map ↔ Annotation 変換に case を追加。

## Room Schemas

[packages/shared/src/room.ts](../../packages/shared/src/room.ts)。**用途別に 4 つの Room schema** がある。

| Schema | 用途 | image | auth / token |
|---|---|---|---|
| `RoomStoredSchema` | サーバ側 R2 メタ JSON 形状 | あり (R2 key 含む) | `auth` optional (PBKDF2 hash) |
| `RoomPublicSchema` | `GET /rooms/:id` のレスポンス | protected 時は隠す | なし |
| `RoomCreatedSchema` | `POST /rooms` のレスポンス (uploader 専用) | 同上 | `token` optional (protected のみ) |
| `RoomImageSchema` | 画像メタ (key / contentType / size / sha256) | — | — |
| `RoomAuthSchema` | パスワード認証メタ (algo / iterations / salt / hash) | — | — |

`RoomPublicSchema` と `RoomCreatedSchema` は **`refine` で「protected → image なし / public → image あり」を強制** する。これにより protected room の画像 R2 key が unauthenticated client に漏れない。

```typescript
export const RoomCreatedSchema = roomPublicShape
  .extend({ token: z.string().min(1).optional() })
  .readonly()
  .refine(
    (r) => r.protected ? r.image === undefined : r.image !== undefined,
    { message: 'image must be present iff protected is false' },
  );
```

### `toPublicRoom` ヘルパー

サーバ側で `RoomStored → RoomPublic` の変換を一発で行う。auth 有無で `image` を含むかを切り替える。

```typescript
export const toPublicRoom = (stored: RoomStored): RoomPublic => {
  if (stored.auth) return { id, createdAt, ttlMs, protected: true };
  return { id, createdAt, ttlMs, protected: false, image };
};
```

### 認証関連 schema

| Schema | エンドポイント | 形 |
|---|---|---|
| `AuthResponseSchema` | `POST /rooms/:id/auth` | `{ token: string }` (HS256 24h JWT) |
| `WsTicketResponseSchema` | `POST /rooms/:id/ws-ticket` | `{ ticket: string }` (32 hex 文字) |

両方とも Phase 8.x の SSOT review で「web 側 `as { token: string }` で素通ししていた」のを潰すために shared に集約された。同じ regex (`/^[0-9a-f]{32}$/`) が generate / receive / consume の 3 箇所に散らばっていたものをここに統合している。

## TTL / Image / Room ID 定数

```typescript
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;     // 10 MB
export const DEFAULT_ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const ROOM_ID_LENGTH = 21;
export const ROOM_ID_REGEX = /^[A-Za-z0-9_-]{21}$/;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;
```

`ROOM_ID_REGEX` は **path traversal 対策で `apps/api/src/yjs.ts` の `syncRoute` middleware でも入口検証**に使われる。web 側 `lib/url-room.ts` も同じ regex で URL から roomId を抽出する (両者完全に同じソース)。

`isExpired(room, now)` は `now > createdAt + ttlMs` を返すヘルパー。境界 (`>`) は「`createdAt + ttlMs` のちょうど瞬間は valid」という意味で意図的。

## Presence Schema

[packages/shared/src/presence.ts](../../packages/shared/src/presence.ts):

```typescript
export const UserPresenceSchema = z.object({
  userId: z.string().min(1).max(MAX_USER_ID_LENGTH),
  displayName: z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH),
  color: z.string().regex(PRESENCE_COLOR_REGEX),
  cursor: PointSchema.nullable(),
  selectedId: z.string().nullable(),
}).readonly();
```

これは Yjs awareness state の形状。RoomEditor の `usePresence` hook が remote peers の cursor / selection をこの schema で `safeParse` してから描画する。

## 「shared にあるべきもの」の判断基準

入れる:
- web/api 両方が `import` する型 / 定数 / regex
- API リクエスト・レスポンスの schema (両側で `safeParse` できるように)
- annotation / presence / room など **データモデル** そのもの

入れない:
- Cloudflare Workers / Konva / Yjs などプラットフォーム依存型
- 関数実装本体 (Pure な変換関数なら OK だが、副作用ありは NG)
- web/api のうち片方しか触らないもの

判断に迷ったら **「フィールド名や regex が複数箇所で重複し始めたら shared に上げる」** が経験則 (Phase 8.x SSOT review がこのルールで作られた)。

## 次に読むファイル

- API 側で shared をどう使うか → [04-api-anatomy](./04-api-anatomy.md)
- web 側で shared をどう使うか → [05-web-anatomy](./05-web-anatomy.md)
