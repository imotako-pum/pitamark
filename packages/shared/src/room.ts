import { z } from 'zod';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
export const RoomPublicSchema = z
  .object({
    id: z.string().regex(ROOM_ID_REGEX),
    createdAt: z.number().int().nonnegative(),
    ttlMs: z.number().int().positive(),
    protected: z.boolean(),
    image: RoomImageSchema.optional(),
  })
  .readonly()
  .refine((r) => (r.protected ? r.image === undefined : r.image !== undefined), {
    message: 'image must be present iff protected is false',
  });

export type RoomPublic = z.infer<typeof RoomPublicSchema>;

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
