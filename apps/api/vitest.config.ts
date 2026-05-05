import { defineConfig } from 'vitest/config';

// `y-durableobjects` (transitively imported by `src/yjs.ts`) imports
// `DurableObject` from the `cloudflare:workers` virtual module, which only
// exists at runtime inside Cloudflare Workers. Under Node-environment vitest
// the ESM loader rejects the `cloudflare:` scheme before any `test.alias`
// substitution runs, so we intercept the spec at the Vite plugin layer
// (resolveId/load with a Rollup-virtual `\0` id) and return a stub class.
//
// Tests in this workspace only exercise the Hono middleware that fronts
// `yRoute` — they never construct or invoke the DO itself — so the stub only
// needs to satisfy the import / `extends` semantics, not real runtime
// behavior. DO behavior is verified via `wrangler dev` + 2-tab manual smoke.
export default defineConfig({
  plugins: [
    {
      name: 'pitamark/virtualize-cloudflare-workers',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'cloudflare:workers') {
          return '\0virtual:cloudflare-workers';
        }
        return null;
      },
      load(id) {
        if (id === '\0virtual:cloudflare-workers') {
          return [
            'export class DurableObject {',
            '  constructor(state, env) {',
            '    this.state = state;',
            '    this.ctx = state;',
            '    this.env = env;',
            '  }',
            '}',
            'export class WorkerEntrypoint {',
            '  constructor(ctx, env) {',
            '    this.ctx = ctx;',
            '    this.env = env;',
            '  }',
            '}',
          ].join('\n');
        }
        return null;
      },
    },
  ],
  test: {
    environment: 'node',
    server: {
      deps: {
        // Force inlining so the virtual `cloudflare:workers` resolution above
        // also applies to imports performed from inside `node_modules`
        // (Vite's externalization heuristic skips plugin transforms otherwise).
        inline: [/y-durableobjects/],
      },
    },
    // Phase 8.x tests review #8 M1: see apps/web/vite.config.ts.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
    },
  },
});
