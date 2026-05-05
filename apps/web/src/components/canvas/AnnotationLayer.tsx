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
