/// <reference types="vite/client" />

// Phase 8.x typesafety review #6 M2: declare the VITE_* env vars once so
// callers can read `import.meta.env.VITE_FOO` directly instead of
// `(import.meta.env as { VITE_FOO?: string }).VITE_FOO`. Each new env var
// added in a `.env.*` file MUST be added here; the missing-key cast
// pattern was hiding additions from typecheck.

interface ImportMetaEnv {
  /** Empty in `vite dev` so /rooms + /sync are proxied to wrangler. */
  readonly VITE_API_URL?: string;
  /** Direct WebSocket origin — must NOT go through Vite's WS proxy. */
  readonly VITE_API_WS_URL?: string;
  /** Public Cloudflare Turnstile site key. Safe to ship in the bundle. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
