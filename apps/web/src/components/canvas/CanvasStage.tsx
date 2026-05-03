import type { Annotation, Point } from '@snap-share/shared';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { type ReactNode, type Ref, useCallback, useRef, useState } from 'react';
import { Stage } from 'react-konva';
import type { AnnotationsStore } from '../../hooks/useAnnotationsStore';
import { generateId } from '../../lib/id';
import { AnnotationLayer } from './AnnotationLayer';
import { DEFAULT_FONT_SIZE, DEFAULT_STROKE_WIDTH } from './colors';
import { ImageLayer } from './ImageLayer';
import type { ArrowEndpointsPatch } from './shapes/ArrowShape';
import type { HighlightResizePatch } from './shapes/HighlightShape';
import type { RectangleResizePatch } from './shapes/RectangleShape';

type CanvasStageProps = Readonly<{
  src: string;
  width: number;
  height: number;
  store: AnnotationsStore;
  editingTextId: string | null;
  onTextDoubleClick: (id: string) => void;
  onStartTextEditing: (id: string) => void;
  /** Stage-relative cursor position. Null when the pointer leaves the stage. */
  onCursorMove?: (point: { x: number; y: number } | null) => void;
  /** Extra Konva layers rendered on top of the annotation layer. */
  extraLayers?: ReactNode;
  /** Ref to the underlying Konva.Stage (for PNG export). */
  stageRef?: Ref<Konva.Stage>;
}>;

const MIN_DRAG_PIXELS = 4;

type DragStart = Readonly<{ x: number; y: number; id: string; createdAt: number }>;

// All draft builders take the active color so the new annotation is born with
// it. Phase 7.7-2 split this into sync/highlight lanes; we collapsed it back to
// one because the lane indicator discontinuity bothered users.
const buildDraftRectangle = (
  start: DragStart,
  x: number,
  y: number,
  color: string,
): Annotation => ({
  id: start.id,
  type: 'rectangle',
  createdAt: start.createdAt,
  x: Math.min(start.x, x),
  y: Math.min(start.y, y),
  width: Math.max(Math.abs(x - start.x), 1),
  height: Math.max(Math.abs(y - start.y), 1),
  color,
  strokeWidth: DEFAULT_STROKE_WIDTH,
});

const buildDraftHighlight = (
  start: DragStart,
  x: number,
  y: number,
  color: string,
): Annotation => ({
  id: start.id,
  type: 'highlight',
  createdAt: start.createdAt,
  x: Math.min(start.x, x),
  y: Math.min(start.y, y),
  width: Math.max(Math.abs(x - start.x), 1),
  height: Math.max(Math.abs(y - start.y), 1),
  color,
});

const buildDraftArrow = (start: DragStart, x: number, y: number, color: string): Annotation => ({
  id: start.id,
  type: 'arrow',
  createdAt: start.createdAt,
  from: { x: start.x, y: start.y },
  to: { x, y },
  color,
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
  onCursorMove,
  extraLayers,
  stageRef,
}: CanvasStageProps) => {
  const { state, dispatch } = store;
  const { tool, selectedId, annotations, activeColor } = state;
  // draft and dragStart live in refs so consecutive mouse events within a single
  // React render cycle (mousedown -> mousemove -> mouseup) always observe the
  // latest values without waiting for state flush. The state mirror keeps the
  // draft visible during the drag preview.
  const dragStartRef = useRef<DragStart | null>(null);
  const draftRef = useRef<Annotation | null>(null);
  const [draft, setDraft] = useState<Annotation | null>(null);

  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const isStageClick = e.target === e.target.getStage();

      // Universal deselect rule: empty-stage click clears selection regardless
      // of tool. Without this, drawing tools left the previous selection
      // hanging until a new annotation got created.
      if (isStageClick && selectedId) {
        dispatch({ type: 'select/set', id: null });
      }

      if (tool === 'select') return;

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
          color: activeColor,
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
      dragStartRef.current = start;
    },
    [tool, dispatch, onStartTextEditing, activeColor, selectedId],
  );

  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition() ?? null;

      // Broadcast the raw pointer position so presence can throttle and emit.
      if (onCursorMove) {
        onCursorMove(pos ? { x: pos.x, y: pos.y } : null);
      }

      const dragStart = dragStartRef.current;
      if (!dragStart || !pos) return;

      let next: Annotation | null = null;
      if (tool === 'rectangle') next = buildDraftRectangle(dragStart, pos.x, pos.y, activeColor);
      else if (tool === 'highlight')
        next = buildDraftHighlight(dragStart, pos.x, pos.y, activeColor);
      else if (tool === 'arrow') next = buildDraftArrow(dragStart, pos.x, pos.y, activeColor);
      if (next) {
        draftRef.current = next;
        setDraft(next);
      }
    },
    [tool, onCursorMove, activeColor],
  );

  const handleMouseLeave = useCallback(() => {
    // Bypass any rAF throttle the parent may have applied: we want the
    // cursor to disappear from peers' canvases immediately, not on the next
    // animation frame after the pointer is already gone.
    if (onCursorMove) onCursorMove(null);
  }, [onCursorMove]);

  const handleMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const dragStart = dragStartRef.current;
      const currentDraft = draftRef.current;
      if (!dragStart) return;
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition() ?? null;
      const reachedThreshold = pos && distance(dragStart, pos.x, pos.y) >= MIN_DRAG_PIXELS;

      if (reachedThreshold && currentDraft) {
        dispatch({ type: 'annotation/add', annotation: currentDraft });
        dispatch({ type: 'select/set', id: currentDraft.id });
      }
      draftRef.current = null;
      dragStartRef.current = null;
      setDraft(null);
    },
    [dispatch],
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

  const handleResizeRectangle = useCallback(
    (id: string, patch: RectangleResizePatch) => {
      dispatch({
        type: 'annotation/resize-rect',
        id,
        x: patch.x,
        y: patch.y,
        width: patch.width,
        height: patch.height,
      });
    },
    [dispatch],
  );

  const handleResizeHighlight = useCallback(
    (id: string, patch: HighlightResizePatch) => {
      dispatch({
        type: 'annotation/resize-highlight',
        id,
        x: patch.x,
        y: patch.y,
        width: patch.width,
        height: patch.height,
      });
    },
    [dispatch],
  );

  const handleArrowEndpoints = useCallback(
    (id: string, endpoints: ArrowEndpointsPatch) => {
      const from: Point = { x: endpoints.from.x, y: endpoints.from.y };
      const to: Point = { x: endpoints.to.x, y: endpoints.to.y };
      dispatch({ type: 'annotation/set-arrow-endpoints', id, from, to });
    },
    [dispatch],
  );

  const visibleAnnotations: ReadonlyArray<Annotation> = draft
    ? [...annotations, draft]
    : annotations;

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <ImageLayer src={src} />
      <AnnotationLayer
        annotations={visibleAnnotations}
        selectedId={selectedId}
        editingTextId={editingTextId}
        onShapeClick={handleShapeClick}
        onShapeMove={handleShapeMove}
        onTextDoubleClick={onTextDoubleClick}
        onResizeRectangle={handleResizeRectangle}
        onResizeHighlight={handleResizeHighlight}
        onArrowEndpoints={handleArrowEndpoints}
      />
      {extraLayers}
    </Stage>
  );
};
