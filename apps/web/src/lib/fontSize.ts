import { MAX_FONT_SIZE } from '@pitamark/shared';

// Schema は positive(>0) のみで min を持たない。dogfood 時に「画像 30% 縮小でも
// 読める下限」目安として 8 を採用。極小フォントの暴発を UI 側でクランプする。
export const MIN_FONT_SIZE = 8;
export { MAX_FONT_SIZE };
// Photoshop と同じ ±2 ステップ。dogfood で 1 / 2 / 4 を再評価する余地。
export const FONT_SIZE_STEP = 2;

export const clampFontSize = (size: number): number =>
  Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)));

export const incrementFontSize = (current: number): number =>
  clampFontSize(current + FONT_SIZE_STEP);

export const decrementFontSize = (current: number): number =>
  clampFontSize(current - FONT_SIZE_STEP);
