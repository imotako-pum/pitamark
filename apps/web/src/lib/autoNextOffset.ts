import type { Point } from '@pitamark/shared';

// Auto-next-A で矢印終端から空 text を生成する位置の offset。矢印方向の単位ベクトルに
// distance を掛けるシンプル設計で、矢印の延長線上に text が並ぶ。8/12/16 のどれが
// 快適かは dogfood で再評価する。
export const AUTO_NEXT_TEXT_OFFSET_PX = 8;

const MIN_VECTOR_LENGTH = 1;

/**
 * 矢印方向に置く小さな offset を計算する。auto-next の text annotation を矢印先端の
 * すぐ先に配置するのに使う。
 *
 * 矢印が degenerate (長さ 1px 未満) のときは `{x: distance, y: 0}` に fallback。
 * CanvasStage の MIN_DRAG_PIXELS=4 で実用上は弾かれるが、関数単体で安全 + unit
 * test 可能な状態を保つために fallback を残す。
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
