import { describe, expect, it } from 'vitest';
import {
  clampFontSize,
  decrementFontSize,
  FONT_SIZE_STEP,
  incrementFontSize,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
} from '../fontSize';

describe('clampFontSize', () => {
  it('returns the same value when within bounds', () => {
    expect(clampFontSize(18)).toBe(18);
  });

  it('clamps below MIN_FONT_SIZE up to the floor', () => {
    expect(clampFontSize(MIN_FONT_SIZE - 1)).toBe(MIN_FONT_SIZE);
    expect(clampFontSize(0)).toBe(MIN_FONT_SIZE);
    expect(clampFontSize(-50)).toBe(MIN_FONT_SIZE);
  });

  it('clamps above MAX_FONT_SIZE down to the ceiling', () => {
    expect(clampFontSize(MAX_FONT_SIZE + 1)).toBe(MAX_FONT_SIZE);
    expect(clampFontSize(9999)).toBe(MAX_FONT_SIZE);
  });

  it('rounds non-integer inputs to the nearest integer', () => {
    expect(clampFontSize(18.7)).toBe(19);
    expect(clampFontSize(18.4)).toBe(18);
  });
});

describe('incrementFontSize', () => {
  it('adds FONT_SIZE_STEP within bounds', () => {
    expect(incrementFontSize(18)).toBe(18 + FONT_SIZE_STEP);
  });

  it('clamps to MAX_FONT_SIZE at the ceiling', () => {
    expect(incrementFontSize(MAX_FONT_SIZE)).toBe(MAX_FONT_SIZE);
    expect(incrementFontSize(MAX_FONT_SIZE - 1)).toBe(MAX_FONT_SIZE);
  });
});

describe('decrementFontSize', () => {
  it('subtracts FONT_SIZE_STEP within bounds', () => {
    expect(decrementFontSize(18)).toBe(18 - FONT_SIZE_STEP);
  });

  it('clamps to MIN_FONT_SIZE at the floor', () => {
    expect(decrementFontSize(MIN_FONT_SIZE)).toBe(MIN_FONT_SIZE);
    expect(decrementFontSize(MIN_FONT_SIZE + 1)).toBe(MIN_FONT_SIZE);
  });
});
