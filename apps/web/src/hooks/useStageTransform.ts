import { useCallback, useEffect, useRef, useState } from 'react';

export type StageTransform = Readonly<{ scale: number; x: number; y: number }>;
export type Size = Readonly<{ width: number; height: number }>;

// Zoom range bounds. 0.1 = 5000px 級画像が 500px のサムネイル並みに、8 = 1px が
// 8px に拡大できる。MAX を上げすぎるとリサイズハンドルがピクセル単位で跳ねる。
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;
// 1 wheel tick あたりのスケール乗数 (≒ 10%)。約 24 tick で fit (~0.4) → 100%、
// 約 18 tick で 100% → 5x。これ以上大きくするとマウスホイールがガクつく。
export const ZOOM_STEP = 1.1;
// 余白: 画像の各辺に画像サイズの 50% ずつ → 仮想領域 = 画像 2 倍 (PRD「200%」
// の解釈)。clampPan が pan 可能領域をこの virtual bounds 内に閉じ込める。
// dogfood 後に push があれば 1.0 (各辺 100% = 合計 3 倍) に拡張可能 — 本定数を
// 変えると pan の許容範囲が大きく変わる点に注意。
export const PAN_MARGIN_RATIO = 0.5;

const IDENTITY: StageTransform = { scale: 1, x: 0, y: 0 };

export const clampScale = (s: number): number => {
  if (!Number.isFinite(s)) return MAX_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
};

export const computeFitTransform = (image: Size, viewport: Size): StageTransform => {
  if (image.width <= 0 || image.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return IDENTITY;
  }
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height, 1);
  return {
    scale,
    x: (viewport.width - image.width * scale) / 2,
    y: (viewport.height - image.height * scale) / 2,
  };
};

export const computeHundredPercentTransform = (image: Size, viewport: Size): StageTransform => ({
  scale: 1,
  x: (viewport.width - image.width) / 2,
  y: (viewport.height - image.height) / 2,
});

export const zoomAtPointer = (
  transform: StageTransform,
  pointer: { x: number; y: number },
  factor: number,
): StageTransform => {
  const newScale = clampScale(transform.scale * factor);
  if (newScale === transform.scale) return transform;
  const mousePointTo = {
    x: (pointer.x - transform.x) / transform.scale,
    y: (pointer.y - transform.y) / transform.scale,
  };
  return {
    scale: newScale,
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };
};

// ---- multi-touch pinch helpers (Phase 10.I-2) ----
// Konva 公式 multi-touch sandbox の getDistance / getCenter / pinch 計算を純粋関数化
// したもの。CanvasStage の onTouchMove ハンドラからこれらを呼び出して transform を
// 更新する。ADR-0006 Status Update (Phase 10.I-2) 参照。

export const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number =>
  Math.hypot(p2.x - p1.x, p2.y - p1.y);

export const getCenter = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): { x: number; y: number } => ({
  x: (p1.x + p2.x) / 2,
  y: (p1.y + p2.y) / 2,
});

/**
 * pinch 入力 (中点 + scale 比 + pan delta) を 1 つの transform に集約する。
 * 既存 zoomAtPointer + panBy を別々に呼ぶと state flush タイミングで 2 回 setState
 * されるため、pinch 時は 1 setState に集約して描画 jitter を回避する。
 */
export const applyPinch = (
  transform: StageTransform,
  center: { x: number; y: number },
  distRatio: number,
  panDx: number,
  panDy: number,
): StageTransform => {
  const newScale = clampScale(transform.scale * distRatio);
  const pointTo = {
    x: (center.x - transform.x) / transform.scale,
    y: (center.y - transform.y) / transform.scale,
  };
  return {
    scale: newScale,
    x: center.x - pointTo.x * newScale + panDx,
    y: center.y - pointTo.y * newScale + panDy,
  };
};

const virtualBounds = (image: Size) => ({
  minX: -image.width * PAN_MARGIN_RATIO,
  minY: -image.height * PAN_MARGIN_RATIO,
  maxX: image.width * (1 + PAN_MARGIN_RATIO),
  maxY: image.height * (1 + PAN_MARGIN_RATIO),
});

export const clampPan = (
  transform: StageTransform,
  image: Size,
  viewport: Size,
): StageTransform => {
  const b = virtualBounds(image);
  const minScreenX = b.minX * transform.scale + transform.x;
  const maxScreenX = b.maxX * transform.scale + transform.x;
  const minScreenY = b.minY * transform.scale + transform.y;
  const maxScreenY = b.maxY * transform.scale + transform.y;
  let x = transform.x;
  let y = transform.y;
  if (maxScreenX < viewport.width) x += viewport.width - maxScreenX;
  if (minScreenX > 0) x -= minScreenX;
  if (maxScreenY < viewport.height) y += viewport.height - maxScreenY;
  if (minScreenY > 0) y -= minScreenY;
  return { scale: transform.scale, x, y };
};

export type UseStageTransform = Readonly<{
  transform: StageTransform;
  /** 画像が読み込まれた / 切り替わった瞬間に呼ぶ。null 渡しでリセット。*/
  setImageSize: (size: Size | null) => void;
  /** Cmd+0: viewport に fit。imageSize が null のときは no-op。*/
  fitToViewport: () => void;
  /** Cmd+1: 等倍。imageSize が null のときは no-op。*/
  setHundredPercent: () => void;
  /** Cmd+wheel / pinch: pointer 中心ズーム。*/
  zoomBy: (pointer: { x: number; y: number }, factor: number) => void;
  /** Space+drag: 直接的な position 加算 (clampPan を内部で適用)。*/
  panBy: (dx: number, dy: number) => void;
  /** multi-touch pinch (Phase 10.I-2): scale + position を atomic に適用する。
   *  applyPinch で計算した transform を渡すと clampPan を被せて 1 回だけ setState する。
   *  zoomBy + panBy を連続で呼ぶ場合の 2 段 setState による jitter を回避する用途。
   *  `prev => next` updater 形式を取ることで、pinch handler から最新 state ベースで
   *  applyPinch を計算できる (props 経由の transform は 1 render 古い)。 */
  setTransformDirect: (input: StageTransform | ((prev: StageTransform) => StageTransform)) => void;
}>;

export const useStageTransform = (viewport: Size): UseStageTransform => {
  const [transform, setTransform] = useState<StageTransform>(IDENTITY);
  const imageSizeRef = useRef<Size | null>(null);
  const viewportRef = useRef<Size>(viewport);
  viewportRef.current = viewport;

  const setImageSize = useCallback((size: Size | null) => {
    imageSizeRef.current = size;
    if (!size) {
      setTransform(IDENTITY);
      return;
    }
    setTransform(computeFitTransform(size, viewportRef.current));
  }, []);

  const fitToViewport = useCallback(() => {
    const img = imageSizeRef.current;
    if (!img) return;
    setTransform(computeFitTransform(img, viewportRef.current));
  }, []);

  const setHundredPercent = useCallback(() => {
    const img = imageSizeRef.current;
    if (!img) return;
    setTransform(computeHundredPercentTransform(img, viewportRef.current));
  }, []);

  const zoomBy = useCallback((pointer: { x: number; y: number }, factor: number) => {
    setTransform((prev) => {
      const img = imageSizeRef.current;
      const next = zoomAtPointer(prev, pointer, factor);
      return img ? clampPan(next, img, viewportRef.current) : next;
    });
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    setTransform((prev) => {
      const img = imageSizeRef.current;
      const moved: StageTransform = { scale: prev.scale, x: prev.x + dx, y: prev.y + dy };
      return img ? clampPan(moved, img, viewportRef.current) : moved;
    });
  }, []);

  const setTransformDirect = useCallback(
    (input: StageTransform | ((prev: StageTransform) => StageTransform)) => {
      setTransform((prev) => {
        const img = imageSizeRef.current;
        const next = typeof input === 'function' ? input(prev) : input;
        return img ? clampPan(next, img, viewportRef.current) : next;
      });
    },
    [],
  );

  // viewport 変化時は再 fit (画像表示中のみ)。Excalidraw も同挙動。`viewport`
  // オブジェクトが毎 render 新規作成されても再 fit ループに入らないよう、
  // 中身の width/height をプリミティブとして deps に取る。
  useEffect(() => {
    const img = imageSizeRef.current;
    if (!img) return;
    setTransform(computeFitTransform(img, { width: viewport.width, height: viewport.height }));
  }, [viewport.width, viewport.height]);

  return {
    transform,
    setImageSize,
    fitToViewport,
    setHundredPercent,
    zoomBy,
    panBy,
    setTransformDirect,
  };
};
