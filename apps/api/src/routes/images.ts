import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { Bindings } from '../lib/bindings';
import { AppError, ErrorResponseSchema, errorEnvelope } from '../lib/error';
import { logger } from '../lib/logger';
import { idParamSchema } from '../lib/schemas';
import { extractBearerToken } from '../lib/token';
import { createTokenService } from '../services/token-service';
import { createR2ImageStorage } from '../storage/r2-image-storage';
import { createR2MetaStorage } from '../storage/r2-meta-storage';

const getImageRoute = createRoute({
  method: 'get',
  path: '/{id}/image',
  tags: ['images'],
  request: {
    params: idParamSchema,
    // optional な Bearer header をここで宣言することで、`hc<AppType>` client が
    // typed `header` field 経由で渡せる (宣言しないと web の `fetchProtectedImage`
    // は raw fetch に fallback せざるを得ない)。server 側 handler は引き続き
    // `c.req.header('authorization')` で読むので、ここは純粋な typing 用 hook。
    headers: z.object({
      authorization: z.string().optional().openapi({
        description: 'protected room には `Bearer <jwt>` を渡す。public room では省略。',
      }),
    }),
  },
  // 200 は `content` を意図的に省略する。handler が R2 binary stream とカスタム
  // cache / disposition header を持つ raw Response を返すため。
  responses: {
    200: { description: '画像 binary (image/png, image/jpeg, image/webp, image/svg+xml)' },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid room ID',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'protected room の bearer token が欠落 / 不正',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'room または image が見つからない',
    },
  },
});

// `.openapi()` を chain することで、export が `hc` 用に merge 済 route schema を保つ。
export const imagesRoute = new OpenAPIHono<{ Bindings: Bindings }>().openapi(
  getImageRoute,
  async (c) => {
    const { id } = c.req.valid('param');
    const meta = await createR2MetaStorage(c.env.IMAGES).getMeta(id);
    if (!meta) throw new AppError(404, 'NOT_FOUND', 'Room not found', { id });

    // 認可 gate: token を要求するのは protected room だけ。unprotected room は元の
    // public 挙動を維持し、既存 share フローを壊さない。
    if (meta.auth) {
      // 明示的な `logger.warn` + `AppError` のペアを単一の AppError throw に集約する。
      // `onAppError` が `logContext` を consume して 1 失敗 = 1 warn 行になる
      // (以前は 2 行出ていた)。
      const token = extractBearerToken(c.req.header('authorization'));
      if (!token) {
        throw new AppError(401, 'UNAUTHORIZED', 'Token required', {
          id,
          event: 'image_fetch_denied',
          reason: 'missing_token',
        });
      }
      const tokenSvc = createTokenService({ secret: c.env.ROOM_TOKEN_SECRET });
      const result = await tokenSvc.verify(token, id);
      if (!result.ok) {
        throw new AppError(401, 'UNAUTHORIZED', 'Invalid token', {
          id,
          event: 'image_fetch_denied',
          reason: result.reason,
        });
      }
    }

    const obj = await createR2ImageStorage(c.env.IMAGES).getImage(meta.image.key);
    if (!obj) {
      // meta はあるが image が消えている — orphan state。「room 自体が無い」miss
      // とは区別する。
      logger.warn('image object missing for existing meta', { id, key: meta.image.key });
      throw new AppError(404, 'NOT_FOUND', 'Image not found', { id, key: meta.image.key });
    }

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    // MIME sniffing 防止: browser には R2 が設定した Content-Type を必ず honor させる。
    headers.set('x-content-type-options', 'nosniff');
    // protected room を browser / CDN cache 経由で漏らさない。R2 object 側は
    // unprotected room に対して `Cache-Control: public, max-age=3600` を設定するが、
    // ここで上書きし、Bearer 認証済 response が共有 cache から未認証 client に再配信
    // されないようにする。
    if (meta.auth) {
      headers.set('cache-control', 'private, no-store');
    }
    // SVG はブラウザタブで直接開くと inline script が実行され得る。`<img src=...>`
    // 経由の表示は許可しつつ、直接開いた場合の XSS を無効化するため download を強制する。
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
