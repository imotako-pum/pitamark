import type { Annotation, TextAnnotation } from '@snap-share/shared';
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { TextEditorOverlay } from '../components/canvas/TextEditorOverlay';
import { DropZone } from '../components/empty-state/DropZone';
import { Toolbar } from '../components/toolbar/Toolbar';
import type { Tool } from '../hooks/annotationsReducer';
import type { AnnotationsStore } from '../hooks/useAnnotationsStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useStageSize } from '../hooks/useStageSize';

const TOOLBAR_HEIGHT = 56;
const MIN_STAGE_HEIGHT = 200;

type ImageDescriptor = Readonly<{ url: string }>;

export type EditorShellProps = Readonly<{
  source: ImageDescriptor | null;
  imageError: string | null;
  /** When undefined the DropZone is replaced by a loading hint (room mode). */
  onLoadFile?: (file: File) => void;
  onClearImage: () => void;
  store: AnnotationsStore;
  onCursorMove?: (point: { x: number; y: number } | null) => void;
  /** Builds the awareness Konva layer; called inside CanvasStage. */
  awarenessLayer?: (annotations: ReadonlyArray<Annotation>) => ReactNode;
  /** Mirror local selection into presence (Yjs awareness). */
  onSelectedIdChange?: (id: string | null) => void;
  /** Top-right toolbar slot (CopyUrlButton). */
  toolbarRight?: ReactNode;
  /** Bottom-right floating slot (ConnectionBadge). */
  floatingExtras?: ReactNode;
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
}: EditorShellProps) => {
  const stageSize = useStageSize();
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const [stageRect, setStageRect] = useState<DOMRect | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

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

  useKeyboardShortcuts({
    onUndo: store.undo,
    onRedo: store.redo,
    onDelete: handleDelete,
    onSetTool: handleSetTool,
    onEscape: handleEscape,
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

  const stageHeight = Math.max(stageSize.height - TOOLBAR_HEIGHT, MIN_STAGE_HEIGHT);

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-(--color-surface) text-(--color-text)">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-4 pt-3">
        <h1 className="pointer-events-auto select-none text-sm font-semibold tracking-wide opacity-70">
          snap-share
        </h1>
        <Toolbar
          tool={store.state.tool}
          canUndo={store.canUndo}
          canRedo={store.canRedo}
          hasSelection={store.state.selectedId !== null}
          imageLoaded={source !== null}
          onSetTool={handleSetTool}
          onUndo={store.undo}
          onRedo={store.redo}
          onDelete={handleDelete}
          onClearImage={handleClearImage}
        />
        <div className="pointer-events-auto flex w-30 justify-end">
          {toolbarRight ?? <div aria-hidden="true" />}
        </div>
      </header>
      <div
        ref={stageContainerRef}
        className="absolute inset-x-0 bottom-0"
        style={{ top: TOOLBAR_HEIGHT, height: stageHeight }}
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
            extraLayers={awarenessLayer?.(store.state.annotations) ?? null}
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
