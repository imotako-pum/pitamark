import type { TextAnnotation } from '@pitamark/shared';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Group, Rect as KonvaRect, Text as KonvaText } from 'react-konva';
import { OUTLINE_ACCENT } from '../colors';

type TextShapeProps = Readonly<{
  annotation: TextAnnotation;
  isSelected: boolean;
  isEditing: boolean;
  onClick: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClick: (id: string) => void;
}>;

const SELECTION_PADDING = 4;
// Approximate glyph width factor for the default sans-serif font; Konva's
// real bounding box is computed at render time, but for the dashed selection
// frame this estimate is good enough until we wire up Konva.Text#getClientRect.
const APPROX_GLYPH_WIDTH_RATIO = 0.6;
const APPROX_LINE_HEIGHT_RATIO = 1.4;

export const TextShape = ({
  annotation,
  isSelected,
  isEditing,
  onClick,
  onDragEnd,
  onDoubleClick,
}: TextShapeProps) => {
  const showSelection = isSelected && !isEditing;
  const visibleChars = Math.max(annotation.text.length, 1);
  const frameWidth =
    visibleChars * annotation.fontSize * APPROX_GLYPH_WIDTH_RATIO + SELECTION_PADDING * 2;
  const frameHeight = annotation.fontSize * APPROX_LINE_HEIGHT_RATIO + SELECTION_PADDING * 2;

  return (
    <Group
      x={annotation.x}
      y={annotation.y}
      draggable
      onClick={(e: KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        onClick(annotation.id);
      }}
      // ADR-0007 D1: touch では `tap` が別発火するため `onClick` と paired binding。
      // body は onClick と同一で、選択 dispatch のみ。edit 進入は `onDblTap` 経由。
      onTap={(e: KonvaEventObject<TouchEvent>) => {
        e.cancelBubble = true;
        onClick(annotation.id);
      }}
      onDblClick={(e: KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        onDoubleClick(annotation.id);
      }}
      // Phase 10.I post-review fix: Konva の `dblclick` は mouse event 専用、touch
      // のダブルタップは別イベント `dbltap` として発火する。両方 bind するのが Konva
      // 公式パターン (https://konvajs.org/docs/events/Desktop_and_Mobile.html)。
      // 既存 `onDblClick` (PC) は維持して desktop 非劣化、`onDblTap` (touch) を追加。
      onDblTap={(e: KonvaEventObject<TouchEvent>) => {
        e.cancelBubble = true;
        onDoubleClick(annotation.id);
      }}
      onDragEnd={(e) => onDragEnd(annotation.id, e.target.x(), e.target.y())}
    >
      {showSelection && (
        <KonvaRect
          x={-SELECTION_PADDING}
          y={-SELECTION_PADDING}
          width={frameWidth}
          height={frameHeight}
          stroke={OUTLINE_ACCENT}
          strokeWidth={1}
          dash={[4, 3]}
        />
      )}
      <KonvaText
        visible={!isEditing}
        text={annotation.text}
        fontSize={annotation.fontSize}
        fill={annotation.color}
        padding={0}
        lineHeight={1.2}
      />
    </Group>
  );
};
