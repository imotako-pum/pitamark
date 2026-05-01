import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import type { Bindings } from './lib/bindings';
import { onAppError, onAppNotFound } from './lib/error';
import { openApiDocConfig } from './lib/openapi';
import { imagesRoute } from './routes/images';
import { roomsRoute } from './routes/rooms';

// NOTE (Phase 4 work-in-progress): `./yjs` exports `syncRoute` and
// `YDurableObjects`, but mounting them here pulls `cloudflare:workers` into
// the Node-based vitest run via transitive imports. Wiring is deferred to
// the next session, where it lands together with a vitest-side stub for the
// `cloudflare:workers` virtual module.

const app = new OpenAPIHono<{ Bindings: Bindings }>();

const routed = app
  .get('/health', (c) => c.json({ ok: true, service: 'snap-share-api', ts: Date.now() }))
  .route('/rooms', roomsRoute)
  .route('/rooms', imagesRoute);

// OpenAPI 3.1 spec + Scalar UI. Mounted on `app` (not `routed`) so they don't
// pollute the AppType used for the `hc` typed client.
app.doc31('/api/openapi.json', openApiDocConfig);
app.get('/api/docs', Scalar({ url: '/api/openapi.json' }));

app.notFound(onAppNotFound);
app.onError(onAppError);

export type AppType = typeof routed;
export default app;
