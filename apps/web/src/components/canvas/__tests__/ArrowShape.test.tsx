import type { ArrowAnnotation } from '@pitamark/shared';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CapturedProps = Record<string, unknown>;

const { capture, useTouchDeviceMock } = vi.hoisted(() => ({
  capture: {
    arrowProps: [] as CapturedProps[],
    circleProps: [] as CapturedProps[],
  },
  useTouchDeviceMock: vi.fn<() => boolean>().mockReturnValue(false),
}));

vi.mock('react-konva', () => ({
  Arrow: (props: CapturedProps) => {
    capture.arrowProps.push(props);
    return null;
  },
  Circle: (props: CapturedProps) => {
    capture.circleProps.push(props);
    return null;
  },
}));

vi.mock('../../../hooks/useTouchDevice', () => ({
  useTouchDevice: () => useTouchDeviceMock(),
}));

import { HANDLE_RADIUS, HANDLE_RADIUS_TOUCH, HIT_STROKE_WIDTH_TOUCH } from '../colors';
import { ArrowShape } from '../shapes/ArrowShape';

const annotation: ArrowAnnotation = {
  id: 'a1',
  type: 'arrow',
  createdAt: 1,
  from: { x: 0, y: 0 },
  to: { x: 100, y: 100 },
  color: '#e74c3c',
  strokeWidth: 2,
};

const renderShape = (props: {
  isSelected: boolean;
  onClick?: (id: string) => void;
  onDragEnd?: (id: string, dx: number, dy: number) => void;
  onArrowEndpoints?: (
    id: string,
    endpoints: { from: { x: number; y: number }; to: { x: number; y: number } },
  ) => void;
}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  act(() => {
    root?.render(
      <ArrowShape
        annotation={annotation}
        isSelected={props.isSelected}
        onClick={props.onClick ?? (() => {})}
        onDragEnd={props.onDragEnd ?? (() => {})}
        onArrowEndpoints={props.onArrowEndpoints ?? (() => {})}
      />,
    );
  });
  return {
    unmount: () => {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
};

describe('ArrowShape', () => {
  beforeEach(() => {
    capture.arrowProps.length = 0;
    capture.circleProps.length = 0;
    useTouchDeviceMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders only the Arrow when not selected (no endpoint Circles)', () => {
    const m = renderShape({ isSelected: false });
    expect(capture.arrowProps).toHaveLength(1);
    expect(capture.circleProps).toHaveLength(0);
    m.unmount();
  });

  it('renders 2 endpoint Circles when selected (from then to)', () => {
    const m = renderShape({ isSelected: true });
    expect(capture.circleProps).toHaveLength(2);
    expect(capture.circleProps[0]).toMatchObject({ x: 0, y: 0 });
    expect(capture.circleProps[1]).toMatchObject({ x: 100, y: 100 });
    m.unmount();
  });

  it('emits onArrowEndpoints with new from when the from-handle is dragged', () => {
    const onArrowEndpoints = vi.fn();
    const m = renderShape({ isSelected: true, onArrowEndpoints });
    const fromHandle = capture.circleProps[0] ?? {};
    const onDragEnd = fromHandle.onDragEnd as (e: {
      target: { x: () => number; y: () => number };
    }) => void;
    act(() => {
      onDragEnd({ target: { x: () => 50, y: () => 60 } });
    });
    expect(onArrowEndpoints).toHaveBeenCalledWith('a1', {
      from: { x: 50, y: 60 },
      to: { x: 100, y: 100 },
    });
    m.unmount();
  });

  it('emits onArrowEndpoints with new to when the to-handle is dragged', () => {
    const onArrowEndpoints = vi.fn();
    const m = renderShape({ isSelected: true, onArrowEndpoints });
    const toHandle = capture.circleProps[1] ?? {};
    const onDragEnd = toHandle.onDragEnd as (e: {
      target: { x: () => number; y: () => number };
    }) => void;
    act(() => {
      onDragEnd({ target: { x: () => 200, y: () => 220 } });
    });
    expect(onArrowEndpoints).toHaveBeenCalledWith('a1', {
      from: { x: 0, y: 0 },
      to: { x: 200, y: 220 },
    });
    m.unmount();
  });

  it('endpoint handles set cancelBubble on pointerdown to avoid Arrow drag conflict', () => {
    const m = renderShape({ isSelected: true });
    const fromHandle = capture.circleProps[0] ?? {};
    const onPointerDown = fromHandle.onPointerDown as (e: { cancelBubble: boolean }) => void;
    const evt = { cancelBubble: false };
    onPointerDown(evt);
    expect(evt.cancelBubble).toBe(true);
    m.unmount();
  });

  // Phase 10.J-1: ADR-0007 D1 paired event binding。

  it('binds both onClick (mouse) and onTap (touch) on the Arrow body per ADR-0007 D1', () => {
    const m = renderShape({ isSelected: false });
    const props = capture.arrowProps[0] ?? {};
    expect(typeof props.onClick).toBe('function');
    expect(typeof props.onTap).toBe('function');
    m.unmount();
  });

  it('Arrow body onTap dispatches the same selection callback as onClick', () => {
    const onClick = vi.fn();
    const m = renderShape({ isSelected: false, onClick });
    const onTap = capture.arrowProps[0]?.onTap as (e: { cancelBubble: boolean }) => void;
    const evt = { cancelBubble: false };
    onTap(evt);
    expect(evt.cancelBubble).toBe(true);
    expect(onClick).toHaveBeenCalledWith('a1');
    m.unmount();
  });

  it('endpoint handles bind both onPointerDown and onTouchStart per ADR-0007 D1 + ADR-0006 Status Update', () => {
    const m = renderShape({ isSelected: true });
    const fromHandle = capture.circleProps[0] ?? {};
    const toHandle = capture.circleProps[1] ?? {};
    expect(typeof fromHandle.onPointerDown).toBe('function');
    expect(typeof fromHandle.onTouchStart).toBe('function');
    expect(typeof toHandle.onPointerDown).toBe('function');
    expect(typeof toHandle.onTouchStart).toBe('function');
    m.unmount();
  });

  it('endpoint handles cancelBubble on touchstart (multi-touch path) to avoid Arrow drag conflict', () => {
    const m = renderShape({ isSelected: true });
    const fromHandle = capture.circleProps[0] ?? {};
    const toHandle = capture.circleProps[1] ?? {};
    const fromOnTouchStart = fromHandle.onTouchStart as (e: { cancelBubble: boolean }) => void;
    const toOnTouchStart = toHandle.onTouchStart as (e: { cancelBubble: boolean }) => void;
    const evt1 = { cancelBubble: false };
    const evt2 = { cancelBubble: false };
    fromOnTouchStart(evt1);
    toOnTouchStart(evt2);
    expect(evt1.cancelBubble).toBe(true);
    expect(evt2.cancelBubble).toBe(true);
    m.unmount();
  });

  // Phase 10.I-2: adaptive sizing for touch devices.

  it('uses HANDLE_RADIUS (desktop default) when not on a touch device', () => {
    useTouchDeviceMock.mockReturnValue(false);
    const m = renderShape({ isSelected: true });
    expect(capture.circleProps[0]?.radius).toBe(HANDLE_RADIUS);
    expect(capture.circleProps[1]?.radius).toBe(HANDLE_RADIUS);
    m.unmount();
  });

  it('uses HANDLE_RADIUS_TOUCH when on a touch device', () => {
    useTouchDeviceMock.mockReturnValue(true);
    const m = renderShape({ isSelected: true });
    expect(capture.circleProps[0]?.radius).toBe(HANDLE_RADIUS_TOUCH);
    expect(capture.circleProps[1]?.radius).toBe(HANDLE_RADIUS_TOUCH);
    m.unmount();
  });

  it('passes hitStrokeWidth equal to annotation.strokeWidth on desktop (no expansion)', () => {
    useTouchDeviceMock.mockReturnValue(false);
    const m = renderShape({ isSelected: false });
    expect(capture.arrowProps[0]?.hitStrokeWidth).toBe(annotation.strokeWidth);
    m.unmount();
  });

  it('passes HIT_STROKE_WIDTH_TOUCH on touch device', () => {
    useTouchDeviceMock.mockReturnValue(true);
    const m = renderShape({ isSelected: false });
    expect(capture.arrowProps[0]?.hitStrokeWidth).toBe(HIT_STROKE_WIDTH_TOUCH);
    m.unmount();
  });
});
