import { describe, expect, it } from 'vitest';
import {
  DOUBLE_TAP_INTERVAL_MS,
  DOUBLE_TAP_POSITION_THRESHOLD_PX,
  DRAG_SLOP_PX_COARSE,
  DRAG_SLOP_PX_FINE,
  HIT_TEST_MARGIN_PX,
  LONG_PRESS_DURATION_MS,
  MIN_TAP_TARGET_PX,
} from '../touch-thresholds';

// Phase 10.J-3: タイミング / サイズ定数の値を業界標準値に lock-in。
// 値変更時は本 spec も同時に更新する明示的な ceremony を強制し、意図せぬドリフトを防ぐ。
describe('touch-thresholds', () => {
  it('LONG_PRESS_DURATION_MS は業界標準 500ms に固定 (Excalidraw / tldraw / iOS UIKit / Android)', () => {
    expect(LONG_PRESS_DURATION_MS).toBe(500);
  });

  it('DOUBLE_TAP_INTERVAL_MS は業界標準 300ms に固定 (Excalidraw / Android)', () => {
    expect(DOUBLE_TAP_INTERVAL_MS).toBe(300);
  });

  it('DOUBLE_TAP_POSITION_THRESHOLD_PX は Excalidraw 35px に固定', () => {
    expect(DOUBLE_TAP_POSITION_THRESHOLD_PX).toBe(35);
  });

  it('DRAG_SLOP_PX_FINE は tldraw dragDistanceSquared=16 の sqrt = 4px に固定', () => {
    expect(DRAG_SLOP_PX_FINE).toBe(4);
  });

  it('DRAG_SLOP_PX_COARSE は tldraw coarseDragDistanceSquared=36 の sqrt = 6px に固定', () => {
    expect(DRAG_SLOP_PX_COARSE).toBe(6);
  });

  it('MIN_TAP_TARGET_PX は HIG / Material 共通の 44px に固定', () => {
    expect(MIN_TAP_TARGET_PX).toBe(44);
  });

  it('HIT_TEST_MARGIN_PX は tldraw hitTestMargin = 8px に固定', () => {
    expect(HIT_TEST_MARGIN_PX).toBe(8);
  });
});
