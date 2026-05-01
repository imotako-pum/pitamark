import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});
