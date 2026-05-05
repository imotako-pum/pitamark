import type { AppType } from '@pitamark/api';
import {
  AuthResponseSchema,
  RoomCreatedSchema,
  type RoomPublic,
  RoomPublicSchema,
  WsTicketResponseSchema,
} from '@pitamark/shared';
import { hc } from 'hono/client';
import { logger } from './logger';

// `import type` for `AppType` ensures the api workspace's runtime code
// (Hono routes, R2 bindings, OpenAPI schemas) never bundles into the web
// build. The Zod schemas, by contrast, are imported as values so they can
// `safeParse` at runtime — Phase 8.x SSOT review #1 H1.
//
// Empty baseUrl is the default in `vite dev` (no `.env` set): all requests
// become relative paths and Vite's `server.proxy` (`/rooms` + `/sync`) routes
// them to the wrangler dev server. Set `VITE_API_URL` only when running
// against a non-proxied origin (CI, prod, etc.).
export const resolveApiBaseUrl = (env: ImportMetaEnv = import.meta.env): string =>
  env.VITE_API_URL ?? '';

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
 *
 * Phase 8.x Hono review #4 M2: this is the one fetch deliberately NOT
 * routed through `hc<AppType>`. The hc typed form client requires
 * pre-shaped `multipart/form-data` objects whose field-by-field types
 * match the server `uploadFormSchema`, but `image: z.instanceof(File)` is
 * not representable in hc's runtime form shape. Other endpoints
 * (`fetchRoom` / `authenticateRoom` / `requestWsTicket` / `fetchProtectedImage`)
 * use hc — only this one keeps raw fetch.
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
      // Phase 8.x SSOT review #1 H1: validate the response shape with the
      // shared Zod schema rather than trusting a TS cast. A schema drift
      // (server rolled back, intermediary corrupting JSON, refine
      // `protected ↔ image` violation) downgrades to a network failure
      // instead of silently flowing into UI state.
      const raw: unknown = await res.json();
      const parsed = RoomCreatedSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('createRoom: unexpected response shape', {
          issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })),
        });
        return { ok: false, reason: 'network' };
      }
      const { token, ...room } = parsed.data;
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
    // Phase 8.x Hono review #4 M2: routed via the typed `hc<AppType>` client
    // so a path/shape drift between api workspace and web is caught at
    // typecheck time. Runtime shape is still validated via Zod safeParse —
    // hc gives us *type* inference, not runtime guarantees.
    const res = await api.rooms[':id'].$get({ param: { id } });
    if (res.status !== 200) return null;
    const raw: unknown = await res.json();
    const parsed = RoomPublicSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn('fetchRoom: unexpected response shape', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })),
      });
      return null;
    }
    return parsed.data;
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
    // Phase 8.x Hono review #4 M2: hc<AppType> でパス + json body 型推論。
    // password 制約 (`min(1).max(256)`) は server schema 側にあり、ここは
    // call site の型として string を受けるだけで済む。
    const res = await api.rooms[':id'].auth.$post({
      param: { id },
      json: { password },
    });
    if (res.status === 200) {
      // Phase 8.x SSOT review #1 M1: shared `AuthResponseSchema` replaces
      // the prior `as { token: string }` cast. `min(1)` on token would
      // catch a server-side regression that emits an empty string.
      const raw: unknown = await res.json();
      const parsed = AuthResponseSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('authenticateRoom: unexpected response shape', {
          issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })),
        });
        return { ok: false, reason: 'unexpected' };
      }
      return { ok: true, token: parsed.data.token };
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
    // Phase 8.x Hono review #4 M2: hc<AppType> 経由。`ws-ticket` は path
    // セグメントに `-` が含まれるため bracket 記法。Authorization header は
    // server schema で optional なので header object に渡しても型が通る。
    const res = await api.rooms[':id']['ws-ticket'].$post({
      param: { id: roomId },
      header: { authorization: `Bearer ${token}` },
    });
    if (res.status === 201) {
      // Phase 8.x PR #15 self-review M1: shared `WsTicketResponseSchema`
      // を使って safeParse。`fetchRoom` / `authenticateRoom` と同じ
      // fail-soft pattern。32 hex regex は schema 側で enforce される
      // ため、ここでの手書き check は不要になった。
      const raw: unknown = await res.json();
      const parsed = WsTicketResponseSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn('requestWsTicket: unexpected response shape', {
          issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })),
        });
        return { ok: false, reason: 'network' };
      }
      return { ok: true, ticket: parsed.data.ticket };
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
    // Phase 8.x Hono review #4 M2: hc<AppType> 経由。binary レスポンスは
    // 200 デフォルト schema を持たない (createRoute で content 省略) が、
    // hc client は `Response` を返すので `.blob()` で取れる。
    const res = await api.rooms[':id'].image.$get({
      param: { id: roomId },
      header: { authorization: `Bearer ${token}` },
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
