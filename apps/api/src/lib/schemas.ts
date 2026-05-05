// Shared Zod schemas reused across multiple route files. Phase 8.x Hono
// review #4 L1: prior to this module, `idParamSchema` was duplicated
// verbatim in `routes/rooms.ts` and `routes/images.ts`, so a tightening
// of `ROOM_ID_REGEX` in `packages/shared` could land in one file and miss
// the other. Co-locating the param schema here keeps the regex one source
// of truth at the route boundary too.

import { z } from '@hono/zod-openapi';
import { ROOM_ID_REGEX } from '@pitamark/shared';

/** `{ id: string }` URL param shared by every `/rooms/:id*` route. */
export const idParamSchema = z.object({
  id: z.string().regex(ROOM_ID_REGEX),
});
