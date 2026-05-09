import type { KonvaEventObject } from 'konva/lib/Node';
import { useCallback, useEffect, useRef } from 'react';
import { DRAG_SLOP_PX_COARSE, LONG_PRESS_DURATION_MS } from '../lib/touch-thresholds';

// ADR-0007 D4: 長押し menu の誤発火対策の標準パターン (Excalidraw / tldraw 同等)。
// - LONG_PRESS_DURATION_MS (500ms) 押下継続
// - DRAG_SLOP_PX_COARSE (6px) を超えると cancel
// - pointerup / pointercancel / unmount で確実に cleanup
// - 成立時に navigator.vibrate(15) で触覚 feedback (Android only、iOS は no-op)

type Anchor = { x: number; y: number };

type LongPressOptions = Readonly<{
  onLongPress: (anchor: Anchor) => void;
  /** 上書き可能。省略時は touch-thresholds.ts SSOT (500ms) */
  durationMs?: number;
  /** 上書き可能。省略時は touch-thresholds.ts SSOT (6px) */
  slopPx?: number;
  /** false で hook を無効化 (例: TextShape の `isEditing` 中) */
  enabled?: boolean;
}>;

export type LongPressHandlers = Readonly<{
  onPointerDown: (e: KonvaEventObject<PointerEvent>) => void;
  onPointerMove: (e: KonvaEventObject<PointerEvent>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  /** Phase 10.I-2 Stage の onTouchMove (multi-touch pinch) 経路で長押しを cancel するため */
  onTouchStart: (e: KonvaEventObject<TouchEvent>) => void;
  onTouchEnd: () => void;
}>;

const triggerHaptic = (): void => {
  try {
    // navigator.vibrate は型定義上 boolean を返す。Android Chrome のみ反応、iOS Safari は no-op。
    navigator.vibrate?.(15);
  } catch {
    // 一部 Chromium で SecurityError を投げる事例があるため safety net。
  }
};

export const useLongPress = ({
  onLongPress,
  durationMs = LONG_PRESS_DURATION_MS,
  slopPx = DRAG_SLOP_PX_COARSE,
  enabled = true,
}: LongPressOptions): LongPressHandlers => {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<Anchor | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  // unmount で必ず timer を片付ける。React 19 strict mode の double-invoke でも leak しない。
  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (!enabled) return;
      const { clientX, clientY } = e.evt;
      startRef.current = { x: clientX, y: clientY };
      timerRef.current = window.setTimeout(() => {
        if (startRef.current) {
          triggerHaptic();
          onLongPress(startRef.current);
        }
        timerRef.current = null;
      }, durationMs);
    },
    [enabled, onLongPress, durationMs],
  );

  const onPointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      const start = startRef.current;
      if (!start) return;
      const dx = e.evt.clientX - start.x;
      const dy = e.evt.clientY - start.y;
      if (dx * dx + dy * dy > slopPx * slopPx) {
        cancel();
      }
    },
    [cancel, slopPx],
  );

  const onTouchStart = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      // multi-touch (2+ pointers) を検知したら即 cancel — pinch / pan に道を譲る。
      if (e.evt.touches.length >= 2) {
        cancel();
      }
    },
    [cancel],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onTouchStart,
    onTouchEnd: cancel,
  };
};
