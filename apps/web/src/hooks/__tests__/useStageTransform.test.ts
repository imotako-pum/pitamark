import { describe, expect, it } from 'vitest';
import {
  applyPinch,
  clampPan,
  clampScale,
  computeFitTransform,
  computeHundredPercentTransform,
  getCenter,
  getDistance,
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

// Phase 10.I-2: multi-touch pinch helpers。CanvasStage の onTouchMove ハンドラから
// 呼ばれる純粋関数。

describe('getDistance', () => {
  it('returns euclidean distance between two points', () => {
    expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
  it('returns 0 for identical points', () => {
    expect(getDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('getCenter', () => {
  it('returns the midpoint of two points', () => {
    expect(getCenter({ x: 0, y: 0 }, { x: 10, y: 10 })).toEqual({ x: 5, y: 5 });
  });
  it('handles negative coordinates', () => {
    expect(getCenter({ x: -10, y: -20 }, { x: 10, y: 20 })).toEqual({ x: 0, y: 0 });
  });
});

describe('applyPinch', () => {
  it('scales by distRatio with center fixed when panDx/panDy are zero', () => {
    // identity transform、中点 (100, 100)、distRatio 2 → scale 2、中点固定 → x/y 調整
    const start = { scale: 1, x: 0, y: 0 };
    const result = applyPinch(start, { x: 100, y: 100 }, 2, 0, 0);
    expect(result.scale).toBe(2);
    // pointTo (logical) = (100 - 0) / 1 = 100。新 transform.x = 100 - 100 * 2 + 0 = -100
    expect(result.x).toBeCloseTo(-100);
    expect(result.y).toBeCloseTo(-100);
  });

  it('translates by panDx/panDy when distRatio is 1 (pure pan)', () => {
    const start = { scale: 1, x: 0, y: 0 };
    const result = applyPinch(start, { x: 50, y: 50 }, 1, 10, -5);
    // distRatio = 1 → newScale = 1。pointTo = (50 - 0)/1 = 50。
    // x = 50 - 50 * 1 + 10 = 10、y = 50 - 50 * 1 + (-5) = -5
    expect(result.scale).toBe(1);
    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(-5);
  });

  it('clamps scale at MAX_SCALE for very large distRatio', () => {
    const start = { scale: 4, x: 0, y: 0 };
    const result = applyPinch(start, { x: 0, y: 0 }, 100, 0, 0);
    expect(result.scale).toBe(MAX_SCALE);
  });

  it('clamps scale at MIN_SCALE for very small distRatio', () => {
    const start = { scale: 0.5, x: 0, y: 0 };
    const result = applyPinch(start, { x: 0, y: 0 }, 0.001, 0, 0);
    expect(result.scale).toBe(MIN_SCALE);
  });

  it('keeps the center point fixed in screen coords when only zooming', () => {
    // 中点が変わらないことを確認: scale 適用後の screen 座標で center が保持される。
    const start = { scale: 1, x: 0, y: 0 };
    const center = { x: 200, y: 150 };
    const result = applyPinch(start, center, 2, 0, 0);
    // pointTo (start logical) = (center - start.{x,y}) / start.scale = (200, 150)
    // 新 screen 中点 = pointTo * newScale + new.{x,y} = (200*2, 150*2) + (-200, -150)
    //               = (400-200, 300-150) = (200, 150) → center と一致
    const newCenterScreenX = 200 * result.scale + result.x;
    const newCenterScreenY = 150 * result.scale + result.y;
    expect(newCenterScreenX).toBeCloseTo(center.x);
    expect(newCenterScreenY).toBeCloseTo(center.y);
  });
});
