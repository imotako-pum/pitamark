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
  const fromEnv = env.VITE_API_WS_URL;
  if (fromEnv) return fromEnv;
  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${location.host}`;
};

/**
 * Build the full WS URL for a given roomId.
 *
 * NOTE: For password-protected rooms, the JWT token rides on the upgrade
 * request via y-websocket's `params: { token }` option (set in
 * `useYjsAnnotationsStore`), NOT through this URL builder. WebSocket cannot
 * send Authorization headers, so token-as-query is the chosen transport, but
 * y-websocket owns the encoding so this helper stays token-free.
 */
export const buildSyncUrl = (roomId: string, baseUrl: string = resolveWsBaseUrl()): string =>
  `${baseUrl}/sync/${encodeURIComponent(roomId)}`;
