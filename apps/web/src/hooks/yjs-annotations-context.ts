import type { Annotation } from '@pitamark/shared';
import * as Y from 'yjs';
import { buildAnnotationsSnapshot } from '../domain/annotation/yjs-codec';
import {
  addAnnotationY,
  clearAllY,
  moveAnnotationY,
  removeAnnotationY,
  reorderAnnotationY,
  resizeHighlightY,
  resizeRectangleY,
  setAnnotationColorY,
  setArrowEndpointsY,
  setTextFontSizeY,
  setTextY,
} from '../domain/annotation/yjs-mutations';
import { LOCAL_ORIGIN } from '../lib/yjs-config';
import type { AnnotationsAction } from './annotationsReducer';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * `createYjsAnnotationsContext` が必要とする最小 provider 表面。`y-websocket` の
 * WebsocketProvider のうち使う部分だけを mirror しており、テストは実 WS を起こさない
 * stub を渡せる。
 */
export type YjsProviderLike = {
  on: (event: 'status', handler: (event: { status: ConnectionStatus }) => void) => void;
  off: (event: 'status', handler: (event: { status: ConnectionStatus }) => void) => void;
  destroy: () => void;
};

export type YjsAnnotationsContext = Readonly<{
  doc: Y.Doc;
  yAnnotations: Y.Map<Y.Map<unknown>>;
  provider: YjsProviderLike;
  undoManager: Y.UndoManager;
  snapshot: () => ReadonlyArray<Annotation>;
  subscribe: (cb: () => void) => () => void;
  applyDataAction: (action: AnnotationsAction) => void;
  reset: () => void;
  destroy: () => void;
}>;

export type ProviderFactory = (doc: Y.Doc) => YjsProviderLike;

export const createYjsAnnotationsContext = (
  providerFactory: ProviderFactory,
): YjsAnnotationsContext => {
  const doc = new Y.Doc();
  const yAnnotations = doc.getMap<Y.Map<unknown>>('annotations');
  const provider = providerFactory(doc);
  const undoManager = new Y.UndoManager(yAnnotations, {
    trackedOrigins: new Set([LOCAL_ORIGIN]),
    captureTimeout: 500,
  });

  let snapshotCache: ReadonlyArray<Annotation> = buildAnnotationsSnapshot(yAnnotations);

  const subscribe = (cb: () => void) => {
    const handler = () => {
      snapshotCache = buildAnnotationsSnapshot(yAnnotations);
      cb();
    };
    yAnnotations.observeDeep(handler);
    return () => {
      yAnnotations.unobserveDeep(handler);
    };
  };

  const applyDataAction = (action: AnnotationsAction): void => {
    switch (action.type) {
      case 'tool/set':
      case 'select/set':
      case 'active-color/set':
      case 'active-font-size/set':
        // UI-only state — Yjs には流さない。
        return;
      case 'annotation/add':
        addAnnotationY(doc, yAnnotations, action.annotation);
        return;
      case 'annotation/remove':
        removeAnnotationY(doc, yAnnotations, action.id);
        return;
      case 'annotation/move':
        moveAnnotationY(doc, yAnnotations, action.id, action.dx, action.dy);
        return;
      case 'annotation/resize-rect':
        resizeRectangleY(
          doc,
          yAnnotations,
          action.id,
          action.x,
          action.y,
          action.width,
          action.height,
        );
        return;
      case 'annotation/resize-highlight':
        resizeHighlightY(
          doc,
          yAnnotations,
          action.id,
          action.x,
          action.y,
          action.width,
          action.height,
        );
        return;
      case 'annotation/set-arrow-endpoints':
        setArrowEndpointsY(doc, yAnnotations, action.id, action.from, action.to);
        return;
      case 'annotation/set-text':
        setTextY(doc, yAnnotations, action.id, action.text);
        return;
      case 'annotation/set-color':
        setAnnotationColorY(doc, yAnnotations, action.id, action.color);
        return;
      case 'annotation/set-font-size':
        setTextFontSizeY(doc, yAnnotations, action.id, action.fontSize);
        return;
      case 'annotation/reorder':
        reorderAnnotationY(doc, yAnnotations, action.id, action.direction);
        return;
      default: {
        // 網羅性チェック — `never` で compile-time、throw で runtime にも露出させる。
        // `as` cast をすり抜けた variant がここに到達したら即落ちる構造。
        const _exhaustive: never = action;
        throw new Error(
          `unknown annotations action: ${(_exhaustive as { type?: string }).type ?? '<unknown>'}`,
        );
      }
    }
  };

  return {
    doc,
    yAnnotations,
    provider,
    undoManager,
    snapshot: () => snapshotCache,
    subscribe,
    applyDataAction,
    reset: () => {
      clearAllY(doc, yAnnotations);
    },
    destroy: () => {
      undoManager.destroy();
      provider.destroy();
      doc.destroy();
    },
  };
};
