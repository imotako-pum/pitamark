// biome-ignore-all lint/suspicious/noConsole: web app 唯一の console wrapper。pino-browser 等への移行は dogfood 後に判断保留中で、production trafic で console の単純さを取るか再評価する。
const PREFIX = '[web]';

type Meta = Record<string, unknown>;

export const logger = {
  info: (msg: string, meta?: Meta) =>
    meta ? console.info(PREFIX, msg, meta) : console.info(PREFIX, msg),
  warn: (msg: string, meta?: Meta) =>
    meta ? console.warn(PREFIX, msg, meta) : console.warn(PREFIX, msg),
  error: (msg: string, meta?: Meta) =>
    meta ? console.error(PREFIX, msg, meta) : console.error(PREFIX, msg),
};
