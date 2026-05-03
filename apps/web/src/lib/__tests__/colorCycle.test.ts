import { describe, expect, it } from 'vitest';
import { COLOR_PALETTE } from '../../components/canvas/colors';
import { nextColor, prevColor } from '../colorCycle';

describe('nextColor', () => {
  it('returns palette[1] when active is palette[0]', () => {
    // biome-ignore lint/style/noNonNullAssertion: palette has fixed length > 1
    expect(nextColor(COLOR_PALETTE[0]!)).toBe(COLOR_PALETTE[1]);
  });

  it('wraps to palette[0] when active is the last color', () => {
    // biome-ignore lint/style/noNonNullAssertion: palette has fixed length > 1
    expect(nextColor(COLOR_PALETTE[COLOR_PALETTE.length - 1]!)).toBe(COLOR_PALETTE[0]);
  });

  it('returns palette[0] when active is not in palette', () => {
    expect(nextColor('#ffffff')).toBe(COLOR_PALETTE[0]);
  });
});

describe('prevColor', () => {
  it('wraps to palette[N-1] when active is palette[0]', () => {
    // biome-ignore lint/style/noNonNullAssertion: palette has fixed length > 1
    expect(prevColor(COLOR_PALETTE[0]!)).toBe(COLOR_PALETTE[COLOR_PALETTE.length - 1]);
  });

  it('returns palette[1] when active is palette[2]', () => {
    // biome-ignore lint/style/noNonNullAssertion: palette has fixed length > 2
    expect(prevColor(COLOR_PALETTE[2]!)).toBe(COLOR_PALETTE[1]);
  });

  it('returns palette[N-1] when active is not in palette', () => {
    expect(prevColor('#ffffff')).toBe(COLOR_PALETTE[COLOR_PALETTE.length - 1]);
  });
});
