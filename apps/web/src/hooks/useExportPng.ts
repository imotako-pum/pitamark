import type Konva from 'konva';
import { type RefObject, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '../i18n';
import { buildExportFilename, stageToBlob, triggerDownload } from '../lib/exportPng';
import { logger } from '../lib/logger';

export type UseExportPngParams = Readonly<{
  stageRef: RefObject<Konva.Stage | null>;
  awarenessLayerRef?: RefObject<Konva.Layer | null>;
  roomId: string | null;
  pixelRatio?: number;
  /** Image natural dimensions. When provided, the export captures only the
   *  image region at native resolution (regardless of the user's zoom/pan)
   *  by temporarily resetting the stage transform during toCanvas.
   *  When null, falls back to the legacy "whole stage" capture. */
  imageSize?: { width: number; height: number } | null;
}>;

/**
 * Returns a memoized async exporter that:
 *   1. Hides the awareness layer (so peer cursors are not baked in).
 *   2. Temporarily resets stage transform so zoom/pan don't affect output.
 *   3. Renders the (image-bounded) region to a PNG Blob via `stage.toCanvas`.
 *   4. Triggers a download with `snap-share-{roomId}-{timestamp}.png`.
 *   5. Restores transform and the awareness layer in `finally`.
 *
 * Failures are surfaced through `sonner` toasts and `logger.warn`; the caller
 * should not need to catch them.
 */
export const useExportPng = ({
  stageRef,
  awarenessLayerRef,
  roomId,
  pixelRatio = 2,
  imageSize = null,
}: UseExportPngParams): (() => Promise<void>) => {
  const t = useTranslation();
  // Translation function via ref so the export callback's deps don't include
  // `t` (which changes identity on every lang switch). Toast messages always
  // pull the **current** language at the time the toast fires.
  const tRef = useRef(t);
  tRef.current = t;
  return useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    const awareness = awarenessLayerRef?.current ?? null;

    const savedScaleX = stage.scaleX();
    const savedScaleY = stage.scaleY();
    const savedX = stage.x();
    const savedY = stage.y();

    let hidden = false;
    let mutated = false;
    try {
      awareness?.hide();
      hidden = true;
      if (imageSize) {
        // Set the flag BEFORE the setters so a partial mutation (any of these
        // throwing) still triggers the restore branch in `finally`. Konva
        // setters don't throw in practice, but the ordering removes the cliff.
        mutated = true;
        stage.scaleX(1);
        stage.scaleY(1);
        stage.x(0);
        stage.y(0);
      }
      const bounds = imageSize
        ? { x: 0, y: 0, width: imageSize.width, height: imageSize.height }
        : undefined;
      const blob = await stageToBlob(stage, pixelRatio, bounds);
      triggerDownload(blob, buildExportFilename(new Date(), roomId));
      toast.success(tRef.current('toast.export.success'));
    } catch (e: unknown) {
      logger.warn('export failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      toast.error(tRef.current('toast.export.error'));
    } finally {
      if (mutated) {
        stage.scaleX(savedScaleX);
        stage.scaleY(savedScaleY);
        stage.x(savedX);
        stage.y(savedY);
        stage.batchDraw();
      }
      if (hidden) awareness?.show();
    }
  }, [stageRef, awarenessLayerRef, roomId, pixelRatio, imageSize]);
};
