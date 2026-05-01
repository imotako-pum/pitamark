import type { AppType } from '@snap-share/api';
import type { Room } from '@snap-share/shared';
import { hc } from 'hono/client';
import { logger } from './logger';

// `import type` ensures the api workspace's runtime code (Hono routes, R2
// bindings, OpenAPI schemas) never bundles into the web build.
export const resolveApiBaseUrl = (env: ImportMetaEnv = import.meta.env): string =>
  (env as { VITE_API_URL?: string }).VITE_API_URL ?? '';

const baseUrl = resolveApiBaseUrl();
if (!baseUrl) {
  // The dev workflow requires a base URL; missing config is a setup error.
  throw new Error('VITE_API_URL is not configured');
}

export const api = hc<AppType>(baseUrl);

export const buildImageUrl = (room: Pick<Room, 'id'>, base: string = baseUrl): string =>
  `${base}/rooms/${room.id}/image`;

/**
 * Uploads an image to `POST /rooms`. Returns null on any failure so callers
 * can fall back to local-only behavior without surfacing a hard error.
 */
export const createRoom = async (file: File): Promise<Room | null> => {
  try {
    const form = new FormData();
    form.set('image', file);
    const res = await fetch(`${baseUrl}/rooms`, { method: 'POST', body: form });
    if (res.status !== 201) {
      logger.warn('createRoom: unexpected status', { status: res.status });
      return null;
    }
    return (await res.json()) as Room;
  } catch (e: unknown) {
    logger.warn('createRoom: network error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
};

export const fetchRoom = async (id: string): Promise<Room | null> => {
  try {
    const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(id)}`);
    if (res.status !== 200) return null;
    return (await res.json()) as Room;
  } catch (e: unknown) {
    logger.warn('fetchRoom: network error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
};
