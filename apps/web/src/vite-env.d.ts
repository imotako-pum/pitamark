/// <reference types="vite/client" />

// VITE_* env var をここで一括宣言する。caller は `import.meta.env.VITE_FOO` を
// `(import.meta.env as { VITE_FOO?: string }).VITE_FOO` にせずに直接読める。
// `.env.*` に新 env を追加したら必ずここにも追加すること — 過去の missing-key cast
// パターンが追加分を typecheck から隠していた。

interface ImportMetaEnv {
  /** `vite dev` では空にして、/rooms + /sync を wrangler に proxy する。 */
  readonly VITE_API_URL?: string;
  /** WebSocket origin。Vite の WS proxy は経由してはいけない。 */
  readonly VITE_API_WS_URL?: string;
  /** Cloudflare Turnstile の public site key。bundle に乗せても安全。 */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
