// 複数 route file で再利用する Zod schema を集約する。以前は `idParamSchema` が
// `routes/rooms.ts` と `routes/images.ts` に逐次 duplicate されていて、`packages/shared`
// の `ROOM_ID_REGEX` 強化が片方にだけ着地して見落とす穴があった。route 境界でも
// regex を SSOT に保つため、ここに集約する。

import { z } from '@hono/zod-openapi';
import { ROOM_ID_REGEX } from '@pitamark/shared';

/** `/rooms/:id*` 系 route が共通で使う `{ id: string }` URL param。 */
export const idParamSchema = z.object({
  id: z.string().regex(ROOM_ID_REGEX),
});
