import type { Point } from '@snap-share/shared';

// Phase 7.8-1 Auto-next-A: 矢印終端から空 text を生成する位置の offset。矢印方向の
// 単位ベクトルに distance を掛けるシンプル設計で、矢印の延長線上に text が並ぶ。
// dogfood で 8/12/16 のどれが快適かは Phase 5 で再評価する。
export const AUTO_NEXT_TEXT_OFFSET_PX = 8;

const MIN_VECTOR_LENGTH = 1;

/**
 * Compute a small offset placed along the arrow's direction, used to position
 * the auto-next text annotation just past the arrow's tip.
 *
 * Falls back to `{x: distance, y: 0}` when the arrow is degenerate (length
 * below 1px). In practice MIN_DRAG_PIXELS=4 in CanvasStage already filters
 * out tiny arrows, but the fallback keeps this function safe in isolation
 * and unit-testable.
 */
export const computeAutoNextTextOffset = (from: Point, to: Point, distance: number): Point => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < MIN_VECTOR_LENGTH) {
    return { x: distance, y: 0 };
  }
  return {
    x: (dx / length) * distance,
    y: (dy / length) * distance,
  };
};
