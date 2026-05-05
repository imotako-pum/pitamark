import { describe, expect, it } from 'vitest';
import {
  clampPan,
  clampScale,
  computeFitTransform,
  computeHundredPercentTransform,
  MAX_SCALE,
  MIN_SCALE,
  PAN_MARGIN_RATIO,
  zoomAtPointer,
} from '../useStageTransform';

describe('clampScale', () => {
  it('clamps below MIN_SCALE', () => {
    expect(clampScale(0.05)).toBe(MIN_SCALE);
  });
  it('clamps above MAX_SCALE', () => {
    expect(clampScale(100)).toBe(MAX_SCALE);
  });
  it('passes through values in range', () => {
    expect(clampScale(1)).toBe(1);
    expect(clampScale(2.5)).toBe(2.5);
  });
  it('returns MAX_SCALE for non-finite values', () => {
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(MAX_SCALE);
    expect(clampScale(Number.NaN)).toBe(MAX_SCALE);
  });
});

describe('computeFitTransform', () => {
  it('shrinks a 5000x5000 image into a 1000x800 viewport', () => {
    const t = computeFitTransform({ width: 5000, height: 5000 }, { width: 1000, height: 800 });
    // 高さで律速: 800 / 5000 = 0.16
    expect(t.scale).toBeCloseTo(0.16);
    // 水平方向に center: 描画幅 = 5000 * 0.16 = 800 → x = (1000 - 800)/2 = 100
    expect(t.x).toBeCloseTo(100);
    expect(t.y).toBeCloseTo(0);
  });

  it('keeps a small image at scale 1 (does not enlarge)', () => {
    const t = computeFitTransform({ width: 320, height: 240 }, { width: 1000, height: 800 });
    expect(t.scale).toBe(1);
    expect(t.x).toBeCloseTo(340);
    expect(t.y).toBeCloseTo(280);
  });

  it('handles a portrait image (height-limited)', () => {
    const t = computeFitTransform({ width: 500, height: 3000 }, { width: 1000, height: 800 });
    expect(t.scale).toBeCloseTo(800 / 3000);
    // 水平方向に center
    expect(t.x).toBeCloseTo((1000 - 500 * (800 / 3000)) / 2);
    expect(t.y).toBeCloseTo(0);
  });

  it('returns identity for zero-size inputs', () => {
    const t = computeFitTransform({ width: 0, height: 0 }, { width: 1000, height: 800 });
    expect(t).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('exact fit produces no margin', () => {
    const t = computeFitTransform({ width: 1000, height: 800 }, { width: 1000, height: 800 });
    expect(t.scale).toBe(1);
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
  });
});

describe('computeHundredPercentTransform', () => {
  it('centers an image larger than the viewport with negative offsets', () => {
    const t = computeHundredPercentTransform(
      { width: 1920, height: 1080 },
      { width: 1000, height: 800 },
    );
    expect(t.scale).toBe(1);
    expect(t.x).toBe((1000 - 1920) / 2);
    expect(t.y).toBe((800 - 1080) / 2);
  });
});

describe('zoomAtPointer', () => {
  it('keeps the pointer fixed in logical space when scaling at it', () => {
    const start = { scale: 1, x: 0, y: 0 };
    const pointer = { x: 500, y: 400 };
    const next = zoomAtPointer(start, pointer, 2);
    expect(next.scale).toBe(2);
    // cursor 直下の logical 座標は (500, 400)。scale 変更後も screen 位置は
    // (500, 400) に固定されているはず。
    const logicalAfter = {
      x: (pointer.x - next.x) / next.scale,
      y: (pointer.y - next.y) / next.scale,
    };
    expect(logicalAfter.x).toBeCloseTo(500);
    expect(logicalAfter.y).toBeCloseTo(400);
  });

  it('returns the same reference when scale already at MAX (no change)', () => {
    const start = { scale: MAX_SCALE, x: 0, y: 0 };
    const result = zoomAtPointer(start, { x: 100, y: 100 }, 2);
    expect(result).toBe(start);
  });

  it('returns the same reference when scale already at MIN (no change)', () => {
    const start = { scale: MIN_SCALE, x: 0, y: 0 };
    const result = zoomAtPointer(start, { x: 100, y: 100 }, 0.5);
    expect(result).toBe(start);
  });

  it('does nothing for factor 1', () => {
    const start = { scale: 2, x: 50, y: 60 };
    const result = zoomAtPointer(start, { x: 0, y: 0 }, 1);
    expect(result).toBe(start);
  });
});

describe('clampPan', () => {
  const image = { width: 1000, height: 800 };
  const viewport = { width: 800, height: 600 };

  it('passes through transforms inside the bounds', () => {
    // scale 1 でほぼ identity 配置。仮想領域は画像の 2 倍、viewport は画像より小さい
    // ので画像が viewport を完全に覆い、十分な余白がある → clamp は発火しないはず。
    const t = { scale: 1, x: 0, y: 0 };
    const clamped = clampPan(t, image, viewport);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
  });

  it('snaps back when virtual right edge crosses the viewport left edge', () => {
    // 画像を大きく左にドラッグ → 仮想 maxX が screen space で 0 を下回る。
    const t = { scale: 1, x: -5000, y: 0 };
    const clamped = clampPan(t, image, viewport);
    // 仮想 maxX (logical) = 1000 * 1.5 = 1500。
    // clamp 後: maxX_screen = 1500 + clamped.x が viewport.width (800) と等しいはず。
    expect(1500 + clamped.x).toBeCloseTo(viewport.width);
  });

  it('snaps back when virtual left edge crosses the viewport right edge (positive overflow)', () => {
    const t = { scale: 1, x: 5000, y: 0 };
    const clamped = clampPan(t, image, viewport);
    // 仮想 minX (logical) = -1000 * 0.5 = -500。
    // clamp 後: minX_screen = -500 + clamped.x が 0 と等しいはず。
    expect(-500 + clamped.x).toBeCloseTo(0);
  });

  it('snaps back vertically (top overflow)', () => {
    const t = { scale: 1, x: 0, y: 5000 };
    const clamped = clampPan(t, image, viewport);
    expect(-image.height * PAN_MARGIN_RATIO + clamped.y).toBeCloseTo(0);
  });

  it('snaps back vertically (bottom overflow)', () => {
    const t = { scale: 1, x: 0, y: -5000 };
    const clamped = clampPan(t, image, viewport);
    expect(image.height * (1 + PAN_MARGIN_RATIO) + clamped.y).toBeCloseTo(viewport.height);
  });
});
