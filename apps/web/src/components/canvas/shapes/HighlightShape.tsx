import type { HighlightAnnotation } from '@snap-share/shared';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Rect as KonvaRect } from 'react-konva';
import { HIGHLIGHT_OPACITY, OUTLINE_ACCENT } from '../colors';

type HighlightShapeProps = Readonly<{
  annotation: HighlightAnnotation;
  isSelected: boolean;
  onClick: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}>;

export const HighlightShape = ({
  annotation,
  isSelected,
  onClick,
  onDragEnd,
}: HighlightShapeProps) => (
  <KonvaRect
    x={annotation.x}
    y={annotation.y}
    width={annotation.width}
    height={annotation.height}
    fill={annotation.fill}
    opacity={HIGHLIGHT_OPACITY}
    stroke={isSelected ? OUTLINE_ACCENT : undefined}
    strokeWidth={isSelected ? 2 : 0}
    draggable
    onClick={(e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onClick(annotation.id);
    }}
    onDragEnd={(e) => onDragEnd(annotation.id, e.target.x(), e.target.y())}
  />
);
