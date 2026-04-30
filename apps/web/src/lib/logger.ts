// biome-ignore-all lint/suspicious/noConsole: this module is the single console wrapper for the web app; replace with a structured logger in Phase 5+.
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
