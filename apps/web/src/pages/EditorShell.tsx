import type { Annotation, Point, TextAnnotation } from '@snap-share/shared';
import type Konva from 'konva';
import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { DEFAULT_STROKE_WIDTH } from '../components/canvas/colors';
import { TextEditorOverlay } from '../components/canvas/TextEditorOverlay';
import { HelpModal } from '../components/dialogs/HelpModal';
import { DropZone } from '../components/empty-state/DropZone';
import { Toolbar } from '../components/toolbar/Toolbar';
import type { Tool } from '../hooks/annotationsReducer';
import type { AnnotationsStore } from '../hooks/useAnnotationsStore';
import { useExportPng } from '../hooks/useExportPng';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useStageSize } from '../hooks/useStageSize';
import { useStageTransform } from '../hooks/useStageTransform';
import { useTranslation } from '../i18n';
import { computeAutoArrowDefault } from '../lib/autoArrowDefault';
import { AUTO_NEXT_TEXT_OFFSET_PX, computeAutoNextTextOffset } from '../lib/autoNextOffset';
import { nextColor, prevColor } from '../lib/colorCycle';
import { clampFontSize, decrementFontSize, incrementFontSize } from '../lib/fontSize';
import { generateId } from '../lib/id';

// Phase 7.8-2 Auto-next-B: 矩形確定直後の既定矢印プレビューの pending 状態。
// CanvasStage の Layer 描画と useKeyboardShortcuts (Enter binding) 両方が touch する
// ため EditorShell に置く。ref + state の二重管理 — ref は同 React event 内で同期参照
// (Enter 確定 callback が ref.current で最新を見る)、state は Konva 再レンダーをトリガする。
type PendingAutoArrow = Readonly<{
  from: Point;
  to: Point;
  color: string;
  strokeWidth: number;
}>;

const MIN_STAGE_HEIGHT = 200;
const FALLBACK_HEADER_HEIGHT = 56;

type ImageDescriptor = Readonly<{ url: string }>;

export type EditorShellProps = Readonly<{
  source: ImageDescriptor | null;
  imageError: string | null;
  /** When undefined the DropZone is replaced by a loading hint (room mode). */
  onLoadFile?: (file: File) => void;
  onClearImage: () => void;
  store: AnnotationsStore;
  onCursorMove?: (point: { x: number; y: number } | null) => void;
  /** Builds the awareness Konva layer; called inside CanvasStage.
   *  Receives an awarenessLayerRef so the parent can hide/show during PNG export. */
  awarenessLayer?: (
    annotations: ReadonlyArray<Annotation>,
    layerRef: Ref<Konva.Layer>,
  ) => ReactNode;
  /** Mirror local selection into presence (Yjs awareness). */
  onSelectedIdChange?: (id: string | null) => void;
  /** Top-right toolbar slot (CopyUrlButton). */
  toolbarRight?: ReactNode;
  /** Bottom-right floating slot (ConnectionBadge). */
  floatingExtras?: ReactNode;
  /** roomId for export filename; null in local mode. */
  roomId?: string | null;
}>;

export const EditorShell = ({
  source,
  imageError,
  onLoadFile,
  onClearImage,
  store,
  onCursorMove,
  awarenessLayer,
  onSelectedIdChange,
  toolbarRight,
  floatingExtras,
  roomId = null,
}: EditorShellProps) => {
  const t = useTranslation();
  const stageContainerRef = useRef<HTMLDivElement>(null);
  // Phase 8.x perf review #10 M2: `useStageSize` no longer registers a
  // `window.resize` listener — it observes `document.documentElement` via
  // ResizeObserver. The duplicate resize listener that lived here for
  // `stageRect` has been switched to ResizeObserver on the stage container
  // (see effect below) so a viewport change re-renders exactly once.
  const stageSize = useStageSize();
  const headerRef = useRef<HTMLElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const awarenessLayerRef = useRef<Konva.Layer>(null);
  // Phase 7.8-1 Auto-next-A: CanvasStage が onStartTextEditing(id, { autoNext: true })
  // で起動した text 編集が、commit / cancel どちらでも tool='select' に復帰するための
  // フラグ。state ではなく ref で持つ理由は Phase 7.7-3 panActiveRef と同じ — 連続
  // dispatch との同期参照が必要になり得るため。通常の text ツール経路 (autoNext 省略)
  // では立たないので、連続 text 作成モードを壊さない。
  const autoNextChainRef = useRef(false);
  // Phase 7.8-2 Auto-next-B: pending 矢印の ref + state 二重管理 (詳細は型宣言の上の
  // コメント参照)。setPendingAutoArrow を経由してのみ書き換えるため、ref と state
  // が乖離しない。
  const pendingAutoArrowRef = useRef<PendingAutoArrow | null>(null);
  const [pendingAutoArrow, setPendingAutoArrowState] = useState<PendingAutoArrow | null>(null);
  const setPendingAutoArrow = useCallback((p: PendingAutoArrow | null) => {
    pendingAutoArrowRef.current = p;
    setPendingAutoArrowState(p);
  }, []);
  const [stageRect, setStageRect] = useState<DOMRect | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(FALLBACK_HEADER_HEIGHT);
  const [imageNaturalSize, setImageNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);

  // ResizeObserver replaces the previous TOOLBAR_HEIGHT constant so the stage
  // tracks the real header height when it wraps to two rows on small screens.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.getBoundingClientRect().height);
    update();
    let raf = 0;
    const observer = new ResizeObserver(() => {
      // rAF defer keeps ResizeObserver from emitting "loop completed" warnings
      // when the resize triggers an immediate React re-render.
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  // Phase 8.x perf review #10 M2: TextEditorOverlay positions against the
  // exact stage container rect, so we observe the same element via
  // ResizeObserver (matching `useStageSize`) instead of a second
  // `window.resize` listener. `source` triggers re-observation when the
  // image swap remounts the stage container.
  useLayoutEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;
    const update = () => setStageRect(el.getBoundingClientRect());
    update();
    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [source]);

  const editingAnnotation: TextAnnotation | null = (() => {
    if (!editingTextId) return null;
    const found = store.state.annotations.find((a) => a.id === editingTextId);
    return found && found.type === 'text' ? found : null;
  })();

  const handleSetTool = useCallback(
    (tool: Tool) => {
      // Phase 7.8-2: pending Auto-arrow があれば、別ツールキー押下でキャンセル。
      if (pendingAutoArrowRef.current) {
        setPendingAutoArrow(null);
      }
      store.dispatch({ type: 'tool/set', tool });
    },
    [store, setPendingAutoArrow],
  );

  const handleStartTextEditing = useCallback((id: string, options?: { autoNext?: boolean }) => {
    if (options?.autoNext) {
      autoNextChainRef.current = true;
    }
    setEditingTextId(id);
  }, []);

  const handleDelete = useCallback(() => {
    // Phase 7.8-2: pending Auto-arrow があれば、BS は pending クリアを優先する。
    // 通常の「選択中注釈削除」は pending クリア後に次の BS で復帰する。
    if (pendingAutoArrowRef.current) {
      setPendingAutoArrow(null);
      return;
    }
    const id = store.state.selectedId;
    if (!id) return;
    store.dispatch({ type: 'annotation/remove', id });
    if (editingTextId === id) {
      setEditingTextId(null);
    }
  }, [store, editingTextId, setPendingAutoArrow]);

  const handleEscape = useCallback(() => {
    // Phase 7.8-2: pending Auto-arrow があれば、Esc は pending クリアを最優先。
    if (pendingAutoArrowRef.current) {
      setPendingAutoArrow(null);
      return;
    }
    if (editingTextId) {
      setEditingTextId(null);
      return;
    }
    if (store.state.selectedId) {
      store.dispatch({ type: 'select/set', id: null });
    }
  }, [editingTextId, store, setPendingAutoArrow]);

  // Phase 7.8-2: マウス mousedown 任意座標で pending をクリアするための callback。
  // CanvasStage の handleMouseDown 冒頭から呼ばれる。pending が null のときは no-op。
  const handleCancelAutoArrowIfAny = useCallback(() => {
    if (pendingAutoArrowRef.current) {
      setPendingAutoArrow(null);
    }
  }, [setPendingAutoArrow]);

  const stageHeight = Math.max(stageSize.height - headerHeight, MIN_STAGE_HEIGHT);
  // Destructure once so each handler / effect depends on a stable function
  // reference rather than `transformApi.X` (a fresh property access per
  // render). This mirrors the same fragility class as the `[viewport]`
  // identity bug fixed inside useStageTransform.
  const {
    transform: stageTransform,
    setImageSize: setStageImageSize,
    fitToViewport,
    setHundredPercent,
    zoomBy,
    panBy,
  } = useStageTransform({ width: stageSize.width, height: stageHeight });

  const handleImageLoaded = useCallback(
    (size: { width: number; height: number } | null) => {
      setStageImageSize(size);
      setImageNaturalSize(size);
    },
    [setStageImageSize],
  );

  const exportPng = useExportPng({
    stageRef,
    awarenessLayerRef,
    roomId,
    imageSize: imageNaturalSize,
  });
  const canExport = source !== null;
  const handleExport = useCallback(() => {
    if (!canExport) return;
    // Commit any in-flight text edit before rasterizing — DOM overlays are
    // not part of the Konva canvas, so otherwise the typed text is lost.
    setEditingTextId(null);
    void exportPng();
  }, [canExport, exportPng]);

  // Expose the transform on window so E2E can poll it without coupling to the
  // canvas DOM. Mirrors the existing __SNAP_SHARE_ANNOTATIONS__ pattern.
  // Phase 8.x band-aids review #5 H1: gated on `import.meta.env.DEV` so
  // production bundles strip the assignment via Vite tree-shaking — same
  // pattern as `useYjsAnnotationsStore.ts:106`.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__SNAP_SHARE_STAGE_TRANSFORM__ = stageTransform;
  }, [stageTransform]);

  // Phase 7.8-1: Auto-next-A の検証で tool 状態を E2E から polling 確認するために
  // 公開する。Toolbar の active 表示で代替できるが、E2E の安定度は window expose
  // の方が高いため既存パターンに揃える。
  // Phase 8.x band-aids review #5 H1: DEV-only.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__SNAP_SHARE_TOOL__ = store.state.tool;
  }, [store.state.tool]);

  // Phase 7.8-2: pending Auto-arrow を E2E から poll するため公開。null = pending なし、
  // object = プレビュー中。Toolbar に出ない情報なので window expose のみが現実的。
  // Phase 8.x band-aids review #5 H1: DEV-only.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__SNAP_SHARE_PENDING_AUTO_ARROW__ =
      pendingAutoArrow;
  }, [pendingAutoArrow]);

  // Expose transform actions for E2E. Playwright's keyboard.press cannot
  // reliably trigger Meta+0 / Meta+1 (Chromium intercepts these as browser
  // shortcuts before the page can preventDefault), so the E2E covers the
  // transform pipeline by calling these directly. The keyboard binding
  // itself is small and covered by the existing keyboard-shortcuts.spec.ts
  // pattern (V / R / A / T / H + Cmd+S).
  // Phase 8.x band-aids review #5 H1: DEV-only. Critically, this hatch
  // exposes function references (fitToViewport / setHundredPercent /
  // zoomBy / panBy) — without the gate, third-party scripts on a
  // production page could call them. The gate strips the entire
  // assignment in production via Vite tree-shaking.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__SNAP_SHARE_TRANSFORM_ACTIONS__ = {
      fitToViewport,
      setHundredPercent,
      zoomBy,
      panBy,
    };
  }, [fitToViewport, setHundredPercent, zoomBy, panBy]);

  const handleTextCommit = useCallback(
    (text: string) => {
      if (!editingTextId) return;
      if (text === '') {
        store.dispatch({ type: 'annotation/remove', id: editingTextId });
      } else {
        store.dispatch({ type: 'annotation/set-text', id: editingTextId, text });
      }
      setEditingTextId(null);
      // Phase 7.8-1: Auto-next-A 連鎖中なら tool を select に戻す。通常の text ツール
      // 経路では ref が立たないので、連続 text 作成モードは保たれる。
      if (autoNextChainRef.current) {
        autoNextChainRef.current = false;
        store.dispatch({ type: 'tool/set', tool: 'select' });
      }
    },
    [editingTextId, store],
  );

  const handleTextCancel = useCallback(() => {
    if (editingTextId && editingAnnotation && editingAnnotation.text === '') {
      store.dispatch({ type: 'annotation/remove', id: editingTextId });
    }
    setEditingTextId(null);
    if (autoNextChainRef.current) {
      autoNextChainRef.current = false;
      store.dispatch({ type: 'tool/set', tool: 'select' });
    }
  }, [editingTextId, editingAnnotation, store]);

  const handleClearImage = useCallback(() => {
    // Phase 7.8-2: 画像クリア時に pending Auto-arrow も消す (孤立した pending 状態を残さない)。
    setPendingAutoArrow(null);
    setStageImageSize(null);
    setImageNaturalSize(null);
    onClearImage();
    setEditingTextId(null);
  }, [onClearImage, setStageImageSize, setPendingAutoArrow]);

  // Single click handler: always update active color (drives next draws),
  // and if a selection exists, also apply the new color to it. Replaced the
  // earlier "pick + 2 apply buttons" UX after dogfood feedback that the 2-step
  // flow felt heavy and the sync/highlight lane separation produced an
  // indicator discontinuity on tool switches.
  const handlePickColor = useCallback(
    (color: string) => {
      store.dispatch({ type: 'active-color/set', color });
      const id = store.state.selectedId;
      if (id) {
        store.dispatch({ type: 'annotation/set-color', id, color });
      }
    },
    [store],
  );

  // C / ⇧C — palette を巡回。selectedId があれば同じ color をその注釈にも適用
  // (handlePickColor と同じ規約)。実装重複は最小化のため、純関数で next/prev
  // を計算したうえで handlePickColor に委譲する。
  const handleCycleColorNext = useCallback(() => {
    handlePickColor(nextColor(store.state.activeColor));
  }, [handlePickColor, store.state.activeColor]);

  const handleCycleColorPrev = useCallback(() => {
    handlePickColor(prevColor(store.state.activeColor));
  }, [handlePickColor, store.state.activeColor]);

  // フォントサイズも color と同じく「常に active 更新 + 選択中 text なら適用」の
  // 1 操作モデル。Yjs / reducer 双方の setFontSize は text 以外を type guard で
  // 弾くが、local reducer は内部で `annotations.map(...)` を呼んで毎回新しい配列
  // を返すため、空の undo step が past stack に積まれてしまう (storeReducer の
  // `next === state.present` チェックが state object identity 比較で通過する)。
  // 視覚的変化のない 1 step が Cmd+Z で消費される UX 不整合を防ぐため、
  // handler 側で「選択中が text の時だけ dispatch する」ガードを置く。
  const handleSetFontSize = useCallback(
    (size: number) => {
      const next = clampFontSize(size);
      store.dispatch({ type: 'active-font-size/set', fontSize: next });
      const id = store.state.selectedId;
      if (!id) return;
      const selected = store.state.annotations.find((a) => a.id === id);
      if (selected?.type !== 'text') return;
      store.dispatch({ type: 'annotation/set-font-size', id, fontSize: next });
    },
    [store],
  );

  // [/] shortcut + Toolbar A-/A+ ボタン共通の経路。active から ±STEP したクランプ値で
  // handleSetFontSize に委譲し、選択中 text への適用ロジックを 1 か所に閉じる。
  const handleIncrementFontSize = useCallback(() => {
    handleSetFontSize(incrementFontSize(store.state.activeFontSize));
  }, [handleSetFontSize, store.state.activeFontSize]);

  const handleDecrementFontSize = useCallback(() => {
    handleSetFontSize(decrementFontSize(store.state.activeFontSize));
  }, [handleSetFontSize, store.state.activeFontSize]);

  // ? — Help cheatsheet を toggle。同キーで反転 (Excalidraw 互換) のため、
  // 引数なしの単純な setter で setState 関数形式を使う。
  const handleShowHelp = useCallback(() => {
    setHelpOpen((prev) => !prev);
  }, []);

  // Phase 7.8-2: 矩形 mouseup 時に呼ばれる callback。CanvasStage が rect 形状を渡す。
  // 矩形 add は CanvasStage 側で既に dispatch 済 (handleMouseUp の committing dispatch)。
  // ここでは pending を立てるだけ。stopUndoCapture で矩形 step を fix し、後続の
  // arrow add (Enter 経路) を別 step として独立させる。
  const handleAutoNextRectangle = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      store.stopUndoCapture();
      const { from, to } = computeAutoArrowDefault(rect);
      setPendingAutoArrow({
        from,
        to,
        color: store.state.activeColor,
        strokeWidth: DEFAULT_STROKE_WIDTH,
      });
    },
    [store, setPendingAutoArrow],
  );

  // Phase 7.8-2: Enter で pending Auto-arrow を確定。矢印 add → step 区切り → text add
  // → tool=text + autoNextChainRef を立てて Phase 7.8-1 と同じ「commit/cancel 後 select
  // 復帰」フローに合流。pending が null のときは安全側で no-op。
  const handleConfirmAutoArrow = useCallback(() => {
    const p = pendingAutoArrowRef.current;
    if (!p) return;
    const arrowId = generateId();
    const arrowAnnotation: Annotation = {
      id: arrowId,
      type: 'arrow',
      createdAt: Date.now(),
      from: p.from,
      to: p.to,
      color: p.color,
      strokeWidth: p.strokeWidth,
    };
    store.dispatch({ type: 'annotation/add', annotation: arrowAnnotation });
    store.dispatch({ type: 'select/set', id: arrowId });
    // arrow → text を独立 undo step に分ける (Phase 7.8-1 と同じ作法)。
    store.stopUndoCapture();
    const offset = computeAutoNextTextOffset(p.from, p.to, AUTO_NEXT_TEXT_OFFSET_PX);
    const textId = generateId();
    const textAnnotation: Annotation = {
      id: textId,
      type: 'text',
      createdAt: Date.now(),
      x: p.to.x + offset.x,
      y: p.to.y + offset.y,
      text: '',
      fontSize: store.state.activeFontSize,
      color: p.color,
    };
    store.dispatch({ type: 'annotation/add', annotation: textAnnotation });
    store.dispatch({ type: 'tool/set', tool: 'text' });
    store.dispatch({ type: 'select/set', id: textId });
    setPendingAutoArrow(null);
    // Phase 7.8-2 review M1 修正: autoNextChainRef 設定 + setEditingTextId のペアを
    // handleStartTextEditing に集約。Phase 7.8-1 の CanvasStage 経路と同じ関数を経由する
    // ことで、Auto-next chain 起動の規約が 1 箇所に閉じる。
    handleStartTextEditing(textId, { autoNext: true });
  }, [store, setPendingAutoArrow, handleStartTextEditing]);

  useKeyboardShortcuts({
    onUndo: store.undo,
    onRedo: store.redo,
    onDelete: handleDelete,
    onSetTool: handleSetTool,
    onEscape: handleEscape,
    onExport: canExport ? handleExport : undefined,
    onFitToViewport: source ? fitToViewport : undefined,
    onSetHundredPercent: source ? setHundredPercent : undefined,
    // Help は画像未投入時も発火させる (キーボード discoverability の担保)。
    onShowHelp: handleShowHelp,
    onCycleColorNext: source ? handleCycleColorNext : undefined,
    onCycleColorPrev: source ? handleCycleColorPrev : undefined,
    onIncrementFontSize: source ? handleIncrementFontSize : undefined,
    onDecrementFontSize: source ? handleDecrementFontSize : undefined,
    // Phase 7.8-2: pending Auto-arrow があるときだけ Enter binding を provide。
    // pending なし時は browser default の Enter (button focus 等) を温存。
    onConfirmAutoArrow: pendingAutoArrow ? handleConfirmAutoArrow : undefined,
  });

  const selectedId = store.state.selectedId;
  useLayoutEffect(() => {
    onSelectedIdChange?.(selectedId);
  }, [onSelectedIdChange, selectedId]);

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-(--color-surface) text-(--color-text)">
      <header
        ref={headerRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 px-3 py-2"
      >
        <h1 className="pointer-events-auto hidden select-none self-center text-sm font-semibold tracking-wide opacity-70 md:block">
          snap-share
        </h1>
        <Toolbar
          tool={store.state.tool}
          canUndo={store.canUndo}
          canRedo={store.canRedo}
          hasSelection={store.state.selectedId !== null}
          imageLoaded={source !== null}
          canExport={canExport}
          activeColor={store.state.activeColor}
          activeFontSize={store.state.activeFontSize}
          onSetTool={handleSetTool}
          onUndo={store.undo}
          onRedo={store.redo}
          onDelete={handleDelete}
          onClearImage={handleClearImage}
          onExport={handleExport}
          onPickColor={handlePickColor}
          onIncrementFontSize={handleIncrementFontSize}
          onDecrementFontSize={handleDecrementFontSize}
          onShowHelp={handleShowHelp}
        />
        <div className="pointer-events-auto flex min-w-0 justify-end self-center md:w-30">
          {toolbarRight ?? <div aria-hidden="true" />}
        </div>
      </header>
      <div
        ref={stageContainerRef}
        className="absolute inset-x-0 bottom-0"
        style={{ top: headerHeight, height: stageHeight }}
      >
        {source ? (
          <CanvasStage
            src={source.url}
            width={stageSize.width}
            height={stageHeight}
            store={store}
            editingTextId={editingTextId}
            onTextDoubleClick={setEditingTextId}
            onStartTextEditing={handleStartTextEditing}
            onCursorMove={onCursorMove}
            extraLayers={awarenessLayer?.(store.state.annotations, awarenessLayerRef) ?? null}
            stageRef={stageRef}
            transform={stageTransform}
            onZoom={zoomBy}
            onPan={panBy}
            onImageLoaded={handleImageLoaded}
            pendingAutoArrow={pendingAutoArrow}
            onAutoNextRectangle={handleAutoNextRectangle}
            onCancelAutoArrowIfAny={handleCancelAutoArrowIfAny}
          />
        ) : onLoadFile ? (
          <DropZone onFile={onLoadFile} error={imageError} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm opacity-60">
            {t('dropzone.loading')}
          </div>
        )}
      </div>
      {editingAnnotation && stageRect && (
        <TextEditorOverlay
          annotation={editingAnnotation}
          stageContainerRect={stageRect}
          transform={stageTransform}
          onCommit={handleTextCommit}
          onCancel={handleTextCancel}
        />
      )}
      {floatingExtras}
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </main>
  );
};
