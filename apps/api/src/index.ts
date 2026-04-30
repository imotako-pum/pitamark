import { Hono } from 'hono';

type Bindings = Record<string, never>;
const app = new Hono<{ Bindings: Bindings }>();

app.get('/health', (c) => c.json({ ok: true, service: 'snap-share-api', ts: Date.now() }));

export default app;
