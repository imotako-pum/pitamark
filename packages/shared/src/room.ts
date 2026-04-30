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

export const RoomSchema = z
  .object({
    id: z.string().regex(ROOM_ID_REGEX),
    createdAt: z.number().int().nonnegative(),
    ttlMs: z.number().int().positive(),
    image: RoomImageSchema,
  })
  .readonly();

export type Room = z.infer<typeof RoomSchema>;

// Returns true once `now` has crossed the TTL boundary.
// `>` (not `>=`) means a room is still valid at the exact instant of `createdAt + ttlMs`.
export const isExpired = (room: Room, now: number): boolean => now > room.createdAt + room.ttlMs;
