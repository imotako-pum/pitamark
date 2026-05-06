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
      // biome-ignore lint/style/noNonNullAssertion: index は [0,255] 範囲で常に定義済
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

/** 指定サイズの RGBA PNG を solid color でメモリ上に構築する。E2E が zoom/pan の
 *  clamp ロジックを実際に動かせる程度の画像サイズが必要な場面で使う (commit 済の
 *  sample.png は 1×1 で動かない)。 */
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
  // 各 scanline の filter byte = 0 (None) + raw RGBA pixels。
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x++) {
      const o = y * stride + 1 + x * 4;
      // biome-ignore lint/style/noNonNullAssertion: ハードコードされた tuple
      raw[o] = rgba[0]!;
      // biome-ignore lint/style/noNonNullAssertion: ハードコードされた tuple
      raw[o + 1] = rgba[1]!;
      // biome-ignore lint/style/noNonNullAssertion: ハードコードされた tuple
      raw[o + 2] = rgba[2]!;
      // biome-ignore lint/style/noNonNullAssertion: ハードコードされた tuple
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
 * invisible Turnstile widget の verification callback が走るまで `LocalEditor.handleLoad`
 * は早期 return + toast だけで、画像 drop は silently に無視される。`TurnstileWidget`
 * は callback 完了で container の `data-turnstile-status="ready"` を立てるので、その
 * 立ち上がりを待ってから drop / paste を発火する。site key 未設定 (status === 'disabled')
 * 経路では data attribute が立たないので 1s で諦め、本来の挙動 (gate 不要) に進む。
 */
async function waitForTurnstileGate(page: Page): Promise<void> {
  const widget = page.locator('[data-turnstile-status]');
  try {
    await widget.first().waitFor({ state: 'attached', timeout: 1_000 });
  } catch {
    // 'disabled' (site key 未設定) — widget が mount されない。すぐ drop に進む。
    return;
  }
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-turnstile-status]');
      const status = el?.getAttribute('data-turnstile-status');
      return status === 'ready' || status === 'error';
    },
    null,
    { timeout: 10_000 },
  );
}

/**
 * DropZone は drag&drop / paste / file-picker click のいずれでも画像を受け付ける
 * (apps/web/src/components/empty-state/DropZone.tsx)。E2E では `page.evaluateHandle`
 * で構築した DataTransfer を locator.dispatchEvent 経由で渡し、React の合成イベント
 * 機構に到達させる。
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

/** dropImage の buffer 版。file path ではなく in-memory buffer を受ける。zoom/pan テスト
 *  のように特定サイズの画像が必要な E2E (1×1 sample.png だと clampPan が動かない) で使う。 */
export async function dropImageBuffer(
  page: Page,
  buffer: Buffer,
  fileName: string,
  mimeType = 'image/png',
): Promise<void> {
  await waitForTurnstileGate(page);
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

  // dragOver → drop の順で dispatch することで、DropZone の handleDragOver で
  // setIsOver(true)、続く handleDrop で setIsOver(false) という想定経路を踏める。
  // `EditorPage` を `React.lazy()` boundary にしたため、`page.goto('/')` 直後は
  // Suspense fallback の状態。DropZone (LocalEditor 内) の visible を明示的に
  // 待つことで lazy chunk のロード待ちも担保する (低速 CI で flaky 発生していたため)。
  const dropZone = page.locator('section[aria-labelledby="dropzone-heading"]');
  await dropZone.waitFor({ state: 'visible', timeout: 10_000 });
  await dropZone.dispatchEvent('dragover', { dataTransfer });
  await dropZone.dispatchEvent('drop', { dataTransfer });
}

/** E2E の file-picker チェック自体に使うヘルパ — Turnstile gate も同時にくぐる。 */
export async function awaitUploadReady(page: Page): Promise<void> {
  await waitForTurnstileGate(page);
}
