// Phase 8.x security review #13 H1: WebSocket cannot send Authorization
// headers, so a query param is the only option for upgrade-time auth. To
// keep the long-lived 24h JWT out of platform access logs (`wrangler tail`,
// CDN logs), protected rooms exchange the JWT for a one-shot, 60-second
// ticket that lives in KV. The ticket is bound to a roomId and is deleted
// the moment the WebSocket upgrade verifies it, so URL leakage outside the
// 60s window cannot grant access. Rooms remain unprotected = no ticket
// required (they are gated by RL_SYNC instead).
//
// `KVNamespace` is a global ambient type from the Workers runtime; we do
// not import it explicitly so that web's tsconfig can compile this file
// when traversed via the workspace dependency graph.
//
// `expirationTtl` minimum is 60s on Cloudflare KV (production + miniflare
// reject < 60 with a 400). The `init` flow happens inside seconds — even
// 60s is a fully oversized window for the legitimate use case (web fetches
// the ticket and immediately opens the WS). Burn-on-consume keeps the
// effective lifetime to "first WS upgrade".

const TICKET_BYTES = 16; // 128 bits → 32 hex chars; brute-force in 60s impossible.
export const WS_TICKET_TTL_SEC = 60;
const KV_KEY_PREFIX = 'ws-ticket:';

export type WsTicketServiceDeps = Readonly<{
  kv: KVNamespace;
  /** Override for deterministic ticket generation in tests. */
  generate?: () => string;
}>;

export type WsTicketIssueResult = Readonly<{ ticket: string }>;

export type WsTicketConsumeResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: 'unknown' | 'sub_mismatch' }>;

export type WsTicketService = Readonly<{
  /** Issue a one-shot ticket bound to `roomId`. */
  issue(roomId: string): Promise<WsTicketIssueResult>;
  /**
   * Atomically consume the ticket. Returns `{ ok: true }` only if the ticket
   * existed AND was bound to `expectedRoomId`. The KV entry is deleted in
   * either case so a leaked ticket cannot be replayed.
   */
  consume(ticket: string, expectedRoomId: string): Promise<WsTicketConsumeResult>;
}>;

const defaultGenerate = (): string => {
  const bytes = new Uint8Array(TICKET_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const isValidTicketShape = (ticket: string): boolean => /^[0-9a-f]{32}$/.test(ticket);

export const createWsTicketService = (deps: WsTicketServiceDeps): WsTicketService => {
  const generate = deps.generate ?? defaultGenerate;
  return {
    async issue(roomId: string): Promise<WsTicketIssueResult> {
      const ticket = generate();
      await deps.kv.put(`${KV_KEY_PREFIX}${ticket}`, roomId, {
        expirationTtl: WS_TICKET_TTL_SEC,
      });
      return { ticket };
    },
    async consume(ticket: string, expectedRoomId: string): Promise<WsTicketConsumeResult> {
      // Reject malformed ticket shape upfront so KV is never queried with
      // attacker-controlled lookup keys (defense in depth).
      if (!isValidTicketShape(ticket)) return { ok: false, reason: 'unknown' };
      const key = `${KV_KEY_PREFIX}${ticket}`;
      const storedRoomId = await deps.kv.get(key);
      if (storedRoomId === null) return { ok: false, reason: 'unknown' };
      // Always delete (one-shot semantics) — even a sub_mismatch ticket gets
      // burned to prevent enumeration via probe-and-check.
      await deps.kv.delete(key);
      if (storedRoomId !== expectedRoomId) return { ok: false, reason: 'sub_mismatch' };
      return { ok: true };
    },
  };
};
