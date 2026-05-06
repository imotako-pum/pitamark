// WebSocket は Authorization header を送れないので、upgrade 時の認証は query param
// しか選択肢が無い。長寿命 24h JWT を platform 側の access log (`wrangler tail`,
// CDN log) に残さないため、protected room は JWT を KV 上の one-shot 60 秒 ticket
// に交換する。ticket は roomId に bind され、WS upgrade で verify した瞬間に削除
// されるので、60 秒を超えた URL 漏洩で再 access はできない。unprotected room は
// ticket 不要 (代わりに RL_SYNC で gate する)。
//
// `KVNamespace` は Workers runtime の global ambient 型で、明示 import しないことで
// workspace 依存グラフ越しに web 側 tsconfig からも compile できるようにしている。
//
// Cloudflare KV の `expirationTtl` 最小値は 60 秒 (production + miniflare ともに
// それ未満は 400)。実際の init 流れは秒オーダーなので、正常系に対しては 60 秒でも
// 余裕すぎる窓。consume burn の方で実効 lifetime を「最初の WS upgrade まで」に
// 抑えている。

const TICKET_BYTES = 16; // 128 bit → 32 hex 文字。60 秒で総当たりは現実的に不可能。
export const WS_TICKET_TTL_SEC = 60;
const KV_KEY_PREFIX = 'ws-ticket:';

export type WsTicketServiceDeps = Readonly<{
  kv: KVNamespace;
  /** テスト用の決定論的 ticket 生成 override。 */
  generate?: () => string;
}>;

export type WsTicketIssueResult = Readonly<{ ticket: string }>;

export type WsTicketConsumeResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: 'unknown' | 'sub_mismatch' }>;

export type WsTicketService = Readonly<{
  /** `roomId` に bind した one-shot ticket を発行する。 */
  issue(roomId: string): Promise<WsTicketIssueResult>;
  /**
   * ticket を atomic に consume する。`{ ok: true }` を返すのは、ticket が存在して
   * かつ `expectedRoomId` に bind されていたときのみ。KV entry はどちらの結果でも
   * 削除するので、漏れた ticket は replay できない。
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
      // shape が malformed な ticket は upfront で拒否し、attacker-controlled lookup
      // key で KV を叩かせない (defense-in-depth)。
      if (!isValidTicketShape(ticket)) return { ok: false, reason: 'unknown' };
      const key = `${KV_KEY_PREFIX}${ticket}`;
      const storedRoomId = await deps.kv.get(key);
      if (storedRoomId === null) return { ok: false, reason: 'unknown' };
      // 結果に関係なく必ず削除 (one-shot semantics)。sub_mismatch でも burn する
      // ことで、probe-and-check による列挙を防ぐ。
      await deps.kv.delete(key);
      if (storedRoomId !== expectedRoomId) return { ok: false, reason: 'sub_mismatch' };
      return { ok: true };
    },
  };
};
