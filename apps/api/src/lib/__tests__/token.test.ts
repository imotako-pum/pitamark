import { describe, expect, it } from 'vitest';
import { createTokenService } from '../../services/token-service';
import { extractBearerToken, issueRoomToken, TOKEN_TTL_SEC, verifyRoomToken } from '../token';

const SECRET = 'test-secret-32-bytes-min-padding-aaa';
const ROOM = 'V1StGXR8_Z5jdHi6B-mYT';

describe('issueRoomToken / verifyRoomToken', () => {
  it('round-trips a fresh token to ok:true with matching sub', async () => {
    const tok = await issueRoomToken(ROOM, SECRET);
    const r = await verifyRoomToken(tok, ROOM, SECRET);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.sub).toBe(ROOM);
      expect(r.payload.exp).toBeGreaterThan(r.payload.iat);
      expect(r.payload.exp - r.payload.iat).toBe(TOKEN_TTL_SEC);
    }
  });

  it('returns sub_mismatch when verifying for a different roomId', async () => {
    const tok = await issueRoomToken(ROOM, SECRET);
    const r = await verifyRoomToken(tok, 'OtherR8_Z5jdHi6B-myZ', SECRET);
    expect(r).toEqual({ ok: false, reason: 'sub_mismatch' });
  });

  it('returns invalid when verified with a different secret', async () => {
    const tok = await issueRoomToken(ROOM, SECRET);
    const r = await verifyRoomToken(tok, ROOM, 'a-completely-different-32byte-secret!');
    expect(r).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns expired when current time exceeds exp', async () => {
    // iat = 0; exp = TOKEN_TTL_SEC. By Date.now() time, exp is in the past.
    const tok = await issueRoomToken(ROOM, SECRET, () => 0);
    const r = await verifyRoomToken(tok, ROOM, SECRET);
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });

  it('returns invalid on garbage tokens', async () => {
    const r = await verifyRoomToken('not-a-jwt', ROOM, SECRET);
    expect(r).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('extractBearerToken', () => {
  it('returns the token portion of a Bearer header', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });
  it('is case-insensitive on the scheme', () => {
    expect(extractBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi');
  });
  it('returns null when header is missing', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
  });
  it('returns null when scheme is not Bearer', () => {
    expect(extractBearerToken('Basic abc')).toBeNull();
  });
});

describe('createTokenService', () => {
  it('issue → verify happy path', async () => {
    const svc = createTokenService({ secret: SECRET });
    const tok = await svc.issue(ROOM);
    const r = await svc.verify(tok, ROOM);
    expect(r.ok).toBe(true);
  });

  it('uses injected now() to control iat', async () => {
    const svc = createTokenService({ secret: SECRET, now: () => 0 });
    const tok = await svc.issue(ROOM);
    const r = await svc.verify(tok, ROOM);
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });
});
