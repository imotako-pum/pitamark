import type { Point, RectangleAnnotation } from '@pitamark/shared';

// Auto-next-B で矩形確定時に出す既定矢印プレビューの長さ。右下 45° 方向にこの距離
// だけ tail (to) を伸ばす。長すぎ/短すぎは dogfood で再評価する。
export const AUTO_ARROW_DEFAULT_LENGTH_PX = 100;

/**
 * 矩形に対する既定 auto-arrow の端点を計算する: arrowhead は矩形右辺の中点、
 * tail はそこから右下 45° 方向に 100px 伸ばした位置。
 *
 * 返り値の `from` は arrowhead 側 (矩形右辺中点)、`to` は tail 側。`<KonvaArrow>` 側で
 * `pointerAtBeginning` を立てているため、from に矢じり / to に尾という対応になる。
 * 後続の Auto-next-A 連鎖は `to + offset` の位置に auto-text を配置する (= 矩形から
 * 更に離れた、ユーザの読み進む向き)。
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
