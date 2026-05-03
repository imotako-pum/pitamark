import type { Annotation, Point } from '@snap-share/shared';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { type ReactNode, type Ref, useCallback, useEffect, useRef, useState } from 'react';
import { Arrow as KonvaArrow, Layer, Stage } from 'react-konva';
import type { AnnotationsStore } from '../../hooks/useAnnotationsStore';
import { isEditableTarget } from '../../hooks/useKeyboardShortcuts';
import { type StageTransform, ZOOM_STEP } from '../../hooks/useStageTransform';
import { AUTO_NEXT_TEXT_OFFSET_PX, computeAutoNextTextOffset } from '../../lib/autoNextOffset';
import { generateId } from '../../lib/id';
import { AnnotationLayer } from './AnnotationLayer';
import {
  ARROW_POINTER_LENGTH,
  ARROW_POINTER_WIDTH,
  DEFAULT_FONT_SIZE,
  DEFAULT_STROKE_WIDTH,
} from './colors';
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
  /** Phase 7.8-1: `options.autoNext` が true のときは Auto-next-A 連鎖中であることを
   *  EditorShell に伝え、text 編集確定/キャンセル後に tool=select に戻すフラグ管理に使う。 */
  onStartTextEditing: (id: string, options?: { autoNext?: boolean }) => void;
  /** Stage-relative cursor position. Null when the pointer leaves the stage. */
  onCursorMove?: (point: { x: number; y: number } | null) => void;
  /** Extra Konva layers rendered on top of the annotation layer. */
  extraLayers?: ReactNode;
  /** Ref to the underlying Konva.Stage (for PNG export). */
  stageRef?: Ref<Konva.Stage>;
  /** Stage transform (scale + position). Identity when unset. */
  transform: StageTransform;
  /** Pinch / Cmd+wheel ズーム。pointer は Stage absolute 座標。*/
  onZoom: (pointer: { x: number; y: number }, factor: number) => void;
  /** Space+drag による pan。dx/dy は screen 座標の差分。*/
  onPan: (dx: number, dy: number) => void;
  /** ImageLayer から伝播される画像 natural サイズ。null は src 切替リセット。*/
  onImageLoaded?: (size: { width: number; height: number } | null) => void;
  /** Phase 7.8-2 Auto-next-B: pending 中の既定矢印プレビュー(半透明)を描画する。
   *  null のときはプレビュー無し。state は EditorShell に置き、ここでは受け取って
   *  描画するだけ。 */
  pendingAutoArrow: { from: Point; to: Point; color: string; strokeWidth: number } | null;
  /** Phase 7.8-2: 矩形 mouseup 直後に呼ばれる。EditorShell が pending state を立てる。 */
  onAutoNextRectangle: (rect: { x: number; y: number; width: number; height: number }) => void;
  /** Phase 7.8-2: マウス mousedown 任意座標で pending をキャンセルする経路。
   *  pending が null のときは no-op、null でないときは EditorShell が pending を null
   *  にする。CanvasStage はクリア後に通常の mousedown 処理を続行する。 */
  onCancelAutoArrowIfAny: () => void;
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
  transform,
  onZoom,
  onPan,
  onImageLoaded,
  pendingAutoArrow,
  onAutoNextRectangle,
  onCancelAutoArrowIfAny,
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
  // Pan-mode bookkeeping. Space turns mousedown/move/up into pan instead of
  // the active tool. spaceDownRef arms the next mousedown; panActiveRef
  // tracks the in-flight pan and survives Space release while the mouse is
  // still down, mirroring Figma/Photoshop behavior.
  const spaceDownRef = useRef(false);
  const panActiveRef = useRef(false);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);
  const internalStageRef = useRef<Konva.Stage | null>(null);

  // Cursor feedback for Space-pan. We tweak the underlying canvas container's
  // CSS cursor directly because react-konva does not surface a className prop
  // on Stage and the wrapping div is owned by react-konva internals.
  const setCursor = useCallback((cursor: string) => {
    const stage = internalStageRef.current;
    if (!stage) return;
    stage.container().style.cursor = cursor;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isEditableTarget(e.target)) return;
      if (spaceDownRef.current) return;
      spaceDownRef.current = true;
      setCursor('grab');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      spaceDownRef.current = false;
      // If a pan is mid-flight (mouse still down), let mouseup finish it.
      if (!panActiveRef.current) {
        setCursor('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setCursor]);

  const composedStageRef = useCallback(
    (node: Konva.Stage | null) => {
      internalStageRef.current = node;
      if (typeof stageRef === 'function') {
        stageRef(node);
      } else if (stageRef) {
        // Mutating a Ref<T> requires the cast — React types ref as readonly.
        (stageRef as { current: Konva.Stage | null }).current = node;
      }
    },
    [stageRef],
  );

  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      // Space + drag → pan, regardless of the active tool. We use absolute
      // pointer position so the delta math is in screen pixels (matches
      // Stage.x/y which are also in screen space).
      if (spaceDownRef.current) {
        const pos = stage.getPointerPosition();
        if (!pos) return;
        panActiveRef.current = true;
        panLastRef.current = pos;
        setCursor('grabbing');
        return;
      }

      // Phase 7.8-2: pending Auto-arrow があれば、マウスクリック (任意座標) で
      // キャンセル。クリック自体は通常の mousedown 処理を続行する (stage クリックで
      // 選択解除など) → ユーザーが「右下既定矢印が合わない」時に自前で矢印を描き
      // 始められる。pending が null のときは EditorShell 側で no-op になる。
      onCancelAutoArrowIfAny();

      const isStageClick = e.target === stage;

      // Universal deselect rule: empty-stage click clears selection regardless
      // of tool. Without this, drawing tools left the previous selection
      // hanging until a new annotation got created.
      if (isStageClick && selectedId) {
        dispatch({ type: 'select/set', id: null });
      }

      if (tool === 'select') return;

      // Hit-test in logical coords so Stage transform (scale/pan) does not
      // throw off where the new annotation lands.
      const pos = stage.getRelativePointerPosition();
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
    [
      tool,
      dispatch,
      onStartTextEditing,
      activeColor,
      selectedId,
      setCursor,
      onCancelAutoArrowIfAny,
    ],
  );

  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      // Active pan: stream screen-space deltas to the parent.
      if (panActiveRef.current) {
        const screen = stage.getPointerPosition();
        const last = panLastRef.current;
        if (!screen || !last) return;
        onPan(screen.x - last.x, screen.y - last.y);
        panLastRef.current = screen;
        return;
      }

      const pos = stage.getRelativePointerPosition();

      // Broadcast the logical pointer position so presence can throttle and
      // emit. Logical coords keep peers' cursor render aligned regardless of
      // local zoom.
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
    [tool, onCursorMove, activeColor, onPan],
  );

  const handleMouseLeave = useCallback(() => {
    // Bypass any rAF throttle the parent may have applied: we want the
    // cursor to disappear from peers' canvases immediately, not on the next
    // animation frame after the pointer is already gone.
    if (onCursorMove) onCursorMove(null);
  }, [onCursorMove]);

  const handleMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (panActiveRef.current) {
        panActiveRef.current = false;
        panLastRef.current = null;
        setCursor(spaceDownRef.current ? 'grab' : '');
        return;
      }

      const dragStart = dragStartRef.current;
      const currentDraft = draftRef.current;
      if (!dragStart) return;
      const stage = e.target.getStage();
      const pos = stage?.getRelativePointerPosition() ?? null;
      const reachedThreshold = pos && distance(dragStart, pos.x, pos.y) >= MIN_DRAG_PIXELS;

      if (reachedThreshold && currentDraft) {
        dispatch({ type: 'annotation/add', annotation: currentDraft });
        dispatch({ type: 'select/set', id: currentDraft.id });

        // Phase 7.8-2 Auto-next-B: 矩形確定直後に既定矢印プレビューを立てる。
        // pending state は EditorShell に置き、stopUndoCapture の呼出も
        // EditorShell 側 (handleAutoNextRectangle 内) に集約。ここでは callback
        // で通知するだけ。
        if (currentDraft.type === 'rectangle') {
          onAutoNextRectangle({
            x: currentDraft.x,
            y: currentDraft.y,
            width: currentDraft.width,
            height: currentDraft.height,
          });
        }

        // Phase 7.8-1 Auto-next-A: 矢印確定直後に終端 +offset で空 text 注釈を
        // 即時編集モードで起動する。既存の text ツール即時編集パターン
        // (handleMouseDown の tool === 'text' 分岐, L207 周辺) と同じ shape を、
        // 座標と tool 切替だけ差し替えて再利用する。EditorShell 側は autoNext=true
        // を受けて「commit/cancel 後に tool=select に戻す」フラグを立てる。
        if (currentDraft.type === 'arrow') {
          // 矢印 add(直前の dispatch)と text add を独立 undo step に分けるための
          // break point。Yjs UndoManager の captureTimeout(500ms)が原因で、
          // これを呼ばないと連続操作が 1 step に merge され Cmd+Z 1 回で両方消える。
          store.stopUndoCapture();

          const offset = computeAutoNextTextOffset(
            currentDraft.from,
            currentDraft.to,
            AUTO_NEXT_TEXT_OFFSET_PX,
          );
          const textId = generateId();
          const textAnnotation: Annotation = {
            id: textId,
            type: 'text',
            createdAt: Date.now(),
            x: currentDraft.to.x + offset.x,
            y: currentDraft.to.y + offset.y,
            text: '',
            fontSize: DEFAULT_FONT_SIZE,
            color: activeColor,
          };
          dispatch({ type: 'annotation/add', annotation: textAnnotation });
          dispatch({ type: 'tool/set', tool: 'text' });
          dispatch({ type: 'select/set', id: textId });
          onStartTextEditing(textId, { autoNext: true });
        }
      }
      draftRef.current = null;
      dragStartRef.current = null;
      setDraft(null);
    },
    // store 全体を依存させると毎レンダーで identity が変わって handleMouseUp が
    // 再生成されるため、Auto-next-A で実際に使う stopUndoCapture のみを依存させる。
    [
      dispatch,
      setCursor,
      activeColor,
      onStartTextEditing,
      store.stopUndoCapture,
      onAutoNextRectangle,
    ],
  );

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      // Modifier matrix:
      //   - Cmd/Ctrl+wheel + macOS trackpad pinch (ctrlKey=true) → zoom
      //   - Shift+wheel → horizontal pan (vertical wheel delta が deltaX に変換)
      //   - modless wheel (mouse / trackpad 2-finger swipe) → pan (deltaX/Y そのまま)
      // すべての wheel をアプリ側で扱うので preventDefault は無条件。
      e.evt.preventDefault();
      const stage = e.target.getStage();
      if (!stage) return;

      const isZoomGesture = e.evt.ctrlKey || e.evt.metaKey;
      if (isZoomGesture) {
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const factor = e.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
        onZoom(pointer, factor);
        return;
      }

      // Pan: scroll delta は「コンテンツを動かしたい量の逆」 (下スクロール →
      // 視点が下へ → Stage.y は減る)。よって onPan には符号反転して渡す。
      if (e.evt.shiftKey) {
        // Shift+wheel = 横パン。プラットフォームによって delta の乗る軸が違う:
        //   - 物理マウスホイール + Shift (Chrome/macOS): deltaY が乗る、deltaX=0
        //   - macOS トラックパッド 2 本指 + Shift: OS が deltaY→deltaX 変換済み
        // 両方をカバーするために deltaX + deltaY を合算 (片方は常に 0 の前提)。
        onPan(-(e.evt.deltaX + e.evt.deltaY), 0);
        return;
      }
      onPan(-e.evt.deltaX, -e.evt.deltaY);
    },
    [onZoom, onPan],
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
      ref={composedStageRef}
      width={width}
      height={height}
      scaleX={transform.scale}
      scaleY={transform.scale}
      x={transform.x}
      y={transform.y}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    >
      <ImageLayer src={src} onImageLoaded={onImageLoaded} />
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
      {pendingAutoArrow && (
        <Layer listening={false}>
          <KonvaArrow
            points={[
              pendingAutoArrow.from.x,
              pendingAutoArrow.from.y,
              pendingAutoArrow.to.x,
              pendingAutoArrow.to.y,
            ]}
            // Phase 7.8-1 の反転を踏襲: 矢じり = from = 矩形右辺中央、尾 = to = 起点。
            pointerAtBeginning
            pointerAtEnding={false}
            pointerLength={ARROW_POINTER_LENGTH}
            pointerWidth={ARROW_POINTER_WIDTH}
            stroke={pendingAutoArrow.color}
            fill={pendingAutoArrow.color}
            strokeWidth={pendingAutoArrow.strokeWidth}
            opacity={0.4}
          />
        </Layer>
      )}
      {extraLayers}
    </Stage>
  );
};
