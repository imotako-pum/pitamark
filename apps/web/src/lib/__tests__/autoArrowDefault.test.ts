import { describe, expect, it } from 'vitest';
import { AUTO_ARROW_DEFAULT_LENGTH_PX, computeAutoArrowDefault } from '../autoArrowDefault';

describe('computeAutoArrowDefault', () => {
  it('places the arrowhead at the right-edge midpoint of a 100x80 rectangle at origin', () => {
    const { from, to } = computeAutoArrowDefault({ x: 0, y: 0, width: 100, height: 80 });
    expect(from).toEqual({ x: 100, y: 40 });
    const expected = AUTO_ARROW_DEFAULT_LENGTH_PX / Math.SQRT2;
    expect(to.x).toBeCloseTo(100 + expected, 5);
    expect(to.y).toBeCloseTo(40 + expected, 5);
  });

  it('preserves the from/to relationship for a translated rectangle', () => {
    const { from, to } = computeAutoArrowDefault({ x: 200, y: 150, width: 60, height: 40 });
    expect(from).toEqual({ x: 260, y: 170 });
    const expected = AUTO_ARROW_DEFAULT_LENGTH_PX / Math.SQRT2;
    expect(to.x).toBeCloseTo(260 + expected, 5);
    expect(to.y).toBeCloseTo(170 + expected, 5);
  });

  it('uses the AUTO_ARROW_DEFAULT_LENGTH_PX constant for the tail extension distance', () => {
    const { from, to } = computeAutoArrowDefault({ x: 0, y: 0, width: 10, height: 10 });
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    expect(length).toBeCloseTo(AUTO_ARROW_DEFAULT_LENGTH_PX, 5);
  });

  it('extends the tail at exactly 45° down-right (dx === dy, both positive)', () => {
    const { from, to } = computeAutoArrowDefault({ x: 0, y: 0, width: 50, height: 30 });
    expect(to.x - from.x).toBeCloseTo(to.y - from.y, 5);
    expect(to.x - from.x).toBeGreaterThan(0);
    expect(to.y - from.y).toBeGreaterThan(0);
  });

  it('produces a deterministic constant value when called multiple times', () => {
    const r = { x: 100, y: 50, width: 80, height: 60 };
    expect(computeAutoArrowDefault(r)).toEqual(computeAutoArrowDefault(r));
  });
});
