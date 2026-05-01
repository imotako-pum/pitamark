import type { ArrowAnnotation } from '@snap-share/shared';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Arrow as KonvaArrow } from 'react-konva';
import {
  ARROW_POINTER_LENGTH,
  ARROW_POINTER_WIDTH,
  OUTLINE_ACCENT,
  SELECTED_STROKE_BOOST,
} from '../colors';

type ArrowShapeProps = Readonly<{
  annotation: ArrowAnnotation;
  isSelected: boolean;
  onClick: (id: string) => void;
  onDragEnd: (id: string, dx: number, dy: number) => void;
}>;

export const ArrowShape = ({ annotation, isSelected, onClick, onDragEnd }: ArrowShapeProps) => {
  const points: [number, number, number, number] = [
    annotation.from.x,
    annotation.from.y,
    annotation.to.x,
    annotation.to.y,
  ];
  const stroke = isSelected ? OUTLINE_ACCENT : annotation.stroke;
  const strokeWidth = isSelected
    ? annotation.strokeWidth + SELECTED_STROKE_BOOST
    : annotation.strokeWidth;

  return (
    <KonvaArrow
      points={points}
      pointerLength={ARROW_POINTER_LENGTH}
      pointerWidth={ARROW_POINTER_WIDTH}
      stroke={stroke}
      fill={stroke}
      strokeWidth={strokeWidth}
      draggable
      onClick={(e: KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        onClick(annotation.id);
      }}
      onDragEnd={(e) => {
        const dx = e.target.x();
        const dy = e.target.y();
        e.target.x(0);
        e.target.y(0);
        onDragEnd(annotation.id, dx, dy);
      }}
    />
  );
};
