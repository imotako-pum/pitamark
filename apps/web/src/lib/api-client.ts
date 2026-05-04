import type { AppType } from '@snap-share/api';
import type { RoomCreated, RoomPublic } from '@snap-share/shared';
import { hc } from 'hono/client';
import { logger } from './logger';

// `import type` ensures the api workspace's runtime code (Hono routes, R2
// bindings, OpenAPI schemas) never bundles into the web build.
//
// Empty baseUrl is the default in `vite dev` (no `.env` set): all requests
// become relative paths and Vite's `server.proxy` (`/rooms` + `/sync`) routes
// them to the wrangler dev server. Set `VITE_API_URL` only when running
// against a non-proxied origin (CI, prod, etc.).
export const resolveApiBaseUrl = (env: ImportMetaEnv = import.meta.env): string =>
  (env as { VITE_API_URL?: string }).VITE_API_URL ?? '';

const baseUrl = resolveApiBaseUrl();

export const api = hc<AppType>(baseUrl || window.location.origin);

export const buildImageUrl = (room: Pick<RoomPublic, 'id'>, base: string = baseUrl): string =>
  `${base}/rooms/${room.id}/image`;

const normalizePassword = (password: string | undefined | null): string | undefined => {
  if (typeof password !== 'string') return undefined;
  return password.length > 0 ? password : undefined;
};

// Phase 7: discriminated-union failure surface. The server can now reject
// uploads for several reasons that warrant distinct UI text, so callers
// switch on `reason` instead of treating every miss as "network error".
export type CreateRoomFailure =
  | { reason: 'rate-limited' }
  | { reason: 'image-blocked' }
  | { reason: 'turnstile' }
  | { reason: 'invalid' }
  | { reason: 'network' };

// Phase 7.6 既知-5 fix: protected room を作成した uploader は POST /rooms の
// レスポンスに含まれる `token` をそのまま sessionStorage に保存することで、
// `/r/:id` 遷移後の RoomGate を skip できる (本人は password を知っている)。
// password なしルームでは `token` は undefined。
export type CreateRoomResult =
  | { ok: true; room: RoomPublic; token?: string }
  | ({ ok: false } & CreateRoomFailure);

/**
 * Uploads an image to `POST /rooms`.
 * Empty/whitespace `password` is normalized to undefined so the resulting
 * room stays unprotected. `turnstileToken` is sent verbatim — the API
 * decides whether to verify it or short-circuit via `BYPASS_TURNSTILE`.
 */
export const createRoom = async (
  file: File,
  password: string | undefined,
  turnstileToken: string,
): Promise<CreateRoomResult> => {
  try {
    const form = new FormData();
    form.set('image', file);
    const pw = normalizePassword(password);
    if (pw !== undefined) form.set('password', pw);
    form.set('cf-turnstile-response', turnstileToken);
    const res = await fetch(`${baseUrl}/rooms`, { method: 'POST', body: form });
    if (res.status === 201) {
      const body = (await res.json()) as RoomCreated;
      const { token, ...room } = body;
      return token ? { ok: true, room, token } : { ok: true, room };
    }
    if (res.status === 429) return { ok: false, reason: 'rate-limited' };
    if (res.status === 422) return { ok: false, reason: 'image-blocked' };
    if (res.status === 401) return { ok: false, reason: 'turnstile' };
    if (res.status === 400 || res.status === 413 || res.status === 415) {
      return { ok: false, reason: 'invalid' };
    }
    logger.warn('createRoom: unexpected status', { status: res.status });
    return { ok: false, reason: 'network' };
  } catch (e: unknown) {
    logger.warn('createRoom: network error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, reason: 'network' };
  }
};

export const fetchRoom = async (id: string): Promise<RoomPublic | null> => {
  try {
    const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(id)}`);
    if (res.status !== 200) return null;
    return (await res.json()) as RoomPublic;
  } catch (e: unknown) {
    logger.warn('fetchRoom: network error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
};

// Phase 7: 'rate-limited' is added to the Phase 5 union so RoomGate can
// distinguish bad password (401) from cooldown (429).
export type AuthFailure = 'wrong-password' | 'rate-limited' | 'network' | 'unexpected';

export type AuthResult = { ok: true; token: string } | { ok: false; reason: AuthFailure };

/**
 * POST /rooms/:id/auth — exchanges a password for a 24h JWT.
 * Returns a tagged result so callers can show different UI for
 * 401 (bad password), 429 (cooldown) vs network failures.
 */
export const authenticateRoom = async (id: string, password: string): Promise<AuthResult> => {
  try {
    const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(id)}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.status === 200) {
      const body = (await res.json()) as { token: string };
      return { ok: true, token: body.token };
    }
    if (res.status === 401) {
      return { ok: false, reason: 'wrong-password' };
    }
    if (res.status === 429) {
      return { ok: false, reason: 'rate-limited' };
    }
    logger.warn('authenticateRoom: unexpected status', { status: res.status });
    return { ok: false, reason: 'unexpected' };
  } catch (e: unknown) {
    logger.warn('authenticateRoom: network error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, reason: 'network' };
  }
};

// Phase 8.x security review #13 H1: web exchanges its long-lived JWT for a
// 30s one-shot ticket here. The ticket — not the JWT — rides on the
// WebSocket upgrade URL so platform access logs (wrangler tail, CDN logs)
// never see the JWT. `network` covers both fetch errors and unexpected
// shapes; `unauthorized` covers JWT expiry / sub mismatch.
export type WsTicketFailure = 'unauthorized' | 'not-found' | 'rate-limited' | 'network';

export type WsTicketResult = { ok: true; ticket: string } | { ok: false; reason: WsTicketFailure };

export const requestWsTicket = async (roomId: string, token: string): Promise<WsTicketResult> => {
  try {
    const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(roomId)}/ws-ticket`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 201) {
      const body = (await res.json()) as { ticket: string };
      // Defense in depth: the API only emits 32-hex tickets; a different
      // shape means an upstream broke contract — fall back to network.
      if (typeof body.ticket !== 'string' || !/^[0-9a-f]{32}$/.test(body.ticket)) {
        logger.warn('requestWsTicket: unexpected ticket shape');
        return { ok: false, reason: 'network' };
      }
      return { ok: true, ticket: body.ticket };
    }
    if (res.status === 401) return { ok: false, reason: 'unauthorized' };
    if (res.status === 404) return { ok: false, reason: 'not-found' };
    if (res.status === 429) return { ok: false, reason: 'rate-limited' };
    logger.warn('requestWsTicket: unexpected status', { status: res.status });
    return { ok: false, reason: 'network' };
  } catch (e: unknown) {
    logger.warn('requestWsTicket: network error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, reason: 'network' };
  }
};

export type ImageFetchFailure = 'unauthorized' | 'not-found' | 'network';

export type ImageFetchResult =
  | { ok: true; objectUrl: string }
  | { ok: false; reason: ImageFetchFailure };

/**
 * Fetches a protected room's image with a Bearer token and exposes it as a
 * blob ObjectURL — Konva's <img> wrapper cannot send Authorization headers
 * directly, so we materialize the bytes and hand back a local URL.
 *
 * Caller MUST `URL.revokeObjectURL(objectUrl)` when the image is unmounted.
 */
export const fetchProtectedImage = async (
  roomId: string,
  token: string,
): Promise<ImageFetchResult> => {
  try {
    const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(roomId)}/image`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 200) {
      const blob = await res.blob();
      return { ok: true, objectUrl: URL.createObjectURL(blob) };
    }
    if (res.status === 401) return { ok: false, reason: 'unauthorized' };
    if (res.status === 404) return { ok: false, reason: 'not-found' };
    logger.warn('fetchProtectedImage: unexpected status', { status: res.status });
    return { ok: false, reason: 'network' };
  } catch (e: unknown) {
    logger.warn('fetchProtectedImage: network error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, reason: 'network' };
  }
};
