import { z } from 'zod';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// TTL の default は 24h、最大 7d。将来 freemium で無制限化する余地を残す形にしてある。
// server (`apps/api`) 側 default は `wrangler.toml` の ROOM_TTL_MS env var で供給し、
// client は `POST /rooms` の ttlMs で room ごとに override できる (上限 MAX_ROOM_TTL_MS)。
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

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const RoomImageSchema = z
  .object({
    key: z.string().min(1),
    contentType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
    size: z.number().int().positive().max(MAX_IMAGE_BYTES),
    // 原 bytes の lowercase hex SHA-256。field 導入前に作成された古い R2 metadata
    // でも parse が通るよう optional にしてある。
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .readonly();

export type RoomImage = z.infer<typeof RoomImageSchema>;

// server 側で room metadata として保存される shape。`salt` / `hash` は base64url
// string にしてあるので、bytes vs string の曖昧さなく JSON を round-trip できる。
export const RoomAuthSchema = z
  .object({
    algo: z.literal('PBKDF2-SHA256'),
    iterations: z.number().int().positive(),
    salt: z.string().min(1),
    hash: z.string().min(1),
  })
  .readonly();

export type RoomAuth = z.infer<typeof RoomAuthSchema>;

// `r2-meta-storage` が書き込み / 読み出しする server 側 shape。`auth` は optional で、
// 欠落しているときは「unprotected room」と解釈する。
export const RoomStoredSchema = z
  .object({
    id: z.string().regex(ROOM_ID_REGEX),
    createdAt: z.number().int().nonnegative(),
    ttlMs: z.number().int().positive(),
    image: RoomImageSchema,
    auth: RoomAuthSchema.optional(),
  })
  .readonly();

export type RoomStored = z.infer<typeof RoomStoredSchema>;

// backwards-compatible な alias。既存の `RoomSchema` / `Room` import を壊さない。
// stored vs public の区別を導入する以前の caller は stored shape (auth optional)
// を受け取るが、これは public shape の strict superset なので互換性が保たれる。
export const RoomSchema = RoomStoredSchema;
export type Room = RoomStored;

// public (API response) shape。protected room では `image` を hide することで、
// 未認証 client が R2 object key を逆算できないようにする。`protected: false` は
// 必ず image を持ち、`protected: true` は必ず省略する (refine で enforce)。
const roomPublicShape = z.object({
  id: z.string().regex(ROOM_ID_REGEX),
  createdAt: z.number().int().nonnegative(),
  ttlMs: z.number().int().positive(),
  protected: z.boolean(),
  image: RoomImageSchema.optional(),
});

const protectedImageRefine = {
  check: (r: { protected: boolean; image?: unknown }) =>
    r.protected ? r.image === undefined : r.image !== undefined,
  message: 'image must be present iff protected is false',
} as const;

export const RoomPublicSchema = roomPublicShape
  .readonly()
  .refine(protectedImageRefine.check, { message: protectedImageRefine.message });

export type RoomPublic = z.infer<typeof RoomPublicSchema>;

// POST /rooms 専用の response。protected room を作成した uploader に直後の gate
// 再表示が出ないよう、server 発行 access token を同梱する。GET /rooms/:id は token
// を返さないので `RoomPublicSchema` とは別 schema にする (token 漏洩を schema 層で
// 遮断する)。token は protected room のときだけ存在する。
export const RoomCreatedSchema = roomPublicShape
  .extend({
    token: z.string().min(1).optional(),
  })
  .readonly()
  .refine(protectedImageRefine.check, { message: protectedImageRefine.message });

export type RoomCreated = z.infer<typeof RoomCreatedSchema>;

// POST /rooms/:id/auth の response。元々 api workspace の routes/rooms.ts に inline
// 定義していたが、web 受信側は schema を import できず `as { token: string }` で
// 素通しになっていた。`packages/shared` に集約することで両 workspace が safeParse
// 経由で runtime 検証できる構造に揃える。
export const AuthResponseSchema = z
  .object({
    token: z.string().min(1),
  })
  .readonly();

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// POST /rooms/:id/ws-ticket の response。`AuthResponseSchema` と同じパターンで shared
// に集約する。32 hex 文字の制約は元々 `ws-ticket-service.ts` (生成側) / ここ (受信側) /
// `yjs.ts` の `isValidTicketShape` (consume 側) の 3 箇所で同 regex を持っていたが、
// この 1 箇所に統合する。
export const WsTicketResponseSchema = z
  .object({
    ticket: z.string().regex(/^[0-9a-f]{32}$/),
  })
  .readonly();

export type WsTicketResponse = z.infer<typeof WsTicketResponseSchema>;

export const toPublicRoom = (stored: RoomStored): RoomPublic => {
  const { id, createdAt, ttlMs, image, auth } = stored;
  if (auth) {
    return { id, createdAt, ttlMs, protected: true };
  }
  return { id, createdAt, ttlMs, protected: false, image };
};

// `now` が TTL 境界を越えたら true を返す。`>=` ではなく `>` にしてあるので、
// `createdAt + ttlMs` 時点ではまだ valid 扱い。
export const isExpired = (room: RoomStored, now: number): boolean =>
  now > room.createdAt + room.ttlMs;
