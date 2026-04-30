import type { Bindings } from '../../lib/bindings';
import { createInMemoryR2 } from './in-memory-r2';

export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const buildEnv = (overrides: Partial<Bindings> = {}): Bindings => ({
  IMAGES: createInMemoryR2(),
  ROOM_TTL_MS: String(DEFAULT_TTL_MS),
  ...overrides,
});
