import type { Annotation, Point } from '@snap-share/shared';
import type * as Y from 'yjs';
import { annotationToYMap } from './yjs-codec';

// LOCAL_ORIGIN is the symbol passed as the second argument to every local
// `doc.transact(...)` call. A UndoManager configured with
// `trackedOrigins: new Set([LOCAL_ORIGIN])` then tracks ONLY local mutations
// — remote merges (origin null) are skipped, so undo never strips peers' work.
// Identity-sensitive: callers must import this exact symbol, not re-create it.
export const LOCAL_ORIGIN = Symbol('snap-share/local');

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
  width: number,
  height: number,
): void => {
  const m = ya.get(id);
  if (!m || m.get('type') !== 'rectangle') return;
  tx(doc, () => {
    m.set('width', width);
    m.set('height', height);
  });
};

export const resizeHighlightY = (
  doc: Y.Doc,
  ya: YAnnotations,
  id: string,
  width: number,
  height: number,
): void => {
  const m = ya.get(id);
  if (!m || m.get('type') !== 'highlight') return;
  tx(doc, () => {
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

export const clearAllY = (doc: Y.Doc, ya: YAnnotations): void => {
  tx(doc, () => {
    ya.clear();
  });
};
