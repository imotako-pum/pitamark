import type { AppType } from '@snap-share/api';
import { hc } from 'hono/client';

// `import type` ensures the api workspace's runtime code (Hono routes, R2
// bindings, OpenAPI schemas) never bundles into the web build.
const baseUrl = import.meta.env.VITE_API_URL;
if (!baseUrl) {
  throw new Error('VITE_API_URL is not configured');
}

export const api = hc<AppType>(baseUrl);
