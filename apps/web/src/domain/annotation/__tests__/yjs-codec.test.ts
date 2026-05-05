import type { Annotation } from '@pitamark/shared';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { annotationToYMap, buildAnnotationsSnapshot, yMapToAnnotation } from '../yjs-codec';

const rectangle = (id: string, createdAt = 1): Annotation => ({
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

const arrow = (id: string, createdAt = 1): Annotation => ({
  id,
  type: 'arrow',
  createdAt,
  from: { x: 0, y: 0 },
  to: { x: 200, y: 100 },
  color: '#e74c3c',
  strokeWidth: 3,
});

const text = (id: string, createdAt = 1): Annotation => ({
  id,
  type: 'text',
  createdAt,
  x: 5,
  y: 5,
  text: 'こんにちは',
  fontSize: 16,
  color: '#000000',
});

const highlight = (id: string, createdAt = 1): Annotation => ({
  id,
  type: 'highlight',
  createdAt,
  x: 1,
  y: 2,
  width: 30,
  height: 40,
  color: '#ffeb3b',
});

// Yjs requires Y.Map values to be integrated into a Y.Doc before reads work.
// Tests use this helper so the round-trip mirrors the real call site
// (`yAnnotations.set(id, annotationToYMap(a))` inside a useYjsAnnotationsStore
// reducer).
const attach = (a: Annotation): { ya: Y.Map<Y.Map<unknown>>; entry: Y.Map<unknown> } => {
  const doc = new Y.Doc();
  const ya = doc.getMap<Y.Map<unknown>>('annotations');
  const entry = annotationToYMap(a);
  ya.set(a.id, entry);
  return { ya, entry };
};

describe('annotationToYMap / yMapToAnnotation', () => {
  it('rectangle round-trips losslessly', () => {
    const a = rectangle('r1');
    const { entry } = attach(a);
    expect(yMapToAnnotation(entry)).toEqual(a);
  });

  it('arrow encodes endpoints as flat 4 fields and decodes back to nested points', () => {
    const a = arrow('a1');
    const { entry } = attach(a);

    expect(entry.get('fromX')).toBe(0);
    expect(entry.get('fromY')).toBe(0);
    expect(entry.get('toX')).toBe(200);
    expect(entry.get('toY')).toBe(100);
    expect(yMapToAnnotation(entry)).toEqual(a);
  });

  it('text round-trips Japanese content', () => {
    const a = text('t1');
    const { entry } = attach(a);
    expect(yMapToAnnotation(entry)).toEqual(a);
  });

  it('highlight round-trips losslessly', () => {
    const a = highlight('h1');
    const { entry } = attach(a);
    expect(yMapToAnnotation(entry)).toEqual(a);
  });

  it('returns null when the Y.Map is missing the type discriminator', () => {
    const doc = new Y.Doc();
    const ya = doc.getMap<Y.Map<unknown>>('annotations');
    const m = new Y.Map<unknown>();
    ya.set('orphan', m);
    m.set('id', 'x');
    m.set('createdAt', 1);
    expect(yMapToAnnotation(m)).toBeNull();
  });

  it('returns null when fields fail Zod validation (invalid color)', () => {
    const a = rectangle('r2');
    const { entry } = attach(a);
    entry.set('color', 'not-a-color');
    expect(yMapToAnnotation(entry)).toBeNull();
  });

  it('returns null for an unknown discriminator value', () => {
    const doc = new Y.Doc();
    const ya = doc.getMap<Y.Map<unknown>>('annotations');
    const m = new Y.Map<unknown>();
    ya.set('weird', m);
    m.set('id', 'x');
    m.set('createdAt', 1);
    m.set('type', 'circle');
    expect(yMapToAnnotation(m)).toBeNull();
  });
});

describe('buildAnnotationsSnapshot', () => {
  it('returns annotations sorted by createdAt ascending and skips invalid entries', () => {
    const doc = new Y.Doc();
    const ya = doc.getMap<Y.Map<unknown>>('annotations');
    ya.set('r1', annotationToYMap(rectangle('r1', 30)));
    ya.set('r2', annotationToYMap(rectangle('r2', 10)));
    ya.set('r3', annotationToYMap(rectangle('r3', 20)));
    const broken = new Y.Map<unknown>();
    broken.set('id', 'broken');
    ya.set('broken', broken);

    const snapshot = buildAnnotationsSnapshot(ya);

    expect(snapshot.map((a) => a.id)).toEqual(['r2', 'r3', 'r1']);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('returns a frozen snapshot deeply equal across repeated invocations on the same Y.Doc state', () => {
    const doc = new Y.Doc();
    const ya = doc.getMap<Y.Map<unknown>>('annotations');
    ya.set('r1', annotationToYMap(rectangle('r1')));

    const first = buildAnnotationsSnapshot(ya);
    const second = buildAnnotationsSnapshot(ya);

    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);
  });
});
