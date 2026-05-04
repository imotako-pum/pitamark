import { z } from 'zod';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// Phase 10.B: TTL 仕様変更。default 24h / max 7d。フリーミアムで無制限化する伏線。
// Server (`apps/api`) defaults via `wrangler.toml` ROOM_TTL_MS env var; clients
// can override per-room via `POST /rooms` ttlMs (capped at MAX_ROOM_TTL_MS).
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
    // Phase 7: lowercase hex SHA-256 of the original bytes. Optional so older
    // R2 metadata (created in Phase 5/6 before the field existed) still parses.
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .readonly();

export type RoomImage = z.infer<typeof RoomImageSchema>;

// Stored on server as room metadata. `salt`/`hash` are base64url strings so the
// whole envelope round-trips through JSON without bytes-vs-string ambiguity.
export const RoomAuthSchema = z
  .object({
    algo: z.literal('PBKDF2-SHA256'),
    iterations: z.number().int().positive(),
    salt: z.string().min(1),
    hash: z.string().min(1),
  })
  .readonly();

export type RoomAuth = z.infer<typeof RoomAuthSchema>;

// Server-side shape — what `r2-meta-storage` writes/reads. `auth` optional so
// a room is "unprotected" when the field is absent.
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

// Backwards-compatible alias: existing imports of `RoomSchema` / `Room` keep
// working. Phase 5 introduces stored vs public distinction; older callers
// receive the stored shape (auth optional) which is a strict superset.
export const RoomSchema = RoomStoredSchema;
export type Room = RoomStored;

// Public (API response) shape. Protected rooms hide `image` so unauthenticated
// clients cannot derive the R2 object key. `protected: false` always carries
// the image; `protected: true` always omits it.
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

// POST /rooms 専用のレスポンス。protected room を作成した uploader が、
// 直後にゲートを再表示されないよう server で発行した access token を含める。
// GET /rooms/:id では token を返さないため `RoomPublicSchema` とは分離している
// (token 漏洩を schema レベルで遮断)。token は protected の場合のみ存在。
export const RoomCreatedSchema = roomPublicShape
  .extend({
    token: z.string().min(1).optional(),
  })
  .readonly()
  .refine(protectedImageRefine.check, { message: protectedImageRefine.message });

export type RoomCreated = z.infer<typeof RoomCreatedSchema>;

// POST /rooms/:id/auth レスポンス。Phase 8.x SSOT review #1 M1: 元々 api
// workspace 内の routes/rooms.ts に inline 定義されていたが、web 受信側は
// schema を import できず `as { token: string }` で素通ししていた。同じ
// 「API レスポンス schema」を packages/shared で一本化することで、両 workspace が
// safeParse 経由で runtime 検証できる構造に揃える。
export const AuthResponseSchema = z
  .object({
    token: z.string().min(1),
  })
  .readonly();

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// POST /rooms/:id/ws-ticket レスポンス。Phase 8.x PR #15 self-review M1:
// `AuthResponseSchema` と同じ pattern で shared に集約。32 hex 文字の制約は
// `ws-ticket-service.ts` で生成側、ここで受信側、`yjs.ts` の
// `isValidTicketShape` で consume 側、と 3 箇所で同じ regex を持っていた
// ものをこの 1 箇所に統合する。
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

// Returns true once `now` has crossed the TTL boundary.
// `>` (not `>=`) means a room is still valid at the exact instant of `createdAt + ttlMs`.
export const isExpired = (room: RoomStored, now: number): boolean =>
  now > room.createdAt + room.ttlMs;
