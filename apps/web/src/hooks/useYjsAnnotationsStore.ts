import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import { WebsocketProvider } from 'y-websocket';
import type * as Y from 'yjs';
import { logger } from '../lib/logger';
import { buildSyncUrl } from '../lib/yjs-config';
import type { AnnotationsAction, AnnotationsState, Tool } from './annotationsReducer';
import type { AwarenessLike } from './presence-context';
import type { AnnotationsStore } from './useAnnotationsStore';
import { useStateRef } from './useStateRef';
import {
  type ConnectionStatus,
  createYjsAnnotationsContext,
  type ProviderFactory,
} from './yjs-annotations-context';

export type YjsAnnotationsStore = AnnotationsStore &
  Readonly<{
    status: ConnectionStatus;
    doc: Y.Doc;
    /**
     * The provider's Awareness instance for cursor / selection broadcast.
     * Null when a test stub provider is used that does not expose awareness.
     */
    awareness: AwarenessLike | null;
  }>;

export const useYjsAnnotationsStore = (
  roomId: string,
  providerFactory?: ProviderFactory,
): YjsAnnotationsStore => {
  // The default factory connects to `${wsBase}/sync/:id` via vite proxy in
  // dev. y-websocket builds `${serverUrl}/${roomName}` so we put the full path
  // into serverUrl and pass an empty roomName.
  // NOTE: tests must always pass `providerFactory`; the default branch boots
  // a real WebSocket and is not testable under happy-dom.
  const factory = useMemo<ProviderFactory>(
    () =>
      providerFactory ??
      ((doc) => new WebsocketProvider(buildSyncUrl(roomId), '', doc, { connect: true })),
    [roomId, providerFactory],
  );

  const ctx = useMemo(() => createYjsAnnotationsContext(factory), [factory]);

  // Tool / selectedId are client-local — do NOT persist via CRDT.
  const [tool, setTool] = useStateRef<Tool>('select');
  const [selectedId, setSelectedId, selectedIdRef] = useStateRef<string | null>(null);

  const subscribe = useCallback((cb: () => void) => ctx.subscribe(cb), [ctx]);
  const annotations = useSyncExternalStore(subscribe, ctx.snapshot, ctx.snapshot);

  const [status, setStatus] = useStateRef<ConnectionStatus>('connecting');
  useEffect(() => {
    const handler = (e: { status: ConnectionStatus }) => {
      setStatus(e.status);
      logger.info('ws status', { status: e.status, roomId });
    };
    ctx.provider.on('status', handler);
    return () => {
      ctx.provider.off('status', handler);
    };
  }, [ctx, roomId, setStatus]);

  const [canUndo, setCanUndo] = useStateRef(false);
  const [canRedo, setCanRedo] = useStateRef(false);
  useEffect(() => {
    const update = () => {
      setCanUndo(ctx.undoManager.undoStack.length > 0);
      setCanRedo(ctx.undoManager.redoStack.length > 0);
    };
    ctx.undoManager.on('stack-item-added', update);
    ctx.undoManager.on('stack-item-popped', update);
    ctx.undoManager.on('stack-cleared', update);
    update();
    return () => {
      ctx.undoManager.off('stack-item-added', update);
      ctx.undoManager.off('stack-item-popped', update);
      ctx.undoManager.off('stack-cleared', update);
    };
  }, [ctx, setCanUndo, setCanRedo]);

  // Cleanup on unmount / roomId change.
  useEffect(
    () => () => {
      ctx.destroy();
    },
    [ctx],
  );

  const dispatch = useCallback(
    (action: AnnotationsAction) => {
      switch (action.type) {
        case 'tool/set':
          setTool(action.tool);
          return;
        case 'select/set':
          setSelectedId(action.id);
          return;
        case 'annotation/remove':
          if (selectedIdRef.current === action.id) setSelectedId(null);
          ctx.applyDataAction(action);
          return;
        default:
          ctx.applyDataAction(action);
      }
    },
    [ctx, setSelectedId, setTool, selectedIdRef],
  );

  const undo = useCallback(() => {
    ctx.undoManager.undo();
  }, [ctx]);
  const redo = useCallback(() => {
    ctx.undoManager.redo();
  }, [ctx]);
  const reset = useCallback(() => {
    ctx.reset();
    setSelectedId(null);
  }, [ctx, setSelectedId]);

  const state: AnnotationsState = {
    annotations,
    selectedId,
    tool,
  };

  // y-websocket exposes `awareness` on its provider; tests use a stub that
  // omits this field, so we narrow at the seam rather than in callers.
  const awareness = (ctx.provider as { awareness?: Awareness }).awareness ?? null;

  return {
    state,
    canUndo,
    canRedo,
    dispatch,
    undo,
    redo,
    reset,
    status,
    doc: ctx.doc,
    awareness: awareness as AwarenessLike | null,
  };
};
