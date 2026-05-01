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
      // Proxy REST and WebSocket traffic to the wrangler dev server so the
      // browser only sees a single origin. `ws: true` is required so vite
      // also forwards the upgrade handshake for /sync/:id.
      '/rooms': { target: 'http://localhost:8787', changeOrigin: true },
      '/sync': { target: 'http://localhost:8787', ws: true, changeOrigin: true },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
