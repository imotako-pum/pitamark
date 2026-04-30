import { Hono } from 'hono';
import { YDurableObjects, yRoute } from 'y-durableobjects';

type Bindings = {
  Y_ROOM: DurableObjectNamespace;
};

type Env = {
  Bindings: Bindings;
};

const app = new Hono<Env>();

app.get('/health', (c) => c.json({ ok: true, spike: 'yjs-durable-object' }));

const route = app.route('/rooms', yRoute<Env>((env) => env.Y_ROOM));

export default route;
export type AppType = typeof route;
export { YDurableObjects };
