import type { Annotation, RectangleAnnotation, TextAnnotation } from '@pitamark/shared';
import { describe, expect, it } from 'vitest';
import {
  type AnnotationsState,
  annotationsReducer,
  initialAnnotationsState,
  isCommittingAction,
} from '../annotationsReducer';

const rect: RectangleAnnotation = {
  id: 'r1',
  type: 'rectangle',
  createdAt: 1,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  color: '#5b6dff',
  strokeWidth: 2,
};

const text: TextAnnotation = {
  id: 't1',
  type: 'text',
  createdAt: 2,
  x: 0,
  y: 0,
  text: 'hello',
  fontSize: 18,
  color: '#202020',
};

const seedWith = (annotations: ReadonlyArray<Annotation>): AnnotationsState => ({
  ...initialAnnotationsState,
  annotations,
});

describe('annotationsReducer.tool/set', () => {
  it('switches the active tool', () => {
    const next = annotationsReducer(initialAnnotationsState, {
      type: 'tool/set',
      tool: 'rectangle',
    });

    expect(next.tool).toBe('rectangle');
  });

  it('preserves selection and annotations when changing tools', () => {
    const seeded: AnnotationsState = { ...seedWith([rect]), selectedId: 'r1' };
    const next = annotationsReducer(seeded, { type: 'tool/set', tool: 'arrow' });

    expect(next.selectedId).toBe('r1');
    expect(next.annotations).toBe(seeded.annotations);
  });
});

describe('annotationsReducer.select/set', () => {
  it('sets the selectedId to a new value', () => {
    const next = annotationsReducer(seedWith([rect]), {
      type: 'select/set',
      id: 'r1',
    });

    expect(next.selectedId).toBe('r1');
  });

  it('clears selection when id is null', () => {
    const seeded: AnnotationsState = { ...seedWith([rect]), selectedId: 'r1' };
    const next = annotationsReducer(seeded, { type: 'select/set', id: null });

    expect(next.selectedId).toBeNull();
  });
});

describe('annotationsReducer.annotation/add', () => {
  it('appends the annotation', () => {
    const next = annotationsReducer(initialAnnotationsState, {
      type: 'annotation/add',
      annotation: rect,
    });

    expect(next.annotations).toEqual([rect]);
  });
});

describe('annotationsReducer.annotation/remove', () => {
  it('drops the annotation by id and clears selection if it was selected', () => {
    const seeded: AnnotationsState = { ...seedWith([rect]), selectedId: 'r1' };
    const next = annotationsReducer(seeded, { type: 'annotation/remove', id: 'r1' });

    expect(next.annotations).toEqual([]);
    expect(next.selectedId).toBeNull();
  });

  it('keeps selection if a different annotation is removed', () => {
    const r2: RectangleAnnotation = { ...rect, id: 'r2' };
    const seeded: AnnotationsState = {
      ...seedWith([rect, r2]),
      selectedId: 'r1',
    };
    const next = annotationsReducer(seeded, { type: 'annotation/remove', id: 'r2' });

    expect(next.selectedId).toBe('r1');
    expect(next.annotations).toEqual([rect]);
  });
});

describe('annotationsReducer.annotation/move', () => {
  it('shifts the matching annotation', () => {
    const next = annotationsReducer(seedWith([rect]), {
      type: 'annotation/move',
      id: 'r1',
      dx: 5,
      dy: 7,
    });

    expect((next.annotations[0] as RectangleAnnotation).x).toBe(5);
    expect((next.annotations[0] as RectangleAnnotation).y).toBe(7);
  });
});

describe('annotationsReducer.annotation/resize-rect', () => {
  it('updates x/y/width/height of a rectangle', () => {
    const next = annotationsReducer(seedWith([rect]), {
      type: 'annotation/resize-rect',
      id: 'r1',
      x: 12,
      y: 18,
      width: 100,
      height: 50,
    });

    expect((next.annotations[0] as RectangleAnnotation).x).toBe(12);
    expect((next.annotations[0] as RectangleAnnotation).y).toBe(18);
    expect((next.annotations[0] as RectangleAnnotation).width).toBe(100);
    expect((next.annotations[0] as RectangleAnnotation).height).toBe(50);
  });
});

describe('annotationsReducer.annotation/set-text', () => {
  it('is a no-op for non-text annotations', () => {
    const next = annotationsReducer(seedWith([rect]), {
      type: 'annotation/set-text',
      id: 'r1',
      text: 'hello',
    });

    expect(next.annotations[0]).toBe(rect);
  });
});

describe('annotationsReducer.annotation/set-arrow-endpoints', () => {
  it('is a no-op for non-arrow annotations', () => {
    const next = annotationsReducer(seedWith([rect]), {
      type: 'annotation/set-arrow-endpoints',
      id: 'r1',
      from: { x: 1, y: 1 },
      to: { x: 9, y: 9 },
    });

    expect(next.annotations[0]).toBe(rect);
  });
});

describe('annotationsReducer.active-color/set', () => {
  it('updates state.activeColor', () => {
    const next = annotationsReducer(initialAnnotationsState, {
      type: 'active-color/set',
      color: '#3a86ff',
    });

    expect(next.activeColor).toBe('#3a86ff');
  });

  it('does not touch annotations or selection', () => {
    const seeded: AnnotationsState = { ...seedWith([rect]), selectedId: 'r1' };
    const next = annotationsReducer(seeded, {
      type: 'active-color/set',
      color: '#3a86ff',
    });

    expect(next.annotations).toBe(seeded.annotations);
    expect(next.selectedId).toBe('r1');
  });
});

describe('annotationsReducer.annotation/set-color', () => {
  it('updates color of the matching annotation', () => {
    const next = annotationsReducer(seedWith([rect]), {
      type: 'annotation/set-color',
      id: 'r1',
      color: '#abcdef',
    });

    expect((next.annotations[0] as RectangleAnnotation).color).toBe('#abcdef');
  });

  it('is a no-op for unknown id', () => {
    const seeded = seedWith([rect]);
    const next = annotationsReducer(seeded, {
      type: 'annotation/set-color',
      id: 'zzz',
      color: '#abcdef',
    });

    expect(next.annotations[0]).toBe(rect);
  });
});

describe('annotationsReducer.active-font-size/set', () => {
  it('updates state.activeFontSize', () => {
    const next = annotationsReducer(initialAnnotationsState, {
      type: 'active-font-size/set',
      fontSize: 24,
    });

    expect(next.activeFontSize).toBe(24);
  });

  it('does not touch annotations or selection', () => {
    const seeded: AnnotationsState = { ...seedWith([rect]), selectedId: 'r1' };
    const next = annotationsReducer(seeded, {
      type: 'active-font-size/set',
      fontSize: 24,
    });

    expect(next.annotations).toBe(seeded.annotations);
    expect(next.selectedId).toBe('r1');
  });
});

describe('annotationsReducer.annotation/set-font-size', () => {
  it('updates fontSize of the matching text annotation', () => {
    const next = annotationsReducer(seedWith([text]), {
      type: 'annotation/set-font-size',
      id: 't1',
      fontSize: 24,
    });

    expect((next.annotations[0] as TextAnnotation).fontSize).toBe(24);
  });

  it('is a no-op for non-text annotations', () => {
    const seeded = seedWith([rect]);
    const next = annotationsReducer(seeded, {
      type: 'annotation/set-font-size',
      id: 'r1',
      fontSize: 24,
    });

    expect(next.annotations[0]).toBe(rect);
  });

  // no-op 時に annotations 配列の identity が保たれることを検証 (上位 historyReducer が
  // 空 undo step を積まない最終 safety net)。handler 側の gating は別途検証済で、
  // ここは reducer layer の非 text target に対する保証を担う。
  it('preserves annotations array identity when no-op on non-text id', () => {
    const seeded = seedWith([rect]);
    const next = annotationsReducer(seeded, {
      type: 'annotation/set-font-size',
      id: 'r1',
      fontSize: 24,
    });

    expect(next.annotations).toBe(seeded.annotations);
  });

  it('preserves annotations array identity when no-op on unknown id', () => {
    const seeded = seedWith([text]);
    const next = annotationsReducer(seeded, {
      type: 'annotation/set-font-size',
      id: 'zzz',
      fontSize: 24,
    });

    expect(next.annotations).toBe(seeded.annotations);
  });

  it('is a no-op for unknown id', () => {
    const seeded = seedWith([text]);
    const next = annotationsReducer(seeded, {
      type: 'annotation/set-font-size',
      id: 'zzz',
      fontSize: 24,
    });

    expect(next.annotations[0]).toBe(text);
  });
});

describe('annotationsReducer.annotation/reorder', () => {
  // Phase 10.J-2: 長押し menu の前面/背面項目で発火。createdAt を更新して
  // yjs-codec の sort 順 (= render z-order) を変える。
  const r1: RectangleAnnotation = { ...rect, id: 'r1', createdAt: 1 };
  const r2: RectangleAnnotation = { ...rect, id: 'r2', createdAt: 2 };
  const r3: RectangleAnnotation = { ...rect, id: 'r3', createdAt: 3 };

  it('front: 中央 r2 を最前面 (createdAt = max + 1 = 4)', () => {
    const state = seedWith([r1, r2, r3]);
    const next = annotationsReducer(state, {
      type: 'annotation/reorder',
      id: 'r2',
      direction: 'front',
    });
    const target = next.annotations.find((a) => a.id === 'r2');
    expect(target?.createdAt).toBe(4);
  });

  it('back: 中央 r2 を最背面 (createdAt = min - 1 = 0)', () => {
    const state = seedWith([r1, r2, r3]);
    const next = annotationsReducer(state, {
      type: 'annotation/reorder',
      id: 'r2',
      direction: 'back',
    });
    const target = next.annotations.find((a) => a.id === 'r2');
    expect(target?.createdAt).toBe(0);
  });

  it('既に最前面の r3 で front は state 同一参照 (空 undo step 抑止)', () => {
    const state = seedWith([r1, r2, r3]);
    const next = annotationsReducer(state, {
      type: 'annotation/reorder',
      id: 'r3',
      direction: 'front',
    });
    expect(next).toBe(state);
  });

  it('未知 id では state 同一参照', () => {
    const state = seedWith([r1, r2, r3]);
    const next = annotationsReducer(state, {
      type: 'annotation/reorder',
      id: 'zzz',
      direction: 'back',
    });
    expect(next).toBe(state);
  });
});

describe('isCommittingAction', () => {
  it('treats annotation/set-color as a committing action (Undo target)', () => {
    expect(isCommittingAction({ type: 'annotation/set-color', id: 'r1', color: '#abcdef' })).toBe(
      true,
    );
  });

  it('treats active-color/set as UI-only (not committed)', () => {
    expect(isCommittingAction({ type: 'active-color/set', color: '#abcdef' })).toBe(false);
  });

  it('treats annotation/set-font-size as a committing action (Undo target)', () => {
    expect(isCommittingAction({ type: 'annotation/set-font-size', id: 't1', fontSize: 24 })).toBe(
      true,
    );
  });

  it('treats active-font-size/set as UI-only (not committed)', () => {
    expect(isCommittingAction({ type: 'active-font-size/set', fontSize: 24 })).toBe(false);
  });

  it('treats annotation/reorder as a committing action (Undo target)', () => {
    expect(isCommittingAction({ type: 'annotation/reorder', id: 'r1', direction: 'front' })).toBe(
      true,
    );
  });
});
