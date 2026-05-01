import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from '@snap-share/shared';
import { describe, expect, it } from 'vitest';
import { validateImageFile } from '../imageValidation';

const makeFile = (name: string, type: string, size: number): File => {
  const data = new Uint8Array(size);
  return new File([data], name, { type });
};

describe('validateImageFile', () => {
  it('accepts a small PNG and returns content type + bytes', () => {
    const file = makeFile('a.png', 'image/png', 2048);
    const result = validateImageFile(file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contentType).toBe('image/png');
      expect(result.bytes).toBe(2048);
    }
  });

  it.each(ALLOWED_IMAGE_MIME_TYPES)('accepts %s as a valid image MIME', (mime) => {
    const file = makeFile('a', mime, 100);
    const result = validateImageFile(file);

    expect(result.ok).toBe(true);
  });

  it('rejects non-image MIME types with a Japanese error message', () => {
    const file = makeFile('virus.exe', 'application/x-msdownload', 100);
    const result = validateImageFile(file);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/画像/);
    }
  });

  it('rejects an image-prefixed but non-allowed MIME (e.g. image/gif)', () => {
    const file = makeFile('a.gif', 'image/gif', 100);
    const result = validateImageFile(file);

    expect(result.ok).toBe(false);
  });

  it('accepts a file exactly at the size limit', () => {
    const file = makeFile('big.png', 'image/png', MAX_IMAGE_BYTES);
    const result = validateImageFile(file);

    expect(result.ok).toBe(true);
  });

  it('rejects a file 1 byte over the size limit', () => {
    const file = makeFile('big.png', 'image/png', MAX_IMAGE_BYTES + 1);
    const result = validateImageFile(file);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/10MB|サイズ|大きすぎ/);
    }
  });
});
