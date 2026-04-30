import type { Annotation } from '@snap-share/shared';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useCallback, useState } from 'react';
import { Stage } from 'react-konva';
import type { AnnotationsStore } from '../../hooks/useAnnotationsStore';
import { generateId } from '../../lib/id';
import { AnnotationLayer } from './AnnotationLayer';
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_STROKE_WIDTH,
  FILL_HIGHLIGHT,
  FILL_TEXT,
  STROKE_ARROW,
  STROKE_RECTANGLE,
} from './colors';
import { ImageLayer } from './ImageLayer';

type CanvasStageProps = Readonly<{
  src: string;
  width: number;
  height: number;
  store: AnnotationsStore;
  editingTextId: string | null;
  onTextDoubleClick: (id: string) => void;
  onStartTextEditing: (id: string) => void;
}>;

const MIN_DRAG_PIXELS = 4;

type DragStart = Readonly<{ x: number; y: number; id: string; createdAt: number }>;

const buildDraftRectangle = (start: DragStart, x: number, y: number): Annotation => ({
  id: start.id,
  type: 'rectangle',
  createdAt: start.createdAt,
  x: Math.min(start.x, x),
  y: Math.min(start.y, y),
  width: Math.max(Math.abs(x - start.x), 1),
  height: Math.max(Math.abs(y - start.y), 1),
  stroke: STROKE_RECTANGLE,
  strokeWidth: DEFAULT_STROKE_WIDTH,
});

const buildDraftHighlight = (start: DragStart, x: number, y: number): Annotation => ({
  id: start.id,
  type: 'highlight',
  createdAt: start.createdAt,
  x: Math.min(start.x, x),
  y: Math.min(start.y, y),
  width: Math.max(Math.abs(x - start.x), 1),
  height: Math.max(Math.abs(y - start.y), 1),
  fill: FILL_HIGHLIGHT,
});

const buildDraftArrow = (start: DragStart, x: number, y: number): Annotation => ({
  id: start.id,
  type: 'arrow',
  createdAt: start.createdAt,
  from: { x: start.x, y: start.y },
  to: { x, y },
  stroke: STROKE_ARROW,
  strokeWidth: DEFAULT_STROKE_WIDTH,
});

const distance = (a: DragStart, x: number, y: number) => Math.hypot(x - a.x, y - a.y);

export const CanvasStage = ({
  src,
  width,
  height,
  store,
  editingTextId,
  onTextDoubleClick,
  onStartTextEditing,
}: CanvasStageProps) => {
  const { state, dispatch } = store;
  const { tool, selectedId, annotations } = state;
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [dragStart, setDragStart] = useState<DragStart | null>(null);

  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (tool === 'select') {
        if (e.target === e.target.getStage()) {
          dispatch({ type: 'select/set', id: null });
        }
        return;
      }
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      if (e.target !== stage) return;

      if (tool === 'text') {
        const id = generateId();
        const annotation: Annotation = {
          id,
          type: 'text',
          createdAt: Date.now(),
          x: pos.x,
          y: pos.y,
          text: '',
          fontSize: DEFAULT_FONT_SIZE,
          fill: FILL_TEXT,
        };
        dispatch({ type: 'annotation/add', annotation });
        dispatch({ type: 'select/set', id });
        onStartTextEditing(id);
        return;
      }

      const start: DragStart = {
        x: pos.x,
        y: pos.y,
        id: generateId(),
        createdAt: Date.now(),
      };
      setDragStart(start);
    },
    [tool, dispatch, onStartTextEditing],
  );

  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!dragStart) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      let next: Annotation | null = null;
      if (tool === 'rectangle') next = buildDraftRectangle(dragStart, pos.x, pos.y);
      else if (tool === 'highlight') next = buildDraftHighlight(dragStart, pos.x, pos.y);
      else if (tool === 'arrow') next = buildDraftArrow(dragStart, pos.x, pos.y);
      if (next) setDraft(next);
    },
    [dragStart, tool],
  );

  const handleMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!dragStart) return;
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition() ?? null;
      const reachedThreshold = pos && distance(dragStart, pos.x, pos.y) >= MIN_DRAG_PIXELS;

      if (reachedThreshold && draft) {
        dispatch({ type: 'annotation/add', annotation: draft });
        dispatch({ type: 'select/set', id: draft.id });
      }
      setDraft(null);
      setDragStart(null);
    },
    [dragStart, draft, dispatch],
  );

  const handleShapeClick = useCallback(
    (id: string) => dispatch({ type: 'select/set', id }),
    [dispatch],
  );

  const handleShapeMove = useCallback(
    (id: string, dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return;
      dispatch({ type: 'annotation/move', id, dx, dy });
    },
    [dispatch],
  );

  const visibleAnnotations: ReadonlyArray<Annotation> = draft
    ? [...annotations, draft]
    : annotations;

  return (
    <Stage
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <ImageLayer src={src} />
      <AnnotationLayer
        annotations={visibleAnnotations}
        selectedId={selectedId}
        editingTextId={editingTextId}
        onShapeClick={handleShapeClick}
        onShapeMove={handleShapeMove}
        onTextDoubleClick={onTextDoubleClick}
      />
    </Stage>
  );
};
