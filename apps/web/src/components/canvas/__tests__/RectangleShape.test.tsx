import type { RectangleAnnotation } from '@pitamark/shared';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CapturedProps = Record<string, unknown>;

const { capture } = vi.hoisted(() => ({
  capture: {
    rectProps: [] as CapturedProps[],
    transformerProps: [] as CapturedProps[],
    nodeStub: {
      scaleX: () => 2,
      scaleY: () => 1.5,
      x: () => 130,
      y: () => 50,
      width: () => 100,
      height: () => 80,
    },
  },
}));

vi.mock('react-konva', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    Rect: forwardRef((props: CapturedProps, ref: React.Ref<unknown>) => {
      capture.rectProps.push(props);
      useImperativeHandle(ref, () => ({
        scaleX: capture.nodeStub.scaleX,
        scaleY: capture.nodeStub.scaleY,
        x: capture.nodeStub.x,
        y: capture.nodeStub.y,
        width: capture.nodeStub.width,
        height: capture.nodeStub.height,
        // Setter signatures called by the implementation to normalize scale.
        // We accept them but do nothing — the test checks the value passed to
        // `onResize`, not what the Konva node retains afterwards.
      }));
      return null;
    }),
    Transformer: forwardRef((props: CapturedProps, ref: React.Ref<unknown>) => {
      capture.transformerProps.push(props);
      useImperativeHandle(ref, () => ({
        nodes: () => {},
        getLayer: () => ({ batchDraw: () => {} }),
      }));
      return null;
    }),
  };
});

import { RectangleShape } from '../shapes/RectangleShape';

const annotation: RectangleAnnotation = {
  id: 'r1',
  type: 'rectangle',
  createdAt: 1,
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  color: '#5b6dff',
  strokeWidth: 2,
};

const renderShape = (props: {
  isSelected: boolean;
  onClick?: (id: string) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, patch: { x: number; y: number; width: number; height: number }) => void;
}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  act(() => {
    root?.render(
      <RectangleShape
        annotation={annotation}
        isSelected={props.isSelected}
        onClick={props.onClick ?? (() => {})}
        onDragEnd={props.onDragEnd ?? (() => {})}
        onResize={props.onResize ?? (() => {})}
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

describe('RectangleShape', () => {
  beforeEach(() => {
    capture.rectProps.length = 0;
    capture.transformerProps.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders only the Rect when not selected (no Transformer)', () => {
    const m = renderShape({ isSelected: false });
    expect(capture.rectProps).toHaveLength(1);
    expect(capture.transformerProps).toHaveLength(0);
    m.unmount();
  });

  it('renders the Transformer when selected', () => {
    const m = renderShape({ isSelected: true });
    expect(capture.rectProps).toHaveLength(1);
    expect(capture.transformerProps).toHaveLength(1);
    m.unmount();
  });

  it('disables rotate and flip on the Transformer', () => {
    const m = renderShape({ isSelected: true });
    const tr = capture.transformerProps[0] ?? {};
    expect(tr.rotateEnabled).toBe(false);
    expect(tr.flipEnabled).toBe(false);
    m.unmount();
  });

  it('rejects boxes below MIN_RESIZE_SIZE via boundBoxFunc', () => {
    const m = renderShape({ isSelected: true });
    const tr = capture.transformerProps[0] ?? {};
    const boundBoxFunc = tr.boundBoxFunc as (
      oldBox: { width: number; height: number },
      newBox: { width: number; height: number },
    ) => unknown;
    const oldBox = { width: 50, height: 50 };
    expect(boundBoxFunc(oldBox, { width: 1, height: 100 })).toBe(oldBox);
    expect(boundBoxFunc(oldBox, { width: 100, height: 2 })).toBe(oldBox);
    const valid = { width: 100, height: 100 };
    expect(boundBoxFunc(oldBox, valid)).toBe(valid);
    m.unmount();
  });

  it('emits onResize with new x/y/width/height computed from the node scale', () => {
    const onResize = vi.fn();
    const m = renderShape({ isSelected: true, onResize });
    const onTransformEnd = capture.rectProps[0]?.onTransformEnd as () => void;
    act(() => {
      onTransformEnd();
    });
    // node stub: width 100 * scaleX 2 = 200, height 80 * scaleY 1.5 = 120
    expect(onResize).toHaveBeenCalledWith('r1', { x: 130, y: 50, width: 200, height: 120 });
    m.unmount();
  });
});
