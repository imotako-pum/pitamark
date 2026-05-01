import { issueRoomToken, type VerifyResult, verifyRoomToken } from '../lib/token';

export type TokenServiceDeps = {
  secret: string;
  now?: () => number;
};

export type TokenService = {
  issue(roomId: string): Promise<string>;
  verify(token: string, roomId: string): Promise<VerifyResult>;
};

export const createTokenService = (deps: TokenServiceDeps): TokenService => {
  const now = deps.now ?? Date.now;
  return {
    issue: (roomId) => issueRoomToken(roomId, deps.secret, now),
    verify: (token, roomId) => verifyRoomToken(token, roomId, deps.secret),
  };
};
