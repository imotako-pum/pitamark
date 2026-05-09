import type { ArrowAnnotation, Point } from '@pitamark/shared';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Circle, Arrow as KonvaArrow } from 'react-konva';
import { useTouchDevice } from '../../../hooks/useTouchDevice';
import {
  ARROW_POINTER_LENGTH,
  ARROW_POINTER_WIDTH,
  HANDLE_FILL,
  HANDLE_RADIUS,
  HANDLE_RADIUS_TOUCH,
  HANDLE_STROKE_WIDTH,
  HIT_STROKE_WIDTH_TOUCH,
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
  const isTouch = useTouchDevice();
  const handleRadius = isTouch ? HANDLE_RADIUS_TOUCH : HANDLE_RADIUS;
  // touch 時のみ細線への hit zone を拡張。desktop では密接した矢印で誤タップが
  // 増えないよう annotation.strokeWidth 維持 (= 視覚と同じ幅で hit する)。
  const arrowHitStrokeWidth = isTouch ? HIT_STROKE_WIDTH_TOUCH : annotation.strokeWidth;
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
        // ユーザは「鏃の方から」矢印を引く感覚で操作するため、pointerdown 位置
        // (= from = dragStart) に矢じり、pointerup 位置 (= to) を尾にする。Konva の
        // default は pointerAtEnding=true (to 側に矢じり) なので、反転して
        // pointerAtBeginning=true / pointerAtEnding=false に切り替えている。これで
        // Auto-next-A の text 位置 (to + offset、to - from 方向の延長) が自動的に
        // 「尾側 = 鏃じゃない側」に来る。
        pointerAtBeginning
        pointerAtEnding={false}
        pointerLength={ARROW_POINTER_LENGTH}
        pointerWidth={ARROW_POINTER_WIDTH}
        stroke={stroke}
        fill={stroke}
        strokeWidth={strokeWidth}
        hitStrokeWidth={arrowHitStrokeWidth}
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
            radius={handleRadius}
            fill={HANDLE_FILL}
            stroke={OUTLINE_ACCENT}
            strokeWidth={HANDLE_STROKE_WIDTH}
            draggable
            onPointerDown={(e: KonvaEventObject<PointerEvent>) => {
              // 単一 pointer (mouse / pen / single-touch) の cancelBubble。
              // 親 Arrow の draggable に drag を奪わせない。
              e.cancelBubble = true;
            }}
            // ADR-0007 D1 + ADR-0006 Status Update: Stage 側に `onTouchMove` (10.I-2 の
            // multi-touch pinch) が bind されているため、touch event 経路でも親への伝搬を
            // 抑止する必要がある。`onPointerDown` だけでは Konva の touch event 経路には
            // 届かないため、paired で `onTouchStart` を追加。
            onTouchStart={(e: KonvaEventObject<TouchEvent>) => {
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
            radius={handleRadius}
            fill={HANDLE_FILL}
            stroke={OUTLINE_ACCENT}
            strokeWidth={HANDLE_STROKE_WIDTH}
            draggable
            onPointerDown={(e: KonvaEventObject<PointerEvent>) => {
              // 単一 pointer (mouse / pen / single-touch) の cancelBubble。
              e.cancelBubble = true;
            }}
            // ADR-0007 D1 + ADR-0006 Status Update: from-handle と同様に touch event 経路
            // でも親への伝搬を抑止 (Stage の `onTouchMove` 経路対策)。
            onTouchStart={(e: KonvaEventObject<TouchEvent>) => {
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
