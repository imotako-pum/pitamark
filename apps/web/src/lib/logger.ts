// biome-ignore-all lint/suspicious/noConsole: this module is the single console wrapper for the web app; the move to a structured logger (e.g. pino-browser) is parked for re-evaluation after Phase 9 dogfood — production traffic will determine whether the simplicity of console wins out.
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
