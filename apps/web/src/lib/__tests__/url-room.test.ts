import { describe, expect, it } from 'vitest';
import { buildRoomPath, parseRoomIdFromPath } from '../url-room';

describe('parseRoomIdFromPath', () => {
  it('returns the id for a valid /r/:nanoid path', () => {
    expect(parseRoomIdFromPath('/r/V1StGXR8_Z5jdHi6B-mYT')).toBe('V1StGXR8_Z5jdHi6B-mYT');
  });

  it('tolerates a trailing slash', () => {
    expect(parseRoomIdFromPath('/r/V1StGXR8_Z5jdHi6B-mYT/')).toBe('V1StGXR8_Z5jdHi6B-mYT');
  });

  it('returns null when the id is too short for the NanoID pattern', () => {
    expect(parseRoomIdFromPath('/r/short')).toBeNull();
  });

  it('returns null when the path lacks the /r/ prefix', () => {
    expect(parseRoomIdFromPath('/foo')).toBeNull();
    expect(parseRoomIdFromPath('/')).toBeNull();
  });

  it('returns null when characters are outside the NanoID alphabet', () => {
    expect(parseRoomIdFromPath('/r/!!!!!!!!!!!!!!!!!!!!!')).toBeNull();
  });
});

describe('buildRoomPath', () => {
  it('prefixes /r/ and round-trips with parseRoomIdFromPath', () => {
    const id = 'V1StGXR8_Z5jdHi6B-mYT';
    expect(buildRoomPath(id)).toBe(`/r/${id}`);
    expect(parseRoomIdFromPath(buildRoomPath(id))).toBe(id);
  });
});
