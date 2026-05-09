import type { HighlightAnnotation } from '@pitamark/shared';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useRef } from 'react';
import { Rect as KonvaRect, Transformer } from 'react-konva';
import { useLongPress } from '../../../hooks/useLongPress';
import { useTouchDevice } from '../../../hooks/useTouchDevice';
import {
  ANCHOR_SIZE_DESKTOP,
  ANCHOR_SIZE_TOUCH,
  HIGHLIGHT_OPACITY,
  MIN_RESIZE_SIZE,
  OUTLINE_ACCENT,
} from '../colors';

export type HighlightResizePatch = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

type HighlightShapeProps = Readonly<{
  annotation: HighlightAnnotation;
  isSelected: boolean;
  onClick: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResize: (id: string, patch: HighlightResizePatch) => void;
  /** Phase 10.J-2: 長押しで context menu を出す callback */
  onLongPress?: (id: string, anchor: { x: number; y: number }) => void;
}>;

export const HighlightShape = ({
  annotation,
  isSelected,
  onClick,
  onDragEnd,
  onResize,
  onLongPress,
}: HighlightShapeProps) => {
  const shapeRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const isTouch = useTouchDevice();
  const longPress = useLongPress({
    onLongPress: (anchor) => onLongPress?.(annotation.id, anchor),
    enabled: !!onLongPress,
  });

  useEffect(() => {
    if (isSelected && shapeRef.current && trRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    } else {
      trRef.current?.nodes([]);
    }
  }, [isSelected]);

  return (
    <>
      <KonvaRect
        ref={shapeRef}
        x={annotation.x}
        y={annotation.y}
        width={annotation.width}
        height={annotation.height}
        fill={annotation.color}
        opacity={HIGHLIGHT_OPACITY}
        stroke={isSelected ? OUTLINE_ACCENT : undefined}
        strokeWidth={isSelected ? 2 : 0}
        draggable
        onClick={(e: KonvaEventObject<MouseEvent>) => {
          e.cancelBubble = true;
          onClick(annotation.id);
        }}
        // ADR-0007 D1: touch では `tap` が別発火するため `onClick` と paired binding。
        onTap={(e: KonvaEventObject<TouchEvent>) => {
          e.cancelBubble = true;
          onClick(annotation.id);
        }}
        onPointerDown={longPress.onPointerDown}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onTouchStart={longPress.onTouchStart}
        onTouchEnd={longPress.onTouchEnd}
        onDragEnd={(e) => onDragEnd(annotation.id, e.target.x(), e.target.y())}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onResize(annotation.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(MIN_RESIZE_SIZE, node.width() * scaleX),
            height: Math.max(MIN_RESIZE_SIZE, node.height() * scaleY),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          anchorSize={isTouch ? ANCHOR_SIZE_TOUCH : ANCHOR_SIZE_DESKTOP}
          rotateEnabled={false}
          flipEnabled={false}
          ignoreStroke
          boundBoxFunc={(oldBox, newBox) =>
            Math.abs(newBox.width) < MIN_RESIZE_SIZE || Math.abs(newBox.height) < MIN_RESIZE_SIZE
              ? oldBox
              : newBox
          }
        />
      )}
    </>
  );
};
