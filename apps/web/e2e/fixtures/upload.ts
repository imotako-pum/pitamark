import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import type { Page } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SAMPLE_IMAGE_PATH = path.resolve(__dirname, 'sample.png');

const crc32 = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return (buf: Uint8Array): number => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: index in [0,255] always defined
      c = table[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
})();

const writeChunk = (type: string, data: Uint8Array): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
};

/** Build an in-memory RGBA PNG of the given size with a solid color.
 *  Used by E2E to produce images large enough for zoom/pan clamping logic
 *  to actually move (the checked-in sample.png is 1×1). */
export const buildSolidPng = (
  width: number,
  height: number,
  rgba: [number, number, number, number] = [200, 200, 200, 255],
): Buffer => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace
  // Filter byte 0 (None) per scanline + raw RGBA pixels.
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x++) {
      const o = y * stride + 1 + x * 4;
      // biome-ignore lint/style/noNonNullAssertion: hardcoded tuple
      raw[o] = rgba[0]!;
      // biome-ignore lint/style/noNonNullAssertion: hardcoded tuple
      raw[o + 1] = rgba[1]!;
      // biome-ignore lint/style/noNonNullAssertion: hardcoded tuple
      raw[o + 2] = rgba[2]!;
      // biome-ignore lint/style/noNonNullAssertion: hardcoded tuple
      raw[o + 3] = rgba[3]!;
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    signature,
    writeChunk('IHDR', ihdr),
    writeChunk('IDAT', idat),
    writeChunk('IEND', Buffer.alloc(0)),
  ]);
};

/**
 * DropZone は <input type="file"> を持たず drag&drop / paste でのみ画像を
 * 受け付ける（apps/web/src/components/empty-state/DropZone.tsx）。E2E では
 * `page.evaluateHandle` で構築した DataTransfer を locator.dispatchEvent
 * 経由で渡し、React の合成イベント機構に到達させる。
 */
export async function dropImage(
  page: Page,
  filePath: string = SAMPLE_IMAGE_PATH,
  fileName = 'sample.png',
  mimeType = 'image/png',
): Promise<void> {
  const buffer = readFileSync(filePath);
  await dropImageBuffer(page, buffer, fileName, mimeType);
}

/** Same as dropImage but takes an in-memory buffer instead of a file path.
 *  Useful for E2E that needs a specific image size (e.g. zoom/pan tests
 *  where the 1×1 sample.png makes clampPan trivially zero out movement). */
export async function dropImageBuffer(
  page: Page,
  buffer: Buffer,
  fileName: string,
  mimeType = 'image/png',
): Promise<void> {
  const base64 = buffer.toString('base64');

  const dataTransfer = await page.evaluateHandle(
    ({ b64, name, type }) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], name, { type });
      const dt = new DataTransfer();
      dt.items.add(file);
      return dt;
    },
    { b64: base64, name: fileName, type: mimeType },
  );

  // dragOver と drop を順に dispatch すると DropZone の handleDragOver で
  // setIsOver(true) → handleDrop で setIsOver(false) という想定経路を踏める。
  const dropZone = page.locator('section[aria-labelledby="dropzone-heading"]');
  await dropZone.dispatchEvent('dragover', { dataTransfer });
  await dropZone.dispatchEvent('drop', { dataTransfer });
}
