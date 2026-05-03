import type { Annotation, TextAnnotation } from '@snap-share/shared';
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
import { nextColor, prevColor } from '../lib/colorCycle';

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
  const stageSize = useStageSize();
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const awarenessLayerRef = useRef<Konva.Layer>(null);
  // Phase 7.8-1 Auto-next-A: CanvasStage が onStartTextEditing(id, { autoNext: true })
  // で起動した text 編集が、commit / cancel どちらでも tool='select' に復帰するための
  // フラグ。state ではなく ref で持つ理由は Phase 7.7-3 panActiveRef と同じ — 連続
  // dispatch との同期参照が必要になり得るため。通常の text ツール経路 (autoNext 省略)
  // では立たないので、連続 text 作成モードを壊さない。
  const autoNextChainRef = useRef(false);
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

  useLayoutEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;
    const update = () => setStageRect(el.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [source]);

  const editingAnnotation: TextAnnotation | null = (() => {
    if (!editingTextId) return null;
    const found = store.state.annotations.find((a) => a.id === editingTextId);
    return found && found.type === 'text' ? found : null;
  })();

  const handleSetTool = useCallback(
    (tool: Tool) => {
      store.dispatch({ type: 'tool/set', tool });
    },
    [store],
  );

  const handleStartTextEditing = useCallback((id: string, options?: { autoNext?: boolean }) => {
    if (options?.autoNext) {
      autoNextChainRef.current = true;
    }
    setEditingTextId(id);
  }, []);

  const handleDelete = useCallback(() => {
    const id = store.state.selectedId;
    if (!id) return;
    store.dispatch({ type: 'annotation/remove', id });
    if (editingTextId === id) {
      setEditingTextId(null);
    }
  }, [store, editingTextId]);

  const handleEscape = useCallback(() => {
    if (editingTextId) {
      setEditingTextId(null);
      return;
    }
    if (store.state.selectedId) {
      store.dispatch({ type: 'select/set', id: null });
    }
  }, [editingTextId, store]);

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
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__SNAP_SHARE_STAGE_TRANSFORM__ = stageTransform;
  }, [stageTransform]);

  // Phase 7.8-1: Auto-next-A の検証で tool 状態を E2E から polling 確認するために
  // 公開する。Toolbar の active 表示で代替できるが、E2E の安定度は window expose
  // の方が高いため既存パターンに揃える。
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__SNAP_SHARE_TOOL__ = store.state.tool;
  }, [store.state.tool]);

  // Expose transform actions for E2E. Playwright's keyboard.press cannot
  // reliably trigger Meta+0 / Meta+1 (Chromium intercepts these as browser
  // shortcuts before the page can preventDefault), so the E2E covers the
  // transform pipeline by calling these directly. The keyboard binding
  // itself is small and covered by the existing keyboard-shortcuts.spec.ts
  // pattern (V / R / A / T / H + Cmd+S).
  useEffect(() => {
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
    setStageImageSize(null);
    setImageNaturalSize(null);
    onClearImage();
    setEditingTextId(null);
  }, [onClearImage, setStageImageSize]);

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

  // ? — Help cheatsheet を toggle。同キーで反転 (Excalidraw 互換) のため、
  // 引数なしの単純な setter で setState 関数形式を使う。
  const handleShowHelp = useCallback(() => {
    setHelpOpen((prev) => !prev);
  }, []);

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
          onSetTool={handleSetTool}
          onUndo={store.undo}
          onRedo={store.redo}
          onDelete={handleDelete}
          onClearImage={handleClearImage}
          onExport={handleExport}
          onPickColor={handlePickColor}
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
          />
        ) : onLoadFile ? (
          <DropZone onFile={onLoadFile} error={imageError} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm opacity-60">
            画像を読み込んでいます…
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
