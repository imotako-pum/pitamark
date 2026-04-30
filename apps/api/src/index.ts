import { Hono } from 'hono';
import type { Bindings } from './lib/bindings';
import { onAppError, onAppNotFound } from './lib/error';
import { imagesRoute } from './routes/images';
import { roomsRoute } from './routes/rooms';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/health', (c) => c.json({ ok: true, service: 'snap-share-api', ts: Date.now() }));

app.route('/rooms', roomsRoute);
app.route('/rooms', imagesRoute);

app.notFound(onAppNotFound);
app.onError(onAppError);

export default app;
