import { z } from 'zod';
import { PointSchema } from './annotation';

export const PRESENCE_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
export const MAX_DISPLAY_NAME_LENGTH = 32;
export const MAX_USER_ID_LENGTH = 64;

export const UserPresenceSchema = z
  .object({
    userId: z.string().min(1).max(MAX_USER_ID_LENGTH),
    displayName: z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH),
    color: z.string().regex(PRESENCE_COLOR_REGEX),
    cursor: PointSchema.nullable(),
    selectedId: z.string().nullable(),
  })
  .readonly();

export type UserPresence = z.infer<typeof UserPresenceSchema>;
