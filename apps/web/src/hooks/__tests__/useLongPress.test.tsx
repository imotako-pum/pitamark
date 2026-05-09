// useLongPress: 長押し timer + slop 監視 hook (ADR-0007 D4)。
// vi.useFakeTimers で 500ms / 6px / multi-touch / unmount の各パスを検証。
//
// 注意: useTouchDevice.test.tsx と同じ createRoot ベースで render する pattern を踏襲。
// hook を直接呼ぶ renderHook 系のヘルパは本リポジトリにないため、薄い Probe コンポーネント
// を介して hook の return を test 側に晒す。

import type { KonvaEventObject } from 'konva/lib/Node';
import { act, createRef, forwardRef, type RefObject, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type LongPressHandlers, useLongPress } from '../useLongPress';

type ProbeHandle = LongPressHandlers;

const Probe = forwardRef<
  ProbeHandle,
  Readonly<{
    onLongPress: (anchor: { x: number; y: number }) => void;
    enabled?: boolean;
  }>
>(({ onLongPress, enabled }, ref) => {
  const handlers = useLongPress({ onLongPress, enabled });
  useImperativeHandle(ref, () => handlers, [handlers]);
  return null;
});

const buildPointerEvt = (clientX: number, clientY: number): KonvaEventObject<PointerEvent> =>
  ({
    evt: { clientX, clientY } as PointerEvent,
    cancelBubble: false,
  }) as unknown as KonvaEventObject<PointerEvent>;

const buildTouchEvt = (touchCount: number): KonvaEventObject<TouchEvent> =>
  ({
    evt: { touches: { length: touchCount } as TouchList } as TouchEvent,
    cancelBubble: false,
  }) as unknown as KonvaEventObject<TouchEvent>;

describe('useLongPress', () => {
  let container: HTMLDivElement;
  let root: Root;
  let ref: RefObject<ProbeHandle | null>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    ref = createRef<ProbeHandle>();
    act(() => {
      root = createRoot(container);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const mount = (props: {
    onLongPress: (anchor: { x: number; y: number }) => void;
    enabled?: boolean;
  }) => {
    act(() => {
      root.render(
        <Probe ref={ref} onLongPress={props.onLongPress} enabled={props.enabled ?? true} />,
      );
    });
  };

  it('500ms 押下継続で onLongPress が anchor 付きで呼ばれる', () => {
    const onLongPress = vi.fn();
    mount({ onLongPress });
    act(() => {
      ref.current?.onPointerDown(buildPointerEvt(123, 456));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledWith({ x: 123, y: 456 });
  });

  it('500ms 未満で pointerup → onLongPress は呼ばれない', () => {
    const onLongPress = vi.fn();
    mount({ onLongPress });
    act(() => {
      ref.current?.onPointerDown(buildPointerEvt(0, 0));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      ref.current?.onPointerUp();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('移動量が slop (6px) を超えると cancel される', () => {
    const onLongPress = vi.fn();
    mount({ onLongPress });
    act(() => {
      ref.current?.onPointerDown(buildPointerEvt(100, 100));
    });
    act(() => {
      // 7px 移動 (slop 6px 超過)
      ref.current?.onPointerMove(buildPointerEvt(107, 100));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('移動量が slop 未満なら cancel されず長押し成立', () => {
    const onLongPress = vi.fn();
    mount({ onLongPress });
    act(() => {
      ref.current?.onPointerDown(buildPointerEvt(100, 100));
    });
    act(() => {
      // 5px 移動 (slop 6px 未満)
      ref.current?.onPointerMove(buildPointerEvt(105, 100));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('multi-touch (2 本指) 検知時に cancel される', () => {
    const onLongPress = vi.fn();
    mount({ onLongPress });
    act(() => {
      ref.current?.onPointerDown(buildPointerEvt(0, 0));
    });
    act(() => {
      ref.current?.onTouchStart(buildTouchEvt(2));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('pointercancel で cancel される (system gesture 介入対策)', () => {
    const onLongPress = vi.fn();
    mount({ onLongPress });
    act(() => {
      ref.current?.onPointerDown(buildPointerEvt(0, 0));
    });
    act(() => {
      ref.current?.onPointerCancel();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('enabled=false なら onPointerDown が no-op', () => {
    const onLongPress = vi.fn();
    mount({ onLongPress, enabled: false });
    act(() => {
      ref.current?.onPointerDown(buildPointerEvt(0, 0));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('unmount 時に timer が clear される (memory leak ガード)', () => {
    const onLongPress = vi.fn();
    mount({ onLongPress });
    act(() => {
      ref.current?.onPointerDown(buildPointerEvt(0, 0));
    });
    // unmount before timer fires
    act(() => {
      root.unmount();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
