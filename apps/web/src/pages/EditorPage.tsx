import type { TextAnnotation } from '@snap-share/shared';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { TextEditorOverlay } from '../components/canvas/TextEditorOverlay';
import { DropZone } from '../components/empty-state/DropZone';
import { Toolbar } from '../components/toolbar/Toolbar';
import type { Tool } from '../hooks/annotationsReducer';
import { useAnnotationsStore } from '../hooks/useAnnotationsStore';
import { useImageSource } from '../hooks/useImageSource';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useStageSize } from '../hooks/useStageSize';

const TOOLBAR_HEIGHT = 56;
const MIN_STAGE_HEIGHT = 200;

export const EditorPage = () => {
  const { source, error, loadFromFile, clear } = useImageSource();
  const store = useAnnotationsStore();
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
    clear();
    store.reset();
    setEditingTextId(null);
  }, [clear, store]);

  const stageHeight = Math.max(stageSize.height - TOOLBAR_HEIGHT, MIN_STAGE_HEIGHT);

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-(--color-surface) text-(--color-text)">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-4 pt-3">
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
        <div className="w-30" aria-hidden="true" />
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
          />
        ) : (
          <DropZone onFile={loadFromFile} error={error} />
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
    </main>
  );
};
