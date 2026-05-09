import type { HighlightAnnotation } from '@pitamark/shared';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CapturedProps = Record<string, unknown>;

const { capture, useTouchDeviceMock } = vi.hoisted(() => ({
  capture: {
    rectProps: [] as CapturedProps[],
    transformerProps: [] as CapturedProps[],
    nodeStub: {
      scaleX: () => 1.5,
      scaleY: () => 2,
      x: () => 12,
      y: () => 14,
      width: () => 80,
      height: () => 30,
    },
  },
  useTouchDeviceMock: vi.fn<() => boolean>().mockReturnValue(false),
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

vi.mock('../../../hooks/useTouchDevice', () => ({
  useTouchDevice: () => useTouchDeviceMock(),
}));

import { ANCHOR_SIZE_DESKTOP, ANCHOR_SIZE_TOUCH } from '../colors';
import { HighlightShape } from '../shapes/HighlightShape';

const annotation: HighlightAnnotation = {
  id: 'h1',
  type: 'highlight',
  createdAt: 1,
  x: 0,
  y: 0,
  width: 80,
  height: 30,
  color: '#f5d142',
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
      <HighlightShape
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

describe('HighlightShape', () => {
  beforeEach(() => {
    capture.rectProps.length = 0;
    capture.transformerProps.length = 0;
    useTouchDeviceMock.mockReturnValue(false);
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
    expect(capture.transformerProps).toHaveLength(1);
    m.unmount();
  });

  it('emits onResize with values derived from the node scale', () => {
    const onResize = vi.fn();
    const m = renderShape({ isSelected: true, onResize });
    const onTransformEnd = capture.rectProps[0]?.onTransformEnd as () => void;
    act(() => {
      onTransformEnd();
    });
    // node stub: width 80 * 1.5 = 120, height 30 * 2 = 60
    expect(onResize).toHaveBeenCalledWith('h1', { x: 12, y: 14, width: 120, height: 60 });
    m.unmount();
  });

  // Phase 10.I-2: Transformer anchorSize adaptive。

  it('uses ANCHOR_SIZE_DESKTOP on the Transformer when not on a touch device', () => {
    useTouchDeviceMock.mockReturnValue(false);
    const m = renderShape({ isSelected: true });
    expect(capture.transformerProps[0]?.anchorSize).toBe(ANCHOR_SIZE_DESKTOP);
    m.unmount();
  });

  it('uses ANCHOR_SIZE_TOUCH on the Transformer when on a touch device', () => {
    useTouchDeviceMock.mockReturnValue(true);
    const m = renderShape({ isSelected: true });
    expect(capture.transformerProps[0]?.anchorSize).toBe(ANCHOR_SIZE_TOUCH);
    m.unmount();
  });
});
