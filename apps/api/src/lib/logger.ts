// biome-ignore-all lint/suspicious/noConsole: this module is the single console wrapper for the api; the move to a structured logger (e.g. pino with Workers transport) is parked for re-evaluation after Phase 9 dogfood — production traffic will determine the cost/benefit.
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
