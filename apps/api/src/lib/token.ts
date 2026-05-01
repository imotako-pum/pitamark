// HMAC-SHA256 JWT helpers for room-bound short-lived tokens. Wraps `hono/jwt`
// so the rest of the codebase deals with `(roomId, secret)` and `Result<...>`
// instead of raw JWT plumbing.

import { sign, verify } from 'hono/utils/jwt/jwt';
import { JwtTokenExpired } from 'hono/utils/jwt/types';

export const TOKEN_TTL_SEC = 24 * 60 * 60; // 24 hours

export type TokenPayload = {
  sub: string;
  exp: number;
  iat: number;
};

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'expired' | 'invalid' | 'sub_mismatch' };

export const issueRoomToken = async (
  roomId: string,
  secret: string,
  now: () => number = Date.now,
): Promise<string> => {
  const iat = Math.floor(now() / 1000);
  const payload: TokenPayload = { sub: roomId, exp: iat + TOKEN_TTL_SEC, iat };
  return sign(payload, secret, 'HS256');
};

export const verifyRoomToken = async (
  token: string,
  expectedRoomId: string,
  secret: string,
): Promise<VerifyResult> => {
  let payload: unknown;
  try {
    payload = await verify(token, secret, 'HS256');
  } catch (e) {
    if (e instanceof JwtTokenExpired) return { ok: false, reason: 'expired' };
    return { ok: false, reason: 'invalid' };
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as Record<string, unknown>).sub !== 'string' ||
    typeof (payload as Record<string, unknown>).exp !== 'number' ||
    typeof (payload as Record<string, unknown>).iat !== 'number'
  ) {
    return { ok: false, reason: 'invalid' };
  }
  const typed = payload as TokenPayload;
  if (typed.sub !== expectedRoomId) return { ok: false, reason: 'sub_mismatch' };
  return { ok: true, payload: typed };
};

/**
 * Extract Bearer token from an Authorization header.
 * Returns null if header is missing or malformed.
 */
export const extractBearerToken = (authorization: string | undefined | null): string | null => {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match ? (match[1]?.trim() ?? null) : null;
};
