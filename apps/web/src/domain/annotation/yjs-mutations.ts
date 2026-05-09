import type { Annotation, Point } from '@pitamark/shared';
import type * as Y from 'yjs';
import { annotationToYMap } from './yjs-codec';

// LOCAL_ORIGIN is the symbol passed as the second argument to every local
// `doc.transact(...)` call. A UndoManager configured with
// `trackedOrigins: new Set([LOCAL_ORIGIN])` then tracks ONLY local mutations
// — remote merges (origin null) are skipped, so undo never strips peers' work.
// Identity-sensitive: callers must import this exact symbol, not re-create it.
export const LOCAL_ORIGIN = Symbol('pitamark/local');

type YAnnotations = Y.Map<Y.Map<unknown>>;

const tx = (doc: Y.Doc, fn: () => void): void => {
  doc.transact(fn, LOCAL_ORIGIN);
};

export const addAnnotationY = (doc: Y.Doc, ya: YAnnotations, annotation: Annotation): void => {
  tx(doc, () => {
    ya.set(annotation.id, annotationToYMap(annotation));
  });
};

export const removeAnnotationY = (doc: Y.Doc, ya: YAnnotations, id: string): void => {
  if (!ya.has(id)) return;
  tx(doc, () => {
    ya.delete(id);
  });
};

export const moveAnnotationY = (
  doc: Y.Doc,
  ya: YAnnotations,
  id: string,
  dx: number,
  dy: number,
): void => {
  const m = ya.get(id);
  if (!m) return;
  const type = m.get('type');
  tx(doc, () => {
    if (type === 'arrow') {
      m.set('fromX', (m.get('fromX') as number) + dx);
      m.set('fromY', (m.get('fromY') as number) + dy);
      m.set('toX', (m.get('toX') as number) + dx);
      m.set('toY', (m.get('toY') as number) + dy);
    } else {
      m.set('x', (m.get('x') as number) + dx);
      m.set('y', (m.get('y') as number) + dy);
    }
  });
};

export const resizeRectangleY = (
  doc: Y.Doc,
  ya: YAnnotations,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  const m = ya.get(id);
  if (!m || m.get('type') !== 'rectangle') return;
  tx(doc, () => {
    m.set('x', x);
    m.set('y', y);
    m.set('width', width);
    m.set('height', height);
  });
};

export const resizeHighlightY = (
  doc: Y.Doc,
  ya: YAnnotations,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  const m = ya.get(id);
  if (!m || m.get('type') !== 'highlight') return;
  tx(doc, () => {
    m.set('x', x);
    m.set('y', y);
    m.set('width', width);
    m.set('height', height);
  });
};

export const setArrowEndpointsY = (
  doc: Y.Doc,
  ya: YAnnotations,
  id: string,
  from: Point,
  to: Point,
): void => {
  const m = ya.get(id);
  if (!m || m.get('type') !== 'arrow') return;
  tx(doc, () => {
    m.set('fromX', from.x);
    m.set('fromY', from.y);
    m.set('toX', to.x);
    m.set('toY', to.y);
  });
};

export const setTextY = (doc: Y.Doc, ya: YAnnotations, id: string, text: string): void => {
  const m = ya.get(id);
  if (!m || m.get('type') !== 'text') return;
  tx(doc, () => {
    m.set('text', text);
  });
};

// text 専用 — fontSize は TextAnnotation のみ持つフィールド。type guard なしに
// 走らせると非 text の Y.Map に fontSize を載せてしまい、Schema parse 不整合の
// 元になる。setTextY と同様 m.get('type') !== 'text' で no-op。
export const setTextFontSizeY = (
  doc: Y.Doc,
  ya: YAnnotations,
  id: string,
  fontSize: number,
): void => {
  const m = ya.get(id);
  if (!m || m.get('type') !== 'text') return;
  tx(doc, () => {
    m.set('fontSize', fontSize);
  });
};

// All four annotation types share the same `color` field, so this mutation
// is type-agnostic. We still no-op on missing id to mirror the other helpers.
export const setAnnotationColorY = (
  doc: Y.Doc,
  ya: YAnnotations,
  id: string,
  color: string,
): void => {
  const m = ya.get(id);
  if (!m) return;
  tx(doc, () => {
    m.set('color', color);
  });
};

export const clearAllY = (doc: Y.Doc, ya: YAnnotations): void => {
  tx(doc, () => {
    ya.clear();
  });
};

// Phase 10.J-2: 長押し menu の「前面へ」「背面へ」から発火される z-order 変更。
// 案 B (Open Question Q1): 既存 `createdAt` を render order key として再利用 (yjs-codec
// の sort が既に createdAt 昇順)。schema 拡張なし、Yjs 互換維持、Y.Array refactor 回避。
// front = max + 1、back = min - 1 で他 annotation を動かさない最小操作。1 件以下では no-op。
export const reorderAnnotationY = (
  doc: Y.Doc,
  ya: YAnnotations,
  id: string,
  direction: 'front' | 'back',
): void => {
  const target = ya.get(id);
  if (!target) return;
  const all = Array.from(ya.values());
  if (all.length <= 1) return;
  const targetCreatedAt = target.get('createdAt') as number;
  if (direction === 'front') {
    const maxCreatedAt = all.reduce((m, n) => {
      const v = n.get('createdAt') as number;
      return v > m ? v : m;
    }, Number.NEGATIVE_INFINITY);
    if (targetCreatedAt >= maxCreatedAt) return;
    tx(doc, () => {
      target.set('createdAt', maxCreatedAt + 1);
    });
    return;
  }
  const minCreatedAt = all.reduce((m, n) => {
    const v = n.get('createdAt') as number;
    return v < m ? v : m;
  }, Number.POSITIVE_INFINITY);
  if (targetCreatedAt <= minCreatedAt) return;
  tx(doc, () => {
    target.set('createdAt', minCreatedAt - 1);
  });
};
