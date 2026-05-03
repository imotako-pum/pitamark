import type { ArrowAnnotation, Point } from '@snap-share/shared';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Circle, Arrow as KonvaArrow } from 'react-konva';
import {
  ARROW_POINTER_LENGTH,
  ARROW_POINTER_WIDTH,
  HANDLE_FILL,
  HANDLE_RADIUS,
  HANDLE_STROKE_WIDTH,
  OUTLINE_ACCENT,
  SELECTED_STROKE_BOOST,
} from '../colors';

export type ArrowEndpointsPatch = Readonly<{ from: Point; to: Point }>;

type ArrowShapeProps = Readonly<{
  annotation: ArrowAnnotation;
  isSelected: boolean;
  onClick: (id: string) => void;
  onDragEnd: (id: string, dx: number, dy: number) => void;
  onArrowEndpoints: (id: string, endpoints: ArrowEndpointsPatch) => void;
}>;

export const ArrowShape = ({
  annotation,
  isSelected,
  onClick,
  onDragEnd,
  onArrowEndpoints,
}: ArrowShapeProps) => {
  const points: [number, number, number, number] = [
    annotation.from.x,
    annotation.from.y,
    annotation.to.x,
    annotation.to.y,
  ];
  const stroke = isSelected ? OUTLINE_ACCENT : annotation.color;
  const strokeWidth = isSelected
    ? annotation.strokeWidth + SELECTED_STROKE_BOOST
    : annotation.strokeWidth;

  return (
    <>
      <KonvaArrow
        points={points}
        // Phase 7.8-1 修正: ユーザーは「鏃のほうから」矢印を引く感覚で操作するため、
        // mousedown 位置 (= from = dragStart) に矢じりを描き、mouseup 位置 (= to) は
        // 尾とする。Konva の default は pointerAtEnding=true (to 側に矢じり) なので、
        // 反転して pointerAtBeginning=true / pointerAtEnding=false に切替。
        // これで Auto-next-A の text 位置 (to + offset、to - from 方向の延長) が
        // 自動的に「尾の側 = 鏃じゃないほう」となり、ユーザー要望と一致する。
        pointerAtBeginning
        pointerAtEnding={false}
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
      {isSelected && (
        <>
          <Circle
            x={annotation.from.x}
            y={annotation.from.y}
            radius={HANDLE_RADIUS}
            fill={HANDLE_FILL}
            stroke={OUTLINE_ACCENT}
            strokeWidth={HANDLE_STROKE_WIDTH}
            draggable
            onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
              // Prevent the parent Arrow's draggable from claiming this drag.
              e.cancelBubble = true;
            }}
            onDragEnd={(e) => {
              const next: Point = { x: e.target.x(), y: e.target.y() };
              onArrowEndpoints(annotation.id, { from: next, to: annotation.to });
            }}
          />
          <Circle
            x={annotation.to.x}
            y={annotation.to.y}
            radius={HANDLE_RADIUS}
            fill={HANDLE_FILL}
            stroke={OUTLINE_ACCENT}
            strokeWidth={HANDLE_STROKE_WIDTH}
            draggable
            onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
            }}
            onDragEnd={(e) => {
              const next: Point = { x: e.target.x(), y: e.target.y() };
              onArrowEndpoints(annotation.id, { from: annotation.from, to: next });
            }}
          />
        </>
      )}
    </>
  );
};
