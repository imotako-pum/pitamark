import type { Annotation } from '@snap-share/shared';
import { Layer } from 'react-konva';
import { ArrowShape } from './shapes/ArrowShape';
import { HighlightShape } from './shapes/HighlightShape';
import { RectangleShape } from './shapes/RectangleShape';
import { TextShape } from './shapes/TextShape';

type AnnotationLayerProps = Readonly<{
  annotations: ReadonlyArray<Annotation>;
  selectedId: string | null;
  editingTextId: string | null;
  onShapeClick: (id: string) => void;
  onShapeMove: (id: string, dx: number, dy: number) => void;
  onTextDoubleClick: (id: string) => void;
}>;

export const AnnotationLayer = ({
  annotations,
  selectedId,
  editingTextId,
  onShapeClick,
  onShapeMove,
  onTextDoubleClick,
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
