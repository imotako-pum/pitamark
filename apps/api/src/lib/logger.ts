// biome-ignore-all lint/suspicious/noConsole: api 唯一の console wrapper。pino + Workers transport 等への移行は dogfood 後に判断保留中で、production trafic でコスト / 効果を再評価する。
const PREFIX = '[api]';

type Meta = Record<string, unknown>;

export const logger = {
  info: (msg: string, meta?: Meta) =>
    meta ? console.info(PREFIX, msg, meta) : console.info(PREFIX, msg),
  warn: (msg: string, meta?: Meta) =>
    meta ? console.warn(PREFIX, msg, meta) : console.warn(PREFIX, msg),
  error: (msg: string, meta?: Meta) =>
    meta ? console.error(PREFIX, msg, meta) : console.error(PREFIX, msg),
};
