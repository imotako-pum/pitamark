import { describe, expect, it } from 'vitest';
import { AUTO_NEXT_TEXT_OFFSET_PX, computeAutoNextTextOffset } from '../autoNextOffset';

describe('computeAutoNextTextOffset', () => {
  it('returns +x offset for a rightward arrow', () => {
    const result = computeAutoNextTextOffset({ x: 0, y: 0 }, { x: 100, y: 0 }, 8);
    expect(result.x).toBeCloseTo(8, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('returns -x offset for a leftward arrow', () => {
    const result = computeAutoNextTextOffset({ x: 100, y: 0 }, { x: 0, y: 0 }, 8);
    expect(result.x).toBeCloseTo(-8, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('returns -y offset for an upward arrow', () => {
    const result = computeAutoNextTextOffset({ x: 0, y: 100 }, { x: 0, y: 0 }, 8);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(-8, 5);
  });

  it('returns +y offset for a downward arrow', () => {
    const result = computeAutoNextTextOffset({ x: 0, y: 0 }, { x: 0, y: 100 }, 8);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(8, 5);
  });

  it('returns equal x/y components for a 45deg diagonal arrow', () => {
    const result = computeAutoNextTextOffset({ x: 0, y: 0 }, { x: 100, y: 100 }, 8);
    const expected = 8 / Math.SQRT2;
    expect(result.x).toBeCloseTo(expected, 5);
    expect(result.y).toBeCloseTo(expected, 5);
  });

  it('keeps the same direction regardless of arrow length (long arrow)', () => {
    const short = computeAutoNextTextOffset({ x: 0, y: 0 }, { x: 10, y: 0 }, 8);
    const long = computeAutoNextTextOffset({ x: 0, y: 0 }, { x: 1000, y: 0 }, 8);
    expect(long.x).toBeCloseTo(short.x, 5);
    expect(long.y).toBeCloseTo(short.y, 5);
  });

  it('falls back to {x: distance, y: 0} when from === to (degenerate)', () => {
    const result = computeAutoNextTextOffset({ x: 50, y: 50 }, { x: 50, y: 50 }, 8);
    expect(result).toEqual({ x: 8, y: 0 });
  });

  it('falls back to {x: distance, y: 0} when arrow length is below 1px', () => {
    const result = computeAutoNextTextOffset({ x: 0, y: 0 }, { x: 0.5, y: 0.3 }, 8);
    expect(result).toEqual({ x: 8, y: 0 });
  });

  it('returns zero vector when distance is 0', () => {
    const result = computeAutoNextTextOffset({ x: 0, y: 0 }, { x: 100, y: 0 }, 0);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('exposes a sane default offset constant', () => {
    expect(AUTO_NEXT_TEXT_OFFSET_PX).toBeGreaterThan(0);
    expect(AUTO_NEXT_TEXT_OFFSET_PX).toBeLessThanOrEqual(20);
  });
});
