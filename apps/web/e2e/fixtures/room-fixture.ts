import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIRequestContext } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_IMAGE_PATH = path.resolve(__dirname, 'sample.png');
const API_BASE = 'http://localhost:8787';

// Phase 11 (E2E flake fix): touch-acceptance suite が 12 cases を mobile-chrome 並列で
// 実行する際、`page.goto('/') → dropImage → POST /rooms → /r/{id}` redirect が
// webServer の API negotiation 滞留で 20s timeout していた flake の根本対処。UI 経路を
// bypass し、API 直叩きで room を作成 → `/r/{id}` に直 navigate することで、landing
// → upload → redirect の依存を排除する。`BYPASS_TURNSTILE` / `BYPASS_RATE_LIMIT` は
// `global-setup.ts` が `.dev.vars` に書く前提。
export const createRoomViaApi = async (
  request: APIRequestContext,
  options: {
    /** in-memory buffer を直接渡す。`buildSolidPng()` のような動的生成画像の経路で使う。 */
    buffer?: Buffer;
    /** ファイルパス指定。省略 + buffer 省略時は `fixtures/sample.png` (1×1) を使う。 */
    imagePath?: string;
    fileName?: string;
    mimeType?: string;
  } = {},
): Promise<{ id: string }> => {
  const fileName = options.fileName ?? 'sample.png';
  const mimeType = options.mimeType ?? 'image/png';
  const buffer = options.buffer ?? readFileSync(options.imagePath ?? SAMPLE_IMAGE_PATH);

  const response = await request.post(`${API_BASE}/rooms`, {
    multipart: {
      image: { name: fileName, mimeType, buffer },
      'cf-turnstile-response': 'ok',
    },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`createRoomViaApi: POST /rooms failed (${response.status()}): ${body}`);
  }
  const json = (await response.json()) as { id?: string };
  if (!json.id) {
    throw new Error(`createRoomViaApi: response missing id: ${JSON.stringify(json)}`);
  }
  return { id: json.id };
};
