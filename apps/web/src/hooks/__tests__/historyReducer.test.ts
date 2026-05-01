import { describe, expect, it } from 'vitest';
import {
  createHistoryState,
  HISTORY_LIMIT,
  type HistoryState,
  historyReducer,
} from '../historyReducer';

type V = number;

describe('historyReducer.commit', () => {
  it('moves the current present to past and replaces present with next', () => {
    const state = createHistoryState<V>(1);
    const next = historyReducer(state, { type: 'commit', value: 2 });

    expect(next.present).toBe(2);
    expect(next.past).toEqual([1]);
    expect(next.future).toEqual([]);
  });

  it('is a no-op when next === present (reference equality)', () => {
    const obj = { x: 1 };
    const state = createHistoryState(obj);
    const next = historyReducer(state, { type: 'commit', value: obj });

    expect(next).toBe(state);
  });

  it('clears the future when committing after a redo-eligible state', () => {
    const seeded: HistoryState<V> = {
      past: [1],
      present: 2,
      future: [3, 4],
    };
    const next = historyReducer(seeded, { type: 'commit', value: 5 });

    expect(next.present).toBe(5);
    expect(next.future).toEqual([]);
    expect(next.past).toEqual([1, 2]);
  });

  it('drops the oldest entry when past exceeds HISTORY_LIMIT', () => {
    const past = Array.from({ length: HISTORY_LIMIT }, (_, i) => i);
    const seeded: HistoryState<V> = {
      past,
      present: HISTORY_LIMIT,
      future: [],
    };

    const next = historyReducer(seeded, { type: 'commit', value: HISTORY_LIMIT + 1 });

    expect(next.past.length).toBe(HISTORY_LIMIT);
    expect(next.past[0]).toBe(1);
    expect(next.past[next.past.length - 1]).toBe(HISTORY_LIMIT);
    expect(next.present).toBe(HISTORY_LIMIT + 1);
  });
});

describe('historyReducer.replace', () => {
  it('replaces present without touching past/future', () => {
    const seeded: HistoryState<V> = { past: [1], present: 2, future: [3] };
    const next = historyReducer(seeded, { type: 'replace', value: 99 });

    expect(next.present).toBe(99);
    expect(next.past).toBe(seeded.past);
    expect(next.future).toBe(seeded.future);
  });
});

describe('historyReducer.undo', () => {
  it('moves the last past entry into present and pushes the old present onto future', () => {
    const seeded: HistoryState<V> = { past: [1, 2], present: 3, future: [] };
    const next = historyReducer(seeded, { type: 'undo' });

    expect(next.past).toEqual([1]);
    expect(next.present).toBe(2);
    expect(next.future).toEqual([3]);
  });

  it('is a no-op when past is empty', () => {
    const seeded: HistoryState<V> = { past: [], present: 1, future: [2] };
    const next = historyReducer(seeded, { type: 'undo' });

    expect(next).toBe(seeded);
  });
});

describe('historyReducer.redo', () => {
  it('pulls the first future entry into present and pushes the old present onto past', () => {
    const seeded: HistoryState<V> = { past: [1], present: 2, future: [3, 4] };
    const next = historyReducer(seeded, { type: 'redo' });

    expect(next.past).toEqual([1, 2]);
    expect(next.present).toBe(3);
    expect(next.future).toEqual([4]);
  });

  it('is a no-op when future is empty', () => {
    const seeded: HistoryState<V> = { past: [1], present: 2, future: [] };
    const next = historyReducer(seeded, { type: 'redo' });

    expect(next).toBe(seeded);
  });
});

describe('historyReducer.reset', () => {
  it('clears past/future and replaces present with the given value', () => {
    const seeded: HistoryState<V> = { past: [1, 2], present: 3, future: [4, 5] };
    const next = historyReducer(seeded, { type: 'reset', value: 100 });

    expect(next).toEqual({ past: [], present: 100, future: [] });
  });
});
