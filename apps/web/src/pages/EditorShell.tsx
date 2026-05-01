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
import { DropZone } from '../components/empty-state/DropZone';
import { Toolbar } from '../components/toolbar/Toolbar';
import type { Tool } from '../hooks/annotationsReducer';
import type { AnnotationsStore } from '../hooks/useAnnotationsStore';
import { useExportPng } from '../hooks/useExportPng';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useStageSize } from '../hooks/useStageSize';

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
  const [stageRect, setStageRect] = useState<DOMRect | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(FALLBACK_HEADER_HEIGHT);

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

  const exportPng = useExportPng({ stageRef, awarenessLayerRef, roomId });
  const canExport = source !== null;
  const handleExport = useCallback(() => {
    if (!canExport) return;
    // Commit any in-flight text edit before rasterizing — DOM overlays are
    // not part of the Konva canvas, so otherwise the typed text is lost.
    setEditingTextId(null);
    void exportPng();
  }, [canExport, exportPng]);

  useKeyboardShortcuts({
    onUndo: store.undo,
    onRedo: store.redo,
    onDelete: handleDelete,
    onSetTool: handleSetTool,
    onEscape: handleEscape,
    onExport: canExport ? handleExport : undefined,
  });

  const handleTextCommit = useCallback(
    (text: string) => {
      if (!editingTextId) return;
      if (text === '') {
        store.dispatch({ type: 'annotation/remove', id: editingTextId });
      } else {
        store.dispatch({ type: 'annotation/set-text', id: editingTextId, text });
      }
      setEditingTextId(null);
    },
    [editingTextId, store],
  );

  const handleTextCancel = useCallback(() => {
    if (editingTextId && editingAnnotation && editingAnnotation.text === '') {
      store.dispatch({ type: 'annotation/remove', id: editingTextId });
    }
    setEditingTextId(null);
  }, [editingTextId, editingAnnotation, store]);

  const handleClearImage = useCallback(() => {
    onClearImage();
    setEditingTextId(null);
  }, [onClearImage]);

  const selectedId = store.state.selectedId;
  useLayoutEffect(() => {
    onSelectedIdChange?.(selectedId);
  }, [onSelectedIdChange, selectedId]);

  const stageHeight = Math.max(stageSize.height - headerHeight, MIN_STAGE_HEIGHT);

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
          onSetTool={handleSetTool}
          onUndo={store.undo}
          onRedo={store.redo}
          onDelete={handleDelete}
          onClearImage={handleClearImage}
          onExport={handleExport}
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
            onStartTextEditing={setEditingTextId}
            onCursorMove={onCursorMove}
            extraLayers={awarenessLayer?.(store.state.annotations, awarenessLayerRef) ?? null}
            stageRef={stageRef}
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
          onCommit={handleTextCommit}
          onCancel={handleTextCancel}
        />
      )}
      {floatingExtras}
    </main>
  );
};
