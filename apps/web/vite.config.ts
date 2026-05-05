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
  // Phase 8.x perf review #10 H1+M1: separate Konva and Yjs into vendor
  // chunks so the landing/local page does not pay for the room-only Yjs
  // network code on first load. `EditorPage` lazy-loads `LocalEditor` /
  // `RoomEditor`, so React.lazy() boundaries control which vendor chunks
  // are even fetched. Combined target: main `index-*.js` ≤ 200 KB gz
  // (down from 283.82 KB single-bundle pre-fix).
  //
  // Vite 8 ships with rolldown which only accepts the function form of
  // `manualChunks` (the object form is rollup-only). We pattern-match each
  // module id against the known vendor packages so future additions stay
  // adjacent to the same chunk decision.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/konva/') ||
            id.includes('/node_modules/react-konva/') ||
            id.includes('/node_modules/use-image/')
          ) {
            return 'vendor-canvas';
          }
          if (
            id.includes('/node_modules/yjs/') ||
            id.includes('/node_modules/y-websocket/') ||
            id.includes('/node_modules/y-protocols/')
          ) {
            return 'vendor-yjs';
          }
          return undefined;
        },
      },
    },
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
    // Phase 8.x tests review #8 M1: 80% coverage target was previously
    // unmeasurable because `@vitest/coverage-v8` was not installed.
    // Wiring it here makes `pnpm -F @pitamark/web test:coverage`
    // emit lcov + text summaries; the actual gate-on-threshold lands
    // alongside Phase 9 once the realistic baseline is known.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
    },
  },
}));
