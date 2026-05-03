import type { ArrowAnnotation } from '@snap-share/shared';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CapturedProps = Record<string, unknown>;

const { capture } = vi.hoisted(() => ({
  capture: {
    arrowProps: [] as CapturedProps[],
    circleProps: [] as CapturedProps[],
  },
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

import { ArrowShape } from '../shapes/ArrowShape';

const annotation: ArrowAnnotation = {
  id: 'a1',
  type: 'arrow',
  createdAt: 1,
  from: { x: 0, y: 0 },
  to: { x: 100, y: 100 },
  stroke: '#e74c3c',
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

  it('endpoint handles set cancelBubble on mousedown to avoid Arrow drag conflict', () => {
    const m = renderShape({ isSelected: true });
    const fromHandle = capture.circleProps[0] ?? {};
    const onMouseDown = fromHandle.onMouseDown as (e: { cancelBubble: boolean }) => void;
    const evt = { cancelBubble: false };
    onMouseDown(evt);
    expect(evt.cancelBubble).toBe(true);
    m.unmount();
  });
});
