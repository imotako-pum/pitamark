import type { AppType } from '@snap-share/api';
import type { RoomPublic } from '@snap-share/shared';
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

/**
 * Uploads an image to `POST /rooms`. Returns null on any failure so callers
 * can fall back to local-only behavior without surfacing a hard error.
 * Empty/whitespace `password` is normalized to undefined so the resulting
 * room stays unprotected.
 */
export const createRoom = async (file: File, password?: string): Promise<RoomPublic | null> => {
  try {
    const form = new FormData();
    form.set('image', file);
    const pw = normalizePassword(password);
    if (pw !== undefined) {
      form.set('password', pw);
    }
    const res = await fetch(`${baseUrl}/rooms`, { method: 'POST', body: form });
    if (res.status !== 201) {
      logger.warn('createRoom: unexpected status', { status: res.status });
      return null;
    }
    return (await res.json()) as RoomPublic;
  } catch (e: unknown) {
    logger.warn('createRoom: network error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
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

export type AuthFailure = 'wrong-password' | 'network' | 'unexpected';

export type AuthResult = { ok: true; token: string } | { ok: false; reason: AuthFailure };

/**
 * POST /rooms/:id/auth — exchanges a password for a 24h JWT.
 * Returns a tagged result so callers can show different UI for
 * 401 (bad password) vs network failures.
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
    logger.warn('authenticateRoom: unexpected status', { status: res.status });
    return { ok: false, reason: 'unexpected' };
  } catch (e: unknown) {
    logger.warn('authenticateRoom: network error', {
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
