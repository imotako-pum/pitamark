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
  /** 画像の natural サイズ。指定時は toCanvas 中だけ stage transform をリセットし、
   *  user の zoom/pan に関係なく画像領域だけをネイティブ解像度で書き出す。
   *  null のときは従来の「stage 全体」capture に fallback する。 */
  imageSize?: { width: number; height: number } | null;
}>;

/**
 * memoized な async exporter を返す:
 *   1. awareness layer を hide (peer の cursor を焼き込まない)。
 *   2. stage transform を一時的にリセットして zoom/pan を出力に影響させない。
 *   3. `stage.toCanvas` で (画像領域に絞った) PNG Blob を生成。
 *   4. `pitamark-{roomId}-{timestamp}.png` で download をトリガ。
 *   5. `finally` で transform と awareness layer を復元。
 *
 * 失敗は `sonner` toast と `logger.warn` で表に出すので、caller 側で catch 不要。
 */
export const useExportPng = ({
  stageRef,
  awarenessLayerRef,
  roomId,
  pixelRatio = 2,
  imageSize = null,
}: UseExportPngParams): (() => Promise<void>) => {
  const t = useTranslation();
  // 翻訳関数を ref で保持して、export callback の deps に `t` を入れずに済ませる
  // (`t` は言語切替の度に identity が変わる)。toast は発火時点の最新言語を引く。
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
        // mutated フラグを setter より前に立てておく。setter のいずれかが throw しても
        // partial mutation が `finally` の restore 経路に流れる。Konva setter は実際には
        // throw しないが、この順序にしておくことで cliff を消せる。
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
