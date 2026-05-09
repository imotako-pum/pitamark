import type { Page } from '@playwright/test';
import { createRoomViaApi } from './room-fixture';

export const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

// Phase 11 (E2E flake fix): UI 経路 (page.goto('/') → dropImage → POST /rooms →
// /r/{id} redirect) を bypass し、API 直叩きで room を作成 → /r/{id} に直 navigate
// する汎用 editor setup。touch-helpers の `setupEditor` を非 touch spec でも使える
// よう一般化したもの。
//
// 対象は「DropZone / Turnstile gate / Upload flow 自体を verify しない」
// spec (annotation-color / font-size / keyboard-shortcuts / auto-next 系 など)。
// upload flow を verify する spec (room-create / dropzone-validation /
// room-uploader-gate-skip 等) は本 helper を使わず従来 dropImage 経路を維持する。
export const setupEditorViaApi = async (
  page: Page,
  options: { buffer?: Buffer; fileName?: string; mimeType?: string } = {},
): Promise<{ id: string }> => {
  const { id } = await createRoomViaApi(page.request, options);
  await page.goto(`/r/${id}`);
  await page.waitForFunction(
    (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
    ANNOTATIONS_KEY,
    { timeout: 10_000 },
  );
  return { id };
};
