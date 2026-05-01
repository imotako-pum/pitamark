import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import type { Bindings } from './lib/bindings';
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

const routed = app
  .get('/health', (c) => c.json({ ok: true, service: 'snap-share-api', ts: Date.now() }))
  .route('/rooms', roomsRoute)
  .route('/rooms', imagesRoute)
  .route('/sync', syncRoute);

// OpenAPI 3.1 spec + Scalar UI. Mounted on `app` (not `routed`) so they don't
// pollute the AppType used for the `hc` typed client.
app.doc31('/api/openapi.json', openApiDocConfig);
app.get('/api/docs', Scalar({ url: '/api/openapi.json' }));

app.notFound(onAppNotFound);
app.onError(onAppError);

export type AppType = typeof routed;
export default app;
