import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import type { Bindings } from './lib/bindings';
import { matchOrigin, parseAllowedOrigins } from './lib/cors';
import { onAppError, onAppNotFound } from './lib/error';
import { openApiDocConfig } from './lib/openapi';
import { imagesRoute } from './routes/images';
import { roomsRoute } from './routes/rooms';
import { syncRoute } from './yjs';

// Phase 5 binds `class_name = "SnapShareYDO"`. `YDurableObjects` is kept as a
// secondary export so legacy migrations / tooling that still resolve the v1
// name continue to work without a runtime error.
export { SnapShareYDO, YDurableObjects } from './yjs';

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// Phase 7.5: ブラウザからの呼び出しは env 駆動の allowlist
// （`wrangler.toml [vars]` / `.dev.vars` の `CORS_ALLOWED_ORIGINS`）でゲート。
// 空 / パース不能な値は初回リクエストで例外を投げる fail-closed 方針 —
// 黙って全 origin を弾くと misconfiguration が観測しにくいので、誤設定を
// ログに大きく出すための意図的な選択。WebSocket `/sync` upgrade は CORS
// 対象外で、別経路の origin check に依存する。
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const raw = (c.env as Bindings).CORS_ALLOWED_ORIGINS ?? '';
      const rules = parseAllowedOrigins(raw);
      if (rules.length === 0) {
        throw new Error('CORS_ALLOWED_ORIGINS is empty — refusing to handle browser requests');
      }
      return matchOrigin(origin, rules) ? origin : undefined;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['content-type', 'authorization'],
    maxAge: 86400,
  }),
);

const routed = app
  .get('/health', (c) => c.json({ ok: true, service: 'pitamark-api', ts: Date.now() }))
  .route('/rooms', roomsRoute)
  .route('/rooms', imagesRoute);

// Phase 8.x Hono review #4 M1: `syncRoute` is mounted on `app` (not `routed`)
// for the same reason `app.doc31` / Scalar UI are mounted there: it's a
// WebSocket upgrade path consumed only by `y-websocket`'s `WebsocketProvider`
// (see `useYjsAnnotationsStore.ts`), never by the `hc<AppType>` typed client.
// Excluding `/sync` from `AppType` keeps the typed RPC tree clean and makes
// the Decisions Log policy ("OpenAPIHono.use() chain forbidden") apply only
// to AppType-exposed routes — `syncRoute` stays as `Hono` + `.use()` because
// it never reaches `hc`.
app.route('/sync', syncRoute);

// OpenAPI 3.1 spec + Scalar UI. Mounted on `app` (not `routed`) so they don't
// pollute the AppType used for the `hc` typed client.
app.doc31('/api/openapi.json', openApiDocConfig);
app.get('/api/docs', Scalar({ url: '/api/openapi.json' }));

app.notFound(onAppNotFound);
app.onError(onAppError);

export type AppType = typeof routed;
export default app;
