// Re-exported so all hooks (useYjsAnnotationsStore + UndoManager) share the
// SAME symbol identity for origin tracking. Importing the symbol from two
// different paths without going through this barrel breaks `trackedOrigins`.
export { LOCAL_ORIGIN } from '../domain/annotation/yjs-mutations';

type WsLocation = Readonly<{ protocol: string; host: string }>;

/**
 * WebSocket base URL for the Yjs sync endpoint.
 * Resolution order: VITE_API_WS_URL env → derived from `window.location` →
 * (last resort) `ws://localhost:8787` for non-browser callers.
 */
export const resolveWsBaseUrl = (
  env: ImportMetaEnv = import.meta.env,
  location: WsLocation = typeof window !== 'undefined'
    ? window.location
    : { protocol: 'http:', host: 'localhost:8787' },
): string => {
  const fromEnv = (env as { VITE_API_WS_URL?: string }).VITE_API_WS_URL;
  if (fromEnv) return fromEnv;
  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${location.host}`;
};

/**
 * Build the full WS URL for a given roomId. Optionally appends `?token=...`
 * for password-protected rooms (WebSocket cannot send Authorization headers,
 * so the token rides as a query parameter — see Phase 5 plan / Decisions Log).
 */
export const buildSyncUrl = (
  roomId: string,
  baseUrl: string = resolveWsBaseUrl(),
  token?: string | null,
): string => {
  const base = `${baseUrl}/sync/${encodeURIComponent(roomId)}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
};
