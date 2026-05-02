import { describe, expect, it, vi } from 'vitest';
import { createTurnstileService } from '../turnstile-service';

const okResponse = (body: object): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('createTurnstileService', () => {
  it('returns ok without contacting siteverify when bypass is true', async () => {
    const fetchSpy = vi.fn(async () => okResponse({ success: true }));
    const svc = createTurnstileService({ secret: '', bypass: true, fetch: fetchSpy });

    const result = await svc.verify({ token: 'anything' });

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns ok when siteverify success is true', async () => {
    const fetchSpy = vi.fn(async () => okResponse({ success: true }));
    const svc = createTurnstileService({ secret: 'secret', bypass: false, fetch: fetchSpy });

    const result = await svc.verify({ token: 'good' });

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('returns invalid when siteverify success is false', async () => {
    const fetchSpy = vi.fn(async () =>
      okResponse({ success: false, 'error-codes': ['invalid-input-response'] }),
    );
    const svc = createTurnstileService({ secret: 'secret', bypass: false, fetch: fetchSpy });

    const result = await svc.verify({ token: 'bad' });

    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns network when fetch throws', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('connection reset');
    });
    const svc = createTurnstileService({ secret: 'secret', bypass: false, fetch: fetchSpy });

    const result = await svc.verify({ token: 'whatever' });

    expect(result).toEqual({ ok: false, reason: 'network' });
  });

  it('passes an AbortSignal to fetch so siteverify cannot hang the request', async () => {
    const fetchSpy = vi.fn(async (_: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return okResponse({ success: true });
    });
    const svc = createTurnstileService({ secret: 'secret', bypass: false, fetch: fetchSpy });

    const result = await svc.verify({ token: 'token' });

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('returns misconfigured when bypass is false and secret is empty', async () => {
    const fetchSpy = vi.fn(async () => okResponse({ success: true }));
    const svc = createTurnstileService({ secret: '', bypass: false, fetch: fetchSpy });

    const result = await svc.verify({ token: 'whatever' });

    expect(result).toEqual({ ok: false, reason: 'misconfigured' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forwards remoteIp to siteverify body when provided', async () => {
    const fetchSpy = vi.fn(async (_: string | URL | Request, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      expect(body.get('remoteip')).toBe('1.2.3.4');
      expect(body.get('secret')).toBe('secret');
      expect(body.get('response')).toBe('token');
      return okResponse({ success: true });
    });
    const svc = createTurnstileService({ secret: 'secret', bypass: false, fetch: fetchSpy });

    await svc.verify({ token: 'token', remoteIp: '1.2.3.4' });

    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
