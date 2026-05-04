import type {
  Annotation,
  ArrowAnnotation,
  HighlightAnnotation,
  RectangleAnnotation,
  TextAnnotation,
} from '@snap-share/shared';
import { describe, expect, it } from 'vitest';
import {
  addAnnotation,
  moveAnnotation,
  removeAnnotation,
  resizeHighlight,
  resizeRectangle,
  setArrowEndpoints,
  setColor,
  setFontSize,
  setText,
} from '../operations';

const rect: RectangleAnnotation = {
  id: 'r1',
  type: 'rectangle',
  createdAt: 1,
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  color: '#5b6dff',
  strokeWidth: 2,
};

const arrow: ArrowAnnotation = {
  id: 'a1',
  type: 'arrow',
  createdAt: 2,
  from: { x: 0, y: 0 },
  to: { x: 50, y: 50 },
  color: '#ff5544',
  strokeWidth: 2,
};

const text: TextAnnotation = {
  id: 't1',
  type: 'text',
  createdAt: 3,
  x: 5,
  y: 5,
  text: 'hello',
  fontSize: 16,
  color: '#202020',
};

const highlight: HighlightAnnotation = {
  id: 'h1',
  type: 'highlight',
  createdAt: 4,
  x: 0,
  y: 0,
  width: 80,
  height: 30,
  color: '#f5d142',
};

describe('addAnnotation', () => {
  it('appends to the end and returns a new array', () => {
    const before: ReadonlyArray<Annotation> = [rect];
    const next = addAnnotation(before, arrow);

    expect(next).toEqual([rect, arrow]);
    expect(next).not.toBe(before);
  });

  it('does not mutate the input array', () => {
    const before: ReadonlyArray<Annotation> = [rect];
    const snapshot = [...before];
    addAnnotation(before, arrow);

    expect(before).toEqual(snapshot);
  });

  it('appends into an empty list', () => {
    const next = addAnnotation([], rect);
    expect(next).toEqual([rect]);
  });
});

describe('removeAnnotation', () => {
  it('filters out the matching id', () => {
    const before: ReadonlyArray<Annotation> = [rect, arrow];
    const next = removeAnnotation(before, 'r1');

    expect(next).toEqual([arrow]);
    expect(next).not.toBe(before);
  });

  it('is a no-op for unknown id but still returns a new array', () => {
    const before: ReadonlyArray<Annotation> = [rect];
    const next = removeAnnotation(before, 'zzz');

    expect(next).toEqual([rect]);
    expect(next).not.toBe(before);
  });

  it('handles empty list', () => {
    expect(removeAnnotation([], 'r1')).toEqual([]);
  });
});

describe('moveAnnotation', () => {
  it('shifts a rectangle by dx/dy', () => {
    const next = moveAnnotation([rect], 'r1', 5, 7);
    const moved = next[0] as RectangleAnnotation;

    expect(moved.x).toBe(15);
    expect(moved.y).toBe(27);
  });

  it('shifts both endpoints of an arrow', () => {
    const next = moveAnnotation([arrow], 'a1', 10, -10);
    const moved = next[0] as ArrowAnnotation;

    expect(moved.from).toEqual({ x: 10, y: -10 });
    expect(moved.to).toEqual({ x: 60, y: 40 });
  });

  it('shifts a text annotation', () => {
    const next = moveAnnotation([text], 't1', 1, 2);
    const moved = next[0] as TextAnnotation;

    expect(moved.x).toBe(6);
    expect(moved.y).toBe(7);
  });

  it('shifts a highlight annotation', () => {
    const next = moveAnnotation([highlight], 'h1', 3, 4);
    const moved = next[0] as HighlightAnnotation;

    expect(moved.x).toBe(3);
    expect(moved.y).toBe(4);
  });

  it('is a no-op for unknown id', () => {
    const next = moveAnnotation([rect], 'zzz', 5, 5);
    expect(next[0]).toBe(rect);
  });
});

describe('resizeRectangle', () => {
  it('updates x/y/width/height only when target type is rectangle', () => {
    const before: ReadonlyArray<Annotation> = [rect, arrow];
    const next = resizeRectangle(before, 'r1', 30, 40, 200, 150);
    const updated = next[0] as RectangleAnnotation;

    expect(updated.x).toBe(30);
    expect(updated.y).toBe(40);
    expect(updated.width).toBe(200);
    expect(updated.height).toBe(150);
    expect(next[1]).toBe(arrow);
  });

  it('is a no-op when id matches a non-rectangle annotation', () => {
    const next = resizeRectangle([arrow], 'a1', 0, 0, 200, 150);
    expect(next[0]).toBe(arrow);
  });

  it('is a no-op for unknown id', () => {
    const next = resizeRectangle([rect], 'zzz', 0, 0, 1, 1);
    expect(next[0]).toBe(rect);
  });
});

describe('resizeHighlight', () => {
  it('updates x/y/width/height only when target type is highlight', () => {
    const next = resizeHighlight([highlight], 'h1', 7, 8, 300, 60);
    const updated = next[0] as HighlightAnnotation;

    expect(updated.x).toBe(7);
    expect(updated.y).toBe(8);
    expect(updated.width).toBe(300);
    expect(updated.height).toBe(60);
  });

  it('is a no-op when id matches a non-highlight annotation', () => {
    const next = resizeHighlight([rect], 'r1', 0, 0, 1, 1);
    expect(next[0]).toBe(rect);
  });

  it('is a no-op for unknown id', () => {
    const next = resizeHighlight([highlight], 'zzz', 0, 0, 1, 1);
    expect(next[0]).toBe(highlight);
  });
});

describe('setArrowEndpoints', () => {
  it('replaces from/to on an arrow annotation', () => {
    const next = setArrowEndpoints([arrow], 'a1', { x: 1, y: 1 }, { x: 9, y: 9 });
    const updated = next[0] as ArrowAnnotation;

    expect(updated.from).toEqual({ x: 1, y: 1 });
    expect(updated.to).toEqual({ x: 9, y: 9 });
  });

  it('is a no-op when id matches a non-arrow annotation', () => {
    const next = setArrowEndpoints([rect], 'r1', { x: 1, y: 1 }, { x: 9, y: 9 });
    expect(next[0]).toBe(rect);
  });

  it('is a no-op for unknown id', () => {
    const next = setArrowEndpoints([arrow], 'zzz', { x: 1, y: 1 }, { x: 9, y: 9 });
    expect(next[0]).toBe(arrow);
  });
});

describe('setText', () => {
  it('updates the text on a text annotation', () => {
    const next = setText([text], 't1', 'hi');
    const updated = next[0] as TextAnnotation;

    expect(updated.text).toBe('hi');
  });

  it('allows empty string (caller decides whether to remove)', () => {
    const next = setText([text], 't1', '');
    const updated = next[0] as TextAnnotation;

    expect(updated.text).toBe('');
  });

  it('is a no-op when id matches a non-text annotation', () => {
    const next = setText([rect], 'r1', 'hello');
    expect(next[0]).toBe(rect);
  });
});

describe('setFontSize', () => {
  it('updates fontSize on a text annotation', () => {
    const next = setFontSize([text], 't1', 24);
    expect((next[0] as TextAnnotation).fontSize).toBe(24);
  });

  it('is a no-op when id matches a non-text annotation', () => {
    const next = setFontSize([rect], 'r1', 24);
    expect(next[0]).toBe(rect);
  });

  it('is a no-op for unknown id', () => {
    const next = setFontSize([text], 'zzz', 24);
    expect(next[0]).toBe(text);
  });
});

describe('setColor', () => {
  it('updates color on a rectangle', () => {
    const next = setColor([rect], 'r1', '#abcdef');
    expect((next[0] as RectangleAnnotation).color).toBe('#abcdef');
  });

  it('updates color on an arrow', () => {
    const next = setColor([arrow], 'a1', '#abcdef');
    expect((next[0] as ArrowAnnotation).color).toBe('#abcdef');
  });

  it('updates color on a text annotation', () => {
    const next = setColor([text], 't1', '#abcdef');
    expect((next[0] as TextAnnotation).color).toBe('#abcdef');
  });

  it('updates color on a highlight annotation', () => {
    const next = setColor([highlight], 'h1', '#abcdef');
    expect((next[0] as HighlightAnnotation).color).toBe('#abcdef');
  });

  it('is a no-op for unknown id', () => {
    const next = setColor([rect, arrow], 'zzz', '#abcdef');
    expect(next[0]).toBe(rect);
    expect(next[1]).toBe(arrow);
  });
});
