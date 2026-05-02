import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SAMPLE_IMAGE_PATH = path.resolve(__dirname, 'sample.png');

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
  // base64 経由で binary を渡す。`Array.from(buffer)` 経由は大きい画像で
  // serialization コストが嵩むため base64 を選ぶ。
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
