import type { Annotation, Point } from '@pitamark/shared';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { type ReactNode, type Ref, useCallback, useEffect, useRef, useState } from 'react';
import { Arrow as KonvaArrow, Layer, Stage } from 'react-konva';
import type { Tool } from '../../hooks/annotationsReducer';
import type { AnnotationsStore } from '../../hooks/useAnnotationsStore';
import { isEditableTarget } from '../../hooks/useKeyboardShortcuts';
import {
  getCenter,
  getDistance,
  type StageTransform,
  ZOOM_STEP,
} from '../../hooks/useStageTransform';
import { AUTO_NEXT_TEXT_OFFSET_PX, computeAutoNextTextOffset } from '../../lib/autoNextOffset';
import { generateId } from '../../lib/id';
import { AnnotationLayer } from './AnnotationLayer';
import { ARROW_POINTER_LENGTH, ARROW_POINTER_WIDTH, DEFAULT_STROKE_WIDTH } from './colors';
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
  /** `options.autoNext` が true のときは Auto-next-A 連鎖中であることを EditorShell に
   *  伝え、text 編集の確定/キャンセル後に tool=select に戻すフラグ管理に使う。 */
  onStartTextEditing: (id: string, options?: { autoNext?: boolean }) => void;
  /** Stage 基準の cursor 位置。pointer が Stage を離れたら null。 */
  onCursorMove?: (point: { x: number; y: number } | null) => void;
  /** annotation layer の上に重ねる追加 Konva layer。 */
  extraLayers?: ReactNode;
  /** PNG export 用の Konva.Stage への ref。 */
  stageRef?: Ref<Konva.Stage>;
  /** Stage transform (scale + position)。未設定時は identity。 */
  transform: StageTransform;
  /** Pinch / Cmd+wheel ズーム。pointer は Stage absolute 座標。*/
  onZoom: (pointer: { x: number; y: number }, factor: number) => void;
  /** Space+drag による pan。dx/dy は screen 座標の差分。*/
  onPan: (dx: number, dy: number) => void;
  /** Phase 10.I-2: 2-finger pinch / pan (Konva 公式 multi-touch パターン)。
   *  EditorShell が `applyPinch` で transform を更新する。center は Stage container
   *  基準の screen 座標、distRatio は 2 点間距離の比 (newDist / lastDist)。 */
  onPinchPan: (input: {
    center: { x: number; y: number };
    distRatio: number;
    panDx: number;
    panDy: number;
  }) => void;
  /** ImageLayer から伝播される画像 natural サイズ。null は src 切替リセット。*/
  onImageLoaded?: (size: { width: number; height: number } | null) => void;
  /** Auto-next-B: pending 中の既定矢印プレビュー (半透明) を描画する。null のときは
   *  プレビュー無し。state は EditorShell に置き、ここでは受け取って描画するだけ。 */
  pendingAutoArrow: { from: Point; to: Point; color: string; strokeWidth: number } | null;
  /** 矩形 pointerup 直後に呼ばれる。EditorShell が Auto-next-B の pending state を立てる。 */
  onAutoNextRectangle: (rect: { x: number; y: number; width: number; height: number }) => void;
  /** ポインタダウン任意座標で pending をキャンセルする経路。pending が null のときは
   *  no-op、null でないときは EditorShell が pending を null にする。CanvasStage は
   *  クリア後に通常の pointerdown 処理を続行する。 */
  onCancelAutoArrowIfAny: () => void;
  /** Phase 10.J-2: shape 長押しで context menu を出す callback。anchor は screen 座標
   *  (clientX/clientY)。EditorShell で menu state を hold + ContextMenu を render する。 */
  onShapeLongPress?: (id: string, anchor: { x: number; y: number }) => void;
}>;

const MIN_DRAG_PIXELS = 4;

type DragStart = Readonly<{ x: number; y: number; id: string; createdAt: number }>;

// 全 draft builder は active color を引数に取り、新規 annotation が生成時点でその色を
// 持つようにする。以前 sync/highlight でレーンを分けていたが、tool 切替時の indicator
// 不連続が UX 上の違和感だったので 1 レーンに集約した。
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

// drag-based tool だけを集める。`Exclude<Tool, 'select' | 'text'>` で「select は drag を
// 持たず、text は pointerdown その場確定 (drag 不要)」という設計を型に埋め込む。新規 drag
// tool を `Tool` union に追加すると、この Record に key を増やさない限りコンパイルエラー。
type DraftBuilder = (start: DragStart, x: number, y: number, color: string) => Annotation;

const DRAFT_BUILDERS: Readonly<Record<Exclude<Tool, 'select' | 'text'>, DraftBuilder>> = {
  rectangle: buildDraftRectangle,
  highlight: buildDraftHighlight,
  arrow: buildDraftArrow,
};

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
  onPinchPan,
  onImageLoaded,
  pendingAutoArrow,
  onAutoNextRectangle,
  onCancelAutoArrowIfAny,
  onShapeLongPress,
}: CanvasStageProps) => {
  const { state, dispatch } = store;
  const { tool, selectedId, annotations, activeColor, activeFontSize } = state;
  // draft と dragStart は ref に置く。1 React render cycle 内で連続発火する pointer event
  // (pointerdown → pointermove → pointerup) が state flush を待たずに最新値を観測できる
  // 必要がある。state 側にもミラーするのは drag preview を可視にするため。
  const dragStartRef = useRef<DragStart | null>(null);
  const draftRef = useRef<Annotation | null>(null);
  const [draft, setDraft] = useState<Annotation | null>(null);
  // pan モードの状態管理。Space は pointerdown/move/up を active tool ではなく pan 扱いに
  // する。spaceDownRef が次の pointerdown を arm し、panActiveRef は in-flight 中の pan を
  // 追跡してポインタを離すまで Space 解放にも耐える (Figma / Photoshop と同じ挙動)。
  const spaceDownRef = useRef(false);
  const panActiveRef = useRef(false);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);
  const internalStageRef = useRef<Konva.Stage | null>(null);
  // Phase 10.I-2: multi-touch pinch state。ADR-0006 Status Update 参照。
  // Pointer Events 経路と並列に動く TouchEvent 経路で、2 本指の中点 + 距離を frame
  // 間で trace する。1 frame 目は state 初期化のみ (jitter 防止)、2 frame 目以降で
  // delta を計算して onPinchPan に流す。touchend で null/0 にリセット。
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistRef = useRef<number>(0);

  // Space-pan の cursor フィードバック。react-konva は Stage に className prop を露出
  // しないし、wrapping div は react-konva 内部所有なので、canvas container の CSS cursor
  // を直接いじる。
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
      // pan が in-flight (pointer 押下継続中) なら pointerup で終わらせる。
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
        // React の Ref<T> は readonly 型なので、書き込みには cast が必要。
        (stageRef as { current: Konva.Stage | null }).current = node;
      }
    },
    [stageRef],
  );

  const handlePointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      // Space + drag → 現在 tool に関係なく pan。delta 計算を screen pixel で行うため
      // absolute pointer 位置を使う (Stage.x/y も screen space)。
      if (spaceDownRef.current) {
        const pos = stage.getPointerPosition();
        if (!pos) return;
        panActiveRef.current = true;
        panLastRef.current = pos;
        setCursor('grabbing');
        return;
      }

      // pending Auto-arrow があれば、ポインタダウン (任意座標) でキャンセル。クリック
      // 自体は通常の pointerdown 処理を続行 (stage クリックで選択解除など) するので、
      // ユーザは「右下既定矢印が合わない」時に自前で矢印を描き始められる。pending が
      // null のときは EditorShell 側で no-op になる。
      onCancelAutoArrowIfAny();

      const isStageClick = e.target === stage;

      // 共通の deselect ルール: stage の何も無いところをクリックしたら tool に関わらず
      // 選択を解除する。これが無いと drawing tool で前の選択が新規 annotation 生成まで
      // 残り続けていた。
      if (isStageClick && selectedId) {
        dispatch({ type: 'select/set', id: null });
      }

      if (tool === 'select') return;

      // Stage transform (scale/pan) で着地点がずれないよう、logical 座標で hit-test。
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
          fontSize: activeFontSize,
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
      activeFontSize,
      selectedId,
      setCursor,
      onCancelAutoArrowIfAny,
    ],
  );

  const handlePointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      // active pan 中: screen 座標の delta を親に流す。
      if (panActiveRef.current) {
        const screen = stage.getPointerPosition();
        const last = panLastRef.current;
        if (!screen || !last) return;
        onPan(screen.x - last.x, screen.y - last.y);
        panLastRef.current = screen;
        return;
      }

      const pos = stage.getRelativePointerPosition();

      // logical pointer 位置を broadcast し、presence layer 側で throttle して emit する。
      // logical 座標で送ることで、peer 側の cursor 表示が local zoom に左右されない。
      if (onCursorMove) {
        onCursorMove(pos ? { x: pos.x, y: pos.y } : null);
      }

      const dragStart = dragStartRef.current;
      if (!dragStart || !pos) return;

      // `DRAFT_BUILDERS` (型 `Record<Exclude<Tool, 'select' | 'text'>, ...>`) で lookup
      // し、`else if` チェーンを置き換えている。`select` は draft を持たず、`text` は
      // pointerdown 時点で確定するので、ここで両者を最初に除外する。
      if (tool === 'select' || tool === 'text') return;
      const next = DRAFT_BUILDERS[tool](dragStart, pos.x, pos.y, activeColor);
      draftRef.current = next;
      setDraft(next);
    },
    [tool, onCursorMove, activeColor, onPan],
  );

  const handlePointerLeave = useCallback(() => {
    // 親の rAF throttle をバイパス。pointer が既に Stage を出ているのに、次の
    // animation frame まで peer 側の cursor が残るのを避けたい。
    if (onCursorMove) onCursorMove(null);
  }, [onCursorMove]);

  const handlePointerUp = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
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

        // Auto-next-B: 矩形確定直後に既定矢印のプレビューを立てる。pending state は
        // EditorShell に置き、stopUndoCapture の呼び出しも EditorShell 側
        // (handleAutoNextRectangle 内) に集約。ここでは callback で通知するだけ。
        if (currentDraft.type === 'rectangle') {
          onAutoNextRectangle({
            x: currentDraft.x,
            y: currentDraft.y,
            width: currentDraft.width,
            height: currentDraft.height,
          });
        }

        // Auto-next-A: 矢印確定直後に終端 +offset の位置で空 text annotation を即時
        // 編集モードで起動する。tool === 'text' 分岐と同じ shape を座標と tool 切替
        // だけ差し替えて再利用。EditorShell 側は autoNext=true を受けて「commit/cancel
        // 後に tool=select に戻す」フラグを立てる。
        if (currentDraft.type === 'arrow') {
          // 矢印 add (直前の dispatch) と text add を独立 undo step に分けるための
          // break point。Yjs UndoManager の captureTimeout(500ms) を呼び出さないと
          // 連続操作が 1 step に merge され Cmd+Z 1 回で両方消える。
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
            fontSize: activeFontSize,
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
    // store 全体を依存させると毎レンダーで identity が変わって handlePointerUp が
    // 再生成されるため、Auto-next-A で実際に使う stopUndoCapture のみを依存させる。
    [
      dispatch,
      setCursor,
      activeColor,
      activeFontSize,
      onStartTextEditing,
      store.stopUndoCapture,
      onAutoNextRectangle,
    ],
  );

  // iOS Safari の system gesture 介入 / browser tab 切替 / device sleep 等で発火する
  // pointercancel を pointerup と等価に扱い、drag-in-progress 状態のリークを防ぐ。
  // 詳細は ADR-0006。
  const handlePointerCancel = handlePointerUp;

  // Phase 10.I-2: multi-touch pinch + 2-finger pan (Konva 公式 sandbox 準拠)。
  // 1 本指 (touch1 のみ) は Pointer 経路に任せて何もしない。2 本指検知瞬間に
  // Pointer 経路の in-flight state (drag / draft / pan) を強制中断して責務分離する。
  // ADR-0006 Status Update (Phase 10.I-2) 参照。
  const handleTouchMove = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches;
      const touch1 = touches[0];
      const touch2 = touches[1];
      if (!touch1 || !touch2) {
        // 1 本指 → Pointer 経路に委譲。multi-touch state はリセットだけしておく。
        lastCenterRef.current = null;
        lastDistRef.current = 0;
        return;
      }

      e.evt.preventDefault();

      // 2 本指検知時の責務分離: Pointer 経路の in-flight 状態を全部 abort する。
      if (dragStartRef.current || draftRef.current) {
        dragStartRef.current = null;
        draftRef.current = null;
        setDraft(null);
      }
      if (panActiveRef.current) {
        panActiveRef.current = false;
        panLastRef.current = null;
        setCursor(spaceDownRef.current ? 'grab' : '');
      }

      const stage = e.target.getStage();
      if (!stage) return;
      // Stage container の screen position が CSS で動く可能性 (Phase 10.I-3 で
      // bottom toolbar 化される) に備えて毎回 getBoundingClientRect する。
      const rect = stage.container().getBoundingClientRect();
      const p1 = { x: touch1.clientX - rect.left, y: touch1.clientY - rect.top };
      const p2 = { x: touch2.clientX - rect.left, y: touch2.clientY - rect.top };
      const newCenter = getCenter(p1, p2);
      const newDist = getDistance(p1, p2);

      // 初回検知 frame: state 初期化のみで return (jitter 防止)。
      if (!lastCenterRef.current || lastDistRef.current === 0) {
        lastCenterRef.current = newCenter;
        lastDistRef.current = newDist;
        return;
      }

      onPinchPan({
        center: newCenter,
        distRatio: newDist / lastDistRef.current,
        panDx: newCenter.x - lastCenterRef.current.x,
        panDy: newCenter.y - lastCenterRef.current.y,
      });

      lastDistRef.current = newDist;
      lastCenterRef.current = newCenter;
    },
    [onPinchPan, setCursor],
  );

  const handleTouchEnd = useCallback(() => {
    lastCenterRef.current = null;
    lastDistRef.current = 0;
  }, []);

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      // modifier 別の挙動:
      //   - Cmd/Ctrl+wheel + macOS trackpad pinch (ctrlKey=true) → zoom
      //   - Shift+wheel → 横 pan (vertical wheel delta を deltaX に変換)
      //   - modifier なし wheel (mouse / trackpad 2 本指スワイプ) → pan (deltaX/Y そのまま)
      // 全 wheel をアプリ側で扱うので preventDefault は無条件。
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
        onShapeLongPress={onShapeLongPress}
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
            // 矢じり = from = 矩形右辺中央、尾 = to = 起点 (Auto-next-A の反転を踏襲)。
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
