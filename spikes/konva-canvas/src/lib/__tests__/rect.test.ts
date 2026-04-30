import { describe, it, expect } from 'vitest';
import type { Rect } from '../rect';
import { addRect, moveRect, removeRect } from '../rect';

const r1: Rect = { id: 'a', x: 0, y: 0, w: 10, h: 10 };
const r2: Rect = { id: 'b', x: 5, y: 5, w: 10, h: 10 };

describe('addRect', () => {
  it('returns a new array containing the appended rect', () => {
    const rects: ReadonlyArray<Rect> = [];
    const next = addRect(rects, r1);
    expect(next).toEqual([r1]);
    expect(next).not.toBe(rects);
  });

  it('does not mutate the input array', () => {
    const rects: ReadonlyArray<Rect> = [r1];
    const before = [...rects];
    addRect(rects, r2);
    expect(rects).toEqual(before);
  });
});

describe('moveRect', () => {
  it('updates target rect by delta and keeps others by reference', () => {
    const rects: ReadonlyArray<Rect> = [r1, r2];
    const next = moveRect(rects, 'a', 5, 7);
    expect(next[0]).toEqual({ ...r1, x: 5, y: 7 });
    expect(next[1]).toBe(r2);
    expect(next).not.toBe(rects);
  });

  it('is a no-op when id is unknown but still returns a new array shape', () => {
    const rects: ReadonlyArray<Rect> = [r1];
    const next = moveRect(rects, 'zzz', 1, 1);
    expect(next).toEqual([r1]);
  });
});

describe('removeRect', () => {
  it('filters out the target rect', () => {
    const rects: ReadonlyArray<Rect> = [r1, r2];
    const next = removeRect(rects, 'a');
    expect(next).toEqual([r2]);
    expect(next).not.toBe(rects);
  });

  it('is a no-op when id is unknown', () => {
    const rects: ReadonlyArray<Rect> = [r1];
    const next = removeRect(rects, 'zzz');
    expect(next).toEqual([r1]);
  });
});
