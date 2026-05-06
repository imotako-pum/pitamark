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

// `AppType` は `import type` で取り込み、api workspace の runtime code (Hono routes,
// R2 bindings, OpenAPI schemas) が web の bundle に混ざらないようにする。Zod schema
// は逆に値として import し、runtime で `safeParse` できるようにしておく。
//
// baseUrl が空の場合 (`vite dev` で `.env` 未設定) は全 request が相対パスになり、
// Vite の `server.proxy` (`/rooms` + `/sync`) が wrangler dev server に繋ぐ。
// CI / 本番など proxy を経由しない origin で動かす場合のみ `VITE_API_URL` を設定する。
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

// 失敗理由を discriminated union で表現する。server は upload を複数の理由で reject
// するので、caller は「全部 network error」扱いにせず `reason` で UI テキストを
// 出し分ける。
export type CreateRoomFailure =
  | { reason: 'rate-limited' }
  | { reason: 'image-blocked' }
  | { reason: 'turnstile' }
  | { reason: 'invalid' }
  | { reason: 'network' };

// protected room を作成した uploader は POST /rooms のレスポンスに含まれる `token` を
// そのまま sessionStorage に保存することで、`/r/:id` 遷移後の RoomGate を skip できる
// (本人は password を知っているため再入力させる必要が無い)。password なしルームでは
// `token` は undefined。
export type CreateRoomResult =
  | { ok: true; room: RoomPublic; token?: string }
  | ({ ok: false } & CreateRoomFailure);

/**
 * 画像を `POST /rooms` に upload する。
 * 空白だけの `password` は undefined に正規化し、protected にしない。
 * `turnstileToken` はそのまま送り、検証 / `BYPASS_TURNSTILE` short-circuit の
 * 判断は API 側に委ねる。
 *
 * このエンドポイントだけ意図的に `hc<AppType>` を経由しない。hc 型付き form client
 * は server の `uploadFormSchema` の型と一致した `multipart/form-data` を要求するが、
 * `image: z.instanceof(File)` を hc の runtime form shape では表現できない。他の
 * endpoint (`fetchRoom` / `authenticateRoom` / `requestWsTicket` / `fetchProtectedImage`)
 * は hc を使い、この 1 本だけ raw fetch にしている。
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
      // TS cast に頼らず shared な Zod schema で response shape を validate する。
      // schema drift (server roll-back / 中間者の JSON 破損 / `protected ↔ image`
      // refine 違反) は network failure に降格し、UI state に黙って流れ込まないようにする。
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
    // 型付き `hc<AppType>` 経由で叩くことで、api workspace と web の間の path / shape
    // drift を typecheck 時に捕まえる。runtime shape は Zod safeParse で別途 validate
    // する — hc は型推論を与えるだけで runtime 保証はしない。
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

// `rate-limited` は bad password (401) と cooldown (429) を RoomGate で出し分ける
// ために導入。
export type AuthFailure = 'wrong-password' | 'rate-limited' | 'network' | 'unexpected';

export type AuthResult = { ok: true; token: string } | { ok: false; reason: AuthFailure };

/**
 * POST /rooms/:id/auth — password を 24h JWT に交換する。
 * 401 (bad password) / 429 (cooldown) / network failure を caller が UI 上で出し
 * 分けられるよう、tagged result で返す。
 */
export const authenticateRoom = async (id: string, password: string): Promise<AuthResult> => {
  try {
    // hc<AppType> で path + json body の型推論。password 制約 (`min(1).max(256)`)
    // は server schema 側にあり、ここは call site の型として string を受けるだけで済む。
    const res = await api.rooms[':id'].auth.$post({
      param: { id },
      json: { password },
    });
    if (res.status === 200) {
      // shared `AuthResponseSchema` で safeParse する (旧来の `as { token: string }`
      // cast を置換)。token への `min(1)` 制約で、server 側の regression による空
      // 文字列 emit も検知できる。
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

// 長寿命 JWT をここで 30 秒の one-shot ticket に交換する。WebSocket upgrade URL に
// 載るのは ticket であって JWT ではないので、platform 側の access log (wrangler tail,
// CDN logs) には JWT が残らない。`network` は fetch error と shape 異常の両方、
// `unauthorized` は JWT 失効 / sub 不一致をカバーする。
export type WsTicketFailure = 'unauthorized' | 'not-found' | 'rate-limited' | 'network';

export type WsTicketResult = { ok: true; ticket: string } | { ok: false; reason: WsTicketFailure };

export const requestWsTicket = async (roomId: string, token: string): Promise<WsTicketResult> => {
  try {
    // hc<AppType> 経由。`ws-ticket` は path セグメントに `-` を含むため bracket 記法
    // で書く。Authorization header は server schema で optional 扱いなので、header
    // object として渡しても型が通る。
    const res = await api.rooms[':id']['ws-ticket'].$post({
      param: { id: roomId },
      header: { authorization: `Bearer ${token}` },
    });
    if (res.status === 201) {
      // shared `WsTicketResponseSchema` で safeParse (`fetchRoom` / `authenticateRoom`
      // と同じ fail-soft pattern)。32 hex regex は schema 側で enforce されるため、
      // ここで手書き check する必要は無い。
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
 * protected room の画像を Bearer token 付きで fetch し、blob ObjectURL として返す。
 * Konva の <img> wrapper は Authorization header を直接送れないため、ここで bytes を
 * 取得してローカル URL に materialize する。
 *
 * caller は image を unmount する際に **必ず** `URL.revokeObjectURL(objectUrl)` を呼ぶこと。
 */
export const fetchProtectedImage = async (
  roomId: string,
  token: string,
): Promise<ImageFetchResult> => {
  try {
    // hc<AppType> 経由。binary レスポンスは createRoute 側で content を省略しており
    // 200 default schema を持たないが、hc client は `Response` を返すので `.blob()`
    // で取れる。
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
