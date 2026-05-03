import { COLOR_PALETTE } from '../components/canvas/colors';

// active が COLOR_PALETTE に含まれない場合は -1 → next は palette[0]、prev は palette[末尾]。
// パレット外の色をユーザーが過去に選んだ(将来 RGB ピッカー導入時)ケースへの保険でもある。
const indexOf = (color: string): number => COLOR_PALETTE.indexOf(color);

export const nextColor = (active: string): string => {
  if (COLOR_PALETTE.length === 0) return active;
  const i = indexOf(active);
  const next = (i + 1) % COLOR_PALETTE.length;
  // biome-ignore lint/style/noNonNullAssertion: COLOR_PALETTE.length > 0 で next は必ず有効
  return COLOR_PALETTE[next]!;
};

export const prevColor = (active: string): string => {
  if (COLOR_PALETTE.length === 0) return active;
  const i = indexOf(active);
  // -1 (palette 外) と 0 (先頭) を同じく末尾へ巻き戻す。
  const prev = i <= 0 ? COLOR_PALETTE.length - 1 : i - 1;
  // biome-ignore lint/style/noNonNullAssertion: 同上
  return COLOR_PALETTE[prev]!;
};
