import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Phase 7: replace `%VITE_FOO%` placeholders inside index.html at build time
// (and during dev). Vite does not expand `%env%` in HTML by default; this
// plugin reads the same env files Vite already loads (`.env.*`) and stamps
// them in. Used for og:url / og:image / Cloudflare Web Analytics token.
const htmlEnvPlugin = (mode: string): Plugin => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname), 'VITE_');
  return {
    name: 'html-env-replace',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(/%VITE_([A-Z0-9_]+)%/g, (_, key) => env[`VITE_${key}`] ?? ''),
    },
  };
};

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), htmlEnvPlugin(mode)],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy REST traffic to wrangler so the browser sees a single origin
      // and CORS is sidestepped.
      '/rooms': { target: 'http://localhost:8787', changeOrigin: true },
      // `/sync` is intentionally NOT proxied: Vite's WS proxy mangles
      // y-websocket's binary frames (EPIPE after upgrade). Instead the
      // browser connects directly to wrangler via VITE_API_WS_URL set in
      // `.env.development`. WebSockets don't enforce same-origin so this
      // is fine for dev; production gets a proper origin via env override.
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
}));
