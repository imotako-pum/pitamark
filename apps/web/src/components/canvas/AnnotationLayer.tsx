import type { Annotation } from '@pitamark/shared';
import { Layer } from 'react-konva';
import { type ArrowEndpointsPatch, ArrowShape } from './shapes/ArrowShape';
import { type HighlightResizePatch, HighlightShape } from './shapes/HighlightShape';
import { type RectangleResizePatch, RectangleShape } from './shapes/RectangleShape';
import { TextShape } from './shapes/TextShape';

type AnnotationLayerProps = Readonly<{
  annotations: ReadonlyArray<Annotation>;
  selectedId: string | null;
  editingTextId: string | null;
  onShapeClick: (id: string) => void;
  onShapeMove: (id: string, dx: number, dy: number) => void;
  onTextDoubleClick: (id: string) => void;
  onResizeRectangle: (id: string, patch: RectangleResizePatch) => void;
  onResizeHighlight: (id: string, patch: HighlightResizePatch) => void;
  onArrowEndpoints: (id: string, endpoints: ArrowEndpointsPatch) => void;
  /** Phase 10.J-2: shape 長押しで context menu を出す callback。screen 座標 (clientX/clientY) を anchor に渡す */
  onShapeLongPress?: (id: string, anchor: { x: number; y: number }) => void;
}>;

export const AnnotationLayer = ({
  annotations,
  selectedId,
  editingTextId,
  onShapeClick,
  onShapeMove,
  onTextDoubleClick,
  onResizeRectangle,
  onResizeHighlight,
  onArrowEndpoints,
  onShapeLongPress,
}: AnnotationLayerProps) => (
  <Layer>
    {annotations.map((a) => {
      const isSelected = a.id === selectedId;
      switch (a.type) {
        case 'rectangle':
          return (
            <RectangleShape
              key={a.id}
              annotation={a}
              isSelected={isSelected}
              onClick={onShapeClick}
              onDragEnd={(id, x, y) => onShapeMove(id, x - a.x, y - a.y)}
              onResize={onResizeRectangle}
              onLongPress={onShapeLongPress}
            />
          );
        case 'arrow':
          return (
            <ArrowShape
              key={a.id}
              annotation={a}
              isSelected={isSelected}
              onClick={onShapeClick}
              onDragEnd={onShapeMove}
              onArrowEndpoints={onArrowEndpoints}
              onLongPress={onShapeLongPress}
            />
          );
        case 'text':
          return (
            <TextShape
              key={a.id}
              annotation={a}
              isSelected={isSelected}
              isEditing={editingTextId === a.id}
              onClick={onShapeClick}
              onDragEnd={(id, x, y) => onShapeMove(id, x - a.x, y - a.y)}
              onDoubleClick={onTextDoubleClick}
              onLongPress={onShapeLongPress}
            />
          );
        case 'highlight':
          return (
            <HighlightShape
              key={a.id}
              annotation={a}
              isSelected={isSelected}
              onClick={onShapeClick}
              onDragEnd={(id, x, y) => onShapeMove(id, x - a.x, y - a.y)}
              onResize={onResizeHighlight}
              onLongPress={onShapeLongPress}
            />
          );
        default: {
          const _exhaustive: never = a;
          return _exhaustive;
        }
      }
    })}
  </Layer>
);
