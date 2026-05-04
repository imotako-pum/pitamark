// Phase 8.x security review #13 H1: tests for the WS ticket exchange.

import { describe, expect, it } from 'vitest';
import { createInMemoryKv } from '../../__tests__/helpers/in-memory-kv';
import { createWsTicketService, WS_TICKET_TTL_SEC } from '../ws-ticket-service';

const ROOM_ID = 'test-room-V1StGXR8';

describe('createWsTicketService.issue', () => {
  it('returns a 32 hex char ticket bound to the roomId in KV', async () => {
    const kv = createInMemoryKv();
    const svc = createWsTicketService({ kv });

    const { ticket } = await svc.issue(ROOM_ID);

    expect(ticket).toMatch(/^[0-9a-f]{32}$/);
    // Stored under `ws-ticket:<ticket>` with the roomId as value.
    const stored = await kv.get(`ws-ticket:${ticket}`);
    expect(stored).toBe(ROOM_ID);
  });

  it('uses the injected generator (deterministic test mode)', async () => {
    const kv = createInMemoryKv();
    const svc = createWsTicketService({
      kv,
      generate: () => 'a'.repeat(32),
    });

    const { ticket } = await svc.issue(ROOM_ID);

    expect(ticket).toBe('a'.repeat(32));
  });

  it('uses a 30s TTL so ticket cannot be replayed indefinitely', async () => {
    let now = 1_000_000;
    const kv = createInMemoryKv({}, { now: () => now });
    const svc = createWsTicketService({
      kv,
      generate: () => 'b'.repeat(32),
    });
    await svc.issue(ROOM_ID);

    // Just before TTL: still valid.
    now += (WS_TICKET_TTL_SEC - 1) * 1000;
    expect(await kv.get(`ws-ticket:${'b'.repeat(32)}`)).toBe(ROOM_ID);

    // Past TTL: KV returns null.
    now += 2_000;
    expect(await kv.get(`ws-ticket:${'b'.repeat(32)}`)).toBeNull();
  });
});

describe('createWsTicketService.consume', () => {
  it('returns ok and burns the ticket on success', async () => {
    const kv = createInMemoryKv();
    const svc = createWsTicketService({
      kv,
      generate: () => 'c'.repeat(32),
    });
    const { ticket } = await svc.issue(ROOM_ID);

    const result = await svc.consume(ticket, ROOM_ID);

    expect(result).toEqual({ ok: true });
    // Replay must fail.
    const replay = await svc.consume(ticket, ROOM_ID);
    expect(replay).toEqual({ ok: false, reason: 'unknown' });
  });

  it('returns sub_mismatch when ticket is bound to a different roomId — and still burns it', async () => {
    const kv = createInMemoryKv();
    const svc = createWsTicketService({
      kv,
      generate: () => 'd'.repeat(32),
    });
    const { ticket } = await svc.issue(ROOM_ID);

    const result = await svc.consume(ticket, 'other-room');

    expect(result).toEqual({ ok: false, reason: 'sub_mismatch' });
    // Probe-and-check enumeration is closed: the ticket must not survive.
    const stored = await kv.get(`ws-ticket:${ticket}`);
    expect(stored).toBeNull();
  });

  it('returns unknown for tickets that never existed without touching KV.delete', async () => {
    const kv = createInMemoryKv();
    const svc = createWsTicketService({ kv });

    const result = await svc.consume('e'.repeat(32), ROOM_ID);

    expect(result).toEqual({ ok: false, reason: 'unknown' });
  });

  it('rejects malformed ticket shapes without contacting KV', async () => {
    const kv = createInMemoryKv();
    const svc = createWsTicketService({ kv });

    const tooShort = await svc.consume('abc', ROOM_ID);
    const wrongChars = await svc.consume('Z'.repeat(32), ROOM_ID);
    const tooLong = await svc.consume('a'.repeat(64), ROOM_ID);

    expect(tooShort).toEqual({ ok: false, reason: 'unknown' });
    expect(wrongChars).toEqual({ ok: false, reason: 'unknown' });
    expect(tooLong).toEqual({ ok: false, reason: 'unknown' });
  });

  it('returns unknown after the TTL elapses', async () => {
    let now = 5_000_000;
    const kv = createInMemoryKv({}, { now: () => now });
    const svc = createWsTicketService({
      kv,
      generate: () => 'f'.repeat(32),
    });
    const { ticket } = await svc.issue(ROOM_ID);

    now += (WS_TICKET_TTL_SEC + 5) * 1000;

    const result = await svc.consume(ticket, ROOM_ID);
    expect(result).toEqual({ ok: false, reason: 'unknown' });
  });
});
