import type Konva from 'konva';
import { type RefObject, useCallback } from 'react';
import { toast } from 'sonner';
import { buildExportFilename, stageToBlob, triggerDownload } from '../lib/exportPng';
import { logger } from '../lib/logger';

export type UseExportPngParams = Readonly<{
  stageRef: RefObject<Konva.Stage | null>;
  awarenessLayerRef?: RefObject<Konva.Layer | null>;
  roomId: string | null;
  pixelRatio?: number;
}>;

/**
 * Returns a memoized async exporter that:
 *   1. Hides the awareness layer (so peer cursors are not baked in).
 *   2. Renders the stage to a PNG Blob via `stage.toCanvas`.
 *   3. Triggers a download with `snap-share-{roomId}-{timestamp}.png`.
 *   4. Restores the awareness layer in `finally`, even on failure.
 *
 * Failures are surfaced through `sonner` toasts and `logger.warn`; the caller
 * should not need to catch them.
 */
export const useExportPng = ({
  stageRef,
  awarenessLayerRef,
  roomId,
  pixelRatio = 2,
}: UseExportPngParams): (() => Promise<void>) => {
  return useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    const awareness = awarenessLayerRef?.current ?? null;

    let hidden = false;
    try {
      awareness?.hide();
      hidden = true;
      const blob = await stageToBlob(stage, pixelRatio);
      triggerDownload(blob, buildExportFilename(new Date(), roomId));
      toast.success('PNG を保存しました');
    } catch (e: unknown) {
      logger.warn('export failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      toast.error('PNG の保存に失敗しました');
    } finally {
      if (hidden) awareness?.show();
    }
  }, [stageRef, awarenessLayerRef, roomId, pixelRatio]);
};
