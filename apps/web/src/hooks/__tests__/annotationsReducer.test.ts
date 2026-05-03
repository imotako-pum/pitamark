import type { Annotation, RectangleAnnotation } from '@snap-share/shared';
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

describe('annotationsReducer.default-color/set-sync', () => {
  it('updates state.defaultColors.sync without touching highlight', () => {
    const next = annotationsReducer(initialAnnotationsState, {
      type: 'default-color/set-sync',
      color: '#3a86ff',
    });

    expect(next.defaultColors.sync).toBe('#3a86ff');
    expect(next.defaultColors.highlight).toBe(initialAnnotationsState.defaultColors.highlight);
  });
});

describe('annotationsReducer.default-color/set-highlight', () => {
  it('updates state.defaultColors.highlight without touching sync', () => {
    const next = annotationsReducer(initialAnnotationsState, {
      type: 'default-color/set-highlight',
      color: '#ff8c42',
    });

    expect(next.defaultColors.highlight).toBe('#ff8c42');
    expect(next.defaultColors.sync).toBe(initialAnnotationsState.defaultColors.sync);
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

describe('isCommittingAction', () => {
  it('treats annotation/set-color as a committing action (Undo target)', () => {
    expect(isCommittingAction({ type: 'annotation/set-color', id: 'r1', color: '#abcdef' })).toBe(
      true,
    );
  });

  it('treats default-color/* as UI-only (not committed)', () => {
    expect(isCommittingAction({ type: 'default-color/set-sync', color: '#abcdef' })).toBe(false);
    expect(isCommittingAction({ type: 'default-color/set-highlight', color: '#abcdef' })).toBe(
      false,
    );
  });
});
