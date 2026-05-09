import { describe, expect, it } from 'vitest';
import {
  ANCHOR_SIZE_DESKTOP,
  ANCHOR_SIZE_TOUCH,
  HANDLE_RADIUS,
  HANDLE_RADIUS_TOUCH,
  HIT_STROKE_WIDTH_TOUCH,
} from '../colors';

// Phase 10.J-3: Konva size 定数の値を業界標準値に lock-in。
// 視覚サイズの変更は実機操作感への直接的な影響があるため、CI で値ドリフトを検知する。
describe('canvas size constants', () => {
  it('ANCHOR_SIZE_DESKTOP は Konva default の 10px に固定', () => {
    expect(ANCHOR_SIZE_DESKTOP).toBe(10);
  });

  it('ANCHOR_SIZE_TOUCH は tldraw coarseHandleRadius = 20px に固定 (ADR-0007 D3)', () => {
    expect(ANCHOR_SIZE_TOUCH).toBe(20);
  });

  it('HANDLE_RADIUS は default 6px、HANDLE_RADIUS_TOUCH は 12px に固定 (Phase 10.I-2 既定)', () => {
    expect(HANDLE_RADIUS).toBe(6);
    expect(HANDLE_RADIUS_TOUCH).toBe(12);
  });

  it('HIT_STROKE_WIDTH_TOUCH は Konva 公式 Issue #524 推奨 20px に固定', () => {
    expect(HIT_STROKE_WIDTH_TOUCH).toBe(20);
  });
});
