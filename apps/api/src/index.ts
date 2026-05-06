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

// 現行 binding は `class_name = "SnapShareYDO"`。`YDurableObjects` は v1 の名前で
// resolve する legacy migration / tooling が runtime error にならないよう secondary
// export として残してある。
export { SnapShareYDO, YDurableObjects } from './yjs';

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// ブラウザからの呼び出しは env 駆動の allowlist (`wrangler.toml [vars]` /
// `.dev.vars` の `CORS_ALLOWED_ORIGINS`) で gate する。空 / parse 不能な値は初回
// request で例外を投げる fail-closed 方針 — 黙って全 origin を弾くと
// misconfiguration が観測できないので、誤設定をログに大きく出すための意図的な
// 選択。WebSocket `/sync` upgrade は CORS 対象外で、別経路の origin check に依存する。
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

// `syncRoute` は `routed` ではなく `app` に mount する (`app.doc31` / Scalar UI と
// 同じ理由)。WebSocket upgrade path で、`y-websocket` の `WebsocketProvider`
// (`useYjsAnnotationsStore.ts`) からだけ叩かれ、`hc<AppType>` typed client は通らない。
// `/sync` を `AppType` から除外することで typed RPC ツリーが清潔に保たれ、
// 「OpenAPIHono.use() chain 禁止」の Decisions Log policy も AppType 公開 route
// だけに適用される (syncRoute は hc に到達しないので Hono + .use() のままで良い)。
app.route('/sync', syncRoute);

// OpenAPI 3.1 spec + Scalar UI。`hc` typed client が使う AppType を汚染しないよう、
// `routed` ではなく `app` に mount する。
app.doc31('/api/openapi.json', openApiDocConfig);
app.get('/api/docs', Scalar({ url: '/api/openapi.json' }));

app.notFound(onAppNotFound);
app.onError(onAppError);

export type AppType = typeof routed;
export default app;
