import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ROOM_ID_REGEX } from '@snap-share/shared';
import type { Bindings } from '../lib/bindings';
import { AppError, ErrorResponseSchema, errorEnvelope } from '../lib/error';
import { logger } from '../lib/logger';
import { extractBearerToken } from '../lib/token';
import { createTokenService } from '../services/token-service';
import { createR2ImageStorage } from '../storage/r2-image-storage';
import { createR2MetaStorage } from '../storage/r2-meta-storage';

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
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Missing or invalid bearer token for protected room',
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

    // Authorization gate: only protected rooms require a token. Unprotected
    // rooms keep their original public behavior so existing share flows stay
    // unchanged.
    if (meta.auth) {
      const token = extractBearerToken(c.req.header('authorization'));
      if (!token) {
        logger.warn('image fetch denied: missing token', { id, tokenPresent: false });
        throw new AppError(401, 'UNAUTHORIZED', 'Token required', { id });
      }
      const tokenSvc = createTokenService({ secret: c.env.ROOM_TOKEN_SECRET });
      const result = await tokenSvc.verify(token, id);
      if (!result.ok) {
        logger.warn('image fetch denied: invalid token', {
          id,
          reason: result.reason,
          tokenPresent: true,
        });
        throw new AppError(401, 'UNAUTHORIZED', 'Invalid token', { id });
      }
    }

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
    // Protected rooms must not leak via browser/CDN cache. Phase 2 stored
    // `Cache-Control: public, max-age=3600` on the R2 object for unprotected
    // rooms; override here so a Bearer-authenticated response is never
    // re-served from a shared cache to an unauthenticated client.
    if (meta.auth) {
      headers.set('cache-control', 'private, no-store');
    }
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
