import { zValidator } from '@hono/zod-validator';
import { ROOM_ID_REGEX } from '@snap-share/shared';
import { Hono } from 'hono';
import * as z from 'zod';
import type { Bindings } from '../lib/bindings';
import { AppError, errorEnvelope } from '../lib/error';
import { logger } from '../lib/logger';
import { createR2ImageStorage } from '../storage/r2-image-storage';
import { createR2MetaStorage } from '../storage/r2-meta-storage';

const idParamSchema = z.object({ id: z.string().regex(ROOM_ID_REGEX) });

export const imagesRoute = new Hono<{ Bindings: Bindings }>();

imagesRoute.get(
  '/:id/image',
  zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) {
      return c.json(errorEnvelope('INVALID_REQUEST', 'Invalid room ID'), 400);
    }
    return undefined;
  }),
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
);
