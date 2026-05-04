import type { Point, RectangleAnnotation } from '@snap-share/shared';

// Phase 7.8-2 Auto-next-B: 矩形確定時の既定矢印プレビューの長さ。右下 45° 方向に
// この距離だけ尾(to)を伸ばす。dogfood で長すぎ/短すぎが出れば Phase 5 で再評価。
export const AUTO_ARROW_DEFAULT_LENGTH_PX = 100;

/**
 * Compute the default auto-arrow endpoints for a rectangle: arrowhead anchored
 * at the rectangle's right-edge midpoint, tail extending 100px down-right at 45°.
 *
 * Returns `{ from, to }` where `from` is the arrowhead side (rectangle right-edge
 * midpoint, since Phase 7.8-1 set `pointerAtBeginning` on `<KonvaArrow>`) and
 * `to` is the tail side. The Auto-next-A chain then places the auto-text along
 * `to + offset` (= further away from the rectangle, in the user's reading flow).
 */
export const computeAutoArrowDefault = (
  rect: Pick<RectangleAnnotation, 'x' | 'y' | 'width' | 'height'>,
): { from: Point; to: Point } => {
  const arrowHead: Point = {
    x: rect.x + rect.width,
    y: rect.y + rect.height / 2,
  };
  const tailExtension = AUTO_ARROW_DEFAULT_LENGTH_PX / Math.SQRT2;
  const tail: Point = {
    x: arrowHead.x + tailExtension,
    y: arrowHead.y + tailExtension,
  };
  return { from: arrowHead, to: tail };
};
