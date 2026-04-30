import type { RectangleAnnotation } from '@snap-share/shared';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Rect as KonvaRect } from 'react-konva';
import { OUTLINE_ACCENT, SELECTED_STROKE_BOOST } from '../colors';

type RectangleShapeProps = Readonly<{
  annotation: RectangleAnnotation;
  isSelected: boolean;
  onClick: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}>;

export const RectangleShape = ({
  annotation,
  isSelected,
  onClick,
  onDragEnd,
}: RectangleShapeProps) => (
  <KonvaRect
    x={annotation.x}
    y={annotation.y}
    width={annotation.width}
    height={annotation.height}
    stroke={isSelected ? OUTLINE_ACCENT : annotation.stroke}
    strokeWidth={
      isSelected ? annotation.strokeWidth + SELECTED_STROKE_BOOST : annotation.strokeWidth
    }
    draggable
    onClick={(e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onClick(annotation.id);
    }}
    onDragEnd={(e) => onDragEnd(annotation.id, e.target.x(), e.target.y())}
  />
);
