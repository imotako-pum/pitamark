import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ROOM_ID_REGEX } from '@snap-share/shared';
import type { Bindings } from '../lib/bindings';
import { AppError, errorEnvelope } from '../lib/error';
import { logger } from '../lib/logger';
import { createR2ImageStorage } from '../storage/r2-image-storage';
import { createR2MetaStorage } from '../storage/r2-meta-storage';

const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum([
      'INVALID_REQUEST',
      'UNSUPPORTED_MEDIA_TYPE',
      'PAYLOAD_TOO_LARGE',
      'NOT_FOUND',
      'INTERNAL',
    ]),
    message: z.string(),
  }),
});

const idParamSchema = z.object({
  id: z.string().regex(ROOM_ID_REGEX),
});

const getImageRoute = createRoute({
  method: 'get',
  path: '/{id}/image',
  tags: ['images'],
  request: { params: idParamSchema },
  // 200 deliberately omits `content` so the handler can return a raw Response
  // carrying the R2 binary stream + custom cache/disposition headers.
  responses: {
    200: { description: 'Image binary (image/png, image/jpeg, image/webp, image/svg+xml)' },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid room ID',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Room or image not found',
    },
  },
});

// Chain `.openapi()` so the export retains the merged route schema for `hc`.
export const imagesRoute = new OpenAPIHono<{ Bindings: Bindings }>().openapi(
  getImageRoute,
  async (c) => {
    const { id } = c.req.valid('param');
    const meta = await createR2MetaStorage(c.env.IMAGES).getMeta(id);
    if (!meta) throw new AppError(404, 'NOT_FOUND', 'Room not found', { id });

    const obj = await createR2ImageStorage(c.env.IMAGES).getImage(meta.image.key);
    if (!obj) {
      // Meta exists but image is gone — orphan state, separate from a plain "no such room" miss.
      logger.warn('image object missing for existing meta', { id, key: meta.image.key });
      throw new AppError(404, 'NOT_FOUND', 'Image not found', { id, key: meta.image.key });
    }

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    // Prevent MIME sniffing: browsers must honor the Content-Type set by R2.
    headers.set('x-content-type-options', 'nosniff');
    // SVG can carry inline scripts that execute when opened directly in a browser tab.
    // Force download to neutralise the XSS vector while still allowing <img src=...> rendering.
    if (meta.image.contentType === 'image/svg+xml') {
      headers.set('content-disposition', `attachment; filename="image.svg"`);
    }
    return new Response(obj.body, { status: 200, headers });
  },
  (result, c) => {
    if (!result.success) {
      return c.json(errorEnvelope('INVALID_REQUEST', 'Invalid room ID'), 400);
    }
    return undefined;
  },
);
