// 全 hook (useYjsAnnotationsStore + UndoManager) が origin tracking 用に **同一**
// symbol identity を共有するための barrel re-export。複数経路から symbol を import
// すると identity が分かれ `trackedOrigins` が機能しなくなる。
export { LOCAL_ORIGIN } from '../domain/annotation/yjs-mutations';

type WsLocation = Readonly<{ protocol: string; host: string }>;

/**
 * Yjs sync endpoint 用の WebSocket base URL。
 * 解決順: VITE_API_WS_URL env → `window.location` から derive →
 * 最終手段として non-browser 呼び出し用 `ws://localhost:8787`。
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
 * 指定 roomId 用の WS URL を構築する。
 *
 * 注意: protected room の JWT は y-websocket の `params: { token }` 経由で upgrade
 * request に乗る (`useYjsAnnotationsStore` 側で設定)。この URL builder は token を
 * 取らない。WebSocket は Authorization header を送れないため query 渡しが必要だが、
 * encoding は y-websocket に寄せ、このヘルパは token-free に保つ。
 */
export const buildSyncUrl = (roomId: string, baseUrl: string = resolveWsBaseUrl()): string =>
  `${baseUrl}/sync/${encodeURIComponent(roomId)}`;
