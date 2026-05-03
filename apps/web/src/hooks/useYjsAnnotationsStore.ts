import type { Annotation } from '@snap-share/shared';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { DEFAULT_FONT_SIZE, DEFAULT_SYNC_COLOR } from '../components/canvas/colors';
import { logger } from '../lib/logger';
import { resolveWsBaseUrl } from '../lib/yjs-config';
import type { AnnotationsAction, AnnotationsState, Tool } from './annotationsReducer';
import type { AwarenessLike } from './presence-context';
import type { AnnotationsStore } from './useAnnotationsStore';
import { useStateRef } from './useStateRef';
import {
  type ConnectionStatus,
  createYjsAnnotationsContext,
  type ProviderFactory,
  type YjsAnnotationsContext,
} from './yjs-annotations-context';

export type YjsAnnotationsStore = AnnotationsStore &
  Readonly<{
    status: ConnectionStatus;
    doc: Y.Doc;
    /**
     * The provider's Awareness instance for cursor / selection broadcast.
     * Null while the context is being created or when a test stub provider
     * is used that does not expose awareness.
     */
    awareness: AwarenessLike | null;
  }>;

const EMPTY_ANNOTATIONS: ReadonlyArray<Annotation> = Object.freeze([]);
// Stable Y.Doc returned while the context is being created on first render.
// Callers that read `store.doc` get a non-null reference; the real doc
// replaces it once the effect-driven context is ready.
const PLACEHOLDER_DOC = new Y.Doc();

export const useYjsAnnotationsStore = (
  roomId: string,
  providerFactory?: ProviderFactory,
  token?: string | null,
): YjsAnnotationsStore => {
  // y-websocket constructs the connection URL as `${serverUrl}/${roomName}`,
  // so we pass `${wsBase}/sync` as serverUrl and `roomId` as roomName.
  // Putting roomId into serverUrl with an empty roomName produces a trailing
  // slash (`/sync/<id>/`) which the Hono `/sync/:id` route rejects.
  //
  // Protected rooms ride a `token` query parameter — y-websocket exposes a
  // `params` option that gets URL-encoded onto the upgrade request.
  //
  // NOTE: tests must always pass `providerFactory`; the default branch boots
  // a real WebSocket and is not testable under happy-dom.
  const factory = useMemo<ProviderFactory>(
    () =>
      providerFactory ??
      ((doc) =>
        new WebsocketProvider(`${resolveWsBaseUrl()}/sync`, roomId, doc, {
          connect: true,
          ...(token ? { params: { token } } : {}),
        })),
    [roomId, providerFactory, token],
  );

  // StrictMode-safe lifecycle: the CRDT context is created inside an effect
  // so the dev double-invoke (mount → cleanup → mount) reliably tears down
  // the first provider and creates a fresh one on the second mount. With
  // `useMemo`, the same destroyed context would be reused on remount,
  // leaving the WebSocket dead before the y-websocket sync handshake.
  const [ctx, setCtx] = useState<YjsAnnotationsContext | null>(null);
  useEffect(() => {
    const c = createYjsAnnotationsContext(factory);
    setCtx(c);
    return () => {
      c.destroy();
      setCtx((current) => (current === c ? null : current));
    };
  }, [factory]);

  // Tool / selectedId / activeColor / activeFontSize are client-local — do NOT persist via CRDT.
  const [tool, setTool] = useStateRef<Tool>('select');
  const [selectedId, setSelectedId, selectedIdRef] = useStateRef<string | null>(null);
  const [activeColor, setActiveColor] = useStateRef<string>(DEFAULT_SYNC_COLOR);
  const [activeFontSize, setActiveFontSize] = useStateRef<number>(DEFAULT_FONT_SIZE);

  const subscribe = useCallback((cb: () => void) => (ctx ? ctx.subscribe(cb) : () => {}), [ctx]);
  const getSnapshot = useCallback(() => (ctx ? ctx.snapshot() : EMPTY_ANNOTATIONS), [ctx]);
  const annotations = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const [status, setStatus] = useStateRef<ConnectionStatus>('connecting');
  useEffect(() => {
    if (!ctx) return;
    const handler = (e: { status: ConnectionStatus }) => {
      setStatus(e.status);
      logger.info('ws status', { status: e.status, roomId });
    };
    ctx.provider.on('status', handler);
    return () => {
      ctx.provider.off('status', handler);
    };
  }, [ctx, roomId, setStatus]);

  // E2E 用の観測フック。dev/test ビルドでのみ window 経由で annotations を
  // 露出する。production では `import.meta.env.DEV` が定数 false になり Vite の
  // tree-shaking で副作用ごと除去されるため bundle に文字列が残らない。
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (
      window as unknown as { __SNAP_SHARE_ANNOTATIONS__?: ReadonlyArray<Annotation> }
    ).__SNAP_SHARE_ANNOTATIONS__ = annotations;
  }, [annotations]);

  const [canUndo, setCanUndo] = useStateRef(false);
  const [canRedo, setCanRedo] = useStateRef(false);
  useEffect(() => {
    if (!ctx) return;
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

  const dispatch = useCallback(
    (action: AnnotationsAction) => {
      switch (action.type) {
        case 'tool/set':
          setTool(action.tool);
          return;
        case 'select/set':
          setSelectedId(action.id);
          return;
        case 'active-color/set':
          setActiveColor(action.color);
          return;
        case 'active-font-size/set':
          setActiveFontSize(action.fontSize);
          return;
        case 'annotation/remove':
          if (selectedIdRef.current === action.id) setSelectedId(null);
          ctx?.applyDataAction(action);
          return;
        default:
          ctx?.applyDataAction(action);
      }
    },
    [ctx, setSelectedId, setTool, setActiveColor, setActiveFontSize, selectedIdRef],
  );

  const undo = useCallback(() => {
    ctx?.undoManager.undo();
  }, [ctx]);
  const redo = useCallback(() => {
    ctx?.undoManager.redo();
  }, [ctx]);
  const reset = useCallback(() => {
    ctx?.reset();
    setSelectedId(null);
  }, [ctx, setSelectedId]);

  // Phase 7.8-1: Auto-next-A で矢印 add と text add を独立 undo step に分割するため、
  // Yjs UndoManager の captureTimeout(500ms) を中間でリセットする。これを呼ばないと
  // 同 LOCAL_ORIGIN の連続操作が 1 step に merge され、Cmd+Z 1 回で両方が消える。
  const stopUndoCapture = useCallback(() => {
    ctx?.undoManager.stopCapturing();
  }, [ctx]);

  const state: AnnotationsState = {
    annotations,
    selectedId,
    tool,
    activeColor,
    activeFontSize,
  };

  // y-websocket exposes `awareness` on its provider; tests use a stub that
  // omits this field, so we narrow at the seam rather than in callers.
  const awareness = ctx ? ((ctx.provider as { awareness?: Awareness }).awareness ?? null) : null;

  return {
    state,
    canUndo,
    canRedo,
    dispatch,
    undo,
    redo,
    reset,
    stopUndoCapture,
    status,
    doc: ctx?.doc ?? PLACEHOLDER_DOC,
    awareness: awareness as AwarenessLike | null,
  };
};
