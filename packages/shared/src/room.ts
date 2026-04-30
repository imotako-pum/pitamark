import { z } from 'zod';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const RoomSchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.number().int().nonnegative(),
    ttlMs: z.number().int().positive(),
  })
  .readonly();

export type Room = z.infer<typeof RoomSchema>;

export const isExpired = (room: Room, now: number): boolean => now > room.createdAt + room.ttlMs;
