import type { RectangleAnnotation } from '@pitamark/shared';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useRef } from 'react';
import { Rect as KonvaRect, Transformer } from 'react-konva';
import { useTouchDevice } from '../../../hooks/useTouchDevice';
import {
  ANCHOR_SIZE_DESKTOP,
  ANCHOR_SIZE_TOUCH,
  MIN_RESIZE_SIZE,
  OUTLINE_ACCENT,
  SELECTED_STROKE_BOOST,
} from '../colors';

export type RectangleResizePatch = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

type RectangleShapeProps = Readonly<{
  annotation: RectangleAnnotation;
  isSelected: boolean;
  onClick: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResize: (id: string, patch: RectangleResizePatch) => void;
}>;

export const RectangleShape = ({
  annotation,
  isSelected,
  onClick,
  onDragEnd,
  onResize,
}: RectangleShapeProps) => {
  const shapeRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const isTouch = useTouchDevice();

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
        stroke={isSelected ? OUTLINE_ACCENT : annotation.color}
        strokeWidth={
          isSelected ? annotation.strokeWidth + SELECTED_STROKE_BOOST : annotation.strokeWidth
        }
        draggable
        onClick={(e: KonvaEventObject<MouseEvent>) => {
          e.cancelBubble = true;
          onClick(annotation.id);
        }}
        // ADR-0007 D1: Konva の `click` は mouse 専用、touch では `tap` が別発火する。
        // body は onClick と同一で、shape 選択を touch 経路でも成立させる。
        onTap={(e: KonvaEventObject<TouchEvent>) => {
          e.cancelBubble = true;
          onClick(annotation.id);
        }}
        onDragEnd={(e) => onDragEnd(annotation.id, e.target.x(), e.target.y())}
        onTransformEnd={() => {
          // Konva applies the resize as a scale on the node — convert it back
          // to literal width/height so the data model stays scale-free and
          // future transforms always start from scale 1.
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
