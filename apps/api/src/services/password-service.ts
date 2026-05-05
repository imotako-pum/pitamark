import type { RoomAuth } from '@pitamark/shared';
import { AppError } from '../lib/error';
import {
  base64UrlDecode,
  base64UrlEncode,
  constantTimeEqual,
  derivePbkdf2,
  generateSalt,
  PBKDF2_ITERATIONS,
} from '../lib/password';

export type PasswordService = {
  hash(password: string): Promise<RoomAuth>;
  verify(password: string, auth: RoomAuth): Promise<boolean>;
};

const MAX_PASSWORD_LEN = 256;

export const createPasswordService = (): PasswordService => ({
  async hash(password) {
    if (password.length === 0) {
      throw new AppError(400, 'INVALID_REQUEST', 'Password is empty');
    }
    if (password.length > MAX_PASSWORD_LEN) {
      throw new AppError(400, 'INVALID_REQUEST', 'Password too long');
    }
    const salt = generateSalt();
    const hashBytes = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
    return {
      algo: 'PBKDF2-SHA256',
      iterations: PBKDF2_ITERATIONS,
      salt: base64UrlEncode(salt),
      hash: base64UrlEncode(hashBytes),
    };
  },
  async verify(password, auth) {
    // Future-proof: only accept the algo we currently emit.
    if (auth.algo !== 'PBKDF2-SHA256') return false;
    if (password.length === 0 || password.length > MAX_PASSWORD_LEN) return false;
    let salt: Uint8Array;
    let expected: Uint8Array;
    try {
      salt = base64UrlDecode(auth.salt);
      expected = base64UrlDecode(auth.hash);
    } catch {
      return false;
    }
    const actual = await derivePbkdf2(password, salt, auth.iterations);
    return constantTimeEqual(actual, expected);
  },
});
