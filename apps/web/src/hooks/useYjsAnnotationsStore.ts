import type { Annotation } from '@pitamark/shared';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { DEFAULT_FONT_SIZE, DEFAULT_SYNC_COLOR } from '../components/canvas/colors';
import { requestWsTicket } from '../lib/api-client';
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
     * カーソル / 選択を broadcast するための Awareness。context 構築中、または
     * awareness を露出しない test stub provider 使用時は null。
     */
    awareness: AwarenessLike | null;
  }>;

const EMPTY_ANNOTATIONS: ReadonlyArray<Annotation> = Object.freeze([]);
// 初回 render で context 構築中に返す stable な Y.Doc。`store.doc` を読む側に
// 必ず非 null を渡し、effect 完了後に実 doc に差し替える。
const PLACEHOLDER_DOC = new Y.Doc();

export const useYjsAnnotationsStore = (
  roomId: string,
  providerFactory?: ProviderFactory,
  token?: string | null,
): YjsAnnotationsStore => {
  // protected room は WebSocket open 前に 24h JWT を 30s one-shot ticket に交換する。
  // upgrade URL に乗るのは ticket だけで、JWT は wrangler tail / CDN log / ブラウザ履歴に
  // 残らない。unprotected room (token null/undefined) はこの flow を bypass し、stub
  // providerFactory を渡す test も同様に skip する。
  const [wsTicket, setWsTicket] = useState<string | null>(null);
  useEffect(() => {
    // stub provider は自前で auth を処理する — API は呼ばない。
    if (providerFactory) {
      setWsTicket(null);
      return;
    }
    if (!token) {
      setWsTicket(null);
      return;
    }
    let cancelled = false;
    setWsTicket(null);
    void requestWsTicket(roomId, token).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setWsTicket(result.ticket);
      } else {
        logger.warn('ws ticket request failed', { roomId, reason: result.reason });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [roomId, providerFactory, token]);

  // y-websocket は `${serverUrl}/${roomName}` で URL を組むため、serverUrl=`${wsBase}/sync`、
  // roomName=`roomId` で渡す。roomId を serverUrl 側に入れて roomName を空にすると
  // trailing slash (`/sync/<id>/`) が付き、Hono の `/sync/:id` route が拒否する。
  const factory = useMemo<ProviderFactory>(
    () =>
      providerFactory ??
      ((doc) =>
        new WebsocketProvider(`${resolveWsBaseUrl()}/sync`, roomId, doc, {
          connect: true,
          ...(wsTicket ? { params: { ticket: wsTicket } } : {}),
        })),
    [roomId, providerFactory, wsTicket],
  );

  // protected room では ticket が届くまで context 構築を block (早すぎる WebSocket open は
  // API が 401 で拒否するため)。`ready` の 3 項論理は: token なし (unprotected) ∨
  // stub provider 経由 ∨ ticket 取得済、のいずれか満たせば boot 可。
  const ctxBootDeps = useMemo(
    () => ({ factory, ready: !token || providerFactory !== undefined || wsTicket !== null }),
    [factory, token, providerFactory, wsTicket],
  );

  // StrictMode 安全な lifecycle: CRDT context を effect 内で構築する。
  // dev の double-invoke (mount → cleanup → mount) で最初の provider を確実に destroy し、
  // 2 回目の mount で新規構築できる。`useMemo` だと destroy 済 context が再利用されて
  // WebSocket が dead のまま sync handshake に到達できなくなる。
  const [ctx, setCtx] = useState<YjsAnnotationsContext | null>(null);
  useEffect(() => {
    if (!ctxBootDeps.ready) return;
    const c = createYjsAnnotationsContext(ctxBootDeps.factory);
    setCtx(c);
    return () => {
      c.destroy();
      setCtx((current) => (current === c ? null : current));
    };
  }, [ctxBootDeps]);

  // tool / selectedId / activeColor / activeFontSize は client-local — CRDT で persist しない。
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

  // Auto-next-A で矢印 add と text add を独立 undo step に分割するため、Yjs UndoManager の
  // captureTimeout(500ms) を中間でリセット。呼ばないと同 LOCAL_ORIGIN の連続操作が
  // 1 step に merge され Cmd+Z 1 回で両方が消える。
  const stopUndoCapture = useCallback(() => {
    ctx?.undoManager.stopCapturing();
  }, [ctx]);

  // `stopUndoCapture` を E2E に露出して undo group を `waitForTimeout` 無しで決定論的に
  // 分割する (旧 spec は captureTimeout 失効を 700ms sleep で待っていて CI で flaky だった)。
  // DEV-only にし、production bundle では Vite の tree-shaking で代入ごと除去される —
  // `__SNAP_SHARE_ANNOTATIONS__` と同 pattern。
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (
      window as unknown as { __SNAP_SHARE_STOP_UNDO_CAPTURE__?: () => void }
    ).__SNAP_SHARE_STOP_UNDO_CAPTURE__ = stopUndoCapture;
  }, [stopUndoCapture]);

  const state: AnnotationsState = {
    annotations,
    selectedId,
    tool,
    activeColor,
    activeFontSize,
  };

  // y-websocket は provider に `awareness` を露出するが、test stub はこの field を持たない
  // ため caller 側ではなく seam で narrow する。`AwarenessLike` は `Pick<Awareness, ...>` で
  // 派生しているので `as` cast 不要のまま型安全に代入でき、y-protocols の version drift は
  // runtime でなくコンパイル時に検知される。
  const awareness: AwarenessLike | null = ctx
    ? ((ctx.provider as { awareness?: Awareness }).awareness ?? null)
    : null;

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
    awareness,
  };
};
