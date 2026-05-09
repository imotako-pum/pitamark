import type { Annotation } from '@pitamark/shared';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { yMapToAnnotation } from '../yjs-codec';
import {
  addAnnotationY,
  clearAllY,
  LOCAL_ORIGIN,
  moveAnnotationY,
  removeAnnotationY,
  reorderAnnotationY,
  resizeHighlightY,
  resizeRectangleY,
  setAnnotationColorY,
  setArrowEndpointsY,
  setTextFontSizeY,
  setTextY,
} from '../yjs-mutations';

const setupDoc = () => {
  const doc = new Y.Doc();
  const ya = doc.getMap<Y.Map<unknown>>('annotations');
  return { doc, ya };
};

const rect = (id: string, createdAt = 1): Annotation => ({
  id,
  type: 'rectangle',
  createdAt,
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  color: '#5b6dff',
  strokeWidth: 2,
});

const arr = (id: string, createdAt = 1): Annotation => ({
  id,
  type: 'arrow',
  createdAt,
  from: { x: 0, y: 0 },
  to: { x: 100, y: 100 },
  color: '#e74c3c',
  strokeWidth: 3,
});

const txt = (id: string, createdAt = 1): Annotation => ({
  id,
  type: 'text',
  createdAt,
  x: 1,
  y: 2,
  text: 'a',
  fontSize: 16,
  color: '#000000',
});

const hi = (id: string, createdAt = 1): Annotation => ({
  id,
  type: 'highlight',
  createdAt,
  x: 5,
  y: 5,
  width: 30,
  height: 40,
  color: '#ffeb3b',
});

describe('addAnnotationY', () => {
  it('inserts an annotation under its id', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    expect(ya.size).toBe(1);
    expect(yMapToAnnotation(ya.get('r1') as Y.Map<unknown>)).toEqual(rect('r1'));
  });
});

describe('removeAnnotationY', () => {
  it('removes the entry by id', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    removeAnnotationY(doc, ya, 'r1');
    expect(ya.size).toBe(0);
  });

  it('is a no-op when the id is unknown', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    removeAnnotationY(doc, ya, 'does-not-exist');
    expect(ya.size).toBe(1);
  });
});

describe('moveAnnotationY', () => {
  it('shifts rectangle x/y by dx/dy', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    moveAnnotationY(doc, ya, 'r1', 5, 7);
    expect(yMapToAnnotation(ya.get('r1') as Y.Map<unknown>)).toMatchObject({
      x: 15,
      y: 27,
    });
  });

  it('shifts both arrow endpoints by dx/dy', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, arr('a1'));
    moveAnnotationY(doc, ya, 'a1', 10, -5);
    expect(yMapToAnnotation(ya.get('a1') as Y.Map<unknown>)).toMatchObject({
      from: { x: 10, y: -5 },
      to: { x: 110, y: 95 },
    });
  });

  it('is a no-op when id is unknown', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    moveAnnotationY(doc, ya, 'does-not-exist', 100, 100);
    expect(yMapToAnnotation(ya.get('r1') as Y.Map<unknown>)).toEqual(rect('r1'));
  });
});

describe('resizeRectangleY / resizeHighlightY', () => {
  it('resizes (x/y/width/height) only when the target type matches', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    addAnnotationY(doc, ya, hi('h1'));

    resizeRectangleY(doc, ya, 'r1', 30, 40, 200, 80);
    resizeRectangleY(doc, ya, 'h1', 0, 0, 999, 999);
    resizeHighlightY(doc, ya, 'h1', 12, 14, 60, 70);
    resizeHighlightY(doc, ya, 'r1', 0, 0, 999, 999);

    expect(yMapToAnnotation(ya.get('r1') as Y.Map<unknown>)).toMatchObject({
      x: 30,
      y: 40,
      width: 200,
      height: 80,
    });
    expect(yMapToAnnotation(ya.get('h1') as Y.Map<unknown>)).toMatchObject({
      x: 12,
      y: 14,
      width: 60,
      height: 70,
    });
  });
});

describe('setArrowEndpointsY', () => {
  it('updates from/to for an arrow', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, arr('a1'));
    setArrowEndpointsY(doc, ya, 'a1', { x: 1, y: 2 }, { x: 3, y: 4 });
    expect(yMapToAnnotation(ya.get('a1') as Y.Map<unknown>)).toMatchObject({
      from: { x: 1, y: 2 },
      to: { x: 3, y: 4 },
    });
  });

  it('is a no-op for non-arrow targets', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    setArrowEndpointsY(doc, ya, 'r1', { x: 1, y: 2 }, { x: 3, y: 4 });
    expect(yMapToAnnotation(ya.get('r1') as Y.Map<unknown>)).toEqual(rect('r1'));
  });
});

describe('setTextY', () => {
  it('updates text on a text annotation', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, txt('t1'));
    setTextY(doc, ya, 't1', 'こんにちは');
    expect(yMapToAnnotation(ya.get('t1') as Y.Map<unknown>)).toMatchObject({
      text: 'こんにちは',
    });
  });

  it('is a no-op for non-text targets', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    setTextY(doc, ya, 'r1', 'should-not-apply');
    expect(yMapToAnnotation(ya.get('r1') as Y.Map<unknown>)).toEqual(rect('r1'));
  });
});

describe('setTextFontSizeY', () => {
  it('updates fontSize on a text annotation', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, txt('t1'));
    setTextFontSizeY(doc, ya, 't1', 24);
    expect(yMapToAnnotation(ya.get('t1') as Y.Map<unknown>)).toMatchObject({ fontSize: 24 });
  });

  it('is a no-op for non-text targets', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    setTextFontSizeY(doc, ya, 'r1', 24);
    expect(yMapToAnnotation(ya.get('r1') as Y.Map<unknown>)).toEqual(rect('r1'));
  });

  it('is a no-op for unknown id', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, txt('t1'));
    setTextFontSizeY(doc, ya, 'does-not-exist', 24);
    expect(yMapToAnnotation(ya.get('t1') as Y.Map<unknown>)).toMatchObject({ fontSize: 16 });
  });
});

describe('setAnnotationColorY', () => {
  it('sets color on rectangle / arrow / text / highlight regardless of type', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    addAnnotationY(doc, ya, arr('a1'));
    addAnnotationY(doc, ya, txt('t1'));
    addAnnotationY(doc, ya, hi('h1'));

    setAnnotationColorY(doc, ya, 'r1', '#abcdef');
    setAnnotationColorY(doc, ya, 'a1', '#abcdef');
    setAnnotationColorY(doc, ya, 't1', '#abcdef');
    setAnnotationColorY(doc, ya, 'h1', '#abcdef');

    expect(yMapToAnnotation(ya.get('r1') as Y.Map<unknown>)).toMatchObject({ color: '#abcdef' });
    expect(yMapToAnnotation(ya.get('a1') as Y.Map<unknown>)).toMatchObject({ color: '#abcdef' });
    expect(yMapToAnnotation(ya.get('t1') as Y.Map<unknown>)).toMatchObject({ color: '#abcdef' });
    expect(yMapToAnnotation(ya.get('h1') as Y.Map<unknown>)).toMatchObject({ color: '#abcdef' });
  });

  it('is a no-op for unknown id', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    setAnnotationColorY(doc, ya, 'does-not-exist', '#abcdef');
    expect(yMapToAnnotation(ya.get('r1') as Y.Map<unknown>)).toMatchObject({ color: '#5b6dff' });
  });
});

describe('clearAllY', () => {
  it('removes every entry', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1'));
    addAnnotationY(doc, ya, arr('a1'));
    clearAllY(doc, ya);
    expect(ya.size).toBe(0);
  });
});

describe('reorderAnnotationY', () => {
  // Phase 10.J-2: createdAt 経由の z-order 更新 (案 B、Open Question Q1)。
  // schema 拡張なし、yjs-codec の sort が render order key として使う。

  it('front: 中央 r2 を最前面 (createdAt = max + 1)', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1', 1));
    addAnnotationY(doc, ya, rect('r2', 2));
    addAnnotationY(doc, ya, rect('r3', 3));

    reorderAnnotationY(doc, ya, 'r2', 'front');

    const r2 = ya.get('r2');
    expect(r2?.get('createdAt')).toBe(4);
  });

  it('back: 中央 r2 を最背面 (createdAt = min - 1)', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1', 1));
    addAnnotationY(doc, ya, rect('r2', 2));
    addAnnotationY(doc, ya, rect('r3', 3));

    reorderAnnotationY(doc, ya, 'r2', 'back');

    const r2 = ya.get('r2');
    expect(r2?.get('createdAt')).toBe(0);
  });

  it('既に最前面 (max) の id で front は no-op (createdAt 不変)', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1', 1));
    addAnnotationY(doc, ya, rect('r2', 2));
    addAnnotationY(doc, ya, rect('r3', 3));

    reorderAnnotationY(doc, ya, 'r3', 'front');

    expect(ya.get('r3')?.get('createdAt')).toBe(3);
  });

  it('未知 id では何も起きない', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1', 1));

    expect(() => reorderAnnotationY(doc, ya, 'zzz', 'front')).not.toThrow();
    expect(ya.get('r1')?.get('createdAt')).toBe(1);
  });

  it('1 件のみでは no-op (前後無いため reorder 無意味)', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1', 5));

    reorderAnnotationY(doc, ya, 'r1', 'front');

    expect(ya.get('r1')?.get('createdAt')).toBe(5);
  });

  it('LOCAL_ORIGIN で wrap される (UndoManager が追跡可能)', () => {
    const { doc, ya } = setupDoc();
    addAnnotationY(doc, ya, rect('r1', 1));
    addAnnotationY(doc, ya, rect('r2', 2));
    const undo = new Y.UndoManager(ya, {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: 0,
    });

    reorderAnnotationY(doc, ya, 'r1', 'front');

    expect(undo.undoStack.length).toBeGreaterThan(0);
  });
});

describe('UndoManager origin tracking', () => {
  it('tracks LOCAL_ORIGIN transactions and undoes the most recent op', () => {
    const { doc, ya } = setupDoc();
    const undo = new Y.UndoManager(ya, {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: 0,
    });

    addAnnotationY(doc, ya, rect('r1'));
    expect(undo.undoStack.length).toBeGreaterThan(0);

    undo.undo();
    expect(ya.size).toBe(0);
  });

  it('does not track transactions whose origin is not LOCAL_ORIGIN', () => {
    const { doc, ya } = setupDoc();
    const undo = new Y.UndoManager(ya, {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: 0,
    });

    doc.transact(() => {
      ya.set('remote', new Y.Map<unknown>());
    });

    expect(undo.undoStack.length).toBe(0);
  });
});
