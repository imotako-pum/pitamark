import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/error';
import { createPasswordService } from '../password-service';

const svc = createPasswordService();

describe('passwordService.hash', () => {
  it('produces a RoomAuth envelope with PBKDF2-SHA256 algo', async () => {
    const auth = await svc.hash('correct horse');
    expect(auth.algo).toBe('PBKDF2-SHA256');
    // Cloudflare Workers (workerd) の PBKDF2 上限が 100k のため OWASP 600k は採れない。
    expect(auth.iterations).toBe(100_000);
    expect(auth.salt.length).toBeGreaterThan(0);
    expect(auth.hash.length).toBeGreaterThan(0);
    expect(auth.salt).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(auth.hash).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('uses a fresh salt on each call', async () => {
    const a = await svc.hash('same-password');
    const b = await svc.hash('same-password');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('throws AppError(400, INVALID_REQUEST) on empty password', async () => {
    await expect(svc.hash('')).rejects.toBeInstanceOf(AppError);
    await expect(svc.hash('')).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });

  it('throws AppError(400) on password longer than 256 chars', async () => {
    const tooLong = 'a'.repeat(257);
    await expect(svc.hash(tooLong)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });
});

describe('passwordService.verify', () => {
  it('returns true on matching password', async () => {
    const auth = await svc.hash('letmein');
    expect(await svc.verify('letmein', auth)).toBe(true);
  });

  it('returns false on wrong password', async () => {
    const auth = await svc.hash('letmein');
    expect(await svc.verify('wrong', auth)).toBe(false);
  });

  it('returns false on unknown algo (forward-compat)', async () => {
    const auth = await svc.hash('any');
    const tampered = { ...auth, algo: 'unknown-algo' as 'PBKDF2-SHA256' };
    expect(await svc.verify('any', tampered)).toBe(false);
  });

  it('returns false on corrupt salt/hash strings', async () => {
    const auth = await svc.hash('any');
    const corrupt = { ...auth, salt: 'A' };
    expect(await svc.verify('any', corrupt)).toBe(false);
  });

  it('returns false on empty/oversize candidate password', async () => {
    const auth = await svc.hash('letmein');
    expect(await svc.verify('', auth)).toBe(false);
    expect(await svc.verify('a'.repeat(257), auth)).toBe(false);
  });
});
